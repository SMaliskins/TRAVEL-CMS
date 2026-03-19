"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface HotelMapHotel {
  lat: number;
  lng: number;
  name: string;
  price: number;
  currency: string;
  id: string;
}

interface HotelMapInnerProps {
  hotels: HotelMapHotel[];
  onHotelClick: (id: string) => void;
  center?: [number, number];
}

function createPriceIcon(price: number, currency: string) {
  return L.divIcon({
    className: "hotel-price-marker",
    html: `<div style="
      background: white;
      border: 2px solid #6366f1;
      border-radius: 8px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    ">${currency} ${price.toLocaleString()}</div>`,
    iconSize: [80, 28],
    iconAnchor: [40, 28],
  });
}

export default function HotelMapInner({
  hotels,
  onHotelClick,
  center,
}: HotelMapInnerProps) {
  const mapCenter: [number, number] = center ??
    (hotels.length > 0
      ? [hotels[0].lat, hotels[0].lng]
      : [48.8566, 2.3522]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      className="w-full h-full rounded-xl z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hotels.map((h) => (
        <Marker
          key={h.id}
          position={[h.lat, h.lng]}
          icon={createPriceIcon(h.price, h.currency)}
        >
          <Popup>
            <div className="p-1">
              <p className="font-semibold text-sm mb-1">{h.name}</p>
              <p className="text-xs text-slate-600 mb-2">
                {h.currency} {h.price.toLocaleString()}
              </p>
              <button
                onClick={() => onHotelClick(h.id)}
                className="px-3 py-1 text-xs font-medium bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
              >
                View
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
