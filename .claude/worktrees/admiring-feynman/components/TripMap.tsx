"use client";

import React, { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { CityWithCountry } from "@/components/CityMultiSelect";
import { getCityByName, countryCodeToFlag } from "@/lib/data/cities";

// Route for a single traveller (or group with same route)
interface TravellerRoute {
  travellerId: string;
  travellerName: string;
  color: string;
  destinations: CityWithCountry[];
}

interface TripMapProps {
  destinations: CityWithCountry[];
  travellerRoutes?: TravellerRoute[];
  dateFrom?: string;
  dateTo?: string;
  amountToPay?: number;
  amountPaid?: number;
  currency?: string;
  className?: string;
}

// Avoid zones: Ukraine, Russia, Belarus (approx bounding boxes)
const AVOID_ZONES: Array<{ latMin: number; latMax: number; lngMin: number; lngMax: number }> = [
  { latMin: 44, latMax: 53, lngMin: 22, lngMax: 41 },
  { latMin: 41, latMax: 82, lngMin: 19, lngMax: 180 },
  { latMin: 51, latMax: 57, lngMin: 23, lngMax: 33 },
];

function pointInAvoidZone(lat: number, lng: number): boolean {
  return AVOID_ZONES.some(z => lat >= z.latMin && lat <= z.latMax && lng >= z.lngMin && lng <= z.lngMax);
}

function pathCrossesAvoidZone(start: [number, number], end: [number, number], samples: number = 30): boolean {
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lat = start[0] + t * (end[0] - start[0]);
    const lng = start[1] + t * (end[1] - start[1]);
    if (pointInAvoidZone(lat, lng)) return true;
  }
  return false;
}

const BYPASS_LNG = 17;

function curveCrossesAvoidZone(points: [number, number][]): boolean {
  for (const p of points) {
    if (pointInAvoidZone(p[0], p[1])) return true;
  }
  return false;
}

function generateCurvedPath(
  start: [number, number],
  end: [number, number],
  segments: number = 50,
  controlPoint?: [number, number]
): [number, number][] | null {
  if (!isFinite(start[0]) || !isFinite(start[1]) || !isFinite(end[0]) || !isFinite(end[1])) {
    return null;
  }

  const points: [number, number][] = [];
  let controlLat: number;
  let controlLng: number;

  if (controlPoint && isFinite(controlPoint[0]) && isFinite(controlPoint[1])) {
    controlLat = controlPoint[0];
    controlLng = controlPoint[1];
  } else {
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    const distance = Math.sqrt(
      Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
    );
    const offset = distance * 0.15;
    const dx = end[1] - start[1];
    const dy = end[0] - start[0];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return [start, end];
    controlLat = midLat + (dx / len) * offset;
    controlLng = midLng - (dy / len) * offset;
  }

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat =
      Math.pow(1 - t, 2) * start[0] +
      2 * (1 - t) * t * controlLat +
      Math.pow(t, 2) * end[0];
    const lng =
      Math.pow(1 - t, 2) * start[1] +
      2 * (1 - t) * t * controlLng +
      Math.pow(t, 2) * end[1];

    if (isFinite(lat) && isFinite(lng)) {
      points.push([lat, lng]);
    } else {
      return null;
    }
  }

  return points;
}

function generatePathWithBypass(start: [number, number], end: [number, number]): [number, number][][] {
  if (!pathCrossesAvoidZone(start, end)) {
    const path = generateCurvedPath(start, end);
    return path ? [path] : [];
  }
  const midLat = (start[0] + end[0]) / 2;
  const ctrl: [number, number] = [midLat, BYPASS_LNG];
  let path = generateCurvedPath(start, end, 50, ctrl);
  if (path && !curveCrossesAvoidZone(path)) return [path];
  for (const lng of [15, 14, 12]) {
    path = generateCurvedPath(start, end, 50, [midLat, lng]);
    if (path && !curveCrossesAvoidZone(path)) return [path];
  }
  path = generateCurvedPath(start, end);
  return path ? [path] : [];
}

export interface TripMapInternalProps {
  destinationCoords: { name: string; country?: string; countryCode?: string; lat: number; lng: number }[];
  paths: [number, number][][];
  travellerPaths: { travellerId: string; travellerName: string; color: string; coords: { lat: number; lng: number; city: string; country?: string; countryCode?: string }[]; paths: [number, number][][] }[];
  effectiveCenter: [number, number];
  effectiveCoords: { lat: number; lng: number; name: string; countryCode?: string; country?: string }[];
  hasMultipleRoutes: boolean;
  isCompact: boolean;
  mapCenter: [number, number];
}

// Single dynamic import — all react-leaflet components load together, avoiding pane race condition
const TripMapLeaflet = dynamic(
  () => import("@/components/TripMapLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-400 text-sm" style={{ height: 200 }}>
        Loading map...
      </div>
    ),
  }
);

