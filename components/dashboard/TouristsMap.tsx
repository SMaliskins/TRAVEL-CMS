"use client";

import React, { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { formatDateRange } from "@/utils/dateFormat";

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

function pinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="10" r="4" fill="white"/><ellipse cx="14" cy="19" rx="5.5" ry="4" fill="white"/></svg>`;
}

function createPinIcon(status?: string) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");
  const color = status === "in-progress" ? "#10b981" : "#3b82f6";
  return L.divIcon({
    html: pinSvg(color),
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
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

  const icons = useMemo(() => {
    if (typeof window === "undefined") return {};
    return {
      upcoming: createPinIcon("upcoming"),
      "in-progress": createPinIcon("in-progress"),
    };
  }, []);

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

  const boundsArr = activeLocations.map((loc) => loc.location);
  const avgLat = activeLocations.reduce((sum, loc) => sum + loc.location[0], 0) / activeLocations.length;
  const avgLng = activeLocations.reduce((sum, loc) => sum + loc.location[1], 0) / activeLocations.length;

  return (
    <div className={`booking-glass-panel !p-6 ${className}`}>
      <h3 className="mb-6 text-xl font-bold text-gray-900 tracking-tight">
        {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
      </h3>
      <div className="h-96 w-full overflow-hidden rounded-xl border border-black/5 shadow-inner">
        <MapContainer center={[avgLat, avgLng]} zoom={4} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFitBounds bounds={boundsArr} />
          {activeLocations.map((tourist) => (
            <Marker
              key={tourist.id}
              position={tourist.location}
              icon={icons[tourist.status as "upcoming" | "in-progress"] || icons.upcoming}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold text-gray-900 text-[13px]">{tourist.name}</p>
                  {tourist.destination && (
                    <p className="text-gray-500 text-xs">{tourist.destination}</p>
                  )}
                  {(tourist.dateFrom || tourist.dateTo) && (
                    <p className="text-gray-600 text-xs mt-1">
                      {formatDateRange(tourist.dateFrom || "", tourist.dateTo || "", true)}
                    </p>
                  )}
                  {tourist.status && (
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      tourist.status === "in-progress"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {tourist.status === "in-progress" ? "In Progress" : "Upcoming"}
                    </span>
                  )}
                  {tourist.orderCode && (
                    <a
                      href={`/orders/${tourist.orderCode}`}
                      className="block mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {tourist.orderCode} →
                    </a>
                  )}
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
      </div>
    </div>
  );
}
