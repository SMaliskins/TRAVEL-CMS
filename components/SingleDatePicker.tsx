"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface SingleDatePickerProps {
  label?: string;
  value: string | undefined; // YYYY-MM-DD
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  error?: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function SingleDatePicker({
  label,
  value,
  onChange,
  placeholder = "Select date",
  error,
}: SingleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const date = new Date(value + "T00:00:00");
      return { year: date.getFullYear(), month: date.getMonth() };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Parse selected date
  const selectedDate = value ? (() => {
    const d = new Date(value + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return d;
  })() : null;

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        calendarRef.current &&
        !calendarRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [isOpen]);

  // Generate calendar days
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

  const days = useMemo(
    () => getDaysForMonth(currentMonth.year, currentMonth.month),
    [currentMonth]
  );

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateClick = (date: Date) => {
    onChange(formatDateToISO(date));
    setIsOpen(false);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleClear = () => {
    onChange(undefined);
    setIsOpen(false);
  };

  const displayValue = value ? formatDateDDMMYYYY(value) : placeholder;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded border px-3 py-2 text-left text-sm flex items-center justify-between focus:outline-none focus:ring-1 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-black focus:ring-black"
        } ${!value ? "text-gray-400" : "text-gray-900"}`}
      >
        <span>{displayValue}</span>
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {isOpen && (
        <div
          ref={calendarRef}
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
            </span>
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

          {/* Weekday headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-8" />;
              }

              const dateStr = formatDateToISO(date);
              const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
              const isToday = date.getTime() === today.getTime();

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  className={`
                    h-8 rounded text-sm transition-colors
                    ${isToday && !isSelected ? "font-semibold ring-1 ring-blue-500" : ""}
                    ${isSelected ? "bg-blue-600 text-white font-semibold hover:bg-blue-700" : "text-gray-700 hover:bg-gray-100"}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Clear/Today buttons */}
          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => {
                const todayStr = formatDateToISO(today);
                onChange(todayStr);
                setCurrentMonth({ year: today.getFullYear(), month: today.getMonth() });
                setIsOpen(false);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
