"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import PartySelect from "@/components/PartySelect";
import CityMultiSelect, { CityWithCountry } from "@/components/CityMultiSelect";
import DateRangePicker from "@/components/DateRangePicker";
import { getCityByName, countryCodeToFlag } from "@/lib/data/cities";

// Dynamic import TripMap to avoid SSR issues with Leaflet
const TripMap = dynamic(() => import("@/components/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-100 rounded-lg animate-pulse" style={{ height: 300 }}>
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading map...
      </div>
    </div>
  ),
});

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
  onUpdate: (updates: Partial<{
    client_display_name: string;
    client_party_id: string;
    countries_cities: string;
    date_from: string;
    date_to: string;
  }>) => void;
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
  onUpdate,
}: OrderClientSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Parse cities for TripMap - add coordinates from database
  const parsedCities = useMemo<CityWithCountry[]>(() => {
    if (!countriesCities) return [];
    return countriesCities.split(";").map(item => {
      const parts = item.trim().split(",");
      const cityName = parts[0]?.trim() || "";
      const country = parts[1]?.trim() || "";
      
      // Try to get coordinates from database
      const cityData = getCityByName(cityName);
      return {
        city: cityName,
        country: country,
        countryCode: cityData?.countryCode,
        lat: cityData?.lat,
        lng: cityData?.lng,
      };
    }).filter(c => c.city);
  }, [countriesCities]);

  // Edit state
  const [editClientId, setEditClientId] = useState<string | null>(clientPartyId || null);
  const [editClientName, setEditClientName] = useState(clientDisplayName || "");
  const [editCities, setEditCities] = useState<CityWithCountry[]>(() => {
    if (!countriesCities) return [];
    // Parse "Rome, Italy; Barcelona, Spain" format
    return countriesCities.split(";").map(item => {
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
  });
  const [editDateFrom, setEditDateFrom] = useState<string | undefined>(dateFrom || undefined);
  const [editDateTo, setEditDateTo] = useState<string | undefined>(dateTo || undefined);

  const handleStartEdit = () => {
    setEditClientId(clientPartyId || null);
    setEditClientName(clientDisplayName || "");
    setEditCities(countriesCities ? countriesCities.split(";").map(item => {
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
    }).filter(c => c.city) : []);
    setEditDateFrom(dateFrom || undefined);
    setEditDateTo(dateTo || undefined);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Format cities for storage: "Rome, Italy; Barcelona, Spain"
      const formattedCities = editCities
        .map(c => `${c.city}, ${c.country}`)
        .join("; ");

      const updates: Record<string, unknown> = {
        client_display_name: editClientName || null,
        countries_cities: formattedCities || null,
        date_from: editDateFrom || null,
        date_to: editDateTo || null,
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
        });
        setIsEditing(false);
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

  if (isEditing) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Client</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="space-y-4">
          {/* Client Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <PartySelect
              value={editClientId}
              onChange={(id, displayName) => {
                setEditClientId(id);
                setEditClientName(displayName);
              }}
              roleFilter="client"
            />
          </div>

          {/* Destinations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destinations</label>
            <CityMultiSelect
              selectedCities={editCities}
              onChange={setEditCities}
            />
          </div>

          {/* Dates */}
          <div>
            <DateRangePicker
              label="Travel Dates"
              from={editDateFrom}
              to={editDateTo}
              onChange={(from, to) => {
                setEditDateFrom(from);
                setEditDateTo(to);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Client Info Card */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Client</h2>
          <button
            onClick={handleStartEdit}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        </div>

        {clientDisplayName ? (
          <div className="space-y-3">
            {/* Client Name with Contact */}
            <div>
              <span className="text-sm text-gray-500">Name:</span>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-gray-900 font-medium">{clientDisplayName}</p>
                {clientPhone && (
                  <a
                    href={`tel:${clientPhone}`}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
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
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {clientEmail}
                  </a>
                )}
              </div>
            </div>

            {/* Destination with flags */}
            {parsedCities.length > 0 && (
              <div>
                <span className="text-sm text-gray-500">Destination:</span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {parsedCities.map((city, idx) => (
                    <span key={city.city} className="flex items-center">
                      {city.countryCode && (
                        <span className="mr-1">{countryCodeToFlag(city.countryCode)}</span>
                      )}
                      <span className="text-gray-900">{city.city}</span>
                      {idx < parsedCities.length - 1 && (
                        <span className="ml-2 text-gray-400">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            {(dateFrom || dateTo) && (
              <div>
                <span className="text-sm text-gray-500">Dates:</span>
                <p className="text-gray-900">
                  {formatDateDDMMYYYY(dateFrom)} — {formatDateDDMMYYYY(dateTo)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-3">No client information</p>
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800"
            >
              Add Client Details
            </button>
          </div>
        )}
      </div>

      {/* Trip Map Card - show only if there are destinations */}
      {parsedCities.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <TripMap
            destinations={parsedCities}
            dateFrom={dateFrom || undefined}
            dateTo={dateTo || undefined}
            amountToPay={amountTotal}
            amountPaid={amountPaid}
            currency="€"
          />
        </div>
      )}
    </div>
  );
}
