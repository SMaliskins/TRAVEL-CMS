"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

/** Parse dd.mm.yyyy or d.m.yyyy to YYYY-MM-DD */
function parseDDMMYYYY(s: string): string | null {
  const t = s.trim().replace(/\//g, ".");
  const parts = t.split(".");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map((p) => p.trim());
  if (y.length !== 4 || !/^\d+$/.test(d) || !/^\d+$/.test(m) || !/^\d+$/.test(y)) return null;
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  const yy = y;
  const iso = `${yy}-${mm}-${dd}`;
  const date = new Date(iso + "T00:00:00");
  if (isNaN(date.getTime())) return null;
  return iso;
}

export type ShortcutPreset = "today" | "tomorrow" | "dayAfter";

interface SingleDatePickerProps {
  label?: string;
  value: string | undefined; // YYYY-MM-DD
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  error?: string;
  parsed?: boolean; // highlight as AI-parsed (green border)
  /** Show Today, Tomorrow, Day after tomorrow in calendar footer (dashboard-style) */
  shortcutPresets?: ShortcutPreset[];
  /** Reference date for "1 month + 2 days before" / "2 weeks + 2 days before" (e.g. earliest service date); results are adjusted to previous working day if weekend */
  relativeToDate?: string; // YYYY-MM-DD
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
  parsed = false,
  shortcutPresets,
  relativeToDate,
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

  const setPresetAndClose = (dateStr: string) => {
    onChange(dateStr);
    const d = new Date(dateStr + "T00:00:00");
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    setIsOpen(false);
  };

  // Shortcut presets: Today, Tomorrow, Day after tomorrow
  const shortcutOptions = useMemo(() => {
    if (!shortcutPresets?.length) return null;
    const base = new Date(today);
    const opts: { label: string; value: string }[] = [];
    if (shortcutPresets.includes("today")) {
      opts.push({ label: "Today", value: formatDateToISO(base) });
    }
    if (shortcutPresets.includes("tomorrow")) {
      const t = new Date(base);
      t.setDate(t.getDate() + 1);
      opts.push({ label: "Tomorrow", value: formatDateToISO(t) });
    }
    if (shortcutPresets.includes("dayAfter")) {
      const t = new Date(base);
      t.setDate(t.getDate() + 2);
      opts.push({ label: "Day after tomorrow", value: formatDateToISO(t) });
    }
    return opts;
  }, [shortcutPresets, today]);

  // Move date to previous working day if it falls on Saturday or Sunday
  const toPreviousWorkingDay = (d: Date): Date => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    let day = out.getDay();
    while (day === 0 || day === 6) {
      out.setDate(out.getDate() - 1);
      day = out.getDay();
    }
    return out;
  };

  // Relative presets: 1 month + 2 days before, 2 weeks + 2 days before (relative to relativeToDate), adjusted to working days
  const relativeOptions = useMemo(() => {
    if (!relativeToDate) return null;
    const ref = new Date(relativeToDate + "T00:00:00");
    ref.setHours(0, 0, 0, 0);
    const oneMonthPlusTwo = new Date(ref);
    oneMonthPlusTwo.setMonth(oneMonthPlusTwo.getMonth() - 1);
    oneMonthPlusTwo.setDate(oneMonthPlusTwo.getDate() - 2);
    const twoWeeksPlusTwo = new Date(ref);
    twoWeeksPlusTwo.setDate(twoWeeksPlusTwo.getDate() - 14 - 2);
    return [
      { label: "1 month + 2 days before", value: formatDateToISO(toPreviousWorkingDay(oneMonthPlusTwo)) },
      { label: "2 weeks + 2 days before", value: formatDateToISO(toPreviousWorkingDay(twoWeeksPlusTwo)) },
    ];
  }, [relativeToDate]);

  const displayValue = (value ? formatDateDDMMYYYY(value) : placeholder).replace(/\//g, ".");
  const [inputText, setInputText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setInputText(displayValue);
  }, [displayValue, isEditing]);

  const handleInputFocus = () => {
    setIsEditing(true);
    setInputText(displayValue);
  };
  const handleInputBlur = () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      onChange(undefined);
      setIsEditing(false);
      return;
    }
    const iso = parseDDMMYYYY(trimmed);
    if (iso) {
      onChange(iso);
      const d = new Date(iso + "T00:00:00");
      setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
    setIsEditing(false);
  };
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      
      <div
        className={`rounded border px-3 py-2 text-sm flex items-center gap-2 ${
          parsed
            ? "border-green-500 ring-1 ring-green-500"
            : error
              ? "border-red-300"
              : "border-gray-300"
        } ${!value && !isEditing ? "text-gray-400" : "text-gray-900"}`}
      >
        <input
          type="text"
          value={isEditing ? inputText : displayValue}
          onChange={(e) => {
            setIsEditing(true);
            setInputText(e.target.value);
          }}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent border-none p-0 text-sm focus:outline-none focus:ring-0"
          aria-label={label || "Date"}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="shrink-0 p-0.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
          aria-label="Open calendar"
        >
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

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

          {/* Presets row (dashboard-style): Today, Tomorrow, Day after, 1 month before, 2 weeks before */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-gray-200 pt-3">
            {shortcutOptions?.length ? (
              shortcutOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPresetAndClose(opt.value)}
                  className={`text-xs transition-colors ${
                    value === opt.value ? "font-semibold text-blue-700" : "text-blue-600 hover:text-blue-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => setPresetAndClose(formatDateToISO(today))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Today
              </button>
            )}
            {relativeOptions?.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setPresetAndClose(opt.value)}
                className={`text-xs transition-colors ${
                  value === opt.value ? "font-semibold text-blue-700" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="ml-auto text-xs text-gray-600 hover:text-gray-900"
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
