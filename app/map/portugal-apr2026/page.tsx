"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const PortugalMapLeaflet = dynamic(
  () => import("./PortugalMapLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
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
    <div style={{ height: "100vh", width: "100vw" }}>
      <PortugalMapLeaflet />
    </div>
  );
}
