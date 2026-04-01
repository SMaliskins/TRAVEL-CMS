"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/i18n";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import type { CityWithCountry } from "@/components/CityMultiSelect";
import { getCityByName, searchCities, ISO_TO_COUNTRY, COUNTRY_TO_ISO } from "@/lib/data/cities";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { getCurrencySymbol } from "@/utils/currency";

export type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";

export type OrderHeaderEOrder = {
  id: string;
  order_code: string;
  client_display_name: string | null;
  client_party_id?: string | null;
  countries_cities: string | null;
  date_from: string | null;
  date_to: string | null;
  order_type: string;
  order_source?: string;
  status: OrderStatus;
  amount_total: number;
  amount_paid: number;
  amount_debt: number;
  payment_dates?: { type: string; date: string }[];
  overdue_days?: number | null;
};

export type ParsedItineraryForHeader = {
  origin: { name: string; countryCode?: string } | null;
  destinations: { name: string; countryCode?: string; country?: string }[];
  returnCity: { name: string; countryCode?: string } | null;
  daysUntil: number | null;
};

function ScoreboardDateCell({ iso }: { iso: string }) {
  const d = new Date(`${iso}T12:00:00`);
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const rawMonth = d.toLocaleDateString("en-GB", { month: "short" }).replace(/\.$/, "");
  const month = rawMonth.slice(0, 3).toUpperCase();
  return (
    <div
      className="flex w-[2.55rem] shrink-0 flex-col items-stretch rounded-md border border-sky-200/90 bg-gradient-to-b from-sky-50 to-slate-100 px-0.5 pb-0.5 pt-0.5 shadow-sm ring-1 ring-sky-100 sm:w-[2.85rem]"
      aria-label={iso}
    >
      <div className="w-full text-center text-[1.12rem] font-black tabular-nums leading-none tracking-tight text-slate-800 sm:text-[1.28rem]">
        {day}
      </div>
      <div className="mt-0.5 w-full text-center text-[0.54rem] font-bold uppercase leading-none tracking-[0.14em] text-sky-800/90">
        {month}
      </div>
      <div className="mt-0.5 w-full text-center text-[0.5rem] font-semibold tabular-nums leading-none text-slate-600 sm:text-[0.52rem]">
        {year}
      </div>
    </div>
  );
}

