"use client";

import React, { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
const MapFitBounds = dynamic(
  () => import("./MapFitBounds"),
  { ssr: false }
);

export interface TouristLocation {
  id: string;
  name: string;
  location: [number, number];
  orderCode?: string;
  status?: "upcoming" | "in-progress" | "completed";
  dateFrom?: string;
  dateTo?: string;
  completedAt?: string;
  destination?: string;
}

interface TouristsMapProps {
  locations: TouristLocation[];
  showAgentOnly?: boolean;
  className?: string;
}

interface CityGroup {
  key: string;
  city: string;
  location: [number, number];
  travelers: TouristLocation[];
  hasInProgress: boolean;
  allInProgress: boolean;
}

function circleSvg(color: string, count: number): string {
  const size = count < 10 ? 36 : count < 100 ? 42 : 48;
  const r = size / 2;
  if (count <= 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="white" stroke-width="2"/><circle cx="${r}" cy="${r * 0.7}" r="${r * 0.22}" fill="white"/><ellipse cx="${r}" cy="${r * 1.2}" rx="${r * 0.32}" ry="${r * 0.22}" fill="white"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="white" stroke-width="2"/><text x="${r}" y="${r + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="white">${count}</text></svg>`;
}

function createCityIcon(group: CityGroup) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");
  const color = group.allInProgress ? "#10b981" : group.hasInProgress ? "#0d9488" : "#3b82f6";
  const count = group.travelers.length;
  const size = count < 10 ? 36 : count < 100 ? 42 : 48;
  return L.divIcon({
    html: circleSvg(color, count),
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function TouristsMap({
  locations,
  showAgentOnly = false,
  className = "",
}: TouristsMapProps) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, []);

  const activeLocations = locations.filter(
    (loc) => loc.status === "upcoming" || loc.status === "in-progress"
  );

  const cityGroups = useMemo(() => {
    const map = new Map<string, CityGroup>();
    for (const loc of activeLocations) {
      const key = `${loc.location[0].toFixed(2)},${loc.location[1].toFixed(2)}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          city: loc.destination || "Unknown",
          location: loc.location,
          travelers: [],
          hasInProgress: false,
          allInProgress: true,
        });
      }
      const g = map.get(key)!;
      g.travelers.push(loc);
      if (loc.status === "in-progress") g.hasInProgress = true;
      if (loc.status !== "in-progress") g.allInProgress = false;
    }
    for (const g of map.values()) {
      g.travelers.sort((a, b) => (a.dateFrom || "").localeCompare(b.dateFrom || ""));
    }
    return Array.from(map.values());
  }, [activeLocations]);

  const icons = useMemo(() => {
    if (typeof window === "undefined") return new Map<string, unknown>();
    const m = new Map<string, unknown>();
    for (const g of cityGroups) {
      m.set(g.key, createCityIcon(g));
    }
    return m;
  }, [cityGroups]);

  if (!activeLocations || activeLocations.length === 0) {
    return (
      <div className={`booking-glass-panel !p-6 ${className}`}>
        <h3 className="mb-6 text-xl font-bold text-gray-900 tracking-tight">
          {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
        </h3>
        <div className="flex h-96 items-center justify-center text-gray-500">
          No active travelers currently
        </div>
      </div>
    );
  }

  const boundsArr = cityGroups.map((g) => g.location);
  const avgLat = boundsArr.reduce((s, l) => s + l[0], 0) / boundsArr.length;
  const avgLng = boundsArr.reduce((s, l) => s + l[1], 0) / boundsArr.length;

  return (
    <div className={`booking-glass-panel !p-6 ${className}`}>
      <h3 className="mb-6 text-xl font-bold text-gray-900 tracking-tight">
        {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
      </h3>
      <div className="h-96 w-full overflow-hidden rounded-xl border border-black/5 shadow-inner">
        <MapContainer center={[avgLat, avgLng]} zoom={4} style={{ height: "100%", width: "100%" }} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapFitBounds bounds={boundsArr} />
          {cityGroups.map((group) => (
            <Marker
              key={group.key}
              position={group.location}
              icon={icons.get(group.key) as never}
            >
              <Popup maxWidth={320} minWidth={200}>
                <div className="text-sm">
                  <p className="font-bold text-gray-900 text-sm mb-2">
                    {group.city}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {group.travelers.length} {group.travelers.length === 1 ? "traveler" : "travelers"}
                    </span>
                  </p>
                  <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                    {group.travelers.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          t.status === "in-progress" ? "bg-emerald-500" : "bg-blue-500"
                        }`} />
                        <span className="text-xs text-gray-500 shrink-0 w-[60px]">
                          {t.dateFrom ? formatDateDDMMYYYY(t.dateFrom).slice(0, 5) : "—"}
                        </span>
                        <a
                          href={`/orders/${(t.orderCode || "").replace("/", "-").toLowerCase()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-900 font-medium truncate hover:text-blue-600"
                        >
                          {t.name}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-600">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-600">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-teal-600" />
          <span className="text-xs text-gray-600">Mixed</span>
        </div>
      </div>
    </div>
  );
}
