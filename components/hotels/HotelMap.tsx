"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const HotelMapInner = dynamic(() => import("./HotelMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl">
      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
    </div>
  ),
});

interface HotelMapHotel {
  lat: number;
  lng: number;
  name: string;
  price: number;
  currency: string;
  id: string;
}

interface HotelMapProps {
  hotels: HotelMapHotel[];
  onHotelClick: (id: string) => void;
  center?: [number, number];
}

export default function HotelMap(props: HotelMapProps) {
  return <HotelMapInner {...props} />;
}
