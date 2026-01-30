"use client";

import React, { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { CityWithCountry } from "@/components/CityMultiSelect";
import { getCityByName, countryCodeToFlag } from "@/lib/data/cities";

// Dynamic import for Leaflet to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

// Route for a single traveller (or group with same route)
interface TravellerRoute {
  travellerId: string;
  travellerName: string;
  color: string;
  destinations: CityWithCountry[];
}

interface TripMapProps {
  destinations: CityWithCountry[];
  // Multiple routes for different travellers (optional)
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
  { latMin: 44, latMax: 53, lngMin: 22, lngMax: 41 },   // Ukraine
  { latMin: 41, latMax: 82, lngMin: 19, lngMax: 180 },  // Russia (incl. Kaliningrad)
  { latMin: 51, latMax: 57, lngMin: 23, lngMax: 33 },   // Belarus
];

function pointInAvoidZone(lat: number, lng: number): boolean {
  return AVOID_ZONES.some(z => lat >= z.latMin && lat <= z.latMax && lng >= z.lngMin && lng <= z.lngMax);
}

// Check if path from start to end crosses avoid zone (sample points along line)
function pathCrossesAvoidZone(start: [number, number], end: [number, number], samples: number = 30): boolean {
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lat = start[0] + t * (end[0] - start[0]);
    const lng = start[1] + t * (end[1] - start[1]);
    if (pointInAvoidZone(lat, lng)) return true;
  }
  return false;
}

// Bypass corridor: lng 17 - west of Ukraine (lng 22+)
const BYPASS_LNG = 17;

// Check if a curve (array of points) crosses avoid zone
function curveCrossesAvoidZone(points: [number, number][]): boolean {
  for (const p of points) {
    if (pointInAvoidZone(p[0], p[1])) return true;
  }
  return false;
}

