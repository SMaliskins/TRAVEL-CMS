"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, MapPin, Pencil } from "lucide-react";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { formatDateRange } from "@/utils/dateFormat";
import { countryCodeToFlag } from "@/lib/data/cities";
import CityMultiSelect, { type CityWithCountry } from "@/components/CityMultiSelect";
import DateRangePicker from "@/components/DateRangePicker";

type CityRef = {
  city?: string;
  country?: string;
  countryCode?: string;
};

type TravellerItinerary = {
  origin?: CityRef | null;
  destinations?: CityRef[];
  returnCity?: CityRef | null;
};

type TravellerRow = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  isMainClient: boolean;
  avatarUrl: string | null;
  itinerary?: TravellerItinerary | Record<string, never>;
  dateFrom: string | null;
  dateTo: string | null;
  position: number;
};

interface Props {
  orderCode: string;
  /** Order-level fallback when traveller has no itinerary set yet. */
  fallbackCountriesCities: string | null;
  fallbackDateFrom: string | null;
  fallbackDateTo: string | null;
}

function isItineraryEmpty(it: TravellerItinerary | Record<string, never> | undefined): boolean {
  if (!it) return true;
  const t = it as TravellerItinerary;
  const hasOrigin = !!t.origin?.city;
  const hasDest = Array.isArray(t.destinations) && t.destinations.some((d) => !!d?.city);
  const hasReturn = !!t.returnCity?.city;
  return !hasOrigin && !hasDest && !hasReturn;
}

function buildChain(it: TravellerItinerary): CityRef[] {
  const chain: CityRef[] = [];
  if (it.origin?.city) chain.push(it.origin);
  for (const d of it.destinations ?? []) {
    if (d?.city) chain.push(d);
  }
  if (it.returnCity?.city && it.returnCity.city !== it.origin?.city) {
    chain.push(it.returnCity);
  }
  return chain;
}

