"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import PartySelect from "@/components/PartySelect";
import CityMultiSelect, { CityWithCountry } from "@/components/CityMultiSelect";
import DateRangePicker from "@/components/DateRangePicker";
import { getCityByName, countryCodeToFlag, CITIES } from "@/lib/data/cities";
import ChecklistPanel from "./ChecklistPanel";

// Dynamic import TripMap to avoid SSR issues with Leaflet
const TripMap = dynamic(() => import("@/components/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-100 rounded-lg animate-pulse h-32 flex items-center justify-center text-gray-400 text-sm">
      Loading map...
      </div>
  ),
});

// Order types
const ORDER_TYPES = [
  { value: "leisure", label: "Leisure" },
  { value: "business", label: "Business" },
  { value: "group", label: "Group" },
  { value: "mice", label: "MICE" },
  { value: "cruise", label: "Cruise" },
];

interface OrderClientSectionProps {
  orderId: string;
  orderCode: string;
  clientDisplayName: string | null;
  clientPartyId?: string | null;
  countriesCities: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  amountTotal?: number;
  amountPaid?: number;
  orderType?: string;
  onUpdate: (updates: Partial<{
    client_display_name: string;
    client_party_id: string;
    countries_cities: string;
    date_from: string;
    date_to: string;
    order_type: string;
  }>) => void;
}

// Get default city from localStorage or fallback to Riga
function getDefaultOriginCity(): CityWithCountry {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("company_default_city");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch { /* ignore */ }
    }
  }
  // Default: Riga
  const riga = getCityByName("Riga");
  return {
    city: "Riga",
    country: "Latvia",
    countryCode: riga?.countryCode || "LV",
    lat: riga?.lat,
    lng: riga?.lng,
  };
}

