"use client";

import { useMemo } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useClock } from "@/hooks/useClock";
import {
  monthlyProfitTarget,
  currentMonthProfit,
  getRemainingProfit,
  getAchievedPercentage,
} from "@/lib/kpi/mockKpis";

/**
 * Calculate working days left in the current month (Mon-Fri only)
 * Uses the specified timezone to determine "today" and month boundaries
 */
function calculateWorkingDaysLeft(timezone: string, now: Date): number {
  // Get today's date parts in the specified timezone
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: timezone,
  });

  const todayParts = dateFmt.formatToParts(now);
  const year = parseInt(todayParts.find((p) => p.type === "year")?.value || "0", 10);
  const month = parseInt(todayParts.find((p) => p.type === "month")?.value || "0", 10); // 1-12
  const day = parseInt(todayParts.find((p) => p.type === "day")?.value || "0", 10);

  // Find the last day of the month by testing dates
  const lastDayFmt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: timezone,
  });
  
  let lastDay = 28; // Start with minimum
  for (let testDay = 31; testDay >= 28; testDay--) {
    // Create date using local time, then format with timezone to check if it's valid
    const testDate = new Date(year, month - 1, testDay); // month is 0-indexed in Date constructor
    const formattedDay = parseInt(lastDayFmt.format(testDate), 10);
    // If the formatted day matches and is in the same month, it's valid
    const formattedMonth = parseInt(
      new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: timezone }).format(testDate),
      10
    );
    if (formattedDay === testDay && formattedMonth === month) {
      lastDay = testDay;
      break;
    }
  }

  const weekdayFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  });

  let workingDays = 0;

  // Count working days from tomorrow through month end
  for (let d = day + 1; d <= lastDay; d++) {
    const testDate = new Date(year, month - 1, d); // month is 0-indexed
    const weekday = weekdayFmt.format(testDate);
    
    // Check if it's a working day (Mon-Fri)
    if (!["Sat", "Sun"].includes(weekday)) {
      workingDays++;
    }
  }

  return workingDays;
}

export default function TopBarProgress() {
  const { prefs, isMounted: prefsMounted } = useUserPreferences();
  const now = useClock();

  const progressData = useMemo(() => {
    if (!prefsMounted || now.getTime() === 0) {
      return null;
    }

    const achievedPct = Math.round(getAchievedPercentage());
    const remainingProfit = getRemainingProfit();
    const workingDaysLeft = calculateWorkingDaysLeft(prefs.timezone, now);
    const requiredPerDay =
      workingDaysLeft > 0 ? remainingProfit / workingDaysLeft : 0;

    // Format currency using user's preferred currency
    const currencyFormatter = new Intl.NumberFormat(prefs.language || "en", {
      style: "currency",
      currency: prefs.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    return {
      target: currencyFormatter.format(monthlyProfitTarget),
      achievedPct,
      workingDaysLeft,
      requiredPerDay: currencyFormatter.format(requiredPerDay),
      remainingProfit,
      progressWidth: Math.min(100, Math.max(0, achievedPct)),
    };
  }, [prefs, prefsMounted, now]);

  if (!progressData) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-gray-400">--</span>
        <div className="h-1 w-32 rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Progress text */}
      <span className="whitespace-nowrap text-xs text-gray-600">
        Target: {progressData.target} · {progressData.achievedPct}% ·{" "}
        {progressData.workingDaysLeft} wd left · {progressData.requiredPerDay}
        /day
      </span>
      
      {/* Progress bar */}
      <div className="h-1.5 w-80 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progressData.progressWidth}%` }}
        />
      </div>
    </div>
  );
}

