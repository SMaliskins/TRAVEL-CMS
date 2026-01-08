"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";

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

export interface TouristLocation {
  id: string;
  name: string;
  location: [number, number]; // [lat, lng]
  orderCode?: string;
  status?: "upcoming" | "in-progress" | "completed";
  completedAt?: string; // ISO date when trip was completed
  destination?: string; // For display in Recently Completed
}

interface TouristsMapProps {
  locations: TouristLocation[];
  showAgentOnly?: boolean;
  className?: string;
}

export default function TouristsMap({
  locations,
  showAgentOnly = false,
  className = "",
}: TouristsMapProps) {
  // Load Leaflet CSS dynamically
  useEffect(() => {
    if (typeof document !== "undefined") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, []);

  // Filter locations - show only upcoming and in-progress on map
  const activeLocations = locations.filter(
    (loc) => loc.status === "upcoming" || loc.status === "in-progress"
  );

  if (!activeLocations || activeLocations.length === 0) {
    return (
      <div className={`rounded-lg bg-white p-6 shadow-sm ${className}`}>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
        </h3>
        <div className="flex h-96 items-center justify-center text-gray-500">
          No active travelers currently
        </div>
      </div>
    );
  }

  // Calculate map center (average of active locations)
  const avgLat =
    activeLocations.reduce((sum, loc) => sum + loc.location[0], 0) / activeLocations.length;
  const avgLng =
    activeLocations.reduce((sum, loc) => sum + loc.location[1], 0) / activeLocations.length;

  const getMarkerColor = (status?: string): string => {
    switch (status) {
      case "upcoming":
        return "#3b82f6"; // blue
      case "in-progress":
        return "#10b981"; // green
      case "completed":
        return "#f97316"; // orange
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <div className={`rounded-lg bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
      </h3>
      <div className="h-96 w-full overflow-hidden rounded-lg">
        <MapContainer
          center={[avgLat, avgLng]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {activeLocations.map((tourist) => (
            <Marker key={tourist.id} position={tourist.location}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{tourist.name}</p>
                  {tourist.orderCode && (
                    <p className="text-gray-600">Order: {tourist.orderCode}</p>
                  )}
                  {tourist.status && (
                    <p className="text-gray-600">Status: {tourist.status}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500"></div>
          <span className="text-xs text-gray-600">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-600">In Progress</span>
        </div>
      </div>
    </div>
  );
}