export default function TripMap({
  destinations,
  travellerRoutes,
  className = "",
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const destinationCoords = useMemo(() => {
    return destinations
      .map((dest) => {
        let lat: number | undefined;
        let lng: number | undefined;

        if (dest.lat && dest.lng) {
          lat = dest.lat;
          lng = dest.lng;
        } else {
          const cityData = getCityByName(dest.city);
          if (cityData) {
            lat = cityData.lat;
            lng = cityData.lng;
          }
        }

        if (lat !== undefined && lng !== undefined && isFinite(lat) && isFinite(lng)) {
          return { name: dest.city, country: dest.country, countryCode: dest.countryCode, lat, lng };
        }
        return null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [destinations]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (destinationCoords.length === 0) return [48.8566, 2.3522];
    const avgLat = destinationCoords.reduce((sum, d) => sum + d.lat, 0) / destinationCoords.length;
    const avgLng = destinationCoords.reduce((sum, d) => sum + d.lng, 0) / destinationCoords.length;
    return [avgLat, avgLng];
  }, [destinationCoords]);

  const paths = useMemo(() => {
    if (destinationCoords.length < 2) return [];
    const result: [number, number][][] = [];
    for (let i = 0; i < destinationCoords.length - 1; i++) {
      const s = destinationCoords[i];
      const e = destinationCoords[i + 1];
      if (!isFinite(s.lat) || !isFinite(s.lng) || !isFinite(e.lat) || !isFinite(e.lng)) continue;
      result.push(...generatePathWithBypass([s.lat, s.lng], [e.lat, e.lng]));
    }
    return result;
  }, [destinationCoords]);

  const travellerPaths = useMemo(() => {
    if (!travellerRoutes || travellerRoutes.length === 0) return [];
    return travellerRoutes.map(route => {
      const coords = route.destinations
        .map((dest) => {
          let lat: number | undefined;
          let lng: number | undefined;
          if (dest.lat && dest.lng) { lat = dest.lat; lng = dest.lng; }
          else { const c = getCityByName(dest.city); if (c) { lat = c.lat; lng = c.lng; } }
          if (lat !== undefined && lng !== undefined && isFinite(lat) && isFinite(lng)) return { ...dest, lat, lng };
          return null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      const p: [number, number][][] = [];
      for (let i = 0; i < coords.length - 1; i++) {
        p.push(...generatePathWithBypass([coords[i].lat, coords[i].lng], [coords[i + 1].lat, coords[i + 1].lng]));
      }
      return { ...route, coords, paths: p };
    });
  }, [travellerRoutes]);

  const allCoords = useMemo(() => {
    if (travellerPaths.length > 0) {
      const coords: { lat: number; lng: number; name: string; countryCode?: string; country?: string }[] = [];
      const seen = new Set<string>();
      for (const route of travellerPaths) {
        for (const c of route.coords) {
          const key = `${c.lat},${c.lng}`;
          if (!seen.has(key)) { seen.add(key); coords.push({ lat: c.lat, lng: c.lng, name: c.city, countryCode: c.countryCode, country: c.country }); }
        }
      }
      return coords;
    }
    return destinationCoords;
  }, [travellerPaths, destinationCoords]);

  const multiRouteCenter = useMemo<[number, number]>(() => {
    if (allCoords.length === 0) return [48.8566, 2.3522];
    const avgLat = allCoords.reduce((sum, d) => sum + d.lat, 0) / allCoords.length;
    const avgLng = allCoords.reduce((sum, d) => sum + d.lng, 0) / allCoords.length;
    return [avgLat, avgLng];
  }, [allCoords]);

  const isCompact = className?.includes("h-32") || className?.includes("h-24");

  if (!isClient) {
    return (
      <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} style={{ height: isCompact ? "100%" : 200 }}>
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  const hasMultipleRoutes = travellerPaths.length > 0;
  const effectiveCenter = hasMultipleRoutes ? multiRouteCenter : mapCenter;
  const effectiveCoords = hasMultipleRoutes ? allCoords : destinationCoords;

  return (
    <div className={`${className} relative`} ref={mapRef}>
      <TripMapLeaflet
        destinationCoords={destinationCoords}
        paths={paths}
        travellerPaths={travellerPaths}
        effectiveCenter={effectiveCenter}
        effectiveCoords={effectiveCoords}
        hasMultipleRoutes={hasMultipleRoutes}
        isCompact={isCompact}
        mapCenter={mapCenter}
      />
      {hasMultipleRoutes && !isCompact && (
        <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg shadow-lg p-2 text-xs z-10">
          {travellerPaths.map(route => (
            <div key={route.travellerId} className="flex items-center gap-2 py-0.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: route.color }} />
              <span className="text-gray-700">{route.travellerName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
