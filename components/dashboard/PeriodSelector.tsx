"use client";

import React, { useState, useRef, useEffect } from "react";
import RangeCalendar from "@/components/RangeCalendar";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";

export type PeriodType = "currentMonth" | "lastMonth" | "lastMonthRolling" | "last3Months" | "last6Months" | "lastYear" | "allTime" | "custom";

interface PeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType, startDate?: string, endDate?: string) => void;
  className?: string;
  startDate?: string;
  endDate?: string;
  dropdownAlign?: "left" | "right";
  /** When true, calendar opens showing previous + current month (e.g. for invoices where future is not selectable) */
  calendarFocusPast?: boolean;
}

const LOCALE_BY_LANG: Record<string, string> = { en: "en-US", ru: "ru-RU", lv: "lv-LV" };

export default function PeriodSelector({
  value,
  onChange,
  className = "",
  startDate: parentStartDate,
  endDate: parentEndDate,
  dropdownAlign = "right",
  calendarFocusPast = false,
}: PeriodSelectorProps) {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const locale = LOCALE_BY_LANG[lang] || "en-US";

  const [customStart, setCustomStart] = useState<string | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<string | undefined>(undefined);
  const [tempStart, setTempStart] = useState<string | undefined>(undefined);
  const [tempEnd, setTempEnd] = useState<string | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [alignOpen, setAlignOpen] = useState<"left" | "right">(dropdownAlign);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const DROPDOWN_WIDTH = 872; // 192 (left panel) + 680 (calendar)
  const PADDING = 8;

  // When opening, choose left/right align so dropdown stays in viewport
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceOnRight = window.innerWidth - rect.left - PADDING;
    const spaceOnLeft = rect.right + PADDING;
    setAlignOpen(spaceOnRight >= DROPDOWN_WIDTH ? "left" : "right");
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize temp dates when calendar opens
  useEffect(() => {
    if (showCalendar) {
      setTempStart(customStart);
      setTempEnd(customEnd);
    }
  }, [showCalendar, customStart, customEnd]);

  // Recalculate rolling periods on mount to keep dates current
  useEffect(() => {
    if (value !== "custom") {
      handlePeriodChange(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (period: PeriodType) => {
    if (period === "custom") {
      setShowCalendar(true);
      return;
    }

    // Calculate dates for predefined periods
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "currentMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "lastMonthRolling": {
        const day = now.getDate();
        const targetMonth = now.getMonth() - 1;
        const targetYear = now.getFullYear();
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? targetYear - 1 : targetYear;
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        startDate = new Date(actualYear, actualMonth, safeDay);
        endDate = new Date(now);
        break;
      }
      case "last3Months": {
        const day = now.getDate() === 1 ? 1 : now.getDate();
        const targetMonth = now.getMonth() - 3;
        const targetYear = now.getFullYear();
        // Handle month overflow
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? targetYear - 1 : targetYear;
        // Get last day of target month to avoid invalid dates (e.g., Jan 31 -> Nov 31)
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        startDate = new Date(actualYear, actualMonth, safeDay);
        break;
      }
      case "last6Months": {
        const day = now.getDate() === 1 ? 1 : now.getDate();
        const targetMonth = now.getMonth() - 6;
        const targetYear = now.getFullYear();
        // Handle month overflow
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? targetYear - 1 : targetYear;
        // Get last day of target month to avoid invalid dates (e.g., Jan 31 -> Jul 31)
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        startDate = new Date(actualYear, actualMonth, safeDay);
        break;
      }
      case "lastYear":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "allTime":
        startDate = new Date(2020, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    onChange(period, formatDate(startDate), formatDate(endDate));
    setIsOpen(false);
    setShowCalendar(false);
  };

  const handleDateSelect = (date: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // Start new range
      setTempStart(date);
      setTempEnd(undefined);
    } else if (tempStart && !tempEnd) {
      // Selecting end date
      const selectedDate = new Date(date + "T00:00:00");
      const startDate = new Date(tempStart + "T00:00:00");

      if (selectedDate < startDate) {
        setTempEnd(tempStart);
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
    }
  };

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      setCustomStart(tempStart);
      setCustomEnd(tempEnd);
      onChange("custom", tempStart, tempEnd);
      setIsOpen(false);
      setShowCalendar(false);
    }
  };

  const handleCancelCustom = () => {
    setTempStart(customStart);
    setTempEnd(customEnd);
    setShowCalendar(false);
  };

  const getPeriodLabel = (period: PeriodType): string => {
    const key = period === "lastMonthRolling" ? "period.lastMonthRolling" : `period.${period}`;
    return t(lang, key);
  };

  const getDisplayDates = (): string => {
    if (parentStartDate && parentEndDate) {
      const formatDisplay = (dateStr: string): string => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString(locale, { month: "short" });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
      };
      return `${formatDisplay(parentStartDate)} – ${formatDisplay(parentEndDate)}`;
    }

    // Fallback to local calculation
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (value) {
      case "currentMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "lastMonthRolling": {
        const day = now.getDate();
        const targetMonth = now.getMonth() - 1;
        const targetYear = now.getFullYear();
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? targetYear - 1 : targetYear;
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        startDate = new Date(actualYear, actualMonth, safeDay);
        endDate = new Date(now);
        break;
      }
      case "last3Months": {
        const day = now.getDate() === 1 ? 1 : now.getDate();
        const targetMonth = now.getMonth() - 3;
        const targetYear = now.getFullYear();
        // Handle month overflow
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? targetYear - 1 : targetYear;
        // Get last day of target month to avoid invalid dates (e.g., Jan 31 -> Nov 31)
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        startDate = new Date(actualYear, actualMonth, safeDay);
        break;
      }
      case "last6Months": {
        const day = now.getDate() === 1 ? 1 : now.getDate();
        const targetMonth = now.getMonth() - 6;
        const targetYear = now.getFullYear();
        // Handle month overflow
        const actualMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
        const actualYear = targetMonth < 0 ? targetYear - 1 : targetYear;
        // Get last day of target month to avoid invalid dates (e.g., Jan 31 -> Jul 31)
        const lastDayOfMonth = new Date(actualYear, actualMonth + 1, 0).getDate();
        const safeDay = Math.min(day, lastDayOfMonth);
        startDate = new Date(actualYear, actualMonth, safeDay);
        break;
      }
      case "lastYear":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "custom":
        if (customStart && customEnd) {
          startDate = new Date(customStart);
          endDate = new Date(customEnd);
        } else {
          return t(lang, "period.selectDates");
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const formatDisplay = (date: Date): string => {
      const day = date.getDate();
      const month = date.toLocaleString(locale, { month: "short" });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    return `${formatDisplay(startDate)} – ${formatDisplay(endDate)}`;
  };

  const periods: PeriodType[] = ["currentMonth", "lastMonth", "lastMonthRolling", "last3Months", "last6Months", "lastYear", "allTime", "custom"];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button - Shopify Style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 booking-glass-panel !py-2 !px-4 !rounded-lg text-sm font-medium text-gray-700 hover:scale-[1.02] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-gray-900">{t(lang, "period.showing")}:</span>
        <span className="font-semibold text-gray-900">{getDisplayDates()}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu - Shopify Style with Calendar */}
      {isOpen && (
        <div className={`fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto ${alignOpen === "left" ? "sm:left-0" : "sm:right-0"} sm:top-auto sm:mt-2 rounded-xl border border-gray-200/50 bg-white/95 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-[9999] max-h-[80vh] overflow-y-auto`}>
          <div className="flex flex-col sm:flex-row">
            {/* Left Panel - Period Options */}
            <div className="sm:w-48 border-b sm:border-b-0 sm:border-r border-gray-200 py-2">
              {periods.map((period) => {
                const isSelected = value === period || (period === "custom" && showCalendar);
                return (
                <button
                  key={period}
                  onClick={() => handlePeriodChange(period)}
                  className={`w-full px-4 py-3 sm:py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${isSelected ? "bg-blue-50 text-blue-800" : "text-gray-700"
                    }`}
                >
                  <span>{getPeriodLabel(period)}</span>
                  {isSelected && !showCalendar && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-blue-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {period === "custom" && showCalendar && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-blue-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              );
              })}
            </div>

            {/* Right Panel - Calendar (visible when Custom is selected) */}
            {showCalendar && (
              <div className="p-4 w-full sm:min-w-[680px]">
                <RangeCalendar
                  startDate={tempStart}
                  endDate={tempEnd}
                  onDateSelect={handleDateSelect}
                  onClear={() => {
                    setTempStart(undefined);
                    setTempEnd(undefined);
                  }}
                  autoCloseOnRangeComplete={false}
                  maxDate={new Date().toISOString().split('T')[0]}
                  startFromPreviousMonth={calendarFocusPast}
                />
                <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelCustom}
                    className="rounded-lg border-2 border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                  >
                    {t(lang, "common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    disabled={!tempStart || !tempEnd}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
                  >
                    {t(lang, "common.apply")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
