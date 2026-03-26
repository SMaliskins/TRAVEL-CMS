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

function pinSvg(color: string, count: number): string {
  if (count <= 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="10" r="4" fill="white"/><ellipse cx="14" cy="19" rx="5.5" ry="4" fill="white"/></svg>`;
  }
  const w = 34;
  const h = 46;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${w / 2} 0C${w * 0.225} 0 0 ${h * 0.157} 0 ${h * 0.35}c0 ${h * 0.26} ${w / 2} ${h * 0.65} ${w / 2} ${h * 0.65}s${w / 2}-${h * 0.39} ${w / 2}-${h * 0.65}C${w} ${h * 0.157} ${w * 0.775} 0 ${w / 2} 0z" fill="${color}"/><circle cx="${w / 2}" cy="${h * 0.33}" r="${w * 0.32}" fill="white"/><text x="${w / 2}" y="${h * 0.37}" text-anchor="middle" font-size="13" font-weight="700" fill="${color}">${count}</text></svg>`;
}

function createCityIcon(group: CityGroup) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");
  const color = group.allInProgress ? "#10b981" : group.hasInProgress ? "#0d9488" : "#3b82f6";
  const count = group.travelers.length;
  const isMulti = count > 1;
  const w = isMulti ? 34 : 28;
  const h = isMulti ? 46 : 40;
  return L.divIcon({
    html: pinSvg(color, count),
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
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
                          href={`/orders/${t.orderCode}`}
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
          <svg width="12" height="17" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#3b82f6"/><circle cx="14" cy="10" r="4" fill="white"/><ellipse cx="14" cy="19" rx="5.5" ry="4" fill="white"/></svg>
          <span className="text-xs text-gray-600">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="12" height="17" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#10b981"/><circle cx="14" cy="10" r="4" fill="white"/><ellipse cx="14" cy="19" rx="5.5" ry="4" fill="white"/></svg>
          <span className="text-xs text-gray-600">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="12" height="17" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#0d9488"/><circle cx="14" cy="10" r="4" fill="white"/><ellipse cx="14" cy="19" rx="5.5" ry="4" fill="white"/></svg>
          <span className="text-xs text-gray-600">Mixed</span>
        </div>
      </div>
    </div>
  );
}