function CityChain({ chain }: { chain: CityRef[] }) {
  if (chain.length === 0) {
    return <span className="text-gray-400 italic text-xs">no route</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {chain.map((c, i) => (
        <span key={`${c.city}-${i}`} className="inline-flex items-center gap-1">
          {c.countryCode ? (
            <span aria-hidden className="text-base leading-none">
              {countryCodeToFlag(c.countryCode)}
            </span>
          ) : null}
          <span className="text-gray-800">{c.city}</span>
          {i < chain.length - 1 ? (
            <span className="text-gray-400 text-xs">→</span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function Initials({ first, last }: { first: string; last: string }) {
  const i = `${(first || "?")[0] || ""}${(last || "")[0] || ""}`.toUpperCase() || "?";
  return (
    <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center">
      {i}
    </div>
  );
}

type EditDraft = {
  origin: CityWithCountry | null;
  destinations: CityWithCountry[];
  returnToOrigin: boolean;
  returnCity: CityWithCountry | null;
  dateFrom: string | undefined;
  dateTo: string | undefined;
};

function cityRefToWithCountry(c: CityRef | null | undefined): CityWithCountry | null {
  if (!c?.city) return null;
  return {
    city: c.city,
    country: c.country || "",
    countryCode: c.countryCode,
  };
}

function draftFromTraveller(t: TravellerRow): EditDraft {
  const it = (t.itinerary || {}) as TravellerItinerary;
  const origin = cityRefToWithCountry(it.origin);
  const dests = (it.destinations || [])
    .map(cityRefToWithCountry)
    .filter((c): c is CityWithCountry => !!c);
  const returnCity = cityRefToWithCountry(it.returnCity);
  const returnToOrigin =
    !returnCity || (!!origin && returnCity.city === origin.city);
  return {
    origin,
    destinations: dests,
    returnToOrigin,
    returnCity,
    dateFrom: t.dateFrom || undefined,
    dateTo: t.dateTo || undefined,
  };
}

export default function OrderPassengerRoutes({
  orderCode,
  fallbackCountriesCities,
  fallbackDateFrom,
  fallbackDateTo,
}: Props) {
  const [travellers, setTravellers] = useState<TravellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchWithAuth(
      `/api/orders/${encodeURIComponent(orderCode)}/travellers`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { travellers?: TravellerRow[] };
    return json.travellers ?? [];
  }, [orderCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((rows) => {
        if (!cancelled) setTravellers(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const startEdit = (t: TravellerRow) => {
    setEditingId(t.id);
    setDraft(draftFromTraveller(t));
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editingId || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const returnCity = draft.returnToOrigin ? draft.origin : draft.returnCity;
      const itinerary = {
        origin: draft.origin || null,
        destinations: draft.destinations,
        returnCity: returnCity || null,
      };
      const res = await fetchWithAuth(
        `/api/orders/${encodeURIComponent(orderCode)}/travellers/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itinerary,
            dateFrom: draft.dateFrom || null,
            dateTo: draft.dateTo || null,
          }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const rows = await load();
      setTravellers(rows);
      setEditingId(null);
      setDraft(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClearRoute = async () => {
    if (!editingId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetchWithAuth(
        `/api/orders/${encodeURIComponent(orderCode)}/travellers/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itinerary: {},
            dateFrom: null,
            dateTo: null,
          }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const rows = await load();
      setTravellers(rows);
      setEditingId(null);
      setDraft(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
        Loading passengers…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
        Failed to load passengers: {error}
      </div>
    );
  }

  if (travellers.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
        <MapPin className="h-4 w-4 text-gray-400" aria-hidden />
        <h3 className="text-sm font-semibold text-gray-700">
          Passengers &amp; routes
        </h3>
        <span className="text-xs text-gray-400">({travellers.length})</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {travellers.map((t) => {
          const it = (t.itinerary || {}) as TravellerItinerary;
          const empty = isItineraryEmpty(it);
          const chain = empty ? [] : buildChain(it);
          const hasOwnDates = !!t.dateFrom || !!t.dateTo;
          const dates = hasOwnDates
            ? formatDateRange(t.dateFrom ?? undefined, t.dateTo ?? undefined, true)
            : formatDateRange(fallbackDateFrom ?? undefined, fallbackDateTo ?? undefined, true);
          const isEditing = editingId === t.id;
          return (
            <li key={t.id} className="px-4 py-3 hover:bg-gray-50/60">
              <div className="flex items-start gap-3">
                <Initials first={t.firstName} last={t.lastName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {[t.firstName, t.lastName].filter(Boolean).join(" ") || "—"}
                    </span>
                    {t.isMainClient ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Lead
                      </span>
                    ) : null}
                    {empty ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500"
                        title="Falls back to the order route"
                      >
                        <Globe className="h-3 w-3" aria-hidden />
                        uses order route
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm">
                    {empty ? (
                      <span className="text-gray-400 italic text-xs">
                        {fallbackCountriesCities || "no route"}
                      </span>
                    ) : (
                      <CityChain chain={chain} />
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 tabular-nums">
                    {dates}
                  </div>
                </div>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    title="Edit route and dates"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                ) : null}
              </div>
              {isEditing && draft ? (
                <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/70 p-3 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      From (origin)
                    </label>
                    <CityMultiSelect
                      selectedCities={draft.origin ? [draft.origin] : []}
                      onChange={(cities) =>
                        setDraft((d) => (d ? { ...d, origin: cities[0] || null } : d))
                      }
                      placeholder="Origin city…"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      To (destinations)
                    </label>
                    <CityMultiSelect
                      selectedCities={draft.destinations}
                      onChange={(cities) =>
                        setDraft((d) => (d ? { ...d, destinations: cities } : d))
                      }
                      placeholder="Add destination…"
                    />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={draft.returnToOrigin}
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, returnToOrigin: e.target.checked } : d
                          )
                        }
                      />
                      Return to origin
                    </label>
                    {!draft.returnToOrigin ? (
                      <div className="flex-1 min-w-[12rem]">
                        <CityMultiSelect
                          selectedCities={draft.returnCity ? [draft.returnCity] : []}
                          onChange={(cities) =>
                            setDraft((d) =>
                              d ? { ...d, returnCity: cities[0] || null } : d
                            )
                          }
                          placeholder="Return city…"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Dates
                    </label>
                    <DateRangePicker
                      label="Travel dates"
                      from={draft.dateFrom}
                      to={draft.dateTo}
                      onChange={(from, to) =>
                        setDraft((d) => (d ? { ...d, dateFrom: from, dateTo: to } : d))
                      }
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Leave empty to inherit from the order.
                    </p>
                  </div>

                  {saveError ? (
                    <div className="rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-800">
                      {saveError}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClearRoute}
                      disabled={saving}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      title="Remove individual route, fall back to order route"
                    >
                      Use order route
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
