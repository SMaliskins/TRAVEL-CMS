"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import PartySelect from "@/components/PartySelect";
import CityMultiSelect, { CityWithCountry } from "@/components/CityMultiSelect";
import DateRangePicker from "@/components/DateRangePicker";
import { getCityByName, countryCodeToFlag, CITIES } from "@/lib/data/cities";

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

  // Parse origin and destinations from countriesCities
  // Format: "origin:Riga, Latvia|Rome, Italy; Barcelona, Spain"
  // If no origin prefix, first city is origin
  const parsedRoute = useMemo(() => {
    if (!countriesCities) return { origin: null, destinations: [] };
    
    let originCity: CityWithCountry | null = null;
    let destinations: CityWithCountry[] = [];
    
    // Check for origin: prefix
    if (countriesCities.includes("|")) {
      const [originPart, destPart] = countriesCities.split("|");
      if (originPart.startsWith("origin:")) {
        const originStr = originPart.replace("origin:", "").trim();
        const parts = originStr.split(",");
        const cityName = parts[0]?.trim() || "";
        const cityData = getCityByName(cityName);
        originCity = {
          city: cityName,
          country: parts[1]?.trim() || "",
          countryCode: cityData?.countryCode,
          lat: cityData?.lat,
          lng: cityData?.lng,
        };
      }
      // Parse destinations
      if (destPart) {
        destinations = destPart.split(";").map(item => {
          const parts = item.trim().split(",");
          const cityName = parts[0]?.trim() || "";
          const cityData = getCityByName(cityName);
          return {
            city: cityName,
            country: parts[1]?.trim() || "",
            countryCode: cityData?.countryCode,
            lat: cityData?.lat,
            lng: cityData?.lng,
          };
        }).filter(c => c.city);
      }
    } else {
      // Old format: just destinations
      destinations = countriesCities.split(";").map(item => {
        const parts = item.trim().split(",");
        const cityName = parts[0]?.trim() || "";
        const cityData = getCityByName(cityName);
        return {
          city: cityName,
          country: parts[1]?.trim() || "",
          countryCode: cityData?.countryCode,
          lat: cityData?.lat,
          lng: cityData?.lng,
        };
      }).filter(c => c.city);
    }
    
    return { origin: originCity, destinations };
  }, [countriesCities]);

  // Edit states
  const [editClientId, setEditClientId] = useState<string | null>(clientPartyId || null);
  const [editClientName, setEditClientName] = useState(clientDisplayName || "");
  const [editOrigin, setEditOrigin] = useState<CityWithCountry | null>(parsedRoute.origin);
  const [editDestinations, setEditDestinations] = useState<CityWithCountry[]>(parsedRoute.destinations);
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

      // Format route for storage
      let formattedCities = "";
      if (editOrigin) {
        formattedCities = `origin:${editOrigin.city}, ${editOrigin.country}|`;
        // Save origin to client history
        saveClientOrigin(editClientId, editOrigin);
      }
      formattedCities += editDestinations.map(c => `${c.city}, ${c.country}`).join("; ");

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

  // All cities for map (origin + destinations)
  const allCitiesForMap = useMemo(() => {
    const cities: CityWithCountry[] = [];
    if (parsedRoute.origin) cities.push(parsedRoute.origin);
    cities.push(...parsedRoute.destinations);
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
                className="px-3 py-1 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
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

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      {/* Header: Order Type + Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Client</h2>
          {/* Order Type Badge - editable */}
          {renderField(
            "orderType",
            "Order Type",
            <span 
              className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded cursor-pointer"
              title="Double-click to edit"
            >
              {ORDER_TYPES.find(t => t.value === orderType)?.label || orderType}
            </span>,
            <select
              value={editOrderType}
              onChange={(e) => setEditOrderType(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              {ORDER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Client Row - bigger, with contacts inline */}
      <div className="mb-4">
        {renderField(
          "client",
          "Client",
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-lg font-medium text-gray-900">
              {clientDisplayName || <span className="text-gray-400 italic">No client</span>}
            </span>
            {clientPhone && (
              <a
                href={`tel:${clientPhone}`}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {clientPhone}
              </a>
            )}
            {clientEmail && (
              <a
                href={`mailto:${clientEmail}`}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {clientEmail}
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
      </div>

      {/* Route: Origin → Destinations */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Origin (From) */}
        {renderField(
          "origin",
          "From",
          <div>
            <span className="text-xs text-gray-500 block mb-1">From</span>
            {parsedRoute.origin ? (
              <div className="flex items-center gap-1">
                {parsedRoute.origin.countryCode && (
                  <span>{countryCodeToFlag(parsedRoute.origin.countryCode)}</span>
                )}
                <span className="text-gray-900">{parsedRoute.origin.city}</span>
              </div>
            ) : (
              <span className="text-gray-400 italic text-sm">Not set</span>
            )}
          </div>,
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropOnOrigin}
            className="min-h-[40px] border-2 border-dashed border-gray-300 rounded p-2"
          >
            {/* Origin suggestions */}
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
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded cursor-move"
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
                placeholder="Select origin city..."
              />
            )}
          </div>
        )}

        {/* Destinations (To) */}
        {renderField(
          "destinations",
          "To",
          <div>
            <span className="text-xs text-gray-500 block mb-1">To</span>
            {parsedRoute.destinations.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                {parsedRoute.destinations.map((city, idx) => (
                  <span key={city.city} className="flex items-center">
                    {city.countryCode && (
                      <span className="mr-1">{countryCodeToFlag(city.countryCode)}</span>
                    )}
                    <span className="text-gray-900">{city.city}</span>
                    {idx < parsedRoute.destinations.length - 1 && (
                      <span className="ml-2 text-gray-400">→</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-gray-400 italic text-sm">No destinations</span>
            )}
          </div>,
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropOnDestinations}
            className="min-h-[40px] border-2 border-dashed border-gray-300 rounded p-2"
          >
            <div className="flex flex-wrap gap-1 mb-2">
              {editDestinations.map(city => (
                <div
                  key={city.city}
                  draggable
                  onDragStart={() => handleDragStart(city, "destinations")}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded cursor-move"
                >
                  {city.countryCode && <span>{countryCodeToFlag(city.countryCode)}</span>}
                  {city.city}
                  <button
                    type="button"
                    onClick={() => setEditDestinations(prev => prev.filter(c => c.city !== city.city))}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <CityMultiSelect
              selectedCities={editDestinations}
              onChange={setEditDestinations}
              placeholder="Add destinations..."
            />
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="mb-4">
        {renderField(
          "dates",
          "Travel Dates",
          <div>
            <span className="text-xs text-gray-500 block mb-1">Travel Dates</span>
            <span className="text-gray-900">
              {dateFrom || dateTo ? (
                `${formatDateDDMMYYYY(dateFrom)} — ${formatDateDDMMYYYY(dateTo)}`
              ) : (
                <span className="text-gray-400 italic">Not set</span>
              )}
            </span>
          </div>,
          <DateRangePicker
            label=""
            from={editDateFrom}
            to={editDateTo}
            onChange={(from, to) => {
              setEditDateFrom(from);
              setEditDateTo(to);
            }}
          />
        )}
      </div>

      {/* Mini Trip Map - compact, inside Client section */}
      {allCitiesForMap.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="h-32 rounded-lg overflow-hidden">
            <TripMap
              destinations={allCitiesForMap}
              dateFrom={dateFrom || undefined}
              dateTo={dateTo || undefined}
              amountToPay={amountTotal}
              amountPaid={amountPaid}
              currency="€"
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
