"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import StatisticCard, { CardPeriodType } from "@/components/dashboard/StatisticCard";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import ProfitOrdersChart from "@/components/dashboard/ProfitOrdersChart";
import TargetSpeedometer, { AgentTarget } from "@/components/dashboard/TargetSpeedometer";
import TouristsMap from "@/components/dashboard/TouristsMap";
import RecentlyCompletedList from "@/components/dashboard/RecentlyCompletedList";
import CalendarWithDots from "@/components/dashboard/CalendarWithDots";
import AIWindowPlaceholder from "@/components/dashboard/AIWindowPlaceholder";
import FinanceDashboard from "@/components/dashboard/FinanceDashboard";
import "../hotels-booking/modern-booking.css";

interface DashboardStatistics {
  ordersCount: number;
  activeBookings: number;
  revenue: number;
  profit: number;
  vat: number;
  totalCommission: number;
  overdueAmount: number;
  targetProfitMonthly: number;
  targetRevenueMonthly: number;
  targetOrdersMonthly: number;
}

interface PreviousYearComparison {
  ordersCount: number;
  activeBookings: number;
  revenue: number;
}

interface ChartDataPoint {
  date: string;
  profit: number;
  orders: number;
}

interface TouristLocation {
  id: string;
  name: string;
  location: [number, number];
  orderCode?: string;
  status?: "upcoming" | "in-progress" | "completed";
  completedAt?: string;
  destination?: string;
}

interface CalendarEvent {
  date: string;
  status: "upcoming" | "in-progress" | "completed";
  orderCode: string;
  orderId?: string;
  count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const currentRole = useCurrentUserRole();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Period state
  const [period, setPeriod] = useState<PeriodType>("currentMonth");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");

