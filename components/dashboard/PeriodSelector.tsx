"use client";

import React, { useState, useRef, useEffect } from "react";
import DateRangePicker from "@/components/DateRangePicker";

export type PeriodType = "thisMonth" | "lastMonth" | "last3Months" | "last6Months" | "custom";

interface PeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType, startDate?: string, endDate?: string) => void;
  className?: string;
  startDate?: string;  // Add: actual period start from parent
  endDate?: string;    // Add: actual period end from parent
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePeriodChange = (period: PeriodType) => {
    if (period === "custom") {
      // Custom period will be handled separately
      setIsOpen(false);
      return;
    }

    // Calculate dates for predefined periods
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last3Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case "last6Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
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
  };

  const handleCustomDatesChange = (from: string | undefined, to: string | undefined) => {
    setCustomStart(from);
    setCustomEnd(to);
    if (from && to) {
      onChange("custom", from, to);
    }
  };

  const getPeriodLabel = (period: PeriodType): string => {
    switch (period) {
      case "thisMonth":
        return "This Month";
      case "lastMonth":
        return "Last Month";
      case "last3Months":
        return "Last 3 Months";
      case "last6Months":
        return "Last 6 Months";
      case "custom":
        return "Custom";
      default:
        return "This Month";
    }
  };

  // Format display date as "1 Dec - 30 Dec"
  const getDisplayDates = (): string => {
    // Use parent dates if provided
    if (parentStartDate && parentEndDate) {
      const formatDisplay = (dateStr: string): string => {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString("en-US", { month: "short" });
        return `${day} ${month}`;
      };
      return `${formatDisplay(parentStartDate)} - ${formatDisplay(parentEndDate)}`;
    }

    // Fallback to local calculation
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (value) {
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last3Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case "last6Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
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
      return `${day} ${month}`;
    };

    return `${formatDisplay(startDate)} - ${formatDisplay(endDate)}`;
  };

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

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-[999]">
          <div className="py-1">
            {(["thisMonth", "lastMonth", "last3Months", "last6Months", "custom"] as PeriodType[]).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${
                  value === period ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}
              >
                <span>{getPeriodLabel(period)}</span>
                {value === period && (
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
            
            {/* Custom Date Range Picker inside dropdown */}
            {value === "custom" && (
              <div className="border-t border-gray-200 p-3">
                <DateRangePicker
                  label="Select custom range"
                  from={customStart}
                  to={customEnd}
                  onChange={handleCustomDatesChange}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
