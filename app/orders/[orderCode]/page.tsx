"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { slugToOrderCode } from "@/lib/orders/orderCode";
import OrderStatusBadge, { getEffectiveStatus } from "@/components/OrderStatusBadge";
import OrderServicesBlock from "./_components/OrderServicesBlock";
import InvoiceCreator from "./_components/InvoiceCreator";
import InvoiceList from "./_components/InvoiceList";
import PartySelect from "@/components/PartySelect";
import DateRangePicker from "@/components/DateRangePicker";
import CityMultiSelect, { CityWithCountry } from "@/components/CityMultiSelect";
import { getCityByName, countryCodeToFlag } from "@/lib/data/cities";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useToast } from "@/contexts/ToastContext";

type TabType = "client" | "finance" | "documents" | "communication" | "log";
const TAB_VALUES: TabType[] = ["client", "finance", "documents", "communication", "log"];
function isValidTab(value: string | null): value is TabType {
  return value !== null && TAB_VALUES.includes(value as TabType);
}
type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";

interface PaymentDateItem {
  type: string;
  date: string;
}

interface OrderData {
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
  profit_estimated: number;
  client_phone?: string | null;
  client_email?: string | null;
  payment_dates?: PaymentDateItem[];
  overdue_days?: number | null;
  // Agent and creation info
  owner_user_id?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ orderCode: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [activeTab, setActiveTabState] = useState<TabType>("client");

