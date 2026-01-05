"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ordersSearchStore from "@/lib/stores/ordersSearchStore";
import { filterOrders } from "@/lib/stores/filterOrders";
import { orderCodeToSlug } from "@/lib/orders/orderCode";

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

  // First, try to split by ", " to detect multiple countries vs country+city
  // Format examples:
  // - "Italy, Rome" (country + city)
  // - "Spain, France" (multiple countries)
  // - "Italy, Rome, Spain, Barcelona" (mixed)
  
  // Strategy: split by comma, then try to identify country+city pairs
  const parts = countriesCities.split(",").map((p) => p.trim());
  
  // If we have 2 parts and second part looks like a city (starts with capital, shorter, no known country match)
  // treat as "Country, City"
  if (parts.length === 2) {
    const first = parts[0];
    const second = parts[1];
    const firstFlag = getCountryFlag(first);
    
    // If first part has a flag, likely it's a country
    // And second part is probably a city (especially if it doesn't match a known country)
    if (firstFlag && !getCountryFlag(second)) {
      // Format: "Country, City"
      return `${firstFlag} ${first}, ${second}`;
    }
  }
  
  // Multiple countries or unknown format - add flags to each known country
  return parts
    .map((part) => {
      const flag = getCountryFlag(part);
      if (flag) {
        return `${flag} ${part}`;
      }
      return part;
    })
    .join(", ");
}

const getStatusBadgeColor = (status: OrderStatus): string => {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-800";
    case "Active":
      return "bg-green-100 text-green-800";
    case "Cancelled":
      return "bg-red-100 text-red-800";
    case "Completed":
      return "bg-blue-100 text-blue-800";
    case "On hold":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString + "T00:00:00");
      if (isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return "-";
    }
  };

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
    if (order.paid >= order.amount) {
      return { icon: "✅", tooltip: "Paid in full" };
    } else if (order.paid > 0) {
      return { icon: "💵", tooltip: "Partial payment" };
    }
    return null;
  };

  // Handle double click to navigate to order
  const handleOrderDoubleClick = (orderCode: string) => {
    router.push(`/orders/${orderCodeToSlug(orderCode)}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading orders...</div>
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
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <button
            onClick={() => router.push("/orders/new")}
            className="rounded-lg bg-black px-6 py-2 text-white transition-colors hover:bg-gray-800"
          >
            New Order
          </button>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="rounded-lg bg-white shadow-sm p-8 text-center">
            <p className="text-gray-500">No orders yet.</p>
            <button
              onClick={() => router.push("/orders/new")}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
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
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700" title="Invoice">
                  Inv
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700" title="Payment Status">
                  Pay
                </th>
                <th className="w-12 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider leading-tight text-gray-700" title="Days to Due">
                  Due
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
                    className="cursor-pointer bg-gray-100 font-semibold leading-tight hover:bg-gray-200"
                    onClick={() => toggleYear(year.year)}
                  >
                    <td className="px-4 py-1.5 text-sm leading-tight text-gray-900">
                      <span className="mr-2">
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
                          className="cursor-pointer bg-gray-50 font-medium leading-tight hover:bg-gray-100"
                          onClick={() => toggleMonth(month.monthKey)}
                        >
                          <td className="px-4 py-1.5 pl-8 text-sm leading-tight text-gray-900">
                            <span className="mr-2">
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
                                className="cursor-pointer bg-gray-50 font-medium leading-tight hover:bg-gray-100"
                                onClick={() => toggleDay(day.dayKey)}
                              >
                                <td className="px-4 py-1.5 pl-16 text-sm leading-tight text-gray-900">
                                  <span className="mr-2">
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
                                      className="cursor-pointer leading-tight transition-colors hover:bg-gray-50"
                                      onDoubleClick={() => handleOrderDoubleClick(order.orderId)}
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
                                      <td className="px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {formatCountriesWithFlags(order.countriesCities)}
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
                                        <span
                                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${getStatusBadgeColor(
                                            order.status
                                          )}`}
                                        >
                                          {order.status}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
                                        {order.type}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-1.5 text-sm leading-tight text-gray-700">
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

