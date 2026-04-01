"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { countryCodeToFlag } from "@/lib/data/cities";
import type { TripMapInternalProps } from "./TripMap";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon (Leaflet + webpack issue)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export default function TripMapLeaflet({
  destinationCoords,
  paths,
  travellerPaths,
  effectiveCenter,
  effectiveCoords,
  hasMultipleRoutes,
  isCompact,
  mapCenter,
}: TripMapInternalProps) {
  if (isCompact) {
    return destinationCoords.length > 0 ? (
      <MapContainer
        center={mapCenter}
        zoom={destinationCoords.length === 1 ? 5 : 3}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {paths.map((path, idx) => {
          if (!path.every(p => isFinite(p[0]) && isFinite(p[1]))) return null;
          return (
            <Polyline key={idx} positions={path} pathOptions={{ color: "#3b82f6", weight: 2, dashArray: "6, 6", opacity: 0.7 }} />
          );
        })}
        {destinationCoords.map((dest, idx) => (
          <Marker key={`${dest.name}-${dest.countryCode || ""}-${idx}`} position={[dest.lat, dest.lng]}>
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
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">No destinations</div>
    );
  }

  if (effectiveCoords.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ height: "100%" }}>
      <MapContainer
        center={effectiveCenter}
        zoom={effectiveCoords.length === 1 ? 6 : 4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {hasMultipleRoutes ? (
          <>
            {travellerPaths.map((route) => (
              <React.Fragment key={route.travellerId}>
                {route.paths.map((path, pathIdx) => {
                  if (!path.every(p => isFinite(p[0]) && isFinite(p[1]))) return null;
                  return (
                    <Polyline
                      key={`${route.travellerId}-${pathIdx}`}
                      positions={path}
                      pathOptions={{ color: route.color, weight: 3, dashArray: "8, 8", opacity: 0.8 }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </>
        ) : (
          paths.map((path, idx) => {
            if (!path.every(p => isFinite(p[0]) && isFinite(p[1]))) return null;
            return (
              <Polyline key={idx} positions={path} pathOptions={{ color: "#3b82f6", weight: 2, dashArray: "8, 8", opacity: 0.7 }} />
            );
          })
        )}

        {effectiveCoords.map((dest, idx) => (
          <Marker key={`${dest.name}-${dest.countryCode || ""}-${idx}`} position={[dest.lat, dest.lng]}>
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
  );
}
