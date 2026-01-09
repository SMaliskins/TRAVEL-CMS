"use client";

import React, { useState, useRef, useEffect } from "react";
import RangeCalendar from "@/components/RangeCalendar";

export type PeriodType = "currentMonth" | "lastMonth" | "last3Months" | "last6Months" | "lastYear" | "custom";

interface PeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType, startDate?: string, endDate?: string) => void;
  className?: string;
  startDate?: string;
  endDate?: string;
}

export default function PeriodSelector({
  value,
  onChange,
  className = "",
  startDate: parentStartDate,
  endDate: parentEndDate,
}: PeriodSelectorProps) {
  const [customStart, setCustomStart] = useState<string | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<string | undefined>(undefined);
  const [tempStart, setTempStart] = useState<string | undefined>(undefined);
  const [tempEnd, setTempEnd] = useState<string | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      case "last3Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case "last6Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case "lastYear":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
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
    switch (period) {
      case "currentMonth":
        return "Current month";
      case "lastMonth":
        return "Last month";
      case "last3Months":
        return "Last 3 months";
      case "last6Months":
        return "Last 6 months";
      case "lastYear":
        return "Last year";
      case "custom":
        return "Custom";
      default:
        return "Current month";
    }
  };

  // Format display date as "1 Dec 2025 - 30 Dec 2025"
  const getDisplayDates = (): string => {
    if (parentStartDate && parentEndDate) {
      const formatDisplay = (dateStr: string): string => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString("en-US", { month: "short" });
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
      case "last3Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case "last6Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case "lastYear":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "custom":
        if (customStart && customEnd) {
          startDate = new Date(customStart);
          endDate = new Date(customEnd);
        } else {
          return "Select dates";
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const formatDisplay = (date: Date): string => {
      const day = date.getDate();
      const month = date.toLocaleString("en-US", { month: "short" });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    return `${formatDisplay(startDate)} – ${formatDisplay(endDate)}`;
  };

  const periods: PeriodType[] = ["currentMonth", "lastMonth", "last3Months", "last6Months", "lastYear", "custom"];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button - Shopify Style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
        <span className="text-gray-900">Showing:</span>
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
        <div className="absolute right-0 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg z-[999]">
          <div className="flex">
            {/* Left Panel - Period Options */}
            <div className="w-48 border-r border-gray-200 py-2">
              {periods.map((period) => (
                <button
                  key={period}
                  onClick={() => handlePeriodChange(period)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${
                    value === period ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`}
                >
                  <span>{getPeriodLabel(period)}</span>
                  {value === period && !showCalendar && (
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
              ))}
            </div>

            {/* Right Panel - Calendar (visible when Custom is selected) */}
            {showCalendar && (
              <div className="p-4" style={{ minWidth: "680px" }}>
                <RangeCalendar
                  startDate={tempStart}
                  endDate={tempEnd}
                  onDateSelect={handleDateSelect}
                  onClear={() => {
                    setTempStart(undefined);
                    setTempEnd(undefined);
                  }}
                  autoCloseOnRangeComplete={false}
                />
                <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelCustom}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    disabled={!tempStart || !tempEnd}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Apply
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
