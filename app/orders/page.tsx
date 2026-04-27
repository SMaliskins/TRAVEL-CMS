"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchOrdersListPage,
  ordersListQueryKeys,
  ORDERS_LIST_PAGE_SIZE,
  ORDERS_LIST_STALE_MS,
} from "@/lib/orders/ordersListQueries";
import ordersSearchStore from "@/lib/stores/ordersSearchStore";
import { filterOrders } from "@/lib/stores/filterOrders";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useTabs } from "@/contexts/TabsContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { Plus, FileText, FileCheck, FileMinus2, CircleDollarSign, CheckCircle2, Check, Clock, CircleAlert, CirclePlus, Search, X, List, CalendarDays, ChevronLeft, ChevronRight, Globe, AlertTriangle } from "lucide-react";
import { getCityByName, ensureWorldCitiesLoaded } from "@/lib/data/cities";

type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";
type OrderType = "TA" | "TO" | "CORP" | "NON";
type AccessType = "Owner" | "Delegated";
type SupplierInvoicePreviewTone = "green" | "amber" | "purple" | "red" | "blue";

interface OrderRow {
  orderId: string;
  client: string;
  countriesCities: string;
  datesFrom: string;
  datesTo: string;
  amount: number;
  paid: number;
  debt: number;
  vat: number;
  profit: number;
  status: OrderStatus;
  type: OrderType;
  owner: string;
  ownerId: string;
  access: AccessType;
  updated: string;
  createdAt?: string;
  invoiceCount?: number;
  dueDate?: string;
  totalServices?: number;
  invoicedServices?: number;
  hasInvoice?: boolean;
  allServicesInvoiced?: boolean;
  totalInvoices?: number;
  allInvoicesPaid?: boolean;
  payers?: string[];
  /** Service clients + travellers (API) — search; payers use `payers` */
  serviceClients?: string[];
  /** Order has a referral partner (profit in list is after referral commission) */
  hasReferral?: boolean;
  referralCommissionTotal?: number;
  supplierInvoiceStatus?: string;
  supplierInvoiceStatusLabel?: string;
  supplierInvoiceStatusTone?: SupplierInvoicePreviewTone;
}

interface OrderTotals {
  amount: number;
  paid: number;
  debt: number;
  vat: number;
  profit: number;
}

interface OrderTreeDay {
  dayKey: string; // "2025-01-15"
  dayLabel: string; // "15/01/2025"
  totals: OrderTotals;
  orders: OrderRow[];
}

interface OrderTreeMonth {
  monthKey: string; // "2025-01"
  monthLabel: string; // "January"
  totals: OrderTotals;
  days: OrderTreeDay[];
}

interface OrderTreeYear {
  year: string; // "2025"
  totals: OrderTotals;
  months: OrderTreeMonth[];
}

type OrderTree = OrderTreeYear[];

// Helper to safely sum values
function sumSafe(values: (number | null | undefined)[]): number {
  return values
    .filter((v): v is number => typeof v === "number" && !isNaN(v))
    .reduce((sum, val) => sum + val, 0);
}

// Helper to calculate totals from orders
function calculateTotals(orders: OrderRow[]): OrderTotals {
  return {
    amount: sumSafe(orders.map((o) => o.amount)),
    paid: sumSafe(orders.map((o) => o.paid)),
    debt: sumSafe(orders.map((o) => o.debt)),
    vat: sumSafe(orders.map((o) => o.vat ?? 0)),
    profit: sumSafe(orders.map((o) => o.profit)),
  };
}

type DateGroupMode = "created" | "checkIn" | "checkOut";

// Parse ISO date string (YYYY-MM-DD or with time) to [year, month, day] — timezone-safe
function parseIsoToParts(raw: string): { year: string; month: string; day: string } | null {
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [year, month, day] = s.split("-");
  if (!year || !month || !day) return null;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year, month: month.padStart(2, "0"), day: day.padStart(2, "0") };
}

const MAX_ISO_DAYS_PER_ORDER_FOR_CALENDAR = 800;

/** Next calendar day as YYYY-MM-DD (UTC date math; valid ISO dates compare lexicographically). */
function addOneCalendarDayIso(iso: string): string | null {
  const parts = parseIsoToParts(iso);
  if (!parts) return null;
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Map each YYYY-MM-DD in [datesFrom, datesTo] to orders whose trip spans that day (for calendar grid). */
function buildOrdersOverlappingByIsoDay(orders: OrderRow[]): Map<string, OrderRow[]> {
  const map = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const from = o.datesFrom?.slice(0, 10);
    const to = o.datesTo?.slice(0, 10);
    if (!from || !to || from > to) continue;
    if (!parseIsoToParts(from) || !parseIsoToParts(to)) continue;
    let cur = from;
    for (let guard = 0; guard < MAX_ISO_DAYS_PER_ORDER_FOR_CALENDAR; guard++) {
      if (cur > to) break;
      const list = map.get(cur);
      if (list) list.push(o);
      else map.set(cur, [o]);
      if (cur === to) break;
      const next = addOneCalendarDayIso(cur);
      if (!next || next <= cur) break;
      cur = next;
    }
  }
  return map;
}

// Build orders tree structure (timezone-safe: uses date string parts, not Date)
function buildOrdersTree(orders: OrderRow[], dateMode: DateGroupMode = "created"): OrderTree {
  const yearMap = new Map<string, Map<string, Map<string, OrderRow[]>>>();

  orders.forEach((order) => {
    const raw = dateMode === "checkIn" ? order.datesFrom
              : dateMode === "checkOut" ? order.datesTo
              : (order.createdAt || order.updated);
    if (!raw) return;
    const parts = parseIsoToParts(raw);
    if (!parts) return;
    const { year, month, day } = parts;
    const monthKey = `${year}-${month}`;
    const dayKey = `${year}-${month}-${day}`;

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map());
    }
    const monthMap = yearMap.get(year)!;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, new Map());
    }
    const dayMap = monthMap.get(monthKey)!;

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }
    dayMap.get(dayKey)!.push(order);
  });

  // Build tree structure
  const tree: OrderTree = [];

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Sort years DESC
  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => Number(b) - Number(a));

  sortedYears.forEach((year) => {
    const monthMap = yearMap.get(year)!;
    const months: OrderTreeMonth[] = [];

    // Sort months DESC (string compare YYYY-MM is safe)
    const sortedMonths = Array.from(monthMap.keys()).sort((a, b) => (b > a ? 1 : a > b ? -1 : 0));

    sortedMonths.forEach((monthKey) => {
      const dayMap = monthMap.get(monthKey)!;
      const days: OrderTreeDay[] = [];

      // Sort days DESC (string compare YYYY-MM-DD is safe)
      const sortedDays = Array.from(dayMap.keys()).sort((a, b) => (b > a ? 1 : a > b ? -1 : 0));

      sortedDays.forEach((dayKey) => {
        const orders = dayMap.get(dayKey)!;

        // Sort orders by order_code DESC (e.g. 0015/26-SM > 0014/26-SM)
        const sortedOrders = [...orders].sort((a, b) => {
          return b.orderId.localeCompare(a.orderId);
        });

        const dayLabel = formatDateDDMMYYYY(dayKey);

        days.push({
          dayKey,
          dayLabel,
          totals: calculateTotals(sortedOrders),
          orders: sortedOrders,
        });
      });

      // Month label from monthKey (e.g. "2026-02" -> February) — no Date/timezone
      const monthNum = parseInt(monthKey.split("-")[1] || "1", 10) - 1;
      const monthLabel = monthNames[Math.max(0, Math.min(11, monthNum))];

      months.push({
        monthKey,
        monthLabel,
        totals: calculateTotals(days.flatMap((d) => d.orders)),
        days,
      });
    });

    tree.push({
      year,
      totals: calculateTotals(months.flatMap((m) => m.days.flatMap((d) => d.orders))),
      months,
    });
  });

  return tree;
}

