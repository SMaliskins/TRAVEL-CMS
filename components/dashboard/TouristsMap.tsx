"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
const MapFitBounds = dynamic(
  () => import("./MapFitBounds"),
  { ssr: false }
);
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-cluster"),
  { ssr: false }
);

export interface TouristLocation {
  id: string;
  name: string;
  location: [number, number];
  orderCode?: string;
  status?: "upcoming" | "in-progress" | "completed";
  dateFrom?: string;
  dateTo?: string;
  completedAt?: string;
  destination?: string;
  /** People on this order (from order_travellers); omit or use 1 when unknown */
  travellerCount?: number;
}

interface TouristsMapProps {
  locations: TouristLocation[];
  showAgentOnly?: boolean;
  className?: string;
}

interface CityGroup {
  key: string;
  city: string;
  location: [number, number];
  travelers: TouristLocation[];
  hasInProgress: boolean;
  allInProgress: boolean;
}

const COUNTRY_TO_ISO: Record<string, string> = {
  "turkey": "TR", "turcija": "TR", "türkiye": "TR",
  "egypt": "EG", "ēģipte": "EG", "ēģitpe": "EG",
  "greece": "GR", "grieķija": "GR",
  "spain": "ES", "spānija": "ES",
  "italy": "IT", "itālija": "IT",
  "france": "FR", "francija": "FR",
  "germany": "DE", "vācija": "DE",
  "united kingdom": "GB", "lielbritānija": "GB", "uk": "GB",
  "uae": "AE", "aae": "AE", "united arab emirates": "AE",
  "thailand": "TH", "taizeme": "TH",
  "georgia": "GE", "gruzija": "GE",
  "albania": "AL", "albānija": "AL",
  "portugal": "PT", "portugāle": "PT",
  "croatia": "HR", "horvātija": "HR",
  "cyprus": "CY", "kipra": "CY",
  "montenegro": "ME", "melnkalne": "ME",
  "latvia": "LV", "latvija": "LV",
  "lithuania": "LT", "lietuva": "LT",
  "estonia": "EE", "igaunija": "EE",
  "sweden": "SE", "zviedrija": "SE",
  "denmark": "DK", "dānija": "DK",
  "finland": "FI", "somija": "FI",
  "norway": "NO", "norvēģija": "NO",
  "switzerland": "CH", "šveice": "CH",
  "austria": "AT", "austrija": "AT",
  "poland": "PL", "polija": "PL",
  "czech republic": "CZ", "čehija": "CZ",
  "netherlands": "NL", "nīderlande": "NL",
  "belgium": "BE", "beļģija": "BE",
  "jordan": "JO", "jordānija": "JO",
  "israel": "IL", "izraēla": "IL",
  "oman": "OM", "omāna": "OM",
  "maldives": "MV", "maldīvija": "MV",
  "morocco": "MA", "maroka": "MA",
  "tanzania": "TZ", "tanzānija": "TZ",
  "canada": "CA", "kanāda": "CA",
  "usa": "US", "asv": "US", "united states": "US",
  "mexico": "MX", "meksika": "MX",
  "japan": "JP", "japāna": "JP",
  "south korea": "KR", "dienvidkoreja": "KR",
  "india": "IN", "indija": "IN",
  "sri lanka": "LK", "šrilanka": "LK",
  "indonesia": "ID", "indonēzija": "ID",
  "vietnam": "VN", "vjetnama": "VN",
  "bulgaria": "BG", "bulgārija": "BG",
  "romania": "RO", "rumānija": "RO",
  "hungary": "HU", "ungārija": "HU",
  "ireland": "IE", "īrija": "IE",
  "malta": "MT",
  "tunisia": "TN", "tunisija": "TN",
  "cuba": "CU", "kuba": "CU",
  "dominican republic": "DO", "dominikāna": "DO",
  "brazil": "BR", "brazīlija": "BR",
  "argentina": "AR", "argentīna": "AR",
  "australia": "AU", "austrālija": "AU",
  "new zealand": "NZ", "jaunzēlande": "NZ",
  "china": "CN", "ķīna": "CN",
  "singapore": "SG", "singapūra": "SG",
  "malaysia": "MY", "malaizija": "MY",
  "philippines": "PH", "filipīnas": "PH",
  "kenya": "KE", "kenija": "KE",
  "south africa": "ZA", "dienvidāfrika": "ZA",
  "iceland": "IS", "islande": "IS",
  "luxembourg": "LU", "luksemburga": "LU",
  "serbia": "RS", "serbija": "RS",
  "bosnia and herzegovina": "BA", "bosnija": "BA",
  "north macedonia": "MK", "maķedonija": "MK",
  "slovenia": "SI", "slovēnija": "SI",
  "slovakia": "SK", "slovākija": "SK",
};

function countryFlag(country: string): string {
  if (!country) return "";
  const iso = COUNTRY_TO_ISO[country.toLowerCase().trim()];
  if (!iso) return "";
  return String.fromCodePoint(
    iso.charCodeAt(0) - 65 + 0x1F1E6,
    iso.charCodeAt(1) - 65 + 0x1F1E6
  );
}

