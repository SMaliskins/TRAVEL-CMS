"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export default function MapFitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (bounds.length === 0) return;
    const latLngs = bounds.map(([lat, lng]) => L.latLng(lat, lng));
    const b = L.latLngBounds(latLngs);
    map.fitBounds(b, { padding: [30, 30], maxZoom: 10 });
  }, [bounds, map]);

  return null;
}
