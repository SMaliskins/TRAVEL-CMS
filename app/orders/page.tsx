"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ordersSearchStore from "@/lib/stores/ordersSearchStore";
import { filterOrders } from "@/lib/stores/filterOrders";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useTabs } from "@/contexts/TabsContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { Plus, FileText, FileCheck, FileMinus2, CircleDollarSign, CheckCircle2, Check, Clock, CircleAlert, CirclePlus, Search, X, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getCityByName, loadWorldCities } from "@/lib/data/cities";

type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";
type OrderType = "TA" | "TO" | "CORP" | "NON";
type AccessType = "Owner" | "Delegated";

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

// Build orders tree structure
function buildOrdersTree(orders: OrderRow[], dateMode: DateGroupMode = "created"): OrderTree {
  const yearMap = new Map<string, Map<string, Map<string, OrderRow[]>>>();

  orders.forEach((order) => {
    const raw = dateMode === "checkIn" ? order.datesFrom
              : dateMode === "checkOut" ? order.datesTo
              : (order.createdAt || order.updated);
    if (!raw) return;
    const date = new Date(raw);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

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

    // Sort months DESC
    const sortedMonths = Array.from(monthMap.keys()).sort((a, b) => {
      const aDate = new Date(a);
      const bDate = new Date(b);
      return bDate.getTime() - aDate.getTime();
    });

    sortedMonths.forEach((monthKey) => {
      const dayMap = monthMap.get(monthKey)!;
      const days: OrderTreeDay[] = [];

      // Sort days DESC
      const sortedDays = Array.from(dayMap.keys()).sort((a, b) => {
        const aDate = new Date(a);
        const bDate = new Date(b);
        return bDate.getTime() - aDate.getTime();
      });

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

      const monthDate = new Date(monthKey);
      const monthLabel = monthNames[monthDate.getMonth()];

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

export default function OrdersPage() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { openTab } = useTabs();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; initials: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{ page: number; total: number; totalPages: number } | null>(null);
  const [searchState, setSearchState] = useState(() => ordersSearchStore.getState());
  const [semanticOrderCodes, setSemanticOrderCodes] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    loadExpandedFromStorage()
  );
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [dateGroupMode, setDateGroupMode] = useState<DateGroupMode>("created");
  const [dateSortAsc, setDateSortAsc] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [surnameInput, setSurnameInput] = useState(searchState.clientLastName || "");

  useEffect(() => { loadWorldCities(); }, []);

  useEffect(() => {
    const createdFrom = urlSearchParams.get("createdFrom");
    const createdTo = urlSearchParams.get("createdTo");
    const status = urlSearchParams.get("status");

    if (createdFrom || createdTo || status) {
      const patch: Partial<import("@/lib/stores/ordersSearchStore").OrdersSearchState> = {};
      if (createdFrom || createdTo) {
        patch.createdAt = { from: createdFrom || undefined, to: createdTo || undefined };
        setDateGroupMode("created");
      }
      if (status) {
        patch.status = status;
      }
      ordersSearchStore.applyPatch(patch);
      // Remove URL params so they don't persist on refresh
      window.history.replaceState({}, "", "/orders");
    } else {
      // Direct navigation without params — reset dashboard-applied filters
      ordersSearchStore.applyPatch({ createdAt: {}, status: "all" });
    }
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(async (page = 1, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || null;

      const response = await fetch(`/api/orders?page=${page}&pageSize=200`, {
        headers: {
          ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (append) {
        setOrders(prev => [...prev, ...(data.orders || [])]);
      } else {
        setOrders(data.orders || []);
      }
      setAgents(prev => {
        const merged = new Map(prev.map(a => [a.id, a]));
        (data.agents || []).forEach((a: { id: string; name: string; initials: string }) => merged.set(a.id, a));
        return Array.from(merged.values());
      });
      if (data.pagination) {
        setPagination({ page: data.pagination.page, total: data.pagination.total, totalPages: data.pagination.totalPages });
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setLoadError(error instanceof Error ? error.message : t(lang, "orders.loadError"));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Load orders on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Initialize store and subscribe to search store changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      ordersSearchStore.init();
    }
    const unsubscribe = ordersSearchStore.subscribe((state) => {
      setSearchState(state);
    });
    return unsubscribe;
  }, []);

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

  // Filter orders based on search state
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, searchState, { semanticOrderCodes });
  }, [orders, searchState, semanticOrderCodes]);

  // Build tree from filtered orders
  const tree = useMemo(() => buildOrdersTree(filteredOrders, dateGroupMode), [filteredOrders, dateGroupMode]);

  // Flat month-grouped list for Start date / End date modes
  const monthGroupedOrders = useMemo(() => {
    if (dateGroupMode === "created") return null;
    const dateKey = dateGroupMode === "checkIn" ? "datesFrom" : "datesTo";
    const sorted = [...filteredOrders]
      .filter(o => o[dateKey])
      .sort((a, b) => {
        const cmp = (a[dateKey] || "").localeCompare(b[dateKey] || "");
        return dateSortAsc ? cmp : -cmp;
      });
    const months = new Map<string, { label: string; orders: OrderRow[]; totals: OrderTotals }>();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    sorted.forEach(o => {
      const d = new Date(o[dateKey]);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months.has(key)) {
        months.set(key, { label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, orders: [], totals: { amount: 0, paid: 0, debt: 0, vat: 0, profit: 0 } });
      }
      months.get(key)!.orders.push(o);
    });
    months.forEach(g => { g.totals = calculateTotals(g.orders); });
    return Array.from(months.values());
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
    
    // Merge: preserve existing state for keys not in tree, add new groups from tree
    setExpandedGroups((prev) => {
      // Keep existing groups that are not in the current tree (for when filters change)
      const merged: Record<string, boolean> = {};
      
      // First, preserve existing state for keys not in current tree
      Object.keys(prev).forEach((key) => {
        if (!(key in allGroupKeys)) {
          merged[key] = prev[key];
        }
      });
      
      // Then, add/update groups from current tree
      Object.assign(merged, allGroupKeys);
      
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
      const dayOrders = filteredOrders.filter(o => {
        if (!o.datesFrom || !o.datesTo) return false;
        return o.datesFrom.slice(0, 10) <= iso && o.datesTo.slice(0, 10) >= iso;
      });
      days.push({ date: d, orders: dayOrders, isCurrentMonth: d.getMonth() === month });
    }
    return days;
  }, [calendarDate, filteredOrders]);

  const calMonthLabel = calendarDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 p-6">
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
      <div className="bg-gray-50 p-6">
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
              onClick={fetchOrders}
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
    ordersSearchStore.applyPatch({
      clientLastName: "",
      agentId: "all",
      status: "all",
    });
    setSurnameInput("");
    setDateGroupMode("created");
  };

  return (
    <div className="bg-gray-50 p-4">
      <div className="mx-auto max-w-[1800px] space-y-2">
        {/* Compact header with view tabs — sticky below TopBar + TabBar */}
        <div className="sticky top-0 z-20 bg-gray-50 pb-2 -mb-2 -mt-4 pt-4 space-y-2 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{t(lang, "orders.title")}</h1>
            <button
              onClick={() => router.push("/orders/new")}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus size={15} strokeWidth={2} />
              {t(lang, "orders.new")}
            </button>
            {filteredOrders.length !== orders.length && (
              <span className="text-sm text-gray-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {filteredOrders.length} / {orders.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List size={15} />
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarDays size={15} />
              Calendar
            </button>
          </div>
        </div>

        {/* Inline filter bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Surname search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Client / Payer..."
                value={surnameInput}
                onChange={(e) => {
                  setSurnameInput(e.target.value);
                  ordersSearchStore.setField("clientLastName", e.target.value);
                }}
                className="w-36 rounded border border-gray-300 pl-8 pr-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <span className="text-gray-300">|</span>

            {/* Date group mode */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
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
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <span className="text-gray-300">|</span>

            {/* Agent */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 uppercase">Agent</label>
              <select
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

            <span className="text-gray-300">|</span>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 uppercase">Status</label>
              <select
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
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
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
                <div key={d} className="px-1 py-1 text-center text-[10px] font-medium text-gray-500 uppercase border-b border-gray-200 bg-gray-50">{d}</div>
              ))}
              {calendarOrders.map((cell, i) => {
                const todayISO = new Date().toISOString().slice(0, 10);
                const cellISO = cell.date.toISOString().slice(0, 10);
                const isToday = cellISO === todayISO;
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] border-b border-r border-gray-100 p-1 ${
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
        <div className="rounded-lg bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead className="sticky top-[76px] z-10 shadow-[0_1px_0_0_#e5e7eb]">
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
            <tbody className="divide-y divide-gray-200 bg-white">
              {/* Flat month-grouped view for Start date / End date */}
              {monthGroupedOrders && monthGroupedOrders.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="bg-gray-100/80">
                    <td className="px-1.5 py-0.5 text-sm font-bold text-gray-900">{group.label}</td>
                    <td className="px-0.5 py-0.5" colSpan={3}></td>
                    <td className="px-1.5 py-1" colSpan={2}></td>
                    <td className="px-1.5 py-1"></td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.amount)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.paid)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.debt)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-700">{formatCurrency(group.totals.profit)}</td>
                    <td className="px-1.5 py-0.5 text-right text-sm font-bold text-blue-500">{formatCurrency(group.totals.vat)}</td>
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
                        <td className="whitespace-nowrap px-1.5 py-0.5 pl-5 text-sm text-gray-900">{order.orderId}</td>
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
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-800">{order.client}</td>
                        <td className="px-1.5 py-0.5 text-sm text-gray-700 max-w-xs"><div className="truncate">{formatCountriesWithFlags(order.countriesCities)}</div></td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-600">{formatDate(order.datesFrom)} — {formatDate(order.datesTo)}</td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-800">{formatCurrency(order.amount)}</td>
                        <td className={`whitespace-nowrap px-1.5 py-0.5 text-right text-sm ${order.paid > 0 && order.amount > 0 && order.paid > order.amount + 0.01 ? "text-purple-700" : "text-gray-800"}`}>{formatCurrency(order.paid)}</td>
                        <td className={`whitespace-nowrap px-1.5 py-0.5 text-right text-sm ${order.debt > 0 ? "text-orange-600" : "text-gray-600"}`}>{formatCurrency(order.debt)}</td>
                        <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-900">{formatCurrency(order.profit)}</td>
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
                    className="cursor-pointer bg-gray-100 font-semibold hover:bg-gray-200 transition-colors"
                    onClick={() => toggleYear(year.year)}
                  >
                    <td className="px-1.5 py-0.5 text-sm font-bold text-gray-900">
                      <span className="mr-1.5 inline-block text-[11px]">
                        {isExpanded("year", year.year) ? "▾" : "▸"}
                      </span>
                      {year.year}
                    </td>
                    <td className="px-0.5 py-0.5" colSpan={3}></td>
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
                          className="cursor-pointer bg-gray-50 font-medium hover:bg-gray-100 transition-colors"
                          onClick={() => toggleMonth(month.monthKey)}
                        >
                          <td className="px-1.5 py-0.5 pl-7 text-sm font-semibold text-gray-900">
                            <span className="mr-1.5 inline-block text-[11px]">
                              {isExpanded("month", month.monthKey) ? "▾" : "▸"}
                            </span>
                            {t(lang, `calendar.month.${parseInt(month.monthKey.split("-")[1], 10) - 1}`)}
                          </td>
                          <td className="px-0.5 py-0.5" colSpan={3}></td>
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
                                className="cursor-pointer bg-gray-50 font-medium hover:bg-gray-100 transition-colors"
                                onClick={() => toggleDay(day.dayKey)}
                              >
                                <td className="px-1.5 py-0.5 pl-14 text-sm font-medium text-gray-800">
                                  <span className="mr-1.5 inline-block text-[11px]">
                                    {isExpanded("day", day.dayKey) ? "▾" : "▸"}
                                  </span>
                                  {day.dayLabel}
                                </td>
                                <td className="px-0.5 py-0.5" colSpan={3}></td>
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
                                        {order.orderId}
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
                                      
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-sm text-gray-800">
                                        {order.client}
                                      </td>
                                      <td className="px-1.5 py-0.5 text-sm text-gray-700 max-w-xs" title={order.countriesCities}>
                                        <div className="truncate">
                                          {formatCountriesWithFlags(order.countriesCities)}
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
                                            ? "text-orange-600"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        {formatCurrency(order.debt)}
                                      </td>
                                      <td className="whitespace-nowrap px-1.5 py-0.5 text-right text-sm text-gray-900">
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
        {pagination && pagination.page < pagination.totalPages && (
          <div className="flex items-center justify-center py-4 gap-3">
            <span className="text-xs text-gray-400">
              {t(lang, "orders.showing")} {orders.length} {t(lang, "orders.of")} {pagination.total}
            </span>
            <button
              onClick={() => fetchOrders(pagination.page + 1, true)}
              disabled={isLoadingMore}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition"
            >
              {isLoadingMore ? `${t(lang, "orders.loading")}...` : t(lang, "orders.loadMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

