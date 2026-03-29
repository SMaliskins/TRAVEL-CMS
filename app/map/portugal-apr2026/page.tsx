"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Itinerary from "./Itinerary";

const PortugalMapLeaflet = dynamic(
  () => import("./PortugalMapLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 300, width: "100%" }} className="flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
        Loading map...
      </div>
    ),
  }
);

export default function PortugalMapPage() {
  const [isClient, setIsClient] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#fff" }}>
      {/* Compact map with expand toggle */}
      <div style={{ position: "relative" }}>
        <div style={{ height: mapExpanded ? "70vh" : 300, width: "100%", transition: "height 0.3s ease" }}>
          <PortugalMapLeaflet />
        </div>
        <button
          onClick={() => setMapExpanded(!mapExpanded)}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            zIndex: 1000,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {mapExpanded ? "Collapse map" : "Expand map"}
        </button>
      </div>

      {/* Itinerary — main content */}
      <Itinerary />
    </div>
  );
}