// Get client's frequent origin cities (max 2)
function getClientOriginHistory(clientId: string | null): CityWithCountry[] {
  if (!clientId || typeof window === "undefined") return [];
  const key = `client_origins_${clientId}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored).slice(0, 2);
    } catch { /* ignore */ }
  }
  return [];
}

// Save client's origin city to history
function saveClientOrigin(clientId: string | null, city: CityWithCountry) {
  if (!clientId || typeof window === "undefined") return;
  const key = `client_origins_${clientId}`;
  const existing = getClientOriginHistory(clientId);
  // Add to front, remove duplicates, keep max 2
  const updated = [city, ...existing.filter(c => c.city !== city.city)].slice(0, 2);
  localStorage.setItem(key, JSON.stringify(updated));
}

export default function OrderClientSection({
  orderCode,
  clientDisplayName,
  clientPartyId,
  countriesCities,
  dateFrom,
  dateTo,
  clientPhone,
  clientEmail,
  amountTotal = 0,
  amountPaid = 0,
  orderType = "leisure",
  onUpdate,
}: OrderClientSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Which field is being edited (double-click to edit)
  const [editingField, setEditingField] = useState<string | null>(null);

  // Parse origin, destinations, and return city from countriesCities
  // Format: "origin:Riga, Latvia|Rome, Italy; Barcelona, Spain|return:Riga, Latvia"
  // If no return specified, defaults to origin
  const parsedRoute = useMemo(() => {
    if (!countriesCities) return { origin: null, destinations: [], returnCity: null };
    
    let originCity: CityWithCountry | null = null;
    let returnCity: CityWithCountry | null = null;
    let destinations: CityWithCountry[] = [];
    
    // Check for parts: origin:|destinations|return:
    const parts = countriesCities.split("|");
    
    for (const part of parts) {
      if (part.startsWith("origin:")) {
        const originStr = part.replace("origin:", "").trim();
        const cityParts = originStr.split(",");
        const cityName = cityParts[0]?.trim() || "";
        const cityData = getCityByName(cityName);
        originCity = {
          city: cityName,
          country: cityParts[1]?.trim() || "",
          countryCode: cityData?.countryCode,
          lat: cityData?.lat,
          lng: cityData?.lng,
        };
      } else if (part.startsWith("return:")) {
        const returnStr = part.replace("return:", "").trim();
        const cityParts = returnStr.split(",");
        const cityName = cityParts[0]?.trim() || "";
        const cityData = getCityByName(cityName);
        returnCity = {
          city: cityName,
          country: cityParts[1]?.trim() || "",
          countryCode: cityData?.countryCode,
          lat: cityData?.lat,
          lng: cityData?.lng,
        };
      } else if (part.trim()) {
        // Destinations
        destinations = part.split(";").map(item => {
          const cityParts = item.trim().split(",");
          const cityName = cityParts[0]?.trim() || "";
          const cityData = getCityByName(cityName);
          return {
            city: cityName,
            country: cityParts[1]?.trim() || "",
            countryCode: cityData?.countryCode,
            lat: cityData?.lat,
            lng: cityData?.lng,
          };
        }).filter(c => c.city);
      }
    }
    
    // If no return city specified, default to origin
    if (!returnCity && originCity) {
      returnCity = { ...originCity };
    }
    
    return { origin: originCity, destinations, returnCity };
  }, [countriesCities]);

  // Edit states
  const [editClientId, setEditClientId] = useState<string | null>(clientPartyId || null);
  const [editClientName, setEditClientName] = useState(clientDisplayName || "");
  const [editOrigin, setEditOrigin] = useState<CityWithCountry | null>(parsedRoute.origin);
  const [editDestinations, setEditDestinations] = useState<CityWithCountry[]>(parsedRoute.destinations);
  const [editReturnCity, setEditReturnCity] = useState<CityWithCountry | null>(parsedRoute.returnCity);
  const [returnToOrigin, setReturnToOrigin] = useState(true); // Toggle for "same as origin"
  const [editDateFrom, setEditDateFrom] = useState<string | undefined>(dateFrom || undefined);
  const [editDateTo, setEditDateTo] = useState<string | undefined>(dateTo || undefined);
  const [editOrderType, setEditOrderType] = useState(orderType);
  
  // Client origin suggestions
  const [originSuggestions, setOriginSuggestions] = useState<CityWithCountry[]>([]);
  
  // Update origin suggestions when client changes
  useEffect(() => {
    if (editClientId) {
      const history = getClientOriginHistory(editClientId);
      if (history.length > 0) {
        setOriginSuggestions(history);
        // Auto-set origin from history if not set
        if (!editOrigin && history.length > 0) {
          setEditOrigin(history[0]);
        }
      } else {
        // New client - use default city
        const defaultCity = getDefaultOriginCity();
        setOriginSuggestions([defaultCity]);
        if (!editOrigin) {
          setEditOrigin(defaultCity);
        }
      }
    }
  }, [editClientId, editOrigin]);

  const handleDoubleClick = (field: string) => {
    // Reset edit states before editing
    setEditClientId(clientPartyId || null);
    setEditClientName(clientDisplayName || "");
    setEditOrigin(parsedRoute.origin);
    setEditDestinations(parsedRoute.destinations);
    setEditReturnCity(parsedRoute.returnCity);
    // Check if return is same as origin
    setReturnToOrigin(
      parsedRoute.returnCity?.city === parsedRoute.origin?.city
    );
    setEditDateFrom(dateFrom || undefined);
    setEditDateTo(dateTo || undefined);
    setEditOrderType(orderType);
    setSaveError(null);
    setEditingField(field);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Format route for storage: origin:City, Country|Dest1; Dest2|return:City, Country
      let formattedCities = "";
      if (editOrigin) {
        formattedCities = `origin:${editOrigin.city}, ${editOrigin.country}|`;
        // Save origin to client history
        saveClientOrigin(editClientId, editOrigin);
      }
      formattedCities += editDestinations.map(c => `${c.city}, ${c.country}`).join("; ");
      
      // Add return city
      const returnCityToSave = returnToOrigin ? editOrigin : editReturnCity;
      if (returnCityToSave) {
        formattedCities += `|return:${returnCityToSave.city}, ${returnCityToSave.country}`;
      }

      const updates: Record<string, unknown> = {
        client_display_name: editClientName || null,
        countries_cities: formattedCities || null,
        date_from: editDateFrom || null,
        date_to: editDateTo || null,
        order_type: editOrderType,
      };

      if (editClientId) {
        updates.client_party_id = editClientId;
      }

      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        onUpdate({
          client_display_name: editClientName,
          countries_cities: formattedCities,
          date_from: editDateFrom || "",
          date_to: editDateTo || "",
          order_type: editOrderType,
        });
        setEditingField(null);
      } else {
        const errData = await response.json().catch(() => ({}));
        setSaveError(errData.error || "Failed to save changes");
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveError("Network error");
    } finally {
      setIsSaving(false);
    }
  };

  // Drag and drop handlers for cities
  const [draggedCity, setDraggedCity] = useState<{ city: CityWithCountry; source: "origin" | "destinations" } | null>(null);

  const handleDragStart = (city: CityWithCountry, source: "origin" | "destinations") => {
    setDraggedCity({ city, source });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnOrigin = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCity) return;
    
    // Move city to origin
    if (draggedCity.source === "destinations") {
      // Remove from destinations
      setEditDestinations(prev => prev.filter(c => c.city !== draggedCity.city.city));
    }
    // If there was an origin, move it to destinations
    if (editOrigin) {
      setEditDestinations(prev => [editOrigin, ...prev]);
    }
    setEditOrigin(draggedCity.city);
    setDraggedCity(null);
  };

  const handleDropOnDestinations = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCity) return;
    
    if (draggedCity.source === "origin") {
      setEditOrigin(null);
      setEditDestinations(prev => [draggedCity.city, ...prev]);
    }
    setDraggedCity(null);
  };

  // All cities for map (origin + destinations + return)
  const allCitiesForMap = useMemo(() => {
    const cities: CityWithCountry[] = [];
    if (parsedRoute.origin) cities.push(parsedRoute.origin);
    cities.push(...parsedRoute.destinations);
    // Add return city if different from last destination
    if (parsedRoute.returnCity) {
      const lastCity = cities[cities.length - 1];
      if (!lastCity || lastCity.city !== parsedRoute.returnCity.city) {
        cities.push(parsedRoute.returnCity);
      }
    }
    return cities;
  }, [parsedRoute]);

  // Render editable field or display value
  const renderField = (
    fieldName: string,
    label: string,
    displayContent: React.ReactNode,
    editContent: React.ReactNode
  ) => {
    const isEditing = editingField === fieldName;
    
    return (
      <div 
        className={`${isEditing ? "" : "cursor-pointer hover:bg-gray-50 rounded -mx-2 px-2 py-1"}`}
        onDoubleClick={() => !isEditing && handleDoubleClick(fieldName)}
      >
        {isEditing ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            {editContent}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "..." : "Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}
          </div>
        ) : (
          displayContent
        )}
      </div>
    );
  };

  // Calculate days until trip
  const daysUntilTrip = useMemo(() => {
    if (!dateFrom) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripDate = new Date(dateFrom);
    tripDate.setHours(0, 0, 0, 0);
    const diffTime = tripDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [dateFrom]);

  // Calculate days and nights for display
  const daysAndNights = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const days = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const nights = days - 1;
    const daysWord = days === 1 ? 'день' : days > 1 && days < 5 ? 'дня' : 'дней';
    const nightsWord = nights === 1 ? 'ночь' : nights > 1 && nights < 5 ? 'ночи' : 'ночей';
    return ` (${days} ${daysWord} / ${nights} ${nightsWord})`;
  }, [dateFrom, dateTo]);

  // Filter unique destinations by city name
  const uniqueDestinations = useMemo(() => {
    const seen = new Set<string>();
    return parsedRoute.destinations.filter(city => {
      const key = city.city.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [parsedRoute.destinations]);

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] border border-gray-100/50">
      {/* Layout: Client info left, Map right */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        {/* Left: Client + Route */}
        <div className="space-y-3">
          {/* Compact Header Row: Client + Type */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/60">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Client Name - editable */}
              {renderField(
                "client",
                "Client",
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                    {clientDisplayName || <span className="text-gray-400 italic font-normal">No client</span>}
                  </h2>
                  {clientPhone && (
                    <a
                      href={`tel:${clientPhone}`}
                      className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      title={clientPhone}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="hidden sm:inline">{clientPhone}</span>
                    </a>
                  )}
                  {clientEmail && (
                    <a
                      href={`mailto:${clientEmail}`}
                      className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      title={clientEmail}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden lg:inline truncate max-w-[150px]">{clientEmail}</span>
                    </a>
                  )}
                </div>,
                <PartySelect
                  value={editClientId}
                  onChange={(id, displayName) => {
                    setEditClientId(id);
                    setEditClientName(displayName);
                  }}
                  roleFilter="client"
                  initialDisplayName={editClientName}
                />
              )}
              {/* Order Type Badge - compact */}
              {renderField(
                "orderType",
                "Order Type",
                <span 
                  className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100/80 text-blue-800 rounded-md cursor-pointer uppercase tracking-wide"
                  title="Double-click to edit"
                >
                  {ORDER_TYPES.find(t => t.value === orderType)?.label || orderType}
                </span>,
                <select
                  value={editOrderType}
                  onChange={(e) => setEditOrderType(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                  aria-label="Order Type"
                >
                  {ORDER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Compact Route + Dates - ONE unified block, no duplicates */}
          {(parsedRoute.origin || uniqueDestinations.length > 0 || dateFrom) && (
            <div>
              {renderField(
                "route",
                "Route & Dates",
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Route - compact inline, unique destinations only */}
                  {(parsedRoute.origin || uniqueDestinations.length > 0) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {parsedRoute.origin && (
                        <>
                          <span className="flex items-center gap-1 text-base font-semibold text-gray-900">
                            {parsedRoute.origin.countryCode && (
                              <span className="text-base">{countryCodeToFlag(parsedRoute.origin.countryCode)}</span>
                            )}
                            {parsedRoute.origin.city}
                          </span>
                          <span className="text-gray-400 text-xs">→</span>
                        </>
                      )}
                      {uniqueDestinations.map((city, idx) => (
                        <span key={`${city.city}-${idx}`} className="flex items-center">
                          <span className="flex items-center gap-1 text-base font-semibold text-gray-900">
                            {city.countryCode && (
                              <span className="text-base">{countryCodeToFlag(city.countryCode)}</span>
                            )}
                            {city.city}
                          </span>
                          {(idx < uniqueDestinations.length - 1 || (parsedRoute.returnCity && parsedRoute.origin && parsedRoute.returnCity.city !== parsedRoute.origin.city)) && (
                            <span className="text-gray-400 text-xs mx-1">→</span>
                          )}
                        </span>
                      ))}
                      {parsedRoute.returnCity && parsedRoute.origin && parsedRoute.returnCity.city !== parsedRoute.origin.city && (
                        <>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className="flex items-center gap-1 text-base font-semibold text-gray-700">
                            {parsedRoute.returnCity.countryCode && (
                              <span className="text-base">{countryCodeToFlag(parsedRoute.returnCity.countryCode)}</span>
                            )}
                            {parsedRoute.returnCity.city}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Dates - inline */}
                  {(dateFrom || dateTo) && (
                    <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">
                        {dateFrom ? formatDateDDMMYYYY(dateFrom) : "—"} — {dateTo ? formatDateDDMMYYYY(dateTo) : "—"}{daysAndNights}
                      </span>
                      {daysUntilTrip !== null && daysUntilTrip >= 0 && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-full">
                          {daysUntilTrip} {daysUntilTrip === 1 ? 'day' : 'days'} before trip
                        </span>
                      )}
                    </div>
                  )}
                </div>,
            <div className="space-y-3">
              {/* Origin */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">From</label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropOnOrigin}
                  className="min-h-[36px] border-2 border-dashed border-gray-300 rounded-lg p-2"
                >
                  {originSuggestions.length > 0 && !editOrigin && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {originSuggestions.map(city => (
                        <button
                          key={city.city}
                          type="button"
                          onClick={() => setEditOrigin(city)}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                        >
                          {city.countryCode && <span>{countryCodeToFlag(city.countryCode)}</span>}
                          {city.city}
                        </button>
                      ))}
                    </div>
                  )}
                  {editOrigin ? (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(editOrigin, "origin")}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded cursor-move text-xs"
                    >
                      {editOrigin.countryCode && <span>{countryCodeToFlag(editOrigin.countryCode)}</span>}
                      {editOrigin.city}
                      <button
                        type="button"
                        onClick={() => setEditOrigin(null)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <CityMultiSelect
                      selectedCities={editOrigin ? [editOrigin] : []}
                      onChange={(cities) => setEditOrigin(cities[0] || null)}
                      placeholder="Select origin..."
                    />
                  )}
                </div>
              </div>

              {/* Destinations - filter duplicates */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">To</label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropOnDestinations}
                  className="min-h-[36px] border-2 border-dashed border-gray-300 rounded-lg p-2"
                >
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editDestinations.filter((city, idx, arr) => 
                      arr.findIndex(c => c.city.toLowerCase() === city.city.toLowerCase()) === idx
                    ).map((city, idx) => (
                      <div
                        key={`${city.city}-${idx}`}
                        draggable
                        onDragStart={() => handleDragStart(city, "destinations")}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded cursor-move text-xs"
                      >
                        {city.countryCode && <span>{countryCodeToFlag(city.countryCode)}</span>}
                        {city.city}
                        <button
                          type="button"
                          onClick={() => setEditDestinations(prev => prev.filter((c, i) => {
                            const cityIndex = prev.findIndex(x => x.city.toLowerCase() === city.city.toLowerCase());
                            return i !== cityIndex;
                          }))}
                          className="ml-1 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <CityMultiSelect
                    selectedCities={editDestinations.filter((city, idx, arr) => 
                      arr.findIndex(c => c.city.toLowerCase() === city.city.toLowerCase()) === idx
                    )}
                    onChange={(newCities) => {
                      // Filter duplicates when adding
                      const unique = newCities.filter((city, idx, arr) => 
                        arr.findIndex(c => c.city.toLowerCase() === city.city.toLowerCase()) === idx
                      );
                      setEditDestinations(unique);
                    }}
                    placeholder="Add destinations..."
                  />
                </div>
              </div>

              {/* Return */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                  <input
                    type="checkbox"
                    checked={returnToOrigin}
                    onChange={(e) => {
                      setReturnToOrigin(e.target.checked);
                      if (e.target.checked && editOrigin) {
                        setEditReturnCity(editOrigin);
                      }
                    }}
                    className="rounded border-gray-300 text-xs"
                  />
                  <span className="text-xs text-gray-700">Return to origin</span>
                </label>
                {!returnToOrigin && (
                  <CityMultiSelect
                    selectedCities={editReturnCity ? [editReturnCity] : []}
                    onChange={(cities) => setEditReturnCity(cities[0] || null)}
                    placeholder="Select return city..."
                  />
                )}
              </div>

              {/* Dates */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Travel Dates</label>
                <DateRangePicker
                  label=""
                  from={editDateFrom}
                  to={editDateTo}
                  onChange={(from, to) => {
                    setEditDateFrom(from);
                    setEditDateTo(to);
                  }}
                />
              </div>
            </div>
              )}
            </div>
          )}
        </div>
        
      </div>

        {/* Right: Square Map */}
            {/* Checklist Panel */}
            <div className="mb-4">
              <ChecklistPanel orderCode={orderCode} />
            </div>

        {allCitiesForMap.length > 0 && (
          <div className="relative z-0">
            <div className="w-full h-[300px] rounded-xl overflow-hidden border border-gray-200/60 shadow-sm">
              <TripMap
                destinations={allCitiesForMap}
                dateFrom={dateFrom || undefined}
                dateTo={dateTo || undefined}
                amountToPay={amountTotal}
                amountPaid={amountPaid}
                currency="€"
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>
  );
}
