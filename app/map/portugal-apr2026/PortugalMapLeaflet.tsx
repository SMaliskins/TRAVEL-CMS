"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
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

// --- Data ---

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: number;
  date: string;
  activities: string[];
}

const DAY_COLORS: Record<number, string> = {
  1: "#6366f1", // indigo — arrival
  2: "#3b82f6", // blue — Belem/Alfama
  3: "#8b5cf6", // purple — Sintra/Cascais
  4: "#06b6d4", // cyan — transfer day
  5: "#f59e0b", // amber — Algarve
  6: "#f59e0b",
  7: "#f59e0b",
  8: "#ef4444", // red — return
};

const DAY_LABELS: Record<number, string> = {
  1: "Day 1 — Apr 3, Thu",
  2: "Day 2 — Apr 4, Fri",
  3: "Day 3 — Apr 5, Sat",
  4: "Day 4 — Apr 6, Sun",
  5: "Days 5-7 — Apr 7-9",
  6: "Days 5-7 — Apr 7-9",
  7: "Days 5-7 — Apr 7-9",
  8: "Day 8 — Apr 10, Thu",
};

const LOCATIONS: Location[] = [
  { id: "lisbon", name: "Lisbon", lat: 38.7223, lng: -9.1393, day: 1, date: "3-6 Apr", activities: ["Baixa & Chiado", "Time Out Market", "Bairro Alto"] },
  { id: "belem", name: "Belem", lat: 38.6966, lng: -9.2060, day: 2, date: "4 Apr", activities: ["Torre de Belem", "Mosteiro dos Jeronimos", "Pasteis de Belem"] },
  { id: "alfama", name: "Alfama", lat: 38.7118, lng: -9.1303, day: 2, date: "4 Apr", activities: ["Tram 28", "Miradouros", "Fado restaurant"] },
  { id: "sintra", name: "Sintra", lat: 38.7873, lng: -9.3908, day: 3, date: "5 Apr", activities: ["Palacio da Pena", "Castelo dos Mouros", "Quinta da Regaleira"] },
  { id: "cascais", name: "Cascais", lat: 38.6979, lng: -9.4215, day: 3, date: "5 Apr", activities: ["Beach town", "Boca do Inferno"] },
  { id: "lagos", name: "Lagos", lat: 37.1028, lng: -8.6731, day: 5, date: "7-9 Apr", activities: ["Praia do Camilo", "Old town", "Seafood restaurants"] },
  { id: "ponta-piedade", name: "Ponta da Piedade", lat: 37.0826, lng: -8.6694, day: 5, date: "7-9 Apr", activities: ["Cliff formations", "Boat tours", "Sunset views"] },
  { id: "marinha", name: "Praia da Marinha", lat: 37.0891, lng: -8.4107, day: 6, date: "7-9 Apr", activities: ["Beach day", "Seven Hanging Valleys trail"] },
  { id: "benagil", name: "Benagil Cave", lat: 37.0877, lng: -8.4268, day: 6, date: "7-9 Apr", activities: ["Boat tour to sea cave", "Kayak option"] },
];

// Route segments: arrays of location ids connected by polylines
const ROUTE_SEGMENTS: { from: string; to: string; day: number }[] = [
  // Day 2: Lisbon → Belem → Alfama
  { from: "lisbon", to: "belem", day: 2 },
  { from: "belem", to: "alfama", day: 2 },
  // Day 3: Lisbon → Sintra → Cascais
  { from: "lisbon", to: "sintra", day: 3 },
  { from: "sintra", to: "cascais", day: 3 },
  // Day 4: Lisbon → Lagos (transfer)
  { from: "lisbon", to: "lagos", day: 4 },
  // Days 5-7: Algarve circuit
  { from: "lagos", to: "ponta-piedade", day: 5 },
  { from: "ponta-piedade", to: "marinha", day: 6 },
  { from: "marinha", to: "benagil", day: 6 },
  // Day 8: Return
  { from: "lagos", to: "lisbon", day: 8 },
];

// --- Helpers ---

function getLocation(id: string): Location {
  return LOCATIONS.find((l) => l.id === id)!;
}

function makeDayIcon(day: number, color: string): L.DivIcon {
  const label = day <= 4 ? day : day <= 7 ? "5+" : "8";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:14px;
      border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
    ">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// --- Component ---

export default function PortugalMapLeaflet() {
  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <MapContainer
        center={[38.5, -8.8]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Route polylines */}
        {ROUTE_SEGMENTS.map((seg, idx) => {
          const from = getLocation(seg.from);
          const to = getLocation(seg.to);
          const color = DAY_COLORS[seg.day] || "#6b7280";
          return (
            <Polyline
              key={idx}
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color,
                weight: 3,
                dashArray: seg.day === 4 || seg.day === 8 ? "10, 8" : "6, 6",
                opacity: 0.8,
              }}
            />
          );
        })}

        {/* Markers */}
        {LOCATIONS.map((loc) => {
          const color = DAY_COLORS[loc.day] || "#6b7280";
          return (
            <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={makeDayIcon(loc.day, color)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{loc.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                    {DAY_LABELS[loc.day]} &middot; {loc.date}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                    {loc.activities.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
