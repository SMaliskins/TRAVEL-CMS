"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import StatisticCard from "@/components/dashboard/StatisticCard";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import ProfitOrdersChart from "@/components/dashboard/ProfitOrdersChart";
import TargetSpeedometer from "@/components/dashboard/TargetSpeedometer";
import TouristsMap from "@/components/dashboard/TouristsMap";
import RecentlyCompletedList from "@/components/dashboard/RecentlyCompletedList";
import CalendarWithDots from "@/components/dashboard/CalendarWithDots";
import AIWindowPlaceholder from "@/components/dashboard/AIWindowPlaceholder";

interface DashboardStatistics {
  ordersCount: number;
  activeBookings: number;
  revenue: number;
  profit: number;
  overdueAmount: number;
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
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Period state
  const [period, setPeriod] = useState<PeriodType>("thisMonth");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");

  // Data states
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [previousYear, setPreviousYear] = useState<PreviousYearComparison | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [targetCurrent, setTargetCurrent] = useState(8900);
  const [targetGoal, setTargetGoal] = useState(36000);
  const [touristLocations, setTouristLocations] = useState<TouristLocation[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Calculate period dates
  useEffect(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "thisMonth":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last3Months":
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case "last6Months":
        start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(
          `/api/dashboard/statistics?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
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

  // Fetch previous year comparison (mock for now)
  useEffect(() => {
    // TODO: Implement API endpoint for previous year comparison
    setPreviousYear({
      ordersCount: 45,
      activeBookings: 12,
      revenue: 22000,
    });
  }, [periodStart, periodEnd]);

  // Mock chart data for current month (all days of month)
  useEffect(() => {
    // TODO: Replace with actual API call
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const mockData: ChartDataPoint[] = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      // Generate more realistic data with fluctuations
      const baseProfit = 15000 + Math.sin(i / 5) * 10000 + Math.random() * 5000;
      const baseOrders = 15 + Math.cos(i / 3) * 10 + Math.random() * 8;
      mockData.push({
        date: dateStr,
        profit: Math.max(0, Math.floor(baseProfit)),
        orders: Math.max(0, Math.floor(baseOrders)),
      });
    }

    setChartData(mockData);
  }, []);

  // Mock tourist locations
  useEffect(() => {
    // TODO: Replace with actual API call
    setTouristLocations([
      {
        id: "1",
        name: "John Doe",
        location: [48.8566, 2.3522], // Paris
        orderCode: "ORD-001",
        status: "in-progress",
      },
      {
        id: "2",
        name: "Jane Smith",
        location: [40.7128, -74.006], // New York
        orderCode: "ORD-002",
        status: "in-progress",
      },
    ]);
  }, []);

  // Mock calendar events
  useEffect(() => {
    // TODO: Replace with actual API call
    const today = new Date();
    setCalendarEvents([
      {
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate() + 2).padStart(2, "0")}`,
        status: "upcoming",
        orderCode: "ORD-003",
        count: 1,
      },
      {
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate() + 5).padStart(2, "0")}`,
        status: "in-progress",
        orderCode: "ORD-004",
        count: 1,
      },
    ]);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setEmail(data.user.email || null);
      
      // Fetch username from profile
      if (data.user.id) {
        const { data: profile } = await supabase
          .from('profile')
          .select('username')
          .eq('id', data.user.id)
          .single();
        
        setUsername(profile?.username || null);
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header with Period Selector */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Hello, {username || email?.split('@')[0] || 'User'}!</h1>          <PeriodSelector
            value={period}
            onChange={handlePeriodChange}
            startDate={periodStart}
            endDate={periodEnd}
          />
        </div>

        {/* Statistic Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatisticCard
            title="Orders"
            value={statistics?.ordersCount || 0}
            previousValue={previousYear?.ordersCount}
            changePercent={
              previousYear
                ? calculateChangePercent(
                    statistics?.ordersCount || 0,
                    previousYear.ordersCount
                  )
                : undefined
            }
          />
          <StatisticCard
            title="Active Bookings"
            value={statistics?.activeBookings || 0}
            previousValue={previousYear?.activeBookings}
            changePercent={
              previousYear
                ? calculateChangePercent(
                    statistics?.activeBookings || 0,
                    previousYear.activeBookings
                  )
                : undefined
            }
          />
          <StatisticCard
            title="Revenue"
            value={`€${(statistics?.revenue || 0).toLocaleString()}`}
            previousValue={`€${(previousYear?.revenue || 0).toLocaleString()}`}
            changePercent={
              previousYear
                ? calculateChangePercent(
                    statistics?.revenue || 0,
                    previousYear.revenue
                  )
                : undefined
            }
            onClick={() => router.push("/analytics/orders")}
          />
          <StatisticCard
            title="Overdue Payments"
            value={`€${(statistics?.overdueAmount || 0).toLocaleString()}`}
            onClick={() => router.push("/analytics/orders")}
          />
        </div>

        {/* Chart and Target Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProfitOrdersChart data={chartData} />
          </div>
          <div>
            <TargetSpeedometer
              current={targetCurrent}
              target={targetGoal}
              rating={3}
              message="Keep pushing forward!"
            />
          </div>
        </div>

        {/* Map and Calendar Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TouristsMap locations={touristLocations} />
          <CalendarWithDots events={calendarEvents} />
        </div>

        {/* Recently Completed Row */}
        <RecentlyCompletedList travelers={touristLocations} />

        {/* AI Window */}
        <div className="flex justify-end">
          <AIWindowPlaceholder />
        </div>
      </div>
    </div>
  );
}