// Country name to ISO code mapping
const countryToISO: Record<string, string> = {
  "Spain": "ES",
  "Egypt": "EG",
  "Turkey": "TR",
  "Italy": "IT",
  "France": "FR",
  "Latvia": "LV",
  "Germany": "DE",
  "UAE": "AE",
  "United Arab Emirates": "AE",
  "Greece": "GR",
  "Portugal": "PT",
  "Netherlands": "NL",
  "Switzerland": "CH",
  "UK": "GB",
  "United Kingdom": "GB",
  "Austria": "AT",
  "Czech Republic": "CZ",
  "Belgium": "BE",
  "Thailand": "TH",
  "Maldives": "MV",
  "Croatia": "HR",
  "Montenegro": "ME",
  "Cyprus": "CY",
  "Bulgaria": "BG",
  "Morocco": "MA",
  "Tunisia": "TN",
  "Sri Lanka": "LK",
  "Indonesia": "ID",
  "Mexico": "MX",
  "Dominican Republic": "DO",
  "Cuba": "CU",
  "USA": "US",
  "United States": "US",
  "India": "IN",
  "Japan": "JP",
  "China": "CN",
  "South Korea": "KR",
  "Australia": "AU",
  "New Zealand": "NZ",
  "Brazil": "BR",
  "Argentina": "AR",
  "Canada": "CA",
  "Norway": "NO",
  "Sweden": "SE",
  "Finland": "FI",
  "Denmark": "DK",
  "Iceland": "IS",
  "Ireland": "IE",
  "Poland": "PL",
  "Hungary": "HU",
  "Romania": "RO",
  "Georgia": "GE",
  "Armenia": "AM",
  "Azerbaijan": "AZ",
  "Israel": "IL",
  "Jordan": "JO",
  "Oman": "OM",
  "Qatar": "QA",
  "Bahrain": "BH",
  "Saudi Arabia": "SA",
  "Kuwait": "KW",
  "Tanzania": "TZ",
  "Kenya": "KE",
  "South Africa": "ZA",
  "Mauritius": "MU",
  "Seychelles": "SC",
  "Malta": "MT",
  "Estonia": "EE",
  "Lithuania": "LT",
  "Singapore": "SG",
  "Malaysia": "MY",
  "Vietnam": "VN",
  "Philippines": "PH",
  "Cambodia": "KH",
  "Uzbekistan": "UZ",
  "Kazakhstan": "KZ",
  "Kyrgyzstan": "KG",
  "Tajikistan": "TJ",
  "Turkmenistan": "TM",
};

// Get country flag emoji from country name
function getCountryFlag(countryName: string): string | null {
  const trimmed = countryName.trim();
  if (!trimmed) return null;

  // Try to find ISO code
  const iso = countryToISO[trimmed];
  if (!iso) return null;

  // Convert ISO code to emoji flag
  const codePoints = iso
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));

  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return null;
  }
}

function toInitials(name: string): string {
  if (!name) return "—";
  return name.split(" ").map(w => w[0]).filter(Boolean).join("").toUpperCase();
}

