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

interface TripMapProps {
  destinations: CityWithCountry[];
  dateFrom?: string;
  dateTo?: string;
  amountToPay?: number;
  amountPaid?: number;
  currency?: string;
  className?: string;
}

// Calculate days until trip
function getDaysUntilTrip(dateFrom: string | undefined): {
  days: number;
  label: string;
  color: string;
} {
  if (!dateFrom) return { days: 0, label: "No dates set", color: "text-gray-500" };

  const tripDate = new Date(dateFrom);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tripDate.setHours(0, 0, 0, 0);

  const diffTime = tripDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: Math.abs(diffDays), label: `${Math.abs(diffDays)} days ago`, color: "text-gray-500" };
  } else if (diffDays === 0) {
    return { days: 0, label: "Today!", color: "text-green-600" };
  } else if (diffDays === 1) {
    return { days: 1, label: "Tomorrow!", color: "text-orange-500" };
  } else if (diffDays <= 7) {
    return { days: diffDays, label: `${diffDays} days before the trip`, color: "text-orange-500" };
  } else if (diffDays <= 30) {
    return { days: diffDays, label: `${diffDays} days before the trip`, color: "text-blue-600" };
  } else {
    return { days: diffDays, label: `${diffDays} days before the trip`, color: "text-gray-600" };
  }
}

// Generate a curved line between two points
function generateCurvedPath(
  start: [number, number],
  end: [number, number],
  segments: number = 50
): [number, number][] | null {
  // Validate coordinates
  if (!isFinite(start[0]) || !isFinite(start[1]) || !isFinite(end[0]) || !isFinite(end[1])) {
    return null;
  }
  
  const points: [number, number][] = [];
  
  // Calculate control point for curve (perpendicular offset)
  const midLat = (start[0] + end[0]) / 2;
  const midLng = (start[1] + end[1]) / 2;
  
  // Distance between points
  const distance = Math.sqrt(
    Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
  );
  
  // Offset for curve (proportional to distance)
  const offset = distance * 0.15;
  
  // Perpendicular direction
  const dx = end[1] - start[1];
  const dy = end[0] - start[0];
  const len = Math.sqrt(dx * dx + dy * dy);
  
  // Control point
  const controlLat = midLat + (dx / len) * offset;
  const controlLng = midLng - (dy / len) * offset;
  
  // Generate quadratic bezier curve points
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
    points.push([lat, lng]);
  }
  
  return points;
}

export default function TripMap({
  destinations,
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

  // Get coordinates for all destinations
  const destinationCoords = useMemo(() => {
    return destinations
      .map((dest) => {
        // First check if dest has coordinates
        if (dest.lat && dest.lng) {
          return {
            name: dest.city,
            country: dest.country,
            countryCode: dest.countryCode,
            lat: dest.lat,
            lng: dest.lng,
          };
        }
        // Otherwise try to get from database
        const cityData = getCityByName(dest.city);
        if (cityData) {
          return {
            name: cityData.name,
            country: cityData.country,
            countryCode: cityData.countryCode,
            lat: cityData.lat,
            lng: cityData.lng,
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

  // Generate curved paths between destinations
  const paths = useMemo(() => {
    if (destinationCoords.length < 2) return [];
    const result: [number, number][][] = [];
    for (let i = 0; i < destinationCoords.length - 1; i++) {
      // Validate coordinates before creating path
      const startLat = destinationCoords[i].lat;
      const startLng = destinationCoords[i].lng;
      const endLat = destinationCoords[i + 1].lat;
      const endLng = destinationCoords[i + 1].lng;
      
      if (!isFinite(startLat) || !isFinite(startLng) || !isFinite(endLat) || !isFinite(endLng)) {
        continue; // Skip invalid coordinates
      }
      
      const start: [number, number] = [startLat, startLng];
      const end: [number, number] = [endLat, endLng];
      const path = generateCurvedPath(start, end);
      if (path) {
        result.push(path);
      }
    }
    return result;
  }, [destinationCoords]);

  // Trip countdown
  const tripInfo = getDaysUntilTrip(dateFrom);

  // Payment status
  const debt = amountToPay - amountPaid;
  const paymentPercentage = amountToPay > 0 ? (amountPaid / amountToPay) * 100 : 0;

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
            {paths.map((path, idx) => (
              <Polyline
                key={idx}
                positions={path}
                pathOptions={{ color: "#3b82f6", weight: 2, dashArray: "6, 6", opacity: 0.7 }}
              />
            ))}
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
    <div className={`space-y-3 ${className}`}>
      {/* Trip info header - compact */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {destinations.map((dest, idx) => (
              <span key={`${dest.city}-${dest.countryCode || ''}-${idx}`} className="flex items-center text-sm">
                {dest.countryCode && (
                  <span className="mr-1">{countryCodeToFlag(dest.countryCode)}</span>
                )}
                <span className="font-medium">{dest.city}</span>
                {idx < destinations.length - 1 && (
                  <span className="ml-2 text-gray-400">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
        <div className={`text-right ${tripInfo.color}`}>
          <div className="text-lg font-bold">{tripInfo.days > 0 ? tripInfo.days : "—"}</div>
          <div className="text-xs">{tripInfo.label}</div>
        </div>
      </div>

      {/* Map - smaller */}
      {destinationCoords.length > 0 && (
        <div
          ref={mapRef}
          className="rounded-lg overflow-hidden border border-gray-200"
          style={{ height: 150 }}
        >
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossOrigin=""
          />
          <MapContainer
            center={mapCenter}
            zoom={destinationCoords.length === 1 ? 6 : 4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Curved dashed lines between destinations */}
            {paths.map((path, idx) => (
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
            ))}
            
            {/* Markers for each destination */}
            {destinationCoords.map((dest, idx) => (
              <Marker key={`${dest.name}-${dest.countryCode || ''}-${idx}`} position={[dest.lat, dest.lng]}>
                <Popup>
                  <div className="text-center">
                    <div className="text-lg">{countryCodeToFlag(dest.countryCode || "")}</div>
                    <div className="font-medium">{dest.name}</div>
                    <div className="text-xs text-gray-500">{dest.country}</div>
                    {idx === 0 && <div className="text-xs text-blue-600 mt-1">Start</div>}
                    {idx === destinationCoords.length - 1 && idx !== 0 && (
                      <div className="text-xs text-green-600 mt-1">End</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Payment status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Payment Status</span>
          <span className="text-sm text-gray-500">
            {paymentPercentage.toFixed(0)}% paid
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-300 ${
              paymentPercentage >= 100
                ? "bg-green-500"
                : paymentPercentage >= 50
                ? "bg-blue-500"
                : "bg-orange-500"
            }`}
            style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
          />
        </div>
        
        {/* Payment details */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 uppercase">To Pay</div>
            <div className="text-lg font-semibold text-gray-900">
              {currency}{amountToPay.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Paid</div>
            <div className="text-lg font-semibold text-green-600">
              {currency}{amountPaid.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">
              {debt >= 0 ? "Debt" : "Overpaid"}
            </div>
            <div
              className={`text-lg font-semibold ${
                debt > 0 ? "text-red-600" : debt < 0 ? "text-blue-600" : "text-gray-900"
              }`}
            >
              {currency}{Math.abs(debt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
