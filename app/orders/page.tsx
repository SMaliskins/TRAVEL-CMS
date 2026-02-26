"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ordersSearchStore from "@/lib/stores/ordersSearchStore";
import { filterOrders } from "@/lib/stores/filterOrders";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useTabs } from "@/contexts/TabsContext";
import { Plus, FileText, FileCheck, FileMinus2, CircleDollarSign, CheckCircle2, Check, Clock, CircleAlert, CirclePlus } from "lucide-react";
import { getCityByName, countryCodeToFlag } from "@/lib/data/cities";

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

// Build orders tree structure
function buildOrdersTree(orders: OrderRow[]): OrderTree {
  // Use createdAt or fallback to updated
  const ordersWithDate = orders.map((order) => ({
    ...order,
    createdAt: order.createdAt || order.updated,
  }));

  // Group by year, month, day
  const yearMap = new Map<string, Map<string, Map<string, OrderRow[]>>>();

  ordersWithDate.forEach((order) => {
    const date = new Date(order.createdAt!);
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
      const cityName = s.split(',')[0]?.trim() || s;
      const cityData = getCityByName(cityName);
      if (cityData?.countryCode) {
        return { city: cityData.name, flag: countryCodeToFlag(cityData.countryCode) };
      }
      const match = s.match(/^(.+),\s*([^,]+)$/);
      if (match) {
        const city = match[1].trim();
        const country = match[2].trim();
        const flag = getCountryFlag(country);
        return { city, flag };
      }
      return { city: s, flag: null };
    }).filter(Boolean);
  }) as { city: string; flag: string | null }[];

  if (parsed.length === 0) return <span className="text-gray-400">—</span>;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {parsed.map((item, i) => (
        <span key={i} className="inline-flex items-center">
          {item.flag && <span className="mr-0.5">{item.flag}</span>}
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
  const { openTab } = useTabs();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState(() => ordersSearchStore.getState());
  const [semanticOrderCodes, setSemanticOrderCodes] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => 
    loadExpandedFromStorage()
  );

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || null;

      const response = await fetch("/api/orders", {
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
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
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
  const tree = useMemo(() => buildOrdersTree(filteredOrders), [filteredOrders]);

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
      return { icon: <CirclePlus size={16} strokeWidth={1.8} className="text-purple-600" />, tooltip: `Overpaid by €${overpay.toFixed(2)}` };
    } else if (order.allInvoicesPaid && order.totalInvoices && order.totalInvoices > 0) {
      return { icon: <CheckCircle2 size={16} strokeWidth={1.8} className="text-green-600" />, tooltip: "All invoices paid in full" };
    } else if (order.paid > 0 && order.amount > 0 && order.paid >= order.amount) {
      return { icon: <CheckCircle2 size={16} strokeWidth={1.8} className="text-green-600" />, tooltip: "Paid in full" };
    } else if (order.paid > 0) {
      return { icon: <CircleDollarSign size={16} strokeWidth={1.8} className="text-amber-500" />, tooltip: "Partial payment" };
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

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 p-6">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
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
              <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
              <button
                onClick={() => router.push("/orders/new")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus size={16} strokeWidth={2} />
                New
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-red-700">{loadError}</p>
            <button
              onClick={fetchOrders}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
            <button
              onClick={() => router.push("/orders/new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Plus size={16} strokeWidth={2} />
              New
            </button>
            {(searchState.queryText || searchState.clientLastName || searchState.status !== 'all' || searchState.country || searchState.orderType !== 'all') && (
              <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Filtered ({filteredOrders.length} results)
              </span>
            )}
          </div>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="rounded-lg bg-white shadow-sm p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={32} strokeWidth={1.5} className="text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">No orders yet</p>
            <p className="text-gray-500 mb-6">Get started by creating your first order</p>
            <button
              onClick={() => router.push("/orders/new")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Plus size={20} strokeWidth={2} />
              Create your first order
            </button>
          </div>
        )}

        {/* Table */}
        {orders.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Order ID
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  <span title="Invoice issued" className="cursor-help inline-flex flex-col items-center gap-0.5">
                    <span>Inv</span>
                    <FileCheck size={14} strokeWidth={1.8} className="text-gray-400" />
                  </span>
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  <span title="Payment Status" className="cursor-help inline-flex flex-col items-center gap-0.5">
                    <span>Pay</span>
                    <CircleDollarSign size={14} strokeWidth={1.8} className="text-gray-400" />
                  </span>
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  <span title="Days to Due Date" className="cursor-help inline-flex flex-col items-center gap-0.5">
                    <span>Due</span>
                    <Clock size={14} strokeWidth={1.8} className="text-gray-400" />
                  </span>
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Client
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Countries/Cities
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Dates
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Amount
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Paid
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Debt
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider leading-tight text-gray-700" title="Profit after PVN">
                  Profit
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider leading-tight text-gray-700" title="VAT (PVN — Pievienotās vērtības nodoklis)">
                  VAT
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Owner
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tree.map((year) => (
                <React.Fragment key={`year-${year.year}`}>
                  {/* Year row */}
                  <tr
                    className="cursor-pointer bg-gray-100 font-semibold leading-tight hover:bg-gray-200 transition-colors"
                    onClick={() => toggleYear(year.year)}
                  >
                    <td className="px-4 py-1.5 text-sm leading-tight text-gray-900">
                      <span className="mr-2 inline-block transition-transform duration-200">
                        {isExpanded("year", year.year) ? "▾" : "▸"}
                      </span>
                      {year.year}
                    </td>
                    <td className="px-2 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                    <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={2}></td>
                    <td className="px-4 py-1.5 text-sm leading-tight text-gray-700"></td>
                    <td className="px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-900">
                      {formatCurrency(year.totals.amount)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-900">
                      {formatCurrency(year.totals.paid)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-900">
                      {formatCurrency(year.totals.debt)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-900">
                      {formatCurrency(year.totals.profit)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-700">
                      {formatCurrency(year.totals.vat)}
                    </td>
                    <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                  </tr>

                  {/* Month rows */}
                  {isExpanded("year", year.year) &&
                    year.months.map((month) => (
                      <React.Fragment key={`month-${month.monthKey}`}>
                        <tr
                          className="cursor-pointer bg-gray-50 font-medium leading-tight hover:bg-gray-100 transition-colors"
                          onClick={() => toggleMonth(month.monthKey)}
                        >
                          <td className="px-4 py-1.5 pl-8 text-sm leading-tight text-gray-900">
                            <span className="mr-2 inline-block transition-transform duration-200">
                              {isExpanded("month", month.monthKey) ? "▾" : "▸"}
                            </span>
                            {month.monthLabel}
                          </td>
                          <td className="px-2 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                          <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={2}></td>
                          <td className="px-4 py-1.5 text-sm leading-tight text-gray-700"></td>
                          <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-900">
                            {formatCurrency(month.totals.amount)}
                          </td>
                          <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-900">
                            {formatCurrency(month.totals.paid)}
                          </td>
                          <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-900">
                            {formatCurrency(month.totals.debt)}
                          </td>
                          <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-900">
                            {formatCurrency(month.totals.profit)}
                          </td>
                          <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-700">
                            {formatCurrency(month.totals.vat)}
                          </td>
                          <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                        </tr>

                        {/* Day rows */}
                        {isExpanded("month", month.monthKey) &&
                          month.days.map((day) => (
                            <React.Fragment key={`day-${day.dayKey}`}>
                              <tr
                                className="cursor-pointer bg-gray-50 font-medium leading-tight hover:bg-gray-100 transition-colors"
                                onClick={() => toggleDay(day.dayKey)}
                              >
                                <td className="px-4 py-1.5 pl-16 text-sm leading-tight text-gray-900">
                                  <span className="mr-2 inline-block transition-transform duration-200">
                                    {isExpanded("day", day.dayKey) ? "▾" : "▸"}
                                  </span>
                                  {day.dayLabel}
                                </td>
                                <td className="px-2 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                                <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={2}></td>
                                <td className="px-4 py-1.5 text-sm leading-tight text-gray-700"></td>
                                <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-900">
                                  {formatCurrency(day.totals.amount)}
                                </td>
                                <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-900">
                                  {formatCurrency(day.totals.paid)}
                                </td>
                                <td
                                  className={`px-4 py-1.5 text-right text-sm font-medium leading-tight ${
                                    day.totals.debt > 0 ? "text-red-600" : "text-gray-900"
                                  }`}
                                >
                                  {formatCurrency(day.totals.debt)}
                                </td>
                                <td className="px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-900">
                                  {formatCurrency(day.totals.profit)}
                                </td>
                                <td className="px-4 py-1.5 text-right text-sm font-medium leading-tight text-gray-700">
                                  {formatCurrency(day.totals.vat)}
                                </td>
                                <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                              </tr>

                              {/* Order rows */}
                              {isExpanded("day", day.dayKey) &&
                                day.orders.map((order) => {
                                  const daysToDue = getDaysToDue(order.dueDate);
                                  const paymentIcon = getPaymentIcon(order);

                                  
                                  return (
                                    <tr
                                      key={`order-${order.orderId}`}
                                      className="cursor-pointer leading-tight transition-colors hover:bg-blue-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset"
                                      onClick={() => handleOrderClick(order)}
                                      onKeyDown={(e) => handleOrderKeyDown(e, order)}
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Open order ${order.orderId}`}
                                    >
                                      <td className="whitespace-nowrap px-4 py-1.5 pl-24 text-sm font-medium leading-tight text-gray-900">
                                        {order.orderId}
                                      </td>
                                      
                                      {/* Invoice icon column */}
                                      <td className="w-12 px-2 py-1.5 text-center text-sm leading-tight">
                                        {order.hasInvoice && order.allServicesInvoiced && (
                                          <span title="All services invoiced" className="cursor-help inline-flex justify-center">
                                            <FileCheck size={16} strokeWidth={1.8} className="text-green-600" />
                                          </span>
                                        )}
                                        {order.hasInvoice && !order.allServicesInvoiced && order.invoicedServices && order.invoicedServices > 0 && (
                                          <span title={`${order.invoicedServices}/${order.totalServices} services invoiced`} className="cursor-help inline-flex justify-center">
                                            <FileMinus2 size={16} strokeWidth={1.8} className="text-amber-500" />
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Payment status icon column */}
                                      <td className="w-12 px-2 py-1.5 text-center text-sm leading-tight">
                                        {paymentIcon && (
                                          <span title={paymentIcon.tooltip} className="cursor-help inline-flex justify-center">
                                            {paymentIcon.icon}
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* DUE: число дней / галка если оплачено / - если нет счёта */}
                                      <td className="w-12 px-2 py-1.5 text-center text-sm leading-tight">
                                        {order.allInvoicesPaid || (order.debt <= 0 && order.amount > 0) ? (
                                          <span title="Оплачено" className="inline-flex justify-center text-green-600">
                                            <Check size={16} strokeWidth={3} />
                                          </span>
                                        ) : daysToDue !== null ? (
                                          <span
                                            className={`inline-flex items-center justify-center gap-0.5 ${daysToDue < 0 ? "font-medium text-red-600" : "text-gray-700"}`}
                                            title={`Due date: ${order.dueDate}`}
                                          >
                                            {daysToDue < 0 && <CircleAlert size={13} strokeWidth={2} />}
                                            {daysToDue}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {order.client}
                                      </td>
                                      <td className="px-4 py-1.5 text-sm leading-tight text-gray-700 max-w-xs" title={order.countriesCities}>
                                        <div className="truncate">
                                          {formatCountriesWithFlags(order.countriesCities)}
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {formatDate(order.datesFrom)} - {formatDate(order.datesTo)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right text-sm leading-tight text-gray-700">
                                        {formatCurrency(order.amount)}
                                      </td>
                                      <td className={`whitespace-nowrap px-4 py-1.5 text-right text-sm leading-tight ${
                                        order.paid > 0 && order.amount > 0 && order.paid > order.amount + 0.01
                                          ? "font-medium text-purple-700"
                                          : "text-gray-700"
                                      }`}>
                                        {formatCurrency(order.paid)}
                                      </td>
                                      <td
                                        className={`whitespace-nowrap px-4 py-1.5 text-right text-sm leading-tight ${
                                          order.debt > 0
                                            ? "font-medium text-orange-600"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {formatCurrency(order.debt)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right text-sm font-semibold leading-tight text-gray-900">
                                        {formatCurrency(order.profit)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right text-sm leading-tight text-gray-700">
                                        {formatCurrency(order.vat ?? 0)}
                                      </td>
                                      <td className="w-8 px-2 py-1.5 text-center">
                                        {(() => {
                                          const colors = getStatusBadgeColor(order.status);
                                          return (
                                            <span
                                              title={order.status}
                                              className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot} cursor-help`}
                                            />
                                          );
                                        })()}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {order.type}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700" title={`Owner: ${order.owner}`}>
                                        {order.owner}
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
      </div>
    </div>
  );
}

