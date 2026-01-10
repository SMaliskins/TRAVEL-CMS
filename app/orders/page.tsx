"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ordersSearchStore from "@/lib/stores/ordersSearchStore";
import { filterOrders } from "@/lib/stores/filterOrders";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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

        // Sort orders by updatedAt DESC
        const sortedOrders = [...orders].sort((a, b) => {
          const aDate = new Date(a.updated);
          const bDate = new Date(b.updated);
          return bDate.getTime() - aDate.getTime();
        });

        const date = new Date(dayKey);
        const dayLabel = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;

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
  "Greece": "GR",
  "Portugal": "PT",
  "Netherlands": "NL",
  "Switzerland": "CH",
  "UK": "GB",
  "United Kingdom": "GB",
  "Austria": "AT",
  "Czech Republic": "CZ",
  "Belgium": "BE",
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

// Format countries/cities string with flags
function formatCountriesWithFlags(countriesCities: string): string {
  if (!countriesCities) return countriesCities;

  // Remove "origin:" and "return:" prefixes, only show destinations
  // Format: "origin:Riga, Latvia|Sharm El Sheikh, Egypt|return:Vilnius, Lithuania"
  // We want only: "Sharm El Sheikh, Egypt"
  
  const parts = countriesCities.split('|').map(p => p.trim());
  const destinations = parts.filter(p => !p.startsWith('origin:') && !p.startsWith('return:'));
  
  // If no explicit destinations, try to extract from the full string
  if (destinations.length === 0) {
    // Fallback: show everything without origin/return prefixes
    return parts
      .map(p => p.replace(/^(origin|return):/i, '').trim())
      .filter(p => p.length > 0)
      .map(p => {
        // Try to add country flag
        const countryMatch = p.match(/,\s*([^,|]+)$/);
        if (countryMatch) {
          const country = countryMatch[1].trim();
          const flag = getCountryFlag(country);
          if (flag) {
            return p.replace(country, `${flag} ${country}`);
          }
        }
        return p;
      })
      .join(', ');
  }
  
  // Format destinations with flags
  return destinations
    .map(dest => {
      const countryMatch = dest.match(/,\s*([^,|]+)$/);
      if (countryMatch) {
        const country = countryMatch[1].trim();
        const flag = getCountryFlag(country);
        if (flag) {
          return dest.replace(country, `${flag} ${country}`);
        }
      }
      return dest;
    })
    .join(', ');
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

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState(() => ordersSearchStore.getState());
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

  // Filter orders based on search state
  const filteredOrders = useMemo(() => {
    return filterOrders(orders, searchState);
  }, [orders, searchState]);

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

  // Helper to get payment status icon
  const getPaymentIcon = (order: OrderRow): { icon: string; tooltip: string } | null => {
    // Full checkmark only if all invoices are fully paid
    if (order.allInvoicesPaid && order.totalInvoices && order.totalInvoices > 0) {
      return { icon: "✅", tooltip: "All invoices paid in full" };
    } else if (order.paid >= order.amount) {
      return { icon: "✅", tooltip: "Paid in full" };
    } else if (order.paid > 0) {
      return { icon: "💵", tooltip: "Partial payment" };
    }
    return null;
  };;

  // Handle click to navigate to order (changed from double-click to single-click)
  const handleOrderClick = (orderCode: string) => {
    router.push(`/orders/${orderCodeToSlug(orderCode)}`);
  };

  // Handle keyboard navigation (Enter key)
  const handleOrderKeyDown = (e: React.KeyboardEvent, orderCode: string) => {
    if (e.key === "Enter") {
      router.push(`/orders/${orderCodeToSlug(orderCode)}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
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
      <div className="bg-gray-50">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <button
              onClick={() => router.push("/orders/new")}
              className="rounded-lg bg-black px-6 py-2 text-white transition-colors hover:bg-gray-800"
            >
              New Order
            </button>
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
    <div className="bg-gray-50">
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            {(searchState.queryText || searchState.clientLastName || searchState.status !== 'all' || searchState.country || searchState.orderType !== 'all') && (
              <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Filtered ({filteredOrders.length} results)
              </span>
            )}
          </div>
          <button
            onClick={() => router.push("/orders/new")}
            className="rounded-lg bg-black px-6 py-2 text-white transition-colors hover:bg-gray-800"
          >
            New Order
          </button>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="rounded-lg bg-white shadow-sm p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">No orders yet</p>
            <p className="text-gray-500 mb-6">Get started by creating your first order</p>
            <button
              onClick={() => router.push("/orders/new")}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
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
                  <span title="Invoice issued" className="cursor-help">Inv 📝</span>
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  <span title="Payment Status" className="cursor-help">Pay 💵</span>
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  <span title="Days to Due Date" className="cursor-help">Due ⏰</span>
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
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Profit
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
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Updated
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
                                <td className="px-4 py-1.5 text-sm leading-tight text-gray-700" colSpan={3}></td>
                              </tr>

                              {/* Order rows */}
                              {isExpanded("day", day.dayKey) &&
                                day.orders.map((order) => {
                                  const daysToDue = getDaysToDue(order.dueDate);
                                  const paymentIcon = getPaymentIcon(order);
                                  const hasInvoice = (order.invoiceCount || 0) > 0;
                                  
                                  return (
                                    <tr
                                      key={`order-${order.orderId}`}
                                      className="cursor-pointer leading-tight transition-colors hover:bg-blue-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset"
                                      onClick={() => handleOrderClick(order.orderId)}
                                      onKeyDown={(e) => handleOrderKeyDown(e, order.orderId)}
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Open order ${order.orderId}`}
                                    >
                                      <td className="whitespace-nowrap px-4 py-1.5 pl-24 text-sm font-medium leading-tight text-gray-900">
                                        {order.orderId}
                                      </td>
                                      
                                      {/* Invoice icon column */}
                                      <td className="w-12 px-2 py-1.5 text-center text-sm leading-tight">
                                        {hasInvoice && (
                                          <span title="Invoice issued" className="cursor-help">
                                            📝
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Payment status icon column */}
                                      <td className="w-12 px-2 py-1.5 text-center text-sm leading-tight">
                                        {paymentIcon && (
                                          <span title={paymentIcon.tooltip} className="cursor-help">
                                            {paymentIcon.icon}
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Days to due column */}
                                      <td className="w-12 px-2 py-1.5 text-center text-sm leading-tight">
                                        {daysToDue !== null ? (
                                          <span
                                            className={daysToDue < 0 ? "font-medium text-red-600" : "text-gray-700"}
                                            title={`Due date: ${order.dueDate}`}
                                          >
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
                                      <td className="whitespace-nowrap px-4 py-1.5 text-right text-sm leading-tight text-gray-700">
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
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight">
                                        {(() => {
                                          const colors = getStatusBadgeColor(order.status);
                                          return (
                                            <span
                                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${colors.bg} ${colors.text}`}
                                            >
                                              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                                              {order.status}
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {order.type}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700" title={`Owner: ${order.owner}`}>
                                        {order.owner}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {formatDate(order.updated)}
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