  // Data states
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [previousYear, setPreviousYear] = useState<PreviousYearComparison | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [touristLocations, setTouristLocations] = useState<TouristLocation[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const showTargets = !!currentRole;
  const showAgentBreakdown = currentRole === "supervisor" || currentRole === "admin" || currentRole === "director";
  const isSubagent = currentRole === "subagent";
  const isFinance = currentRole === "finance";
  const [agentTargets, setAgentTargets] = useState<AgentTarget[]>([]);

  const tokenRef = useRef<string | null>(null);

  // Per-card period overrides
  type CardKey = "orders" | "bookings" | "revenue" | "overdue";
  const [cardPeriods, setCardPeriods] = useState<Record<CardKey, CardPeriodType>>({
    orders: "inherit",
    bookings: "inherit",
    revenue: "inherit",
    overdue: "allTime",
  });
  const [cardOverrideData, setCardOverrideData] = useState<Record<CardKey, {
    stats: DashboardStatistics | null;
    prevYear: PreviousYearComparison | null;
  } | null>>({
    orders: null,
    bookings: null,
    revenue: null,
    overdue: null,
  });

  // Calculate period dates
  useEffect(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "currentMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last3Months": {
        const day = now.getDate() === 1 ? 1 : now.getDate();
        const targetMonth = now.getMonth() - 3;
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        start = new Date(actualYear, actualMonth, safeDay);
      }
        break;
      case "last6Months": {
        const day = now.getDate() === 1 ? 1 : now.getDate();
        const targetMonth = now.getMonth() - 6;
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        start = new Date(actualYear, actualMonth, safeDay);
      }
        break;
      case "lastYear":
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "allTime":
        start = new Date(2020, 0, 1);
        break;
      default:
        // Custom - will be set by PeriodSelector
        return;
    }

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setPeriodStart(formatDate(start));
    setPeriodEnd(formatDate(end));
  }, [period]);

  // Fetch statistics
  useEffect(() => {
    if (!periodStart || !periodEnd) return;

    const fetchStatistics = async () => {
      try {
        const token = tokenRef.current;
        if (!token) return;

        const response = await fetch(
          `/api/dashboard/statistics?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setStatistics(data);
        }
      } catch (error) {
        console.error("Error fetching statistics:", error);
      }
    };

    fetchStatistics();
  }, [periodStart, periodEnd]);

  // Fetch previous year comparison
  useEffect(() => {
    if (!periodStart || !periodEnd) return;

    const fetchPreviousYear = async () => {
      try {
        const token = tokenRef.current;
        if (!token) return;

        const response = await fetch(
          `/api/dashboard/previous-year?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          setPreviousYear(data);
        }
      } catch (error) {
        console.error("Error fetching previous year:", error);
      }
    };

    fetchPreviousYear();
  }, [periodStart, periodEnd]);

  // Fetch chart data (skip for finance role)
  useEffect(() => {
    if (!periodStart || !periodEnd || isFinance) return;

    const fetchChart = async () => {
      try {
        const token = tokenRef.current;
        if (!token) return;

        const response = await fetch(
          `/api/dashboard/chart?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const json = await response.json();
          setChartData(json.data || []);
        }
      } catch (error) {
        console.error("Error fetching chart:", error);
      }
    };

    fetchChart();
  }, [periodStart, periodEnd, isFinance]);

  // Fetch real tourist locations (skip for finance role)
  useEffect(() => {
    if (isFinance) return;

    const fetchLocations = async () => {
      try {
        const token = tokenRef.current;
        if (!token) return;

        const response = await fetch('/api/dashboard/map', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.locations) {
            setTouristLocations(data.locations);
          }
        }
      } catch (error) {
        console.error("Error fetching tourist locations on map:", error);
      }
    };

    fetchLocations();
  }, [isFinance]);

  // Fetch calendar events (skip for finance role)
  useEffect(() => {
    if (isFinance) return;

    const fetchCalendar = async () => {
      try {
        const token = tokenRef.current;
        if (!token) return;

        const response = await fetch("/api/dashboard/calendar", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const json = await response.json();
          setCalendarEvents(json.events || []);
        }
      } catch (error) {
        console.error("Error fetching calendar:", error);
      }
    };

    fetchCalendar();
  }, [isFinance]);

  // Fetch agent targets for supervisor/admin (skip for finance)
  useEffect(() => {
    if (!showAgentBreakdown || !periodStart || !periodEnd || isFinance) return;
    const fetchAgentTargets = async () => {
      try {
        const token = tokenRef.current;
        if (!token) return;
        const res = await fetch(
          `/api/dashboard/agent-targets?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const json = await res.json();
          setAgentTargets(json.agents || []);
        }
      } catch (err) {
        console.error("Error fetching agent targets:", err);
      }
    };
    fetchAgentTargets();
  }, [showAgentBreakdown, periodStart, periodEnd]);

  // Helper to calculate dates for a card period
  const calcCardDates = (cp: CardPeriodType): { start: string; end: string } => {
    const now = new Date();
    let s: Date;
    let e: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (cp) {
      case "currentMonth": s = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "lastMonth":
        s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        e = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last3Months": {
        const d = now.getDate(), tm = now.getMonth() - 3;
        const am = tm < 0 ? tm + 12 : tm, ay = tm < 0 ? now.getFullYear() - 1 : now.getFullYear();
        s = new Date(ay, am, Math.min(d, new Date(ay, am + 1, 0).getDate()));
        break;
      }
      case "last6Months": {
        const d = now.getDate(), tm = now.getMonth() - 6;
        const am = tm < 0 ? tm + 12 : tm, ay = tm < 0 ? now.getFullYear() - 1 : now.getFullYear();
        s = new Date(ay, am, Math.min(d, new Date(ay, am + 1, 0).getDate()));
        break;
      }
      case "lastYear": s = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
      case "allTime": s = new Date(2020, 0, 1); break;
      default: s = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const fmt = (dt: Date) => {
      const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, "0"), dy = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${dy}`;
    };
    return { start: fmt(s), end: fmt(e) };
  };

  // Fetch per-card override data when card periods change
  const cardPeriodsKey = JSON.stringify(cardPeriods);
  useEffect(() => {
    const fetchOverrides = async () => {
      const token = tokenRef.current;
      if (!token) return;

      const cards: CardKey[] = ["orders", "bookings", "revenue", "overdue"];
      const newData: typeof cardOverrideData = { orders: null, bookings: null, revenue: null, overdue: null };

      for (const card of cards) {
        const cp = cardPeriods[card];
        if (cp === "inherit") continue;

        const { start, end } = calcCardDates(cp);
        try {
          const [statsRes, prevRes] = await Promise.all([
            fetch(`/api/dashboard/statistics?periodStart=${start}&periodEnd=${end}`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`/api/dashboard/previous-year?periodStart=${start}&periodEnd=${end}`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
          ]);
          newData[card] = {
            stats: statsRes.ok ? await statsRes.json() : null,
            prevYear: prevRes.ok ? await prevRes.json() : null,
          };
        } catch (err) {
          console.error(`Error fetching ${card} override:`, err);
        }
      }
      setCardOverrideData(newData);
    };
    fetchOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPeriodsKey]);

  const getStats = (card: CardKey): DashboardStatistics | null => {
    if (cardPeriods[card] !== "inherit" && cardOverrideData[card]?.stats) return cardOverrideData[card]!.stats;
    return statistics;
  };
  const getPrev = (card: CardKey): PreviousYearComparison | null => {
    if (cardPeriods[card] !== "inherit" && cardOverrideData[card]) return cardOverrideData[card]!.prevYear;
    return previousYear;
  };
  const getCardEffectiveDates = (card: CardKey): { start: string; end: string } => {
    if (cardPeriods[card] === "inherit") return { start: periodStart, end: periodEnd };
    return calcCardDates(cardPeriods[card]);
  };

  useEffect(() => {
    const checkUser = async () => {
      const [{ data }, { data: { session } }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setEmail(data.user.email || null);
      const token = session?.access_token || null;
      tokenRef.current = token;

      if (token) {
        try {
          const res = await fetch("/api/profile", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const profileData = await res.json();
            setUsername(profileData?.first_name || null);
          }
        } catch { /* fallback to email */ }
      }

      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handlePeriodChange = (
    newPeriod: PeriodType,
    startDate?: string,
    endDate?: string
  ) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setPeriodStart(startDate);
      setPeriodEnd(endDate);
    }
  };

  const calculateChangePercent = (
    current: number,
    previous: number
  ): number => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  if (loading) {
    return (
      <div className="booking-modern-container">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="booking-modern-header relative !mb-0">
            <div className="flex items-center justify-between w-full">
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-56 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-modern-container">
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Header with Period Selector */}
        <div className="booking-modern-header relative !mb-0 !overflow-visible">
          <div className="flex items-center justify-between w-full">
            <h1 className="booking-header-title">Hello, {username || email?.split('@')[0] || 'User'}!</h1>
            <div className="relative z-40">
              <PeriodSelector
                value={period}
                onChange={handlePeriodChange}
                startDate={periodStart}
                endDate={periodEnd}
              />
            </div>
          </div>
        </div>

        {/* Finance-specific Dashboard */}
        {isFinance ? (
          <FinanceDashboard
            periodStart={periodStart}
            periodEnd={periodEnd}
            statistics={statistics ? { revenue: statistics.revenue, overdueAmount: statistics.overdueAmount } : null}
            previousYear={previousYear ? { revenue: previousYear.revenue } : null}
            calcCardDates={calcCardDates}
            calculateChangePercent={calculateChangePercent}
          />
        ) : (
          <>
            {/* Row 1: Statistic Cards & Target */}
            <div className={`grid gap-4 grid-cols-2 md:grid-cols-3 ${isSubagent ? "lg:grid-cols-6" : showTargets ? "lg:grid-cols-5" : "lg:grid-cols-4"} relative z-0`}>
              <StatisticCard
                title="Orders"
                value={getStats("orders")?.ordersCount || 0}
                previousValue={getPrev("orders")?.ordersCount}
                changePercent={
                  getPrev("orders")
                    ? calculateChangePercent(
                      getStats("orders")?.ordersCount || 0,
                      getPrev("orders")!.ordersCount
                    )
                    : undefined
                }
                cardPeriod={cardPeriods.orders}
                onCardPeriodChange={(p) => setCardPeriods(prev => ({ ...prev, orders: p }))}
                onClick={() => {
                  const d = getCardEffectiveDates("orders");
                  router.push(`/orders?createdFrom=${d.start}&createdTo=${d.end}`);
                }}
              />
              <StatisticCard
                title="Active Bookings"
                value={getStats("bookings")?.activeBookings || 0}
                previousValue={getPrev("bookings")?.activeBookings}
                changePercent={
                  getPrev("bookings")
                    ? calculateChangePercent(
                      getStats("bookings")?.activeBookings || 0,
                      getPrev("bookings")!.activeBookings
                    )
                    : undefined
                }
                cardPeriod={cardPeriods.bookings}
                onCardPeriodChange={(p) => setCardPeriods(prev => ({ ...prev, bookings: p }))}
                onClick={() => router.push("/orders?status=Active")}
              />
              <StatisticCard
                title="Revenue"
                value={`€${(getStats("revenue")?.revenue || 0).toLocaleString()}`}
                previousValue={`€${(getPrev("revenue")?.revenue || 0).toLocaleString()}`}
                changePercent={
                  getPrev("revenue")
                    ? calculateChangePercent(
                      getStats("revenue")?.revenue || 0,
                      getPrev("revenue")!.revenue
                    )
                    : undefined
                }
                cardPeriod={cardPeriods.revenue}
                onCardPeriodChange={(p) => setCardPeriods(prev => ({ ...prev, revenue: p }))}
                onClick={() => {
                  const d = getCardEffectiveDates("revenue");
                  router.push(`/orders?createdFrom=${d.start}&createdTo=${d.end}`);
                }}
              />
              <StatisticCard
                title="Overdue Payments"
                value={`€${(getStats("overdue")?.overdueAmount || 0).toLocaleString()}`}
                valueClassName="text-red-600"
                cardPeriod={cardPeriods.overdue}
                onCardPeriodChange={(p) => setCardPeriods(prev => ({ ...prev, overdue: p }))}
                onClick={!isSubagent ? () => router.push("/finances/invoices?status=overdue") : undefined}
              />
              {isSubagent && (
                <StatisticCard
                  title="Commission"
                  value={`€${(statistics?.totalCommission || 0).toLocaleString()}`}
                />
              )}
              {showTargets && !isFinance && (() => {
                const monthlyTarget = statistics?.targetProfitMonthly || 0;
                if (period === "currentMonth" || period === "lastMonth") {
                  return (
                    <TargetSpeedometer
                      current={statistics?.profit || 0}
                      target={monthlyTarget}
                      label="Target"
                      vat={statistics?.vat || 0}
                      agents={showAgentBreakdown ? agentTargets : undefined}
                      showAgentSelector={showAgentBreakdown}
                    />
                  );
                }
                const days = periodStart && periodEnd
                  ? Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000) + 1)
                  : 30;
                const months = days / 30.44;
                const scaledTarget = Math.round(monthlyTarget * months * 100) / 100;
                return (
                  <TargetSpeedometer
                    current={statistics?.profit || 0}
                    target={scaledTarget}
                    label="Target"
                    vat={statistics?.vat || 0}
                    agents={showAgentBreakdown ? agentTargets : undefined}
                    showAgentSelector={showAgentBreakdown}
                  />
                );
              })()}
            </div>

            {/* Row 2: Map and Calendar */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TouristsMap locations={touristLocations} />
              </div>
              <div>
                <CalendarWithDots events={calendarEvents} />
              </div>
            </div>

            {/* Row 3: Chart */}
            <div className="grid gap-4">
              <ProfitOrdersChart data={chartData} />
            </div>

            {/* Recently Completed Row */}
            <RecentlyCompletedList travelers={touristLocations} />
          </>
        )}

        {/* AI Window */}
        <div className="flex justify-end">
          <AIWindowPlaceholder />
        </div>
      </div>
    </div>
  );
}