function formatCountriesWithFlags(countriesCities: string): React.ReactNode {
  if (!countriesCities) return <span className="text-gray-400">—</span>;

  const parts = countriesCities.split('|').map(p => p.trim());
  const destinations = parts.filter(p => !p.startsWith('origin:') && !p.startsWith('return:'));
  
  const items = destinations.length > 0 
    ? destinations 
    : parts.map(p => p.replace(/^(origin|return):/i, '').trim()).filter(p => p.length > 0);
  
  // Deduplicate (e.g. origin and return same city)
  const uniqueItems = [...new Set(items)];
  
  if (uniqueItems.length === 0) return <span className="text-gray-400">—</span>;

  const parsed = uniqueItems.flatMap(item => {
    return item.split(';').map(sub => {
      const s = sub.trim();
      if (!s) return null;
      // Format "XX City" (country code + city) — e.g. TR Tekirova, BG Nesebar
      const codeCityMatch = s.match(/^([A-Za-z]{2})\s+(.+)$/);
      if (codeCityMatch) {
        const code = codeCityMatch[1].toUpperCase();
        const city = codeCityMatch[2].trim();
        return { city, countryCode: code };
      }
      const cityName = s.split(',')[0]?.trim() || s;
      const cityData = getCityByName(cityName);
      if (cityData?.countryCode) {
        return { city: cityData.name, countryCode: cityData.countryCode };
      }
      const match = s.match(/^(.+),\s*([^,]+)$/);
      if (match) {
        const city = match[1].trim();
        const country = match[2].trim();
        const iso = countryToISO[country.trim()];
        return { city, countryCode: iso || null };
      }
      return { city: s, countryCode: null };
    }).filter(Boolean);
  }) as { city: string; countryCode: string | null }[];

  if (parsed.length === 0) return <span className="text-gray-400">—</span>;

  // Multi-Country / Multi-City compact label.
  // Triggers when the route is too rich to fit a flag-per-city list.
  const uniqueCountryCodes = new Set(
    parsed.map((p) => p.countryCode).filter((c): c is string => Boolean(c))
  );
  const uniqueCities = new Set(parsed.map((p) => p.city).filter(Boolean));
  const tooltip = parsed
    .map((p) => (p.countryCode ? `${p.city} (${p.countryCode})` : p.city))
    .join(", ");

  if (uniqueCountryCodes.size >= 2) {
    return (
      <span
        className="inline-flex items-center gap-1 text-gray-700"
        title={tooltip}
      >
        <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
        <span>Multi-Country</span>
        <span className="text-gray-400 text-xs">({uniqueCountryCodes.size})</span>
      </span>
    );
  }

  if (uniqueCountryCodes.size === 1 && uniqueCities.size >= 4) {
    return (
      <span
        className="inline-flex items-center gap-1 text-gray-700"
        title={tooltip}
      >
        <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
        <span>Multi-City</span>
        <span className="text-gray-400 text-xs">({uniqueCities.size})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {parsed.map((item, i) => (
        <span key={i} className="inline-flex items-center">
          {item.countryCode && (
            <span
              className={`fi fi-${item.countryCode.toLowerCase()} mr-0.5 inline-block h-3.5 w-[1.375rem] shrink-0 rounded-sm overflow-hidden bg-cover bg-center`}
              title={item.city}
              aria-hidden
            />
          )}
          <span>{item.city}</span>
          {i < parsed.length - 1 && <span className="text-gray-300 mx-1">,</span>}
        </span>
      ))}
    </span>
  );
}

const getStatusBadgeColor = (status: OrderStatus): { bg: string; text: string; dot: string } => {
  switch (status) {
    case "Draft":
      return { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-400" };
    case "Active":
      return { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" };
    case "Cancelled":
      return { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" };
    case "Completed":
      return { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" };
    case "On hold":
      return { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-400" };
  }
};

const getSupplierInvoicePreviewToneClass = (tone: SupplierInvoicePreviewTone | undefined): string => {
  switch (tone) {
    case "green":
      return "text-green-600";
    case "blue":
      return "text-blue-600";
    case "purple":
      return "text-purple-600";
    case "red":
      return "text-red-600";
    case "amber":
    default:
      return "text-amber-600";
  }
};

function getSupplierInvoicePreviewIcon(status: string | undefined): React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> {
  switch (status) {
    case "missing":
      return CircleAlert;
    case "unmatched_documents":
      return FileText;
    case "attention":
      return AlertTriangle;
    case "periodic_only":
      return CalendarDays;
    case "all_matched":
    default:
      return CheckCircle2;
  }
}

function renderSupplierInvoicePreviewBadge(order: OrderRow) {
  const fullLabel = order.supplierInvoiceStatusLabel || "All matched";
  const Icon = getSupplierInvoicePreviewIcon(order.supplierInvoiceStatus);
  const toneClass = getSupplierInvoicePreviewToneClass(order.supplierInvoiceStatusTone);
  return (
    <span
      className={`inline-flex justify-center ${toneClass} cursor-help`}
      title={fullLabel}
    >
      <Icon size={14} strokeWidth={1.8} />
    </span>
  );
}

// Helper to load expanded state from localStorage
function loadExpandedFromStorage(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  
  try {
    const stored = localStorage.getItem("travelcms.orders.expanded");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load expanded state from localStorage", e);
  }
  
  return {};
}

// Helper to save expanded state to localStorage
function saveExpandedToStorage(expanded: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem("travelcms.orders.expanded", JSON.stringify(expanded));
  } catch (e) {
    console.error("Failed to save expanded state to localStorage", e);
  }
}

// Helper to generate group keys
function getGroupKey(type: "year" | "month" | "day", key: string): string {
  switch (type) {
    case "year":
      return `Y:${key}`;
    case "month":
      return `YM:${key}`;
    case "day":
      return `YMD:${key}`;
  }
}

// Debounce delay for semantic search (ms)
const SEMANTIC_DEBOUNCE_MS = 400;
/** Orders list API + React Query key — must not change on every keystroke */
const ORDERS_LIST_SEARCH_DEBOUNCE_MS = 320;

export default function OrdersPage() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { openTab } = useTabs();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [searchState, setSearchState] = useState(() => ordersSearchStore.getState());
  const listSearch = searchState.queryText.trim();
  const listLastName = searchState.clientLastName.trim();
  const debouncedListSearch = useDebounce(listSearch, ORDERS_LIST_SEARCH_DEBOUNCE_MS);
  const debouncedListLastName = useDebounce(listLastName, ORDERS_LIST_SEARCH_DEBOUNCE_MS);

  const {
    data: listInfiniteData,
    isPending: listQueryPending,
    isError: listQueryIsError,
    error: listQueryErr,
    refetch: refetchOrdersList,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ordersListQueryKeys.listInfinite(
      ORDERS_LIST_PAGE_SIZE,
      debouncedListSearch,
      debouncedListLastName
    ),
    queryFn: ({ pageParam }) =>
      fetchOrdersListPage(
        pageParam,
        ORDERS_LIST_PAGE_SIZE,
        debouncedListSearch,
        debouncedListLastName
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      if (!p || p.page >= p.totalPages) return undefined;
      return p.page + 1;
    },
    staleTime: ORDERS_LIST_STALE_MS,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const loadError =
    listQueryIsError && listQueryErr instanceof Error
      ? listQueryErr.message
      : listQueryIsError
        ? String(listQueryErr)
        : null;

  const [agents, setAgents] = useState<{ id: string; name: string; initials: string }[]>([]);

  useEffect(() => {
    const pages = listInfiniteData?.pages;
    if (!pages?.length) return;
    setAgents((prev) => {
      const merged = new Map(prev.map((a) => [a.id, a]));
      for (const page of pages) {
        (page.agents || []).forEach((a) => merged.set(a.id, a));
      }
      return Array.from(merged.values());
    });
  }, [listInfiniteData?.pages]);

  const pagination = useMemo(() => {
    const pages = listInfiniteData?.pages;
    if (!pages?.length) return null;
    const last = pages[pages.length - 1].pagination;
    return last
      ? { page: last.page, total: last.total, totalPages: last.totalPages }
      : null;
  }, [listInfiniteData?.pages]);

  const orders = useMemo(
    () =>
      listInfiniteData?.pages.flatMap((p) => (p.orders as OrderRow[]) ?? []) ?? [],
    [listInfiniteData?.pages]
  );

  const isLoading = listQueryPending && !listInfiniteData;
  const [semanticOrderCodes, setSemanticOrderCodes] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    loadExpandedFromStorage()
  );
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [dateGroupMode, setDateGroupMode] = useState<DateGroupMode>("created");
  const [dateSortAsc, setDateSortAsc] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [surnameInput, setSurnameInput] = useState(searchState.clientLastName || "");
  const surnameDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_MS = 180;
  useEffect(() => () => { if (surnameDebounceRef.current) clearTimeout(surnameDebounceRef.current); }, []);

  /** Bumps after extended world cities JSON loads so flag lookups re-run (A3.1). */
  const [worldCitiesEpoch, setWorldCitiesEpoch] = useState(0);
  const worldCitiesLoadOnceRef = useRef(false);

  const countriesFlagsMap = useMemo(() => {
    const map = new Map<string, React.ReactNode>();
    orders.forEach(order => {
      if (order.countriesCities && !map.has(order.countriesCities)) {
        map.set(order.countriesCities, formatCountriesWithFlags(order.countriesCities));
      }
    });
    return map;
  }, [orders, worldCitiesEpoch]);

  // Single init effect: store → URL params → subscribe → defer world cities
  useEffect(() => {
    ordersSearchStore.init();

    const createdFrom = urlSearchParams.get("createdFrom");
    const createdTo = urlSearchParams.get("createdTo");
    const urlStatus = urlSearchParams.get("status");
    if (createdFrom || createdTo || urlStatus) {
      const patch: Partial<import("@/lib/stores/ordersSearchStore").OrdersSearchState> = {};
      if (createdFrom || createdTo) {
        patch.createdAt = { from: createdFrom || undefined, to: createdTo || undefined };
        setDateGroupMode("created");
      }
      if (urlStatus) {
        patch.status = urlStatus;
      }
      ordersSearchStore.applyPatch(patch);
      window.history.replaceState({}, "", "/orders");
    } else {
      ordersSearchStore.applyPatch({ createdAt: {}, status: "all" });
    }

    setSearchState(ordersSearchStore.getState());

    let prev = ordersSearchStore.getState();
    const unsubscribe = ordersSearchStore.subscribe((next) => {
      if (
        prev.queryText === next.queryText &&
        prev.agentId === next.agentId &&
        prev.country === next.country &&
        prev.status === next.status &&
        prev.orderType === next.orderType &&
        prev.delegatedToMe === next.delegatedToMe &&
        prev.hotelName === next.hotelName &&
        prev.clientLastName === next.clientLastName &&
        prev.refNr === next.refNr &&
        prev.checkIn?.from === next.checkIn?.from &&
        prev.checkIn?.to === next.checkIn?.to &&
        prev.return?.from === next.return?.from &&
        prev.return?.to === next.return?.to &&
        prev.createdAt?.from === next.createdAt?.from &&
        prev.createdAt?.to === next.createdAt?.to
      ) {
        return;
      }
      prev = next;
      setSearchState({ ...next });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (orders.length === 0 || worldCitiesLoadOnceRef.current) return;
    worldCitiesLoadOnceRef.current = true;
    let cancelled = false;
    ensureWorldCitiesLoaded().then(() => {
      if (!cancelled) setWorldCitiesEpoch((e) => e + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [orders.length]);

  // Debounced semantic search when queryText changes
  useEffect(() => {
    const q = searchState.queryText?.trim();
    if (!q || q.length < 2) {
      setSemanticOrderCodes([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || null;
        const res = await fetch("/api/search/semantic/order-service", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ query: q, limit: 20 }),
        });
        if (res.ok) {
          const data = await res.json();
          setSemanticOrderCodes(data.orderCodes || []);
        } else {
          setSemanticOrderCodes([]);
        }
      } catch {
        setSemanticOrderCodes([]);
      }
    }, SEMANTIC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchState.queryText]);

  // Filter orders based on search state (no useDeferredValue — filters must stay in sync with inputs)
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, searchState, {
      semanticOrderCodes,
      // Align skips with what the list API last requested (debounced), not raw keystrokes
      skipClientQueryTextMatch: debouncedListSearch.length > 0,
      skipSurnameMatch: debouncedListLastName.length > 0,
    });
  }, [
    orders,
    searchState,
    semanticOrderCodes,
    debouncedListSearch,
    debouncedListLastName,
  ]);

  // Build tree from filtered orders
  const tree = useMemo(() => buildOrdersTree(filteredOrders, dateGroupMode), [filteredOrders, dateGroupMode]);

  // Flat month-grouped list for Start date / End date modes (timezone-safe)
  const monthGroupedOrders = useMemo(() => {
    if (dateGroupMode === "created") return null;
    const dateKey = dateGroupMode === "checkIn" ? "datesFrom" : "datesTo";
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const sorted = [...filteredOrders]
      .filter(o => o[dateKey] && parseIsoToParts(o[dateKey]))
      .sort((a, b) => {
        const cmp = (a[dateKey] || "").localeCompare(b[dateKey] || "");
        return dateSortAsc ? cmp : -cmp;
      });
    const months = new Map<string, { label: string; orders: OrderRow[]; totals: OrderTotals }>();
    sorted.forEach(o => {
      const parts = parseIsoToParts(o[dateKey]);
      if (!parts) return;
      const key = `${parts.year}-${parts.month}`;
      const monthIdx = parseInt(parts.month, 10) - 1;
      if (!months.has(key)) {
        months.set(key, {
          label: `${monthNames[Math.max(0, Math.min(11, monthIdx))]} ${parts.year}`,
          orders: [],
          totals: { amount: 0, paid: 0, debt: 0, vat: 0, profit: 0 },
        });
      }
      months.get(key)!.orders.push(o);
    });
    const entries = Array.from(months.entries());
    entries.forEach(([, g]) => { g.totals = calculateTotals(g.orders); });
    entries.sort(([a], [b]) => (dateSortAsc ? a.localeCompare(b) : b.localeCompare(a)));
    return entries.map(([, g]) => g);
  }, [dateGroupMode, filteredOrders, dateSortAsc]);

  // Initialize expanded state - all groups expanded by default, merge with stored preferences
  useEffect(() => {
    const stored = loadExpandedFromStorage();
    
    // Collect all group keys from current tree
    const allGroupKeys: Record<string, boolean> = {};
    
    tree.forEach((year) => {
      const yearKey = getGroupKey("year", year.year);
      // Use stored value if exists, otherwise default to true (expanded)
      allGroupKeys[yearKey] = stored[yearKey] !== undefined ? stored[yearKey] : true;
      
      year.months.forEach((month) => {
        const monthKey = getGroupKey("month", month.monthKey);
        allGroupKeys[monthKey] = stored[monthKey] !== undefined ? stored[monthKey] : true;
        
        month.days.forEach((day) => {
          const dayKey = getGroupKey("day", day.dayKey);
          allGroupKeys[dayKey] = stored[dayKey] !== undefined ? stored[dayKey] : true;
        });
      });
    });
    
    setExpandedGroups((prev) => {
      const merged: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        if (!(key in allGroupKeys)) {
          merged[key] = prev[key];
        }
      });
      Object.assign(merged, allGroupKeys);

      const mergedKeys = Object.keys(merged);
      if (mergedKeys.length === Object.keys(prev).length &&
          mergedKeys.every(k => merged[k] === prev[k])) {
        return prev;
      }
      return merged;
    });
  }, [tree]);

  // Save to localStorage whenever expandedGroups changes
  useEffect(() => {
    saveExpandedToStorage(expandedGroups);
  }, [expandedGroups]);

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString()}`;
  };

  // Use centralized date formatting
  const formatDate = formatDateDDMMYYYY;

  const toggleYear = (year: string) => {
    const key = getGroupKey("year", year);
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleMonth = (monthKey: string) => {
    const key = getGroupKey("month", monthKey);
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleDay = (dayKey: string) => {
    const key = getGroupKey("day", dayKey);
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Helper to check if a group is expanded
  const isExpanded = (type: "year" | "month" | "day", key: string): boolean => {
    const groupKey = getGroupKey(type, key);
    return expandedGroups[groupKey] !== false; // Default to true if not set
  };

  // Helper to calculate days to due date
  const getDaysToDue = (dueDate?: string): number | null => {
    if (!dueDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getPaymentIcon = (order: OrderRow): { icon: React.ReactNode; tooltip: string } | null => {
    if (order.paid > 0 && order.amount > 0 && order.paid > order.amount + 0.01) {
      const overpay = Math.round((order.paid - order.amount) * 100) / 100;
      return { icon: <CirclePlus size={16} strokeWidth={1.8} className="text-purple-600" />, tooltip: t(lang, "orders.tooltipOverpaid").replace("{amount}", overpay.toFixed(2)) };
    } else if (order.allInvoicesPaid && order.totalInvoices && order.totalInvoices > 0) {
      return { icon: <CheckCircle2 size={16} strokeWidth={1.8} className="text-green-600" />, tooltip: t(lang, "orders.tooltipAllInvoicesPaid") };
    } else if (order.paid > 0 && order.amount > 0 && order.paid >= order.amount) {
      return { icon: <CheckCircle2 size={16} strokeWidth={1.8} className="text-green-600" />, tooltip: t(lang, "orders.tooltipPaidInFull") };
    } else if (order.paid > 0) {
      return { icon: <CircleDollarSign size={16} strokeWidth={1.8} className="text-amber-500" />, tooltip: t(lang, "orders.tooltipPartialPayment") };
    }
    return null;
  };

  // Handle click to navigate to order - opens in tab with extra info
  const handleOrderClick = (order: OrderRow) => {
    const path = `/orders/${orderCodeToSlug(order.orderId)}`;
    const title = order.orderId;
    const subtitle = order.client && order.client !== "—" ? order.client : undefined;
    const dates = order.datesFrom && order.datesTo 
      ? `${formatDate(order.datesFrom)} - ${formatDate(order.datesTo)}`
      : undefined;
    
    console.log('[Tab] Opening order:', { title, subtitle, dates, client: order.client });
    
    openTab(path, title, "order", { subtitle, dates });
  };

  // Handle keyboard navigation (Enter key)
  const handleOrderKeyDown = (e: React.KeyboardEvent, order: OrderRow) => {
    if (e.key === "Enter") {
      handleOrderClick(order);
    }
  };

  const ordersOverlappingByIsoDay = useMemo(() => {
    if (viewMode !== "calendar") return new Map<string, OrderRow[]>();
    return buildOrdersOverlappingByIsoDay(filteredOrders);
  }, [filteredOrders, viewMode]);

  const calendarOrders = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const calStart = new Date(firstDay);
    calStart.setDate(calStart.getDate() - startOffset);
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    const days: { date: Date; orders: OrderRow[]; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(calStart);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayOrders = ordersOverlappingByIsoDay.get(iso) ?? [];
      days.push({ date: d, orders: dayOrders, isCurrentMonth: d.getMonth() === month });
    }
    return days;
  }, [calendarDate, ordersOverlappingByIsoDay]);

  const calMonthLabel = calendarDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Loading state
  if (isLoading) {
    return (
      <div className="theme-page-bg p-3 sm:p-6">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">{t(lang, "orders.title")}</h1>
              <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
          <div className="rounded-lg bg-white shadow-sm p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded flex-1 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="theme-page-bg p-3 sm:p-6">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">{t(lang, "orders.title")}</h1>
              <button
                onClick={() => router.push("/orders/new")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus size={16} strokeWidth={2} />
                {t(lang, "orders.new")}
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-red-700">{loadError}</p>
            <button
              onClick={() => {
                void refetchOrdersList();
              }}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              {t(lang, "orders.tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeFilterCount = (() => {
    let c = 0;
    if (searchState.clientLastName) c++;
    if (searchState.agentId !== "all") c++;
    if (searchState.status !== "all") c++;
    return c;
  })();

  const clearAllFilters = () => {
    if (surnameDebounceRef.current) {
      clearTimeout(surnameDebounceRef.current);
      surnameDebounceRef.current = null;
    }
    ordersSearchStore.applyPatch({
      clientLastName: "",
      agentId: "all",
      status: "all",
    });
    setSurnameInput("");
    setDateGroupMode("created");
  };

  return (
    <div className="theme-page-bg p-3 sm:p-4">
      <div className="mx-auto max-w-[1800px] space-y-2">
        {/* Compact header with view tabs — sticky below TopBar + TabBar */}
        <div className="sticky top-0 z-20 theme-panel-bg pb-2 -mb-2 -mt-3 sm:-mt-4 pt-3 sm:pt-4 space-y-2 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{t(lang, "orders.title")}</h1>
            <button
              onClick={() => router.push("/orders/new")}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 sm:px-2.5 sm:py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus size={15} strokeWidth={2} />
              {t(lang, "orders.new")}
            </button>
            {filteredOrders.length !== orders.length && (
              <span className="text-sm text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {filteredOrders.length} / {orders.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs sm:text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              title="List view"
              aria-label="List view"
            >
              <List size={15} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs sm:text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              title="Calendar view"
              aria-label="Calendar view"
            >
              <CalendarDays size={15} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>

        {/* Inline filter bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-4 py-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
            {/* Surname search */}
            <div className="relative w-full sm:w-36 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" aria-hidden />
              <input
                type="text"
                placeholder="Client / Payer..."
                value={surnameInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSurnameInput(val);
                  if (surnameDebounceRef.current) clearTimeout(surnameDebounceRef.current);
                  surnameDebounceRef.current = setTimeout(() => {
                    surnameDebounceRef.current = null;
                    ordersSearchStore.setField("clientLastName", val);
                  }, DEBOUNCE_MS);
                }}
                className="w-full rounded-lg border border-gray-300 pl-8 pr-2 py-2.5 sm:py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <span className="hidden sm:inline text-gray-300">|</span>

            {/* Date group mode */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5 w-fit">
              {([
                { value: "created", label: "Created" },
                { value: "checkIn", label: "Start date" },
                { value: "checkOut", label: "End date" },
              ] as { value: DateGroupMode; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDateGroupMode(opt.value)}
                  className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                    dateGroupMode === opt.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <span className="hidden sm:inline text-gray-300">|</span>

            {/* Agent */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="orders-agent-select" className="text-xs text-gray-600 uppercase">Agent</label>
              <select
                id="orders-agent-select"
                aria-label="Filter by agent"
                value={searchState.agentId}
                onChange={(e) => ordersSearchStore.setField("agentId", e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.initials} — {a.name}</option>
                ))}
              </select>
            </div>

            <span className="hidden sm:inline text-gray-300">|</span>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="orders-status-select" className="text-xs text-gray-600 uppercase">Status</label>
              <select
                id="orders-status-select"
                aria-label="Filter by status"
                value={searchState.status}
                onChange={(e) => ordersSearchStore.setField("status", e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="On hold">On hold</option>
              </select>
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <X size={14} />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
        </div>{/* end sticky */}

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="rounded-lg bg-white shadow-sm p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={32} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">{t(lang, "orders.noOrdersYet")}</p>
            <p className="text-gray-500 mb-6">{t(lang, "orders.getStarted")}</p>
            <button
              onClick={() => router.push("/orders/new")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus size={20} strokeWidth={2} />
              {t(lang, "orders.createFirstOrder")}
            </button>
          </div>
        )}

        {/* Calendar View */}
        {orders.length > 0 && viewMode === "calendar" && (
          <div className="rounded-lg bg-white shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-200 bg-gray-50">
              <button onClick={() => setCalendarDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })} className="p-1 rounded hover:bg-gray-200 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-900">{calMonthLabel}</span>
              <button onClick={() => setCalendarDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="p-1 rounded hover:bg-gray-200 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="px-0.5 sm:px-1 py-1 text-center text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase border-b border-gray-200 bg-gray-50 truncate">{d}</div>
              ))}
              {calendarOrders.map((cell, i) => {
                const todayISO = new Date().toISOString().slice(0, 10);
                const cellISO = cell.date.toISOString().slice(0, 10);
                const isToday = cellISO === todayISO;
                return (
                  <div
                    key={i}
                    className={`min-h-[60px] sm:min-h-[80px] border-b border-r border-gray-100 p-0.5 sm:p-1 ${
                      !cell.isCurrentMonth ? "bg-gray-50/50" : ""
                    } ${isToday ? "bg-blue-50/60" : ""}`}
                  >
                    <div className={`text-[11px] mb-0.5 ${
                      isToday ? "font-bold text-blue-600" : cell.isCurrentMonth ? "text-gray-700" : "text-gray-400"
                    }`}>
                      {cell.date.getDate()}
                    </div>
                    <div className="space-y-0.5 max-h-[60px] overflow-y-auto">
                      {cell.orders.slice(0, 4).map(o => {
                        const colors = getStatusBadgeColor(o.status);
                        const isStart = o.datesFrom.slice(0, 10) === cellISO;
                        const isEnd = o.datesTo.slice(0, 10) === cellISO;
                        return (
                          <div
                            key={o.orderId}
                            onClick={() => handleOrderClick(o)}
                            className={`rounded px-1 py-px text-[9px] leading-tight cursor-pointer truncate transition-colors ${colors.bg} ${colors.text} hover:opacity-80 ${
                              isStart ? "rounded-l-md border-l-2 border-current" : ""
                            } ${isEnd ? "rounded-r-md border-r-2 border-current" : ""}`}
                            title={`${o.orderId} — ${o.client} (${formatDate(o.datesFrom)} - ${formatDate(o.datesTo)})`}
                          >
                            {o.orderId.split("/")[0]} {o.client.split(" ")[0]}
                          </div>
                        );
                      })}
                      {cell.orders.length > 4 && (
                        <div className="text-[9px] text-gray-400 text-center">+{cell.orders.length - 4}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Table (List view) */}
        {orders.length > 0 && viewMode === "list" && (
        <div className="rounded-lg theme-card-bg shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full border-collapse min-w-[1040px]">
            <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb] theme-panel-bg border-b border-gray-200">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-1 text-left text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.orderId")}
                </th>
                <th className="w-8 px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  <span title={t(lang, "orders.invTitle")} className="cursor-help">
                    <FileCheck size={12} strokeWidth={1.8} className="text-gray-400 mx-auto" />
                  </span>
                </th>
                <th className="w-8 px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  <span title={t(lang, "orders.payTitle")} className="cursor-help">
                    <CircleDollarSign size={12} strokeWidth={1.8} className="text-gray-400 mx-auto" />
                  </span>
                </th>
                <th className="w-8 px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  <span title={t(lang, "orders.dueTitle")} className="cursor-help">
                    <Clock size={12} strokeWidth={1.8} className="text-gray-400 mx-auto" />
                  </span>
                </th>
                <th className="w-8 px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  <span title="Supplier invoices status" className="cursor-help">
                    <FileText size={12} strokeWidth={1.8} className="text-gray-400 mx-auto" />
                  </span>
                </th>
                <th className="px-3 py-1 text-left text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.client")}
                </th>
                <th className="px-3 py-1 text-left text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.countriesCities")}
                </th>
                <th
                  className={`px-3 py-1 text-left text-[10px] font-medium uppercase tracking-wider text-gray-600 ${dateGroupMode !== "created" ? "cursor-pointer select-none hover:text-gray-900" : ""}`}
                  onClick={() => { if (dateGroupMode !== "created") setDateSortAsc(p => !p); }}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {t(lang, "orders.dates")}
                    {dateGroupMode !== "created" && (
                      <span className="text-[9px] text-gray-400">{dateSortAsc ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
                <th className="px-3 py-1 text-right text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.amount")}
                </th>
                <th className="px-3 py-1 text-right text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.paid")}
                </th>
                <th className="px-3 py-1 text-right text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.debt")}
                </th>
                <th className="px-3 py-1 text-right text-[10px] font-medium uppercase tracking-wider text-gray-600" title="Profit after PVN">
                  {t(lang, "orders.profit")}
                </th>
                <th className="px-3 py-1 text-right text-[10px] font-medium uppercase tracking-wider text-gray-600" title="VAT">
                  {t(lang, "orders.vat")}
                </th>
                <th className="w-8 px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.status")}
                </th>
                <th className="px-3 py-1 text-left text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.type")}
                </th>
                <th className="px-3 py-1 text-left text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {t(lang, "orders.owner")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 theme-card-bg">
              {/* Flat month-grouped view for Start date / End date */}
              {monthGroupedOrders && monthGroupedOrders.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="theme-panel-bg">
                    <td className="px-1.5 py-0.5 text-sm font-bold text-gray-900">{group.label}</td>
                    <td className="px-0.5 py-0.5" colSpan={4}></td>
                    <td className="px-1.5 py-1" colSpan={2}></td>
                    <td className="px-1.5 py-1"></td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.amount)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.paid)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.debt)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.profit)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.vat)}</td>
                    <td className="px-1.5 py-1" colSpan={3}></td>
                  </tr>
                  {group.orders.map((order) => {
                    const daysToDue = getDaysToDue(order.dueDate);
                    const paymentIcon = getPaymentIcon(order);
                    return (
                      <tr
                        key={`order-${order.orderId}`}
                        className="cursor-pointer transition-colors hover:bg-blue-50/60"
                        onClick={() => handleOrderClick(order)}
                        onKeyDown={(e) => handleOrderKeyDown(e, order)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open order ${order.orderId}`}
                      >
                        <td className="whitespace-nowrap px-1.5 py-0.5 pl-5 text-sm text-gray-900">
                          <span className="inline-flex items-center gap-1">
                            {order.orderId}
                            {order.hasReferral ? (
                              <span
                                className="rounded bg-amber-100 px-1 py-0 text-[9px] font-semibold uppercase text-amber-900"
                                title={t(lang, "orders.referralBadgeTitle")}
                              >
                                {t(lang, "orders.referralBadge")}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="w-7 px-0.5 py-0.5 text-center">
                          {order.hasInvoice && order.allServicesInvoiced && <span title={t(lang, "orders.tooltipAllServicesInvoiced")} className="cursor-help inline-flex justify-center"><FileCheck size={14} strokeWidth={1.8} className="text-green-600" /></span>}
                          {order.hasInvoice && !order.allServicesInvoiced && order.invoicedServices && order.invoicedServices > 0 && <span title={t(lang, "orders.tooltipServicesInvoiced").replace("{n}", String(order.invoicedServices)).replace("{total}", String(order.totalServices ?? ""))} className="cursor-help inline-flex justify-center"><FileMinus2 size={14} strokeWidth={1.8} className="text-amber-500" /></span>}
                        </td>
                        <td className="w-7 px-0.5 py-0.5 text-center">
                          {paymentIcon && <span title={paymentIcon.tooltip} className="cursor-help inline-flex justify-center">{paymentIcon.icon}</span>}
                        </td>
                        <td className="w-7 px-0.5 py-0.5 text-center text-sm">
                          {order.allInvoicesPaid || (order.debt <= 0 && order.amount > 0) ? (
                            <span title={t(lang, "orders.paidShort")} className="inline-flex justify-center text-green-600"><Check size={14} strokeWidth={3} /></span>
                          ) : daysToDue !== null ? (
                            <span className={`inline-flex items-center justify-center gap-0.5 ${daysToDue < 0 ? "text-red-600" : "text-gray-600"}`} title={t(lang, "orders.tooltipDueDate").replace("{date}", order.dueDate ?? "")}>
                              {daysToDue < 0 && <CircleAlert size={12} strokeWidth={2} />}{daysToDue}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="w-8 px-1 py-0.5 text-center">
                          {renderSupplierInvoicePreviewBadge(order)}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-800">{order.client}</td>
                        <td className="px-1.5 py-0.5 text-sm text-gray-700 max-w-xs"><div className="truncate">{countriesFlagsMap.get(order.countriesCities) ?? formatCountriesWithFlags(order.countriesCities)}</div></td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600">{formatDate(order.datesFrom)} — {formatDate(order.datesTo)}</td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-800">{formatCurrency(order.amount)}</td>
                        <td className={`whitespace-nowrap px-1.5 py-0.5 text-right text-sm ${order.paid > 0 && order.amount > 0 && order.paid > order.amount + 0.01 ? "text-purple-700" : "text-gray-800"}`}>{formatCurrency(order.paid)}</td>
                        <td className={`whitespace-nowrap px-1.5 py-0.5 text-right text-sm ${order.debt > 0 ? "text-orange-700" : "text-gray-600"}`}>{formatCurrency(order.debt)}</td>
                        <td
                          className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-900"
                          title={
                            order.hasReferral && (order.referralCommissionTotal ?? 0) !== 0
                              ? t(lang, "orders.profitAfterReferralHint").replace(
                                  "{commission}",
                                  formatCurrency(order.referralCommissionTotal ?? 0)
                                )
                              : undefined
                          }
                        >
                          {formatCurrency(order.profit)}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-600">{formatCurrency(order.vat ?? 0)}</td>
                        <td className="w-7 px-0.5 py-0.5 text-center">
                          {(() => { const colors = getStatusBadgeColor(order.status); const statusKey = order.status === "On hold" ? "order.status.OnHold" : `order.status.${order.status}`; return <span title={t(lang, statusKey)} className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot} cursor-help`} />; })()}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600">{order.type}</td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600" title={order.owner}>{toInitials(order.owner)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Year → Month → Day tree for Created mode */}
              {!monthGroupedOrders && tree.map((year) => (
                <React.Fragment key={`year-${year.year}`}>
                  {/* Year row */}
                  <tr
                    className="cursor-pointer bg-gray-100 font-semibold hover:bg-gray-200 transition-colors border-b border-gray-200/60"
                    onClick={() => toggleYear(year.year)}
                  >
                    <td className="px-1.5 py-1.5 text-sm font-bold text-gray-900">
                      <span className="mr-1.5 inline-block text-[11px]">
                        {isExpanded("year", year.year) ? "▾" : "▸"}
                      </span>
                      {year.year}
                    </td>
                    <td className="px-0.5 py-0.5" colSpan={4}></td>
                    <td className="px-1.5 py-1" colSpan={2}></td>
                    <td className="px-1.5 py-1"></td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(year.totals.amount)}
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(year.totals.paid)}
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(year.totals.debt)}
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(year.totals.profit)}
                    </td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-gray-700">
                      {formatCurrency(year.totals.vat)}
                    </td>
                    <td className="px-1.5 py-1" colSpan={3}></td>
                  </tr>

                  {/* Month rows */}
                  {isExpanded("year", year.year) &&
                    year.months.map((month) => (
                      <React.Fragment key={`month-${month.monthKey}`}>
                        <tr
                          className="cursor-pointer bg-blue-50/50 font-medium hover:bg-blue-50 transition-colors border-b border-gray-100"
                          onClick={() => toggleMonth(month.monthKey)}
                        >
                          <td className="px-1.5 py-1 pl-8 text-sm font-semibold text-gray-900">
                            <span className="mr-1.5 inline-block text-[11px]">
                              {isExpanded("month", month.monthKey) ? "▾" : "▸"}
                            </span>
                            {t(lang, `calendar.month.${parseInt(month.monthKey.split("-")[1], 10) - 1}`)}
                          </td>
                          <td className="px-0.5 py-0.5" colSpan={4}></td>
                          <td className="px-1.5 py-1" colSpan={2}></td>
                          <td className="px-1.5 py-1"></td>
                          <td className="px-1.5 py-0.5 text-right text-sm font-semibold text-blue-700">
                            {formatCurrency(month.totals.amount)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right text-sm font-semibold text-blue-700">
                            {formatCurrency(month.totals.paid)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right text-sm font-semibold text-blue-700">
                            {formatCurrency(month.totals.debt)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right text-sm font-semibold text-blue-700">
                            {formatCurrency(month.totals.profit)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right text-sm font-semibold text-blue-500">
                            {formatCurrency(month.totals.vat)}
                          </td>
                          <td className="px-1.5 py-1" colSpan={3}></td>
                        </tr>

                        {/* Day rows */}
                        {isExpanded("month", month.monthKey) &&
                          month.days.map((day) => (
                            <React.Fragment key={`day-${day.dayKey}`}>
                              <tr
                                className="cursor-pointer bg-white hover:bg-gray-50 transition-colors border-b border-gray-100"
                                onClick={() => toggleDay(day.dayKey)}
                              >
                                <td className="px-1.5 py-1 pl-12 text-sm font-medium text-gray-800">
                                  <span className="mr-1.5 inline-block text-[11px]">
                                    {isExpanded("day", day.dayKey) ? "▾" : "▸"}
                                  </span>
                                  {day.dayLabel}
                                </td>
                                <td className="px-0.5 py-0.5" colSpan={4}></td>
                                <td className="px-1.5 py-1" colSpan={2}></td>
                                <td className="px-1.5 py-1"></td>
                                <td className="px-1.5 py-0.5 text-right text-sm font-medium text-gray-900">
                                  {formatCurrency(day.totals.amount)}
                                </td>
                                <td className="px-1.5 py-0.5 text-right text-sm font-medium text-gray-900">
                                  {formatCurrency(day.totals.paid)}
                                </td>
                                <td
                                  className={`px-1.5 py-0.5 text-right text-sm font-medium ${
                                    day.totals.debt > 0 ? "text-red-600" : "text-gray-900"
                                  }`}
                                >
                                  {formatCurrency(day.totals.debt)}
                                </td>
                                <td className="px-1.5 py-0.5 text-right text-sm font-semibold text-gray-900">
                                  {formatCurrency(day.totals.profit)}
                                </td>
                                <td className="px-1.5 py-0.5 text-right text-sm font-medium text-gray-700">
                                  {formatCurrency(day.totals.vat)}
                                </td>
                                <td className="px-1.5 py-1" colSpan={3}></td>
                              </tr>

                              {/* Order rows */}
                              {isExpanded("day", day.dayKey) &&
                                day.orders.map((order) => {
                                  const daysToDue = getDaysToDue(order.dueDate);
                                  const paymentIcon = getPaymentIcon(order);

                                  
                                  return (
                                    <tr
                                      key={`order-${order.orderId}`}
                                      className="cursor-pointer transition-colors hover:bg-blue-50/60"
                                      onClick={() => handleOrderClick(order)}
                                      onKeyDown={(e) => handleOrderKeyDown(e, order)}
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Open order ${order.orderId}`}
                                    >
                                      <td className="whitespace-nowrap px-1.5 py-0.5 pl-20 text-sm text-gray-900">
                                        <span className="inline-flex items-center gap-1">
                                          {order.orderId}
                                          {order.hasReferral ? (
                                            <span
                                              className="rounded bg-amber-100 px-1 py-0 text-[9px] font-semibold uppercase text-amber-900"
                                              title={t(lang, "orders.referralBadgeTitle")}
                                            >
                                              {t(lang, "orders.referralBadge")}
                                            </span>
                                          ) : null}
                                        </span>
                                      </td>
                                      
                                      <td className="w-7 px-0.5 py-0.5 text-center">
                                        {order.hasInvoice && order.allServicesInvoiced && (
                                          <span title={t(lang, "orders.tooltipAllServicesInvoiced")} className="cursor-help inline-flex justify-center">
                                            <FileCheck size={14} strokeWidth={1.8} className="text-green-600" />
                                          </span>
                                        )}
                                        {order.hasInvoice && !order.allServicesInvoiced && order.invoicedServices && order.invoicedServices > 0 && (
                                          <span title={t(lang, "orders.tooltipServicesInvoiced").replace("{n}", String(order.invoicedServices)).replace("{total}", String(order.totalServices ?? ""))} className="cursor-help inline-flex justify-center">
                                            <FileMinus2 size={14} strokeWidth={1.8} className="text-amber-500" />
                                          </span>
                                        )}
                                      </td>
                                      
                                      <td className="w-7 px-0.5 py-0.5 text-center">
                                        {paymentIcon && (
                                          <span title={paymentIcon.tooltip} className="cursor-help inline-flex justify-center">
                                            {paymentIcon.icon}
                                          </span>
                                        )}
                                      </td>
                                      
                                      <td className="w-7 px-0.5 py-0.5 text-center text-sm">
                                        {order.allInvoicesPaid || (order.debt <= 0 && order.amount > 0) ? (
                                          <span title={t(lang, "orders.paidShort")} className="inline-flex justify-center text-green-600">
                                            <Check size={14} strokeWidth={3} />
                                          </span>
                                        ) : daysToDue !== null ? (
                                          <span
                                            className={`inline-flex items-center justify-center gap-0.5 ${daysToDue < 0 ? "text-red-600" : "text-gray-600"}`}
                                            title={t(lang, "orders.tooltipDueDate").replace("{date}", order.dueDate ?? "")}
                                          >
                                            {daysToDue < 0 && <CircleAlert size={12} strokeWidth={2} />}
                                            {daysToDue}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      <td className="w-8 px-1 py-0.5 text-center">
                                        {renderSupplierInvoicePreviewBadge(order)}
                                      </td>
                                      
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-800">
                                        {order.client}
                                      </td>
                                      <td className="px-1.5 py-0.5 text-sm text-gray-700 max-w-xs" title={order.countriesCities}>
                                        <div className="truncate">
                                          {countriesFlagsMap.get(order.countriesCities) ?? formatCountriesWithFlags(order.countriesCities)}
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600">
                                        {formatDate(order.datesFrom)} — {formatDate(order.datesTo)}
                                      </td>
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-800">
                                        {formatCurrency(order.amount)}
                                      </td>
                                      <td className={`whitespace-nowrap px-1.5 py-0.5 text-right text-sm ${
                                        order.paid > 0 && order.amount > 0 && order.paid > order.amount + 0.01
                                          ? "text-purple-700"
                                          : "text-gray-800"
                                      }`}>
                                        {formatCurrency(order.paid)}
                                      </td>
                                      <td
                                        className={`whitespace-nowrap px-1.5 py-0.5 text-right text-sm ${
                                          order.debt > 0
                                            ? "text-orange-700"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        {formatCurrency(order.debt)}
                                      </td>
                                      <td
                                        className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-900"
                                        title={
                                          order.hasReferral && (order.referralCommissionTotal ?? 0) !== 0
                                            ? t(lang, "orders.profitAfterReferralHint").replace(
                                                "{commission}",
                                                formatCurrency(order.referralCommissionTotal ?? 0)
                                              )
                                            : undefined
                                        }
                                      >
                                        {formatCurrency(order.profit)}
                                      </td>
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-600">
                                        {formatCurrency(order.vat ?? 0)}
                                      </td>
                                      <td className="w-7 px-0.5 py-0.5 text-center">
                                        {(() => {
                                          const colors = getStatusBadgeColor(order.status);
                                          const statusKey = order.status === "On hold" ? "order.status.OnHold" : `order.status.${order.status}`;
                                          return (
                                            <span
                                              title={t(lang, statusKey)}
                                              className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot} cursor-help`}
                                            />
                                          );
                                        })()}
                                      </td>
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600">
                                        {order.type}
                                      </td>
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600" title={order.owner}>
                                        {toInitials(order.owner)}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          ))}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        )}

        {/* No results message */}
        {orders.length > 0 && filteredOrders.length === 0 && (
          <div className="rounded-lg bg-white shadow-sm p-8 text-center">
            <p className="text-sm text-gray-500">No orders match current filters</p>
            <button onClick={clearAllFilters} className="mt-2 text-xs text-blue-600 hover:underline">
              Clear all filters
            </button>
          </div>
        )}

        {/* Load more */}
        {hasNextPage && pagination && (
          <div className="flex items-center justify-center py-4 gap-3">
            <span className="text-xs text-gray-600">
              {t(lang, "orders.showing")} {orders.length} {t(lang, "orders.of")} {pagination.total}
            </span>
            <button
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full sm:w-auto px-6 py-3 sm:py-2 text-sm font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition"
            >
              {isFetchingNextPage ? `${t(lang, "orders.loading")}...` : t(lang, "orders.loadMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