// Generate a curved line between two points (quadratic bezier)
// controlPoint: if provided, used as bezier control; otherwise computed (perpendicular offset)
function generateCurvedPath(
  start: [number, number],
  end: [number, number],
  segments: number = 50,
  controlPoint?: [number, number]
): [number, number][] | null {
  // Validate coordinates
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
    // Default: perpendicular offset for subtle curve
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
  
  // Quadratic bezier: B(t) = (1-t)²·start + 2(1-t)t·control + t²·end
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

// Generate path - curved always; bypass curve when crossing Ukraine/Russia/Belarus
// Use direction-independent control point (midLat, BYPASS_LNG) so Latvia↔Turkey look the same
function generatePathWithBypass(start: [number, number], end: [number, number]): [number, number][][] {
  // If path doesn't cross avoid zone → default curved line (subtle bezier)
  if (!pathCrossesAvoidZone(start, end)) {
    const path = generateCurvedPath(start, end);
    return path ? [path] : [];
  }
  // Same corridor for both directions: control at path midpoint lat, fixed lng west of zone
  const midLat = (start[0] + end[0]) / 2;
  const ctrl: [number, number] = [midLat, BYPASS_LNG];
  let path = generateCurvedPath(start, end, 50, ctrl);
  if (path && !curveCrossesAvoidZone(path)) return [path];
  // Fallback: try more westward
  for (const lng of [15, 14, 12]) {
    path = generateCurvedPath(start, end, 50, [midLat, lng]);
    if (path && !curveCrossesAvoidZone(path)) return [path];
  }
  path = generateCurvedPath(start, end);
  return path ? [path] : [];
}

export default function TripMap({
  destinations,
  travellerRoutes,
  dateFrom,
  dateTo,
  amountToPay = 0,
  amountPaid = 0,
  currency = "€",
  className = "",
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = React.useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get coordinates for all destinations (single route fallback)
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
          return {
            name: dest.city,
            country: dest.country,
            countryCode: dest.countryCode,
            lat: lat,
            lng: lng,
          };
        }
        
        return null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [destinations]);

  // Calculate map center and bounds
  const mapCenter = useMemo<[number, number]>(() => {
    if (destinationCoords.length === 0) {
      return [48.8566, 2.3522]; // Default to Paris
    }
    const avgLat =
      destinationCoords.reduce((sum, d) => sum + d.lat, 0) /
      destinationCoords.length;
    const avgLng =
      destinationCoords.reduce((sum, d) => sum + d.lng, 0) /
      destinationCoords.length;
    return [avgLat, avgLng];
  }, [destinationCoords]);

  // Generate curved paths between destinations (bypass Ukraine, Russia, Belarus)
  const paths = useMemo(() => {
    if (destinationCoords.length < 2) return [];
    const result: [number, number][][] = [];
    for (let i = 0; i < destinationCoords.length - 1; i++) {
      const startLat = destinationCoords[i].lat;
      const startLng = destinationCoords[i].lng;
      const endLat = destinationCoords[i + 1].lat;
      const endLng = destinationCoords[i + 1].lng;
      
      if (!isFinite(startLat) || !isFinite(startLng) || !isFinite(endLat) || !isFinite(endLng)) {
        continue;
      }
      
      const start: [number, number] = [startLat, startLng];
      const end: [number, number] = [endLat, endLng];
      const pathSegments = generatePathWithBypass(start, end);
      result.push(...pathSegments);
    }
    return result;
  }, [destinationCoords]);

  // Generate paths for multiple traveller routes (with different colors)
  const travellerPaths = useMemo(() => {
    if (!travellerRoutes || travellerRoutes.length === 0) return [];
    
    return travellerRoutes.map(route => {
      // Get coordinates for this traveller's destinations
      const coords = route.destinations
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
            return { ...dest, lat, lng };
          }
          return null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);
      
      // Generate curved paths (bypass Ukraine, Russia, Belarus)
      const paths: [number, number][][] = [];
      for (let i = 0; i < coords.length - 1; i++) {
        const start: [number, number] = [coords[i].lat, coords[i].lng];
        const end: [number, number] = [coords[i + 1].lat, coords[i + 1].lng];
        const pathSegments = generatePathWithBypass(start, end);
        paths.push(...pathSegments);
      }
      
      return {
        ...route,
        coords,
        paths,
      };
    });
  }, [travellerRoutes]);

  // Get all unique coordinates from all routes for map bounds
  const allCoords = useMemo(() => {
    if (travellerPaths.length > 0) {
      const coords: { lat: number; lng: number; name: string; countryCode?: string; country?: string }[] = [];
      const seen = new Set<string>();
      for (const route of travellerPaths) {
        for (const c of route.coords) {
          const key = `${c.lat},${c.lng}`;
          if (!seen.has(key)) {
            seen.add(key);
            coords.push({ lat: c.lat, lng: c.lng, name: c.city, countryCode: c.countryCode, country: c.country });
          }
        }
      }
      return coords;
    }
    return destinationCoords;
  }, [travellerPaths, destinationCoords]);

  // Recalculate map center based on all coords
  const multiRouteCenter = useMemo<[number, number]>(() => {
    if (allCoords.length === 0) {
      return [48.8566, 2.3522]; // Default to Paris
    }
    const avgLat = allCoords.reduce((sum, d) => sum + d.lat, 0) / allCoords.length;
    const avgLng = allCoords.reduce((sum, d) => sum + d.lng, 0) / allCoords.length;
    return [avgLat, avgLng];
  }, [allCoords]);

  // Compact mode when height is small (embedded in Client section)
  const isCompact = className?.includes("h-32") || className?.includes("h-24");

  if (!isClient) {
    return (
      <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} style={{ height: isCompact ? "100%" : 200 }}>
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  // Determine if we should show multiple routes
  const hasMultipleRoutes = travellerPaths.length > 0;
  const effectiveCenter = hasMultipleRoutes ? multiRouteCenter : mapCenter;
  const effectiveCoords = hasMultipleRoutes ? allCoords : destinationCoords;

  // Compact version - just the map, no headers
  if (isCompact) {
    return (
      <div className={`${className}`} style={{ height: "100%" }}>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        {destinationCoords.length > 0 ? (
          <MapContainer
            center={mapCenter}
            zoom={destinationCoords.length === 1 ? 5 : 3}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {paths.map((path, idx) => {
              // Validate path coordinates before rendering
              const isValidPath = path.every(
                (point) => isFinite(point[0]) && isFinite(point[1])
              );
              if (!isValidPath) return null;
              
              return (
                <Polyline
                  key={idx}
                  positions={path}
                  pathOptions={{ color: "#3b82f6", weight: 2, dashArray: "6, 6", opacity: 0.7 }}
                />
              );
            })}
            {destinationCoords.map((dest, idx) => (
              <Marker key={`${dest.name}-${dest.countryCode || ''}-${idx}`} position={[dest.lat, dest.lng]}>
                <Popup>
                  <div className="text-center">
                    <div>{countryCodeToFlag(dest.countryCode || "")}</div>
                    <div className="font-medium text-sm">{dest.name}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            No destinations
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${className} relative`}>
      {/* Map only - full height */}
      {effectiveCoords.length > 0 && (
        <div
          ref={mapRef}
          className="rounded-lg overflow-hidden"
          style={{ height: "100%" }}
        >
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossOrigin=""
          />
          <MapContainer
            center={effectiveCenter}
            zoom={effectiveCoords.length === 1 ? 6 : 4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Multiple traveller routes with different colors */}
            {hasMultipleRoutes ? (
              <>
                {travellerPaths.map((route) => (
                  <React.Fragment key={route.travellerId}>
                    {route.paths.map((path, pathIdx) => {
                      const isValidPath = path.every(
                        (point) => isFinite(point[0]) && isFinite(point[1])
                      );
                      if (!isValidPath) return null;
                      
                      return (
                        <Polyline
                          key={`${route.travellerId}-${pathIdx}`}
                          positions={path}
                          pathOptions={{
                            color: route.color,
                            weight: 3,
                            dashArray: "8, 8",
                            opacity: 0.8,
                          }}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </>
            ) : (
              /* Single route fallback */
              paths.map((path, idx) => {
                const isValidPath = path.every(
                  (point) => isFinite(point[0]) && isFinite(point[1])
                );
                if (!isValidPath) return null;
                
                return (
                  <Polyline
                    key={idx}
                    positions={path}
                    pathOptions={{
                      color: "#3b82f6",
                      weight: 2,
                      dashArray: "8, 8",
                      opacity: 0.7,
                    }}
                  />
                );
              })
            )}
            
            {/* Markers for each destination */}
            {effectiveCoords.map((dest, idx) => (
              <Marker key={`${dest.name}-${dest.countryCode || ''}-${idx}`} position={[dest.lat, dest.lng]}>
                <Popup>
                  <div className="text-center">
                    <div className="text-lg">{countryCodeToFlag(dest.countryCode || "")}</div>
                    <div className="font-medium">{dest.name}</div>
                    <div className="text-xs text-gray-500">{dest.country}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Legend for routes */}
      {hasMultipleRoutes && !isCompact && (
        <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg shadow-lg p-2 text-xs z-10">
          {travellerPaths.map(route => (
            <div key={route.travellerId} className="flex items-center gap-2 py-0.5">
              <div 
                className="w-4 h-0.5 rounded" 
                style={{ backgroundColor: route.color }}
              />
              <span className="text-gray-700">{route.travellerName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