function fmtAmountShort(n: number, sym: string): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sym}${(abs / 1000).toFixed(1)}k`;
  return `${sym}${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildDestinationParts(
  order: OrderHeaderEOrder | null,
  parsedItinerary: ParsedItineraryForHeader,
  autoDestinations: CityWithCountry[]
): { countryCode: string | null; compact: string; full: string } {
  if (!order) return { countryCode: null, compact: "", full: "" };

  const manualDests = [
    ...parsedItinerary.destinations,
    ...(parsedItinerary.returnCity && parsedItinerary.returnCity.name !== parsedItinerary.origin?.name
      ? [parsedItinerary.returnCity]
      : []),
  ];
  const hasSaved = order.countries_cities?.trim();
  const allCities = hasSaved ? manualDests : autoDestinations.length > 0 ? autoDestinations : manualDests;

  if (allCities.length === 0) {
    return { countryCode: null, compact: "", full: "" };
  }

  const orderedCityNames: string[] = [];
  const countryCities: Record<string, { countryCode?: string; cities: string[] }> = {};

  for (const city of allCities) {
    const cityName = (city as { name?: string }).name || (city as { city?: string }).city || "";
    if (!cityName) continue;
    if (!orderedCityNames.includes(cityName)) orderedCityNames.push(cityName);

    const cityData = getCityByName(cityName);
    let countryName = cityData?.country || (city as Record<string, unknown>).country as string || "";
    let countryCode = (city as { countryCode?: string }).countryCode || cityData?.countryCode;
    if (!countryName && !countryCode) {
      const fuzzy = searchCities(cityName);
      if (fuzzy.length > 0) {
        countryName = fuzzy[0].country;
        countryCode = fuzzy[0].countryCode;
      }
    }
    if (!countryCode && countryName) {
      countryCode = COUNTRY_TO_ISO[countryName] || undefined;
    }
    if (!countryName) countryName = countryCode ? ISO_TO_COUNTRY[countryCode] || countryCode : "";
    const groupKey = countryName || cityName;
    if (!countryCities[groupKey]) countryCities[groupKey] = { countryCode, cities: [] };
    if (!countryCities[groupKey].cities.includes(cityName)) countryCities[groupKey].cities.push(cityName);
  }

  const fullParts = Object.entries(countryCities).map(([country, data]) => {
    const citiesStr = data.cities.join(", ");
    return data.cities.length === 1 && data.cities[0] === country ? country : `${country} (${citiesStr})`;
  });
  const full = fullParts.join(" / ");

  let compact = "";
  if (orderedCityNames.length >= 2) {
    compact = `${orderedCityNames[0]} → ${orderedCityNames[orderedCityNames.length - 1]}`;
  } else if (orderedCityNames.length === 1) {
    compact = orderedCityNames[0];
  }

  let countryCode: string | null = null;
  for (const [, data] of Object.entries(countryCities)) {
    if (data.countryCode) {
      countryCode = data.countryCode;
      break;
    }
  }

  return { countryCode, compact, full };
}

export type OrderPageHeaderEProps = {
  lang: string;
  order: OrderHeaderEOrder | null;
  orderLoading: boolean;
  effectiveOrderCode: string;
  effectiveStatus: OrderStatus;
  orderCode: string;
  companyCurrencyCode: string;
  linkedToInvoices: number;
  showOrderSource: boolean;
  showPaymentPlan: boolean;
  setShowPaymentPlan: React.Dispatch<React.SetStateAction<boolean>>;
  currentRole: string | null;
  isSaving: boolean;
  onStatusChange: (s: OrderStatus) => void | Promise<void>;
  onDeleteOpen: () => void;
  isCtrlPressed: boolean;
  leadPassengerHeaderAvatar: { imageUrl: string | null; initials: string };
  leadPassengerAvatarFailed: boolean;
  setLeadPassengerAvatarFailed: (v: boolean) => void;
  parsedItinerary: ParsedItineraryForHeader;
  autoDestinations: CityWithCountry[];
  startEditingClient: () => void;
  startEditingItinerary: () => void;
  startEditingDates: () => void;
  setOrder: React.Dispatch<React.SetStateAction<OrderHeaderEOrder | null>>;
  onOpenDirectoryParty: (partyId: string) => void;
  /** When editing client, replaces row 2 (trip line). */
  row2Replacement?: React.ReactNode;
};

export function OrderPageHeaderE({
  lang,
  order,
  orderLoading,
  effectiveOrderCode,
  effectiveStatus,
  orderCode,
  companyCurrencyCode,
  linkedToInvoices,
  showOrderSource,
  showPaymentPlan,
  setShowPaymentPlan,
  currentRole,
  isSaving,
  onStatusChange,
  onDeleteOpen,
  isCtrlPressed,
  leadPassengerHeaderAvatar,
  leadPassengerAvatarFailed,
  setLeadPassengerAvatarFailed,
  parsedItinerary,
  autoDestinations,
  startEditingClient,
  startEditingItinerary,
  startEditingDates,
  setOrder,
  onOpenDirectoryParty,
  row2Replacement,
}: OrderPageHeaderEProps) {
  const router = useRouter();
  const currencySymbol = getCurrencySymbol(companyCurrencyCode);

  const dest = useMemo(
    () => buildDestinationParts(order, parsedItinerary, autoDestinations),
    [order, parsedItinerary, autoDestinations]
  );

  const patchOrderField = async (body: Record<string, unknown>, rollback: () => void) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) rollback();
    } catch {
      rollback();
    }
  };

  if (!order) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        {orderLoading ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-7 w-28 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
              <div className="flex gap-2">
                <div className="h-14 w-11 animate-pulse rounded-md bg-sky-100" />
                <div className="h-14 w-11 animate-pulse rounded-md bg-sky-100" />
              </div>
            </div>
            <div className="h-8 w-full max-w-md animate-pulse rounded bg-gray-100" />
          </div>
        ) : (
          <div className="text-sm text-gray-500">{effectiveOrderCode}</div>
        )}
      </div>
    );
  }

  const paid = order.amount_paid ?? 0;
  const total = order.amount_total ?? 0;
  const refundDue = Math.max(0, Math.round((paid - total) * 100) / 100);
  const isRefundDue = total > 0 && refundDue > 0.01;
  const overpayment = Math.max(0, Math.round((paid - linkedToInvoices) * 100) / 100);
  const isOverpaid = paid > linkedToInvoices + 0.01;
  const isPaid = total > 0 && paid >= total && !isOverpaid && !isRefundDue;
  const isPartial = paid > 0 && total > 0 && paid < total;
  const isUnpaid = total > 0 && paid === 0;
  const paidRatio = total > 0 ? Math.min(1, paid / total) : 0;

  const payBadgeClass = isRefundDue
    ? "bg-purple-100 text-purple-800"
    : isOverpaid
      ? "bg-purple-100 text-purple-800"
      : isPaid
        ? "bg-green-100 text-green-800"
        : isPartial
          ? "bg-yellow-100 text-yellow-800"
          : "bg-red-100 text-red-800";

  const payBadgeLabel = isRefundDue
    ? t(lang, "order.refundDue")
    : isOverpaid
      ? t(lang, "order.overpaid")
      : isPaid
        ? t(lang, "order.paid")
        : isPartial
          ? t(lang, "order.partiallyPaid")
          : t(lang, "order.unpaid");

  const dateFromIso = order.date_from?.slice(0, 10);
  const dateToIso = order.date_to?.slice(0, 10);

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
          <h1 className="text-lg font-bold leading-tight text-gray-900">{effectiveOrderCode}</h1>
          <OrderStatusBadge
            status={effectiveStatus}
            size="xs"
            onChange={effectiveStatus !== "Completed" ? onStatusChange : undefined}
            readonly={effectiveStatus === "Completed" || isSaving}
          />
          {(currentRole === "supervisor" || currentRole === "director") && (
            <button
              type="button"
              onClick={onDeleteOpen}
              title="Delete order"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label="Delete order"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className="flex items-end gap-1.5 sm:gap-2"
            onClick={startEditingDates}
            title="Click to edit dates"
          >
            {dateFromIso ? (
              <ScoreboardDateCell iso={dateFromIso} />
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
            <span className="mb-2 text-base font-light text-gray-400 select-none sm:mb-2.5" aria-hidden>
              –
            </span>
            {dateToIso ? (
              <ScoreboardDateCell iso={dateToIso} />
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </button>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="relative text-right">
            <button type="button" onClick={() => setShowPaymentPlan((p) => !p)} className="text-right">
              <div className="text-lg font-bold leading-tight text-gray-900">
                {currencySymbol}
                {(order.amount_total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-gray-400">{t(lang, "order.totalActiveServices")}</div>
            </button>
            {showPaymentPlan && (order.payment_dates?.length ?? 0) > 0 && (
              <div className="absolute right-0 top-full z-30 mt-1">
                <div className="min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg">
                  <div className="mb-1.5 text-[11px] font-semibold text-gray-900">{t(lang, "order.paymentPlan")}</div>
                  <div className="space-y-1">
                    {order.payment_dates!.map((p, i) => (
                      <div key={i} className="flex justify-between gap-4">
                        <span className="text-gray-500">
                          {p.type === "deposit" ? t(lang, "order.deposit") : t(lang, "order.final")}
                        </span>
                        <span className="font-medium">{formatDateDDMMYYYY(p.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payBadgeClass}`}>{payBadgeLabel}</div>
            {order.overdue_days != null && order.overdue_days > 0 && (
              <span className="text-[10px] font-medium text-red-600">
                {order.overdue_days}{" "}
                {order.overdue_days === 1 ? t(lang, "order.dayOverdue") : t(lang, "order.daysOverdue")}
              </span>
            )}
          </div>
          <div
            className="hidden w-24 shrink-0 sm:block"
            title={`${currencySymbol}${paid.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${t(lang, "order.paidAmount")}, ${currencySymbol}${(order.amount_debt ?? Math.max(0, total - paid)).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${t(lang, "order.remaining")}`}
          >
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, paidRatio * 100)}%` }} />
            </div>
            <div className="mt-0.5 text-right text-[10px] tabular-nums text-gray-400">
              {fmtAmountShort(paid, currencySymbol)} / {fmtAmountShort(total, currencySymbol)}
            </div>
          </div>
        </div>
      </div>

      {row2Replacement ? (
        <div className="border-t border-gray-100 pt-2">{row2Replacement}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-gray-100 pt-2 text-xs text-gray-800 sm:text-sm">
          <button
            type="button"
            disabled={!order.client_party_id}
            onClick={() => order.client_party_id && onOpenDirectoryParty(order.client_party_id)}
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-blue-100 text-[11px] font-semibold text-blue-800 ${
              order.client_party_id
                ? "cursor-pointer hover:ring-2 hover:ring-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                : "cursor-default opacity-90"
            }`}
            title={order.client_party_id ? "Open directory card" : undefined}
            aria-label={order.client_party_id ? "Open lead passenger directory card" : undefined}
          >
            {leadPassengerHeaderAvatar.imageUrl && !leadPassengerAvatarFailed ? (
              <img
                src={leadPassengerHeaderAvatar.imageUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full rounded-full border-0 object-cover"
                onError={() => setLeadPassengerAvatarFailed(true)}
              />
            ) : null}
            <span
              className={
                leadPassengerHeaderAvatar.imageUrl && !leadPassengerAvatarFailed
                  ? "sr-only"
                  : "relative z-10 pointer-events-none"
              }
              aria-hidden
            >
              {leadPassengerHeaderAvatar.initials}
            </span>
          </button>
          <button
            type="button"
            className={`cursor-pointer text-left font-semibold rounded px-0.5 ${
              isCtrlPressed && order.client_party_id ? "text-blue-600 underline" : "text-blue-600 hover:underline"
            }`}
            onClick={(e) => {
              if ((e.ctrlKey || e.metaKey) && order.client_party_id) {
                e.preventDefault();
                router.push(`/directory/${order.client_party_id}`);
              } else {
                startEditingClient();
              }
            }}
            title={
              order.client_party_id
                ? `${t(lang, "order.clickToChangeClient")} · ${t(lang, "order.ctrlClickToOpenClient")}`
                : t(lang, "order.clickToChangeClient")
            }
          >
            {order.client_display_name || t(lang, "order.selectClient")}
          </button>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            className="inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 text-left text-gray-700 sm:max-w-md"
            onClick={startEditingItinerary}
            title={dest.full || t(lang, "order.clickToEditItinerary")}
          >
            {dest.countryCode ? (
              <span
                className={`fi fi-${dest.countryCode.toLowerCase()} h-3.5 w-4 shrink-0 rounded-sm bg-cover bg-center`}
                aria-hidden
              />
            ) : null}
            <span className="truncate text-sm">
              {dest.compact || t(lang, "order.clickToSet")}
            </span>
          </button>
          {parsedItinerary.daysUntil !== null && parsedItinerary.daysUntil >= 0 ? (
            <>
              <span className="text-gray-300">·</span>
              <span className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                {parsedItinerary.daysUntil}{" "}
                {t(lang, parsedItinerary.daysUntil === 1 ? "order.dayBeforeTrip" : "order.daysBeforeTrip")}
              </span>
            </>
          ) : null}
          <div className="flex w-full flex-col items-stretch gap-1.5 sm:ml-auto sm:w-auto sm:flex-1 sm:items-end">
            <div className="flex flex-wrap justify-end gap-1">
              {(
                [
                  { value: "leisure", label: t(lang, "order.leisure") },
                  { value: "business", label: t(lang, "order.business") },
                  { value: "lifestyle", label: t(lang, "order.lifestyle") },
                ] as const
              ).map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    if (order.order_type === type.value) return;
                    const prev = order.order_type;
                    setOrder({ ...order, order_type: type.value });
                    void patchOrderField({ order_type: type.value }, () =>
                      setOrder((prevOrder) => (prevOrder ? { ...prevOrder, order_type: prev } : prevOrder))
                    );
                  }}
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    order.order_type === type.value ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            {showOrderSource ? (
              <div className="flex flex-wrap justify-end gap-1">
                {(["TA", "TO", "CORP", "NON"] as const).map((src) => {
                  const selected = order.order_source === src;
                  const highlight = src === "TA" || src === "TO";
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        if (selected) return;
                        const prev = order.order_source;
                        setOrder({ ...order, order_source: src });
                        void patchOrderField({ order_source: src }, () =>
                          setOrder((prevOrder) => (prevOrder ? { ...prevOrder, order_source: prev } : prevOrder))
                        );
                      }}
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        selected
                          ? "bg-blue-600 text-white shadow-sm"
                          : highlight
                            ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {src}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
