"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Itinerary from "./Itinerary";

const PortugalMapLeaflet = dynamic(
  () => import("./PortugalMapLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "50vh", width: "100%" }} className="flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
        Loading map...
      </div>
    ),
  }
);

export default function PortugalMapPage() {
  const [isClient, setIsClient] = useState(false);

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
    <div style={{ width: "100vw", minHeight: "100vh", background: "#fff" }}>
      {/* Map section */}
      <div style={{ height: "50vh", width: "100%", position: "sticky", top: 0, zIndex: 10 }}>
        <PortugalMapLeaflet />
      </div>

      {/* Itinerary section */}
      <Itinerary />
    </div>
  );
}
