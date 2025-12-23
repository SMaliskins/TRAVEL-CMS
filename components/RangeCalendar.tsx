"use client";

import { useState, useMemo, useRef, useEffect } from "react";

interface RangeCalendarProps {
  startDate: string | undefined; // YYYY-MM-DD
  endDate: string | undefined; // YYYY-MM-DD
  onDateSelect: (date: string) => void; // YYYY-MM-DD
  onClear: () => void;
  autoCloseOnRangeComplete?: boolean; // Close calendar when range is complete
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
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

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function RangeCalendar({
  startDate,
  endDate,
  onDateSelect,
  onClear,
  autoCloseOnRangeComplete = false,
}: RangeCalendarProps) {
  // Initialize to show two months starting from start date or today
  const getInitialMonth = () => {
    if (startDate) {
      const date = new Date(startDate + "T00:00:00");
      return { year: date.getFullYear(), month: date.getMonth() };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  };

  const [leftMonth, setLeftMonth] = useState(getInitialMonth());
  const [showMonthPicker, setShowMonthPicker] = useState<"left" | "right" | null>(null);
  const [monthPickerYear, setMonthPickerYear] = useState(leftMonth.year);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  // Parse dates
  const start = startDate ? (() => {
    const d = new Date(startDate + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return d;
  })() : null;
  const end = endDate ? (() => {
    const d = new Date(endDate + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return d;
  })() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Right month is always left month + 1
  const rightMonth = useMemo(() => {
    if (leftMonth.month === 11) {
      return { year: leftMonth.year + 1, month: 0 };
    }
    return { year: leftMonth.year, month: leftMonth.month + 1 };
  }, [leftMonth]);

  // Generate calendar days for a month
  const getDaysForMonth = (year: number, month: number): (Date | null)[] => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const startingDayIndex = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

    const daysArray: (Date | null)[] = [];
    for (let i = 0; i < startingDayIndex; i++) {
      daysArray.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      daysArray.push(new Date(year, month, day));
    }
    return daysArray;
  };

  const leftDays = useMemo(() => getDaysForMonth(leftMonth.year, leftMonth.month), [leftMonth]);
  const rightDays = useMemo(() => getDaysForMonth(rightMonth.year, rightMonth.month), [rightMonth]);

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isDateInRange = (date: Date): boolean => {
    if (!start || !end) return false;
    const dateTime = date.getTime();
    const startTime = start.getTime();
    const endTime = end.getTime();
    const minTime = Math.min(startTime, endTime);
    const maxTime = Math.max(startTime, endTime);
    return dateTime >= minTime && dateTime <= maxTime;
  };

  const isDateStart = (date: Date): boolean => {
    if (!start) return false;
    return date.getTime() === start.getTime();
  };

  const isDateEnd = (date: Date): boolean => {
    if (!end) return false;
    return date.getTime() === end.getTime();
  };

  const isToday = (date: Date): boolean => {
    return date.getTime() === today.getTime();
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDateToISO(date);
    onDateSelect(dateStr);
    
    // Auto-close if range is complete and autoCloseOnRangeComplete is true
    if (autoCloseOnRangeComplete && startDate && dateStr !== startDate) {
      // Range should be complete after this selection
      setTimeout(() => {
        // Trigger close via parent component if needed
      }, 100);
    }
  };

  const goToPreviousMonth = () => {
    setLeftMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setLeftMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleMonthHeaderClick = (side: "left" | "right") => {
    setShowMonthPicker(side);
    const monthToUse = side === "left" ? leftMonth : rightMonth;
    setMonthPickerYear(monthToUse.year);
  };

  const handleMonthYearSelect = (year: number, month: number) => {
    setLeftMonth({ year, month });
    setShowMonthPicker(null);
  };

  // Close month picker on click outside
  useEffect(() => {
    if (!showMonthPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMonthPicker]);

  const renderMonth = (days: (Date | null)[], month: { year: number; month: number }, side: "left" | "right") => (
    <div className="w-full">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleMonthHeaderClick(side)}
          className="text-sm font-semibold text-gray-900 hover:text-gray-700"
        >
          {MONTH_NAMES[month.month]} {month.year}
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${side}-${index}`} className="h-8" />;
          }

          const dateStr = formatDateToISO(date);
          const inRange = isDateInRange(date);
          const isStart = isDateStart(date);
          const isEnd = isDateEnd(date);
          const isTodayDate = isToday(date);
          const isRangeEndpoint = isStart || isEnd;

          return (
            <button
              key={`${side}-${dateStr}`}
              type="button"
              onClick={() => handleDateClick(date)}
              className={`
                h-8 rounded text-sm transition-colors
                ${isTodayDate && !isRangeEndpoint ? "font-semibold ring-1 ring-blue-500" : ""}
                ${inRange && !isRangeEndpoint ? "bg-blue-100 text-blue-900" : ""}
                ${!inRange && !isRangeEndpoint ? "text-gray-700 hover:bg-gray-100" : ""}
                ${isRangeEndpoint ? "bg-blue-600 text-white font-semibold hover:bg-blue-700" : ""}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      {/* Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goToNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Two months side by side */}
      <div className="grid grid-cols-2 gap-4">
        {renderMonth(leftDays, leftMonth, "left")}
        {renderMonth(rightDays, rightMonth, "right")}
      </div>

      {/* Month/Year picker popover */}
      {showMonthPicker && (
        <div
          ref={monthPickerRef}
          className="absolute left-1/2 top-1/2 z-50 w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Year navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthPickerYear((y) => y - 1)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">{monthPickerYear}</span>
            <button
              type="button"
              onClick={() => setMonthPickerYear((y) => y + 1)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTH_NAMES_SHORT.map((monthName, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleMonthYearSelect(monthPickerYear, index)}
                className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                  showMonthPicker === "left" && leftMonth.year === monthPickerYear && leftMonth.month === index
                    ? "bg-blue-600 text-white"
                    : showMonthPicker === "right" && rightMonth.year === monthPickerYear && rightMonth.month === index
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {monthName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear button */}
      {(start || end) && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-600 hover:text-gray-900 underline"
          >
            Clear range
          </button>
        </div>
      )}
    </div>
  );
}