  // Sync tab from URL (on load and when user uses back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (isValidTab(tabFromUrl)) {
      setActiveTabState(tabFromUrl);
    }
  }, [searchParams]);

  // Update URL when tab changes so reload keeps the same tab
  const setActiveTab = useCallback(
    (tab: TabType) => {
      setActiveTabState(tab);
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.set("tab", tab);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, searchParams, router]
  );

  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [stickyHeaderBottom, setStickyHeaderBottom] = useState(280);

  useEffect(() => {
    if (!stickyHeaderRef.current) return;
    const STICKY_TOP = 92;
    const measure = () => {
      const el = stickyHeaderRef.current;
      if (el) setStickyHeaderBottom(STICKY_TOP + el.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stickyHeaderRef.current);
    return () => ro.disconnect();
  }, []);

  const [orderCode, setOrderCode] = useState<string>("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderLoading, setOrderLoading] = useState(false); // order fetch in progress (header shows "Loading...")
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showInvoiceCreator, setShowInvoiceCreator] = useState(false);
  const [invoiceServices, setInvoiceServices] = useState<any[]>([]);
  const [invoiceServicesByPayer, setInvoiceServicesByPayer] = useState<Map<string, any[]>>(new Map());
  const [invoiceRefetchTrigger, setInvoiceRefetchTrigger] = useState(0);
  const [showOrderSource, setShowOrderSource] = useState(false);
  const [companyCurrencyCode, setCompanyCurrencyCode] = useState<string>("EUR");
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [editingHeaderField, setEditingHeaderField] = useState<"client" | "itinerary" | "dates" | null>(null);
  
  // Inline edit states
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState<string>("");
  const [editDateFrom, setEditDateFrom] = useState<string>("");
  const [editDateTo, setEditDateTo] = useState<string>("");
  const [editOrigin, setEditOrigin] = useState<CityWithCountry | null>(null);
  const [editDestinations, setEditDestinations] = useState<CityWithCountry[]>([]);
  const [editReturnToOrigin, setEditReturnToOrigin] = useState(true);
  const [editReturnCity, setEditReturnCity] = useState<CityWithCountry | null>(null);
  const [isSavingField, setIsSavingField] = useState(false);
  const [draggedDestIdx, setDraggedDestIdx] = useState<number | null>(null);
  // Auto-detected destinations from services (fallback when countries_cities is empty)
  const [autoDestinations, setAutoDestinations] = useState<CityWithCountry[]>([]);
  
  // Track Ctrl key for Ctrl+click navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setIsCtrlPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  
  // Parse itinerary from countries_cities
  const parsedItinerary = useMemo(() => {
    if (!order?.countries_cities) return { origin: null, destinations: [], returnCity: null, daysNights: null, daysUntil: null };
    
    const countriesCities = order.countries_cities;
    let originCity: { name: string; countryCode?: string } | null = null;
    let destinations: { name: string; countryCode?: string }[] = [];
    let returnCity: { name: string; countryCode?: string } | null = null;
    
    // Check for new format with origin:/return:
    if (countriesCities.includes("origin:") || countriesCities.includes("|")) {
      const parts = countriesCities.split("|");
      for (const part of parts) {
        if (part.startsWith("origin:")) {
          const cityStr = part.replace("origin:", "").trim();
          const cityName = cityStr.split(",")[0]?.trim() || "";
          const cityData = getCityByName(cityName);
          originCity = cityData || (cityName ? { name: cityName } : null);
        } else if (part.startsWith("return:")) {
          const cityStr = part.replace("return:", "").trim();
          const cityName = cityStr.split(",")[0]?.trim() || "";
          if (cityName) {
            const cityData = getCityByName(cityName);
            returnCity = cityData || { name: cityName };
          }
        } else if (part.trim()) {
          // Destinations
          destinations = part.split(";").map(item => {
            const cityName = item.trim().split(",")[0]?.trim() || "";
            const cityData = getCityByName(cityName);
            return cityData || (cityName ? { name: cityName } : null);
          }).filter(Boolean) as { name: string; countryCode?: string }[];
        }
      }
    } else {
      // Legacy format
      const cities = countriesCities.split(",").map((c) => c.trim());
      originCity = cities.length > 0 ? getCityByName(cities[0]) || { name: cities[0] } : null;
      destinations = cities.slice(1).map((c) => getCityByName(c) || { name: c });
    }
    
    // Calculate days/nights
    let daysNights = null;
    let daysUntil = null;
    if (order.date_from && order.date_to) {
      const days = Math.ceil((new Date(order.date_to).getTime() - new Date(order.date_from).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const nights = Math.max(0, days - 1);
      daysNights = `${days} ${days === 1 ? 'day' : 'days'} / ${nights} ${nights === 1 ? 'night' : 'nights'}`;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tripDate = new Date(order.date_from);
      tripDate.setHours(0, 0, 0, 0);
      daysUntil = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    return { origin: originCity, destinations, returnCity, daysNights, daysUntil };
  }, [order?.countries_cities, order?.date_from, order?.date_to]);

  // Build destinations array for map (origin + destinations + returnCity if different)
  const itineraryDestinations: CityWithCountry[] = useMemo(() => {
    const result: CityWithCountry[] = [];
    if (parsedItinerary.origin) {
      const cityData = getCityByName(parsedItinerary.origin.name);
      result.push({
        city: parsedItinerary.origin.name,
        country: cityData?.country || "",
        countryCode: parsedItinerary.origin.countryCode || cityData?.countryCode,
        lat: cityData?.lat,
        lng: cityData?.lng,
      });
    }
    for (const dest of parsedItinerary.destinations) {
      const cityData = getCityByName(dest.name);
      result.push({
        city: dest.name,
        country: cityData?.country || "",
        countryCode: dest.countryCode || cityData?.countryCode,
        lat: cityData?.lat,
        lng: cityData?.lng,
      });
    }
    // Add return city for map - even when same as origin (round trip: Tallinn→Nice→Tallinn)
    if (parsedItinerary.returnCity) {
      const cityData = getCityByName(parsedItinerary.returnCity.name);
      result.push({
        city: parsedItinerary.returnCity.name,
        country: cityData?.country || "",
        countryCode: parsedItinerary.returnCity.countryCode || cityData?.countryCode,
        lat: cityData?.lat,
        lng: cityData?.lng,
      });
    }
    return result;
  }, [parsedItinerary]);

  // Initialize edit states when starting to edit
  const startEditingClient = useCallback(() => {
    setEditClientId(order?.client_party_id || null);
    setEditClientName(order?.client_display_name || "");
    setEditingHeaderField("client");
  }, [order?.client_party_id, order?.client_display_name]);

  const startEditingDates = useCallback(() => {
    setEditDateFrom(order?.date_from || "");
    setEditDateTo(order?.date_to || "");
    setEditingHeaderField("dates");
  }, [order?.date_from, order?.date_to]);

  const startEditingItinerary = useCallback(() => {
    // Parse current itinerary to CityWithCountry format
    let originCity: CityWithCountry | null = null;
    if (parsedItinerary.origin) {
      const cityData = getCityByName(parsedItinerary.origin.name);
      originCity = cityData ? {
        city: cityData.name,
        country: cityData.country || "",
        countryCode: cityData.countryCode,
        lat: cityData.lat,
        lng: cityData.lng,
      } : { city: parsedItinerary.origin.name, country: "" };
      setEditOrigin(originCity);
    } else {
      setEditOrigin(null);
    }
    setEditDestinations(parsedItinerary.destinations.map(d => {
      const cityData = getCityByName(d.name);
      return cityData ? {
        city: cityData.name,
        country: cityData.country || "",
        countryCode: cityData.countryCode,
        lat: cityData.lat,
        lng: cityData.lng,
      } : { city: d.name, country: "" };
    }));
    // Default to return to origin
    setEditReturnToOrigin(true);
    setEditReturnCity(null);
    setEditingHeaderField("itinerary");
  }, [parsedItinerary.origin, parsedItinerary.destinations]);

  // Save functions
  const saveClient = async (partyId: string, displayName: string) => {
    if (!order) return;
    setIsSavingField(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          client_party_id: partyId || null,
          client_display_name: displayName || null,
        }),
      });
      if (response.ok) {
        setOrder({ ...order, client_party_id: partyId || null, client_display_name: displayName || null });
        setEditingHeaderField(null);
      }
    } catch (err) {
      console.error("Error saving client:", err);
    } finally {
      setIsSavingField(false);
    }
  };

  const saveDates = async () => {
    if (!order) return;
    setIsSavingField(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          date_from: editDateFrom || null,
          date_to: editDateTo || null,
        }),
      });
      if (response.ok) {
        setOrder({ ...order, date_from: editDateFrom, date_to: editDateTo });
        setEditingHeaderField(null);
      }
    } catch (err) {
      console.error("Error saving dates:", err);
    } finally {
      setIsSavingField(false);
    }
  };

  const saveItinerary = async () => {
    if (!order) return;
    setIsSavingField(true);
    try {
      let formattedCities = "";
      if (editOrigin) {
        formattedCities = `origin:${editOrigin.city}, ${editOrigin.country}|`;
      }
      const uniqueDests = editDestinations.filter((city, idx, arr) => 
        arr.findIndex(c => c.city.toLowerCase() === city.city.toLowerCase()) === idx
      );
      if (uniqueDests.length > 0) {
        formattedCities += uniqueDests.map(c => `${c.city}, ${c.country}`).join("; ");
      }
      // Return city
      let returnCityStr = "";
      if (editReturnToOrigin && editOrigin) {
        returnCityStr = `${editOrigin.city}, ${editOrigin.country}`;
      } else if (!editReturnToOrigin && editReturnCity) {
        returnCityStr = `${editReturnCity.city}, ${editReturnCity.country}`;
      }
      formattedCities += "|return:" + returnCityStr;

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          countries_cities: formattedCities || null,
        }),
      });
      if (response.ok) {
        setOrder({ ...order, countries_cities: formattedCities });
        setEditingHeaderField(null);
      }
    } catch (err) {
      console.error("Error saving itinerary:", err);
    } finally {
      setIsSavingField(false);
    }
  };

  // Fetch company settings for conditional Order Source display
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch("/api/company", {
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setShowOrderSource(data.company?.show_order_source || false);
          setCompanyCurrencyCode(data.company?.default_currency || "EUR");
        }
      } catch (err) {
        console.error("Failed to fetch company settings:", err);
      }
    };
    fetchCompanySettings();
  }, []);

  // Resolve orderCode from params, then fetch order (services load in parallel in OrderServicesBlock)
  useEffect(() => {
    let cancelled = false;
    params.then((resolvedParams) => {
      if (cancelled) return;
      const code = slugToOrderCode(resolvedParams.orderCode);
      setOrderCode(code);
      setError(null);
      setOrderLoading(true);

      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`/api/orders/${encodeURIComponent(code)}`, {
            headers: {
              ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
          });
          if (cancelled) return;
          if (response.ok) {
            const data = await response.json();
            setOrder(data.order || data);
          } else if (response.status === 404) {
            setError("Order not found");
          } else {
            const errData = await response.json().catch(() => ({}));
            setError(errData.error || "Failed to load order");
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Fetch order error:", err);
            setError("Network error");
          }
        } finally {
          if (!cancelled) setOrderLoading(false);
        }
      })();
    });
    return () => { cancelled = true; };
  }, [params]);

  // Update order status
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order || isSaving) return;
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrder({ ...order, status: newStatus });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Failed to update status:", errData.error);
      }
    } catch (err) {
      console.error("Update status error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate effective status (auto-finish if past date_to)
  const effectiveStatus = order ? getEffectiveStatus(order.status, order.date_to) : "Active";

  // Full-page loading only until we have orderCode (params resolved)
  if (!orderCode) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-4">
        {/* A) Order Header - Order Code left, Client+Itinerary+Amount right */}
        <div ref={stickyHeaderRef} className="mb-0 sticky top-[92px] z-20 bg-gray-50 -mx-4 px-4 pt-2 pb-2 border-b border-gray-200">
          {/* Main Row: Order Code | Client + Itinerary + Dates | Amount + Payment */}
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Left: Order Code + Status + Created/Agent */}
            <div className="shrink-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {orderCode}
                </h1>
                {order && (
                  <OrderStatusBadge 
                    status={effectiveStatus}
                    onChange={effectiveStatus !== "Completed" ? handleStatusChange : undefined}
                    readonly={effectiveStatus === "Completed" || isSaving}
                  />
                )}
              </div>
              {/* Created date + Agent - directly under order code */}
              {order?.created_at && (
                <div className="mt-0.5 text-xs text-gray-400">
                  Created on {formatDateDDMMYYYY(order.created_at)} by {order.owner_name || "Unknown"}
                </div>
              )}
              {/* Order Type & Source Radio Bars */}
              {order && (
                <div className="mt-1.5 flex flex-col gap-1">
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-fit">
                    {[
                      { value: "leisure", label: "Leisure" },
                      { value: "business", label: "Business" },
                      { value: "lifestyle", label: "Lifestyle" },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          if (order.order_type === type.value) return;
                          const prevValue = order.order_type;
                          setOrder({ ...order, order_type: type.value });
                          (async () => {
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                                },
                                credentials: "include",
                                body: JSON.stringify({ order_type: type.value }),
                              });
                              if (!response.ok) {
                                setOrder(prev => prev ? { ...prev, order_type: prevValue } : prev);
                              }
                            } catch (err) {
                              console.error("Update error:", err);
                              setOrder(prev => prev ? { ...prev, order_type: prevValue } : prev);
                            }
                          })();
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          order.order_type === type.value
                            ? "bg-gray-700 text-white shadow-sm"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  {showOrderSource && (
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-fit">
                      {[
                        { value: "TA", label: "TA" },
                        { value: "TO", label: "TO" },
                        { value: "CORP", label: "CORP" },
                        { value: "NON", label: "NON" },
                      ].map((source) => (
                        <button
                          key={source.value}
                          type="button"
                          onClick={() => {
                            if (order.order_source === source.value) return;
                            const prevValue = order.order_source;
                            setOrder({ ...order, order_source: source.value });
                            (async () => {
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                    ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                                  },
                                  credentials: "include",
                                  body: JSON.stringify({ order_source: source.value }),
                                });
                                if (!response.ok) {
                                  setOrder(prev => prev ? { ...prev, order_source: prevValue } : prev);
                                }
                              } catch (err) {
                                console.error("Update error:", err);
                                setOrder(prev => prev ? { ...prev, order_source: prevValue } : prev);
                              }
                            })();
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            order.order_source === source.value
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          } disabled:opacity-50`}
                        >
                          {source.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Center: Client Name + Itinerary + Dates (or Loading when order not yet loaded) */}
            {!order ? (
              <div className="flex-1 min-w-0 ml-4 flex items-center text-gray-500">
                {orderLoading ? "Loading order..." : null}
              </div>
            ) : (
              <div className="flex-1 min-w-0 ml-4">
                {/* Row 1: Client Name */}
                {editingHeaderField === "client" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-64">
                      <PartySelect
                        value={editClientId}
                        onChange={(partyId, displayName) => {
                          if (partyId && displayName) {
                            // Save new client
                            saveClient(partyId, displayName);
                          }
                          // If X is pressed (partyId === null), don't save - just clear input for new selection
                          // User must select a new client or Cancel to restore old one
                        }}
                        roleFilter="client"
                        initialDisplayName={order.client_display_name || ""}
                      />
                    </div>
                    <button
                      onClick={() => {
                        // Close without saving - original client stays
                        setEditingHeaderField(null);
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <span className="text-xs text-gray-400">
                      (Select new or Cancel to keep current)
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Lead Passenger</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        className={`text-xl font-bold cursor-pointer rounded px-1 -mx-1 transition-colors ${
                          isCtrlPressed && order.client_party_id 
                            ? "text-blue-600 underline" 
                            : "text-gray-900 hover:bg-gray-100"
                        }`}
                        onClick={() => {
                          if (isCtrlPressed && order.client_party_id) {
                            router.push(`/directory/${order.client_party_id}`);
                          } else {
                            startEditingClient();
                          }
                        }}
                        title={isCtrlPressed ? "Ctrl+Click to open client" : "Click to change client"}
                      >
                        {order.client_display_name || "Select client"}
                      </span>
                      {order.client_phone && (
                        <a href={`tel:${order.client_phone}`} className="text-sm text-blue-600 hover:text-blue-800">
                          {order.client_phone}
                        </a>
                      )}
                      {order.client_email && (
                        <a href={`mailto:${order.client_email}`} className="text-sm text-blue-600 hover:text-blue-800">
                          {order.client_email}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Row 2: Itinerary */}
                {editingHeaderField === "itinerary" ? (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                        <CityMultiSelect
                          selectedCities={editOrigin ? [editOrigin] : []}
                          onChange={(cities) => setEditOrigin(cities[0] || null)}
                          placeholder="Origin city..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">To (drag to reorder)</label>
                        {/* Draggable destination tags */}
                        {editDestinations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {editDestinations.map((city, idx) => (
                              <div
                                key={`${city.city}-${idx}`}
                                draggable
                                onDragStart={() => setDraggedDestIdx(idx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedDestIdx !== null && draggedDestIdx !== idx) {
                                    const newDests = [...editDestinations];
                                    const [dragged] = newDests.splice(draggedDestIdx, 1);
                                    newDests.splice(idx, 0, dragged);
                                    setEditDestinations(newDests);
                                  }
                                  setDraggedDestIdx(null);
                                }}
                                onDragEnd={() => setDraggedDestIdx(null)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded cursor-move text-xs transition-all ${
                                  draggedDestIdx === idx 
                                    ? "bg-blue-200 text-blue-800 opacity-50" 
                                    : "bg-green-100 text-green-800 hover:bg-green-200"
                                }`}
                              >
                                {city.countryCode && <span>{countryCodeToFlag(city.countryCode)}</span>}
                                {city.city}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditDestinations(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="ml-0.5 text-green-600 hover:text-green-800"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <CityMultiSelect
                          selectedCities={[]}
                          onChange={(cities) => {
                            if (cities.length > 0) {
                              setEditDestinations(prev => [...prev, ...cities]);
                            }
                          }}
                          placeholder="Add destination..."
                        />
                      </div>
                    </div>
                    {/* Return options */}
                    <div className="mt-3 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editReturnToOrigin}
                          onChange={(e) => {
                            setEditReturnToOrigin(e.target.checked);
                            if (e.target.checked) setEditReturnCity(null);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Return to origin</span>
                      </label>
                      {!editReturnToOrigin && (
                        <div className="flex-1 max-w-48">
                          <CityMultiSelect
                            selectedCities={editReturnCity ? [editReturnCity] : []}
                            onChange={(cities) => setEditReturnCity(cities[0] || null)}
                            placeholder="Return city..."
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={saveItinerary}
                        disabled={isSavingField}
                        className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingField ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingHeaderField(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-1.5 flex-wrap mt-1 cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-gray-100"
                    onClick={startEditingItinerary}
                    title="Click to edit itinerary"
                  >
                    {parsedItinerary.origin || parsedItinerary.destinations.length > 0 || autoDestinations.length > 0 ? (
                      <>
                        <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Destination:</span>
                        {/* Only show destinations (where main service is). NOT origin/departure point. */}
                        {(() => {
                          const manualDests = [
                            ...parsedItinerary.destinations,
                            ...(parsedItinerary.returnCity && parsedItinerary.returnCity.name !== parsedItinerary.origin?.name 
                              ? [parsedItinerary.returnCity] : [])
                          ];
                          // If no manually set destinations, use auto-detected from services
                          const allCities = manualDests.length > 0 ? manualDests : autoDestinations;
                          if (allCities.length === 0) return <span className="text-gray-400 text-sm">Click to set destination</span>;
                          
                          // Group by country
                          const countryCities: Record<string, { countryCode?: string; cities: string[] }> = {};
                          for (const city of allCities) {
                            const cityData = getCityByName(city.name);
                            const countryName = cityData?.country || "Unknown";
                            const countryCode = city.countryCode || cityData?.countryCode;
                            
                            if (!countryCities[countryName]) {
                              countryCities[countryName] = { countryCode, cities: [] };
                            }
                            if (!countryCities[countryName].cities.includes(city.name)) {
                              countryCities[countryName].cities.push(city.name);
                            }
                          }
                          
                          return Object.entries(countryCities).map(([country, data], idx) => (
                            <span key={country} className="flex items-center">
                              <span className="flex items-center gap-1 text-base font-semibold text-gray-900">
                                {data.countryCode && (
                                  <span>{countryCodeToFlag(data.countryCode)}</span>
                                )}
                                {country} ({data.cities.join(", ")})
                              </span>
                              {idx < Object.keys(countryCities).length - 1 && (
                                <span className="text-gray-400 text-sm mx-2">/</span>
                              )}
                            </span>
                          ));
                        })()}
                      </>
                    ) : (
                      <span className="text-gray-400 text-sm">Click to set destination</span>
                    )}
                  </div>
                )}
                
                {/* Row 3: Dates */}
                {editingHeaderField === "dates" ? (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <div className="w-80">
                      <DateRangePicker
                        label=""
                        from={editDateFrom || undefined}
                        to={editDateTo || undefined}
                        onChange={(from, to) => {
                          setEditDateFrom(from || "");
                          setEditDateTo(to || "");
                        }}
                      />
                    </div>
                    <button
                      onClick={saveDates}
                      disabled={isSavingField}
                      className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingField ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingHeaderField(null)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-2 mt-1 text-sm text-gray-600 cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-gray-100"
                    onClick={startEditingDates}
                    title="Click to edit dates"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {order.date_from ? formatDateDDMMYYYY(order.date_from) : "—"} — {order.date_to ? formatDateDDMMYYYY(order.date_to) : "—"}
                    </span>
                    {parsedItinerary.daysNights && (
                      <span className="text-gray-500">({parsedItinerary.daysNights})</span>
                    )}
                    {parsedItinerary.daysUntil !== null && parsedItinerary.daysUntil >= 0 && (
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {parsedItinerary.daysUntil} {parsedItinerary.daysUntil === 1 ? 'day' : 'days'} before trip
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Right: Total (active services) + Payment Status + Dates */}
            {order && (
              <div className="flex items-center gap-4 shrink-0 flex-wrap justify-end">
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    €{(order.amount_total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500">Total (active services)</div>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                    order.amount_total > 0 && order.amount_paid >= order.amount_total
                      ? "bg-green-100 text-green-800"
                      : order.amount_paid > 0
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {order.amount_total > 0 && order.amount_paid >= order.amount_total
                      ? "Paid"
                      : order.amount_paid > 0
                      ? "Partially paid"
                      : "Unpaid"
                    }
                  </div>
                  {order.amount_total > 0 && order.amount_paid >= order.amount_total && (
                    <span className="text-xs text-green-700">
                      €{(order.amount_paid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} paid
                    </span>
                  )}
                  {order.amount_paid > 0 && order.amount_total > 0 && order.amount_paid < order.amount_total && (
                    <span className="text-xs text-gray-600">
                      €{(order.amount_paid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} paid, €{(order.amount_debt ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} remaining
                    </span>
                  )}
                  {order.amount_total > 0 && order.amount_paid < order.amount_total && order.amount_paid === 0 && (
                    <span className="text-xs text-gray-600">
                      €{(order.amount_debt ?? order.amount_total).toLocaleString("en-US", { minimumFractionDigits: 2 })} to pay
                    </span>
                  )}
                  {(order.payment_dates?.length ?? 0) > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {order.payment_dates!.map((p, i) => (
                        <span key={i}>
                          {p.type === "deposit" ? "Deposit" : "Final"}: {formatDateDDMMYYYY(p.date)}
                          {i < order.payment_dates!.length - 1 ? "; " : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {order.overdue_days != null && order.overdue_days > 0 && (
                    <span className="text-xs text-red-600 font-medium">
                      {order.overdue_days} {order.overdue_days === 1 ? "day" : "days"} overdue
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* B) Tabs */}
          <nav className="-mb-px flex space-x-6 border-t border-gray-200 mt-2">
            <button
              onClick={() => setActiveTab("client")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "client"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab("finance")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "finance"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Finance
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "documents"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab("communication")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "communication"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Communication
            </button>
            <button
              onClick={() => setActiveTab("log")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === "log"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Log
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mb-6 relative z-0">
          {activeTab === "client" && (
            <div className="space-y-6">
              {/* Services Block - loads in parallel with order (table appears as soon as services load) */}
              <OrderServicesBlock 
                orderCode={orderCode}
                defaultClientId={order?.client_party_id}
                defaultClientName={order?.client_display_name || undefined}
                orderDateFrom={order?.date_from}
                orderDateTo={order?.date_to}
                stickyTopOffset={stickyHeaderBottom}
                itineraryDestinations={itineraryDestinations}
                orderSource={(order?.order_source as 'TA' | 'TO' | 'CORP' | 'NON') || 'NON'}
                companyCurrencyCode={companyCurrencyCode}
                onDestinationsFromServices={setAutoDestinations}
                onTotalsChanged={(totals) => {
                  setOrder(prev => prev ? {
                    ...prev,
                    amount_total: totals.amount_total,
                    amount_debt: Math.max(0, totals.amount_total - (prev.amount_paid || 0)),
                    profit_estimated: totals.profit_estimated,
                  } : prev);
                }}
                onIssueInvoice={(services) => {
                  // Filter out cancelled services
                  const activeServices = services.filter(s => s.resStatus !== 'cancelled');
                  
                  if (activeServices.length === 0) {
                    alert('No active services selected. Cancelled services are excluded.');
                    return;
                  }
                  
                  // Group services by payer
                  // Group by payer name (normalized) - if names are the same (case-insensitive, trimmed), it's the same payer
                  const groupedByPayerName = new Map<string, any[]>();
                  
                  activeServices.forEach(service => {
                    // Normalize payer name: trim, lowercase for comparison, but keep original for display
                    const payerNameRaw = (service.payer || 'no-payer').trim();
                    const payerNameKey = payerNameRaw.toLowerCase();
                    
                    if (!groupedByPayerName.has(payerNameKey)) {
                      groupedByPayerName.set(payerNameKey, []);
                    }
                    groupedByPayerName.get(payerNameKey)!.push(service);
                  });
                  
                  // If multiple different payers (by normalized name), show grouped services
                  if (groupedByPayerName.size > 1) {
                    setInvoiceServicesByPayer(groupedByPayerName);
                    setShowInvoiceCreator(true);
                    setActiveTab("finance");
                  } else {
                    // Single payer - use existing flow
                    setInvoiceServices(services);
                    setInvoiceServicesByPayer(new Map());
                    setShowInvoiceCreator(true);
                    setActiveTab("finance");
                  }
                }}
              />
            </div>
          )}

          {activeTab === "finance" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              {showInvoiceCreator ? (
                <InvoiceCreator
                  orderCode={orderCode}
                  clientName={order?.client_display_name || null}
                  selectedServices={invoiceServices}
                  servicesByPayer={invoiceServicesByPayer.size > 0 ? invoiceServicesByPayer : undefined}
                  onClose={() => {
                    setShowInvoiceCreator(false);
                    setInvoiceServices([]);
                    setInvoiceServicesByPayer(new Map());
                  }}
                  onSuccess={() => {
                    setShowInvoiceCreator(false);
                    setInvoiceServices([]);
                    setInvoiceServicesByPayer(new Map());
                    setInvoiceRefetchTrigger(prev => prev + 1);
                  }}
                />
              ) : (
                <InvoiceList
                  orderCode={orderCode}
                  key={invoiceRefetchTrigger}
                  onCreateNew={() => {
                    // Switch to Client tab to select services
                    setActiveTab("client");
                    showToast("error", "Please select services from the table and click 'Issue Invoice'");
                  }}
                />
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Documents
              </h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}

          {activeTab === "communication" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Communication
              </h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}

          {activeTab === "log" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">Log</h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}
        </div>

      </div>
      
    </div>
  );
}