function splitDestination(dest: string): { city: string; country: string } {
  const parts = dest.split(",").map(s => s.trim());
  if (parts.length >= 2) return { city: parts[0], country: parts[1] };
  return { city: parts[0] || "", country: "" };
}

/** Headcount for one map row (one order); at least 1 for display when data missing */
function travellerHeadcount(loc: TouristLocation): number {
  const n = loc.travellerCount;
  if (typeof n === "number" && n >= 1) return n;
  return 1;
}

function sumHeadcounts(locs: TouristLocation[]): number {
  return locs.reduce((s, loc) => s + travellerHeadcount(loc), 0);
}

function circleSvg(color: string, count: number, ring?: string): string {
  const size = count < 10 ? 36 : count < 100 ? 42 : 48;
  const r = size / 2;
  const strokeColor = ring || "white";
  const strokeWidth = ring ? 3 : 2;
  if (count <= 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/><circle cx="${r}" cy="${r * 0.7}" r="${r * 0.22}" fill="white"/><ellipse cx="${r}" cy="${r * 1.2}" rx="${r * 0.32}" ry="${r * 0.22}" fill="white"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/><text x="${r}" y="${r + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="white">${count}</text></svg>`;
}

function createCityIcon(group: CityGroup) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");
  const color = group.allInProgress ? "#10b981" : "#3b82f6";
  const ring = group.hasInProgress && !group.allInProgress ? "#10b981" : undefined;
  const count = sumHeadcounts(group.travelers);
  const size = count < 10 ? 36 : count < 100 ? 42 : 48;
  return L.divIcon({
    html: circleSvg(color, count, ring),
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** ISO date YYYY-MM-DD, local calendar day */
function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  d.setDate(d.getDate() + days);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type UpcomingDatePreset = "all" | "next7" | "next14";

function upcomingMatchesDatePreset(
  dateFrom: string | undefined,
  preset: UpcomingDatePreset
): boolean {
  if (preset === "all") return true;
  if (!dateFrom || !/^\d{4}-\d{2}-\d{2}/.test(dateFrom.trim())) return false;
  const start = dateFrom.trim().slice(0, 10);
  const today = todayIsoLocal();
  const lastInclusive = addDaysIso(today, preset === "next7" ? 6 : 13);
  return start >= today && start <= lastInclusive;
}

function createClusterIcon(cluster: { getChildCount: () => number; getAllChildMarkers: () => { options: { alt?: string } }[] }) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");

  const children = cluster.getAllChildMarkers();
  let totalCount = 0;
  let hasGreen = false;
  let allGreen = true;
  for (const m of children) {
    const parts = (m.options.alt || "1").split("|");
    totalCount += parseInt(parts[0]) || 1;
    if (parts[1] === "g") hasGreen = true;
    if (parts[1] !== "g") allGreen = false;
  }

  const size = totalCount < 10 ? 40 : totalCount < 50 ? 48 : 56;
  const r = size / 2;
  const bg = allGreen ? "#10b981" : "#3b82f6";
  const stroke = hasGreen && !allGreen ? "#10b981" : "white";
  const sw = hasGreen && !allGreen ? 3 : 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${bg}" stroke="${stroke}" stroke-width="${sw}"/><text x="${r}" y="${r + 5}" text-anchor="middle" font-size="${size < 44 ? 14 : 16}" font-weight="700" fill="white">${totalCount}</text></svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function TouristsMap({
  locations,
  showAgentOnly = false,
  className = "",
}: TouristsMapProps) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, []);

  const activeLocations = locations.filter(
    (loc) => loc.status === "upcoming" || loc.status === "in-progress"
  );

  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showInProgress, setShowInProgress] = useState(true);
  const [upcomingPreset, setUpcomingPreset] = useState<UpcomingDatePreset>("all");

  const visibleLocations = useMemo(() => {
    return activeLocations.filter((loc) => {
      if (loc.status === "in-progress") return showInProgress;
      if (loc.status === "upcoming") {
        if (!showUpcoming) return false;
        return upcomingMatchesDatePreset(loc.dateFrom, upcomingPreset);
      }
      return false;
    });
  }, [activeLocations, showUpcoming, showInProgress, upcomingPreset]);

  const cityGroups = useMemo(() => {
    const map = new Map<string, CityGroup>();
    for (const loc of visibleLocations) {
      const key = `${loc.location[0].toFixed(2)},${loc.location[1].toFixed(2)}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          city: loc.destination || "Unknown",
          location: loc.location,
          travelers: [],
          hasInProgress: false,
          allInProgress: true,
        });
      }
      const g = map.get(key)!;
      g.travelers.push(loc);
      if (loc.status === "in-progress") g.hasInProgress = true;
      if (loc.status !== "in-progress") g.allInProgress = false;
    }
    for (const g of map.values()) {
      g.travelers.sort((a, b) => (a.dateFrom || "").localeCompare(b.dateFrom || ""));
    }
    return Array.from(map.values());
  }, [visibleLocations]);

  const icons = useMemo(() => {
    if (typeof window === "undefined") return new Map<string, unknown>();
    const m = new Map<string, unknown>();
    for (const g of cityGroups) {
      m.set(g.key, createCityIcon(g));
    }
    return m;
  }, [cityGroups]);

  const noDataAtAll = !activeLocations || activeLocations.length === 0;

  const boundsArr = cityGroups.map((g) => g.location);
  const avgLat =
    boundsArr.length > 0
      ? boundsArr.reduce((s, l) => s + l[0], 0) / boundsArr.length
      : 50;
  const avgLng =
    boundsArr.length > 0
      ? boundsArr.reduce((s, l) => s + l[1], 0) / boundsArr.length
      : 10;

  const upcomingCount = sumHeadcounts(visibleLocations.filter((l) => l.status === "upcoming"));
  const inProgressCount = sumHeadcounts(visibleLocations.filter((l) => l.status === "in-progress"));

  if (noDataAtAll) {
    return (
      <div className={`booking-glass-panel !p-4 ${className}`}>
        <h3 className="mb-3 text-xl font-bold text-gray-900 tracking-tight">
          {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
        </h3>
        <div className="flex h-96 items-center justify-center text-base text-gray-500">
          No active travelers currently
        </div>
      </div>
    );
  }

  const filteredEmpty = visibleLocations.length === 0;

  return (
    <div className={`booking-glass-panel !p-4 ${className}`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
        <h3 className="shrink-0 text-xl font-bold leading-tight text-gray-900 tracking-tight">
          {showAgentOnly ? "My Travelers on map" : "Travelers on map"}
        </h3>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-800">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showUpcoming}
              onChange={(e) => setShowUpcoming(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-blue-500" />
              Upcoming ({upcomingCount})
            </span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showInProgress}
              onChange={(e) => setShowInProgress(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-emerald-500" />
              In progress ({inProgressCount})
            </span>
          </label>
          <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Upcoming trips start:</span>
            <select
              value={upcomingPreset}
              onChange={(e) => setUpcomingPreset(e.target.value as UpcomingDatePreset)}
              disabled={!showUpcoming}
              className="min-h-[2.25rem] rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Upcoming date range"
            >
              <option value="all">Any date</option>
              <option value="next7">Next 7 days</option>
              <option value="next14">Next 14 days</option>
            </select>
          </div>
          <span className="hidden h-5 w-px bg-gray-200 sm:block" aria-hidden />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-blue-500 ring-2 ring-emerald-500 ring-offset-1" />
              <span className="text-sm text-gray-700">Mixed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/80">
                <span className="text-[10px] font-bold leading-none text-white">3</span>
              </div>
              <span className="text-sm text-gray-700">Grouped cities</span>
            </div>
          </div>
        </div>
      </div>
      <div className="h-96 w-full overflow-hidden rounded-xl border border-black/5 shadow-inner relative">
        {filteredEmpty ? (
          <div className="flex h-full items-center justify-center bg-gray-50/80 px-4 text-center text-sm text-gray-600">
            No travelers match the current filters. Turn on a status or widen the upcoming date range.
          </div>
        ) : (
          <MapContainer
            center={[avgLat, avgLng]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFitBounds bounds={boundsArr} />
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              spiderfyOnMaxZoom={false}
              showCoverageOnHover={false}
              iconCreateFunction={createClusterIcon}
            >
              {cityGroups.map((group) => {
                const totalTravelers = sumHeadcounts(group.travelers);
                const bookingCount = group.travelers.length;
                const altTag = `${totalTravelers}|${group.allInProgress ? "g" : group.hasInProgress ? "m" : "b"}`;
                return (
                  <Marker
                    key={group.key}
                    position={group.location}
                    icon={icons.get(group.key) as never}
                    alt={altTag}
                  >
                    <Popup maxWidth={320} minWidth={200}>
                      <div className="text-sm">
                        {(() => {
                          const { city, country } = splitDestination(group.city);
                          const flag = countryFlag(country);
                          return (
                            <p className="font-bold text-gray-900 text-sm mb-2">
                              {flag && <span className="mr-1">{flag}</span>}
                              {country && <span className="text-gray-500 font-normal">{country}, </span>}
                              {city}
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                {totalTravelers} {totalTravelers === 1 ? "traveler" : "travelers"}
                                {bookingCount > 1 ? (
                                  <span className="text-gray-400"> · {bookingCount} bookings</span>
                                ) : null}
                              </span>
                            </p>
                          );
                        })()}
                        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                          {group.travelers.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  t.status === "in-progress" ? "bg-emerald-500" : "bg-blue-500"
                                }`}
                              />
                              <span className="text-xs text-gray-500 shrink-0 w-[60px]">
                                {t.dateFrom ? formatDateDDMMYYYY(t.dateFrom).slice(0, 5) : "—"}
                              </span>
                              <a
                                href={`/orders/${(t.orderCode || "").replace("/", "-").toLowerCase()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-900 font-medium truncate hover:text-blue-600"
                              >
                                {t.name}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        )}
      </div>
    </div>
  );
}
