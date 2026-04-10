"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import RangeCalendar from "./RangeCalendar";
import { formatDateRange } from "@/utils/dateFormat";

interface DateRangePickerProps {
  label: string;
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
  /** Optional class for the trigger button (e.g. parsed highlight) */
  triggerClassName?: string;
}

export default function DateRangePicker({
  label,
  from,
  to,
  onChange,
  triggerClassName,
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempStart, setTempStart] = useState<string | undefined>(() => from);
  const [tempEnd, setTempEnd] = useState<string | undefined>(() => to);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Initialize temp values when props change (but only if calendar is closed)
  // This ensures we always show the committed values in the input
  useEffect(() => {
    if (!isCalendarOpen) {
      setTempStart(from);
      setTempEnd(to);
    }
  }, [from, to, isCalendarOpen]);


  // Close calendar on Escape (stop propagation to prevent closing parent popover)
  useEffect(() => {
    if (!isCalendarOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // Prevent closing parent popover
        // Cancel changes, restore original values
        setTempStart(from);
        setTempEnd(to);
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape, true); // Use capture phase
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [isCalendarOpen, from, to]);

  // Update dropdown position when opening (for portal); keep inside viewport
  const CALENDAR_WIDTH = 680;
  const CALENDAR_HEIGHT = 420;
  const PADDING = 8;
  useEffect(() => {
    if (!isCalendarOpen || typeof window === "undefined" || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let left = rect.left;
    if (left + CALENDAR_WIDTH > window.innerWidth - PADDING) {
      left = Math.max(PADDING, window.innerWidth - CALENDAR_WIDTH - PADDING);
    }
    if (left < PADDING) left = PADDING;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = (spaceBelow < CALENDAR_HEIGHT && rect.top > CALENDAR_HEIGHT)
      ? rect.top - CALENDAR_HEIGHT - 4
      : rect.bottom + 4;
    setDropdownPosition({ top, left });
  }, [isCalendarOpen]);

  // Close calendar on click outside
  useEffect(() => {
    if (!isCalendarOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        calendarRef.current &&
        !calendarRef.current.contains(e.target as Node)
      ) {
        // Cancel changes, restore original values
        setTempStart(from);
        setTempEnd(to);
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCalendarOpen, from, to]);

  const handleDateSelect = (date: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // Start new range
      setTempStart(date);
      setTempEnd(undefined);
      // Don't close calendar after first click - user needs to select end date
    } else if (tempStart && !tempEnd) {
      // Selecting end date
      const selectedDate = new Date(date + "T00:00:00");
      const startDate = new Date(tempStart + "T00:00:00");

      if (selectedDate < startDate) {
        // Swap: selected becomes start, old start becomes end
        setTempEnd(tempStart);
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
      // Commit the range and close calendar after range is complete
      onChange(tempStart, date < tempStart ? tempStart : date);
      setIsCalendarOpen(false);
    }
  };

  const handleClear = () => {
    setTempStart(undefined);
    setTempEnd(undefined);
    onChange(undefined, undefined);
    setIsCalendarOpen(false);
  };

  const handleApply = () => {
    // Treat single selected day as a valid same-day range.
    if (tempStart && !tempEnd) {
      onChange(tempStart, tempStart);
      setIsCalendarOpen(false);
      return;
    }
    onChange(tempStart, tempEnd);
    setIsCalendarOpen(false);
  };

  const displayValue = formatDateRange(from, to, true);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Above app modals (e.g. Edit Service z-[100000]) so the range calendar is visible and clickable
  const CALENDAR_Z = "z-[200000]";

  const calendarContent = isCalendarOpen && (
    <div
      ref={calendarRef}
      data-calendar-dropdown
      className={
        isMobile
          ? `fixed inset-0 ${CALENDAR_Z} flex flex-col bg-white`
          : `fixed ${CALENDAR_Z} w-[680px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg`
      }
      style={isMobile ? undefined : { top: dropdownPosition.top, left: dropdownPosition.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile && (
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">{label || "Select dates"}</span>
          <button
            type="button"
            onClick={() => { setTempStart(from); setTempEnd(to); setIsCalendarOpen(false); }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      <div className={isMobile ? "flex-1 overflow-y-auto p-4" : ""}>
        <RangeCalendar
          startDate={tempStart}
          endDate={tempEnd}
          onDateSelect={handleDateSelect}
          onClear={handleClear}
          autoCloseOnRangeComplete={true}
          singleMonth={isMobile}
        />
      </div>
      <div className={isMobile
        ? "flex gap-3 border-t border-gray-200 p-4"
        : "mt-4 flex justify-end gap-2 border-t border-gray-200 pt-4"
      }>
        <button
          type="button"
          onClick={() => {
            setTempStart(from);
            setTempEnd(to);
            setIsCalendarOpen(false);
          }}
          className={isMobile
            ? "flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
            : "rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          }
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className={isMobile
            ? "flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white"
            : "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          }
        >
          Apply
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      {label ? <label className="mb-1 block text-xs text-gray-600">{label}</label> : null}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 sm:py-1.5 text-left text-sm focus:border-black focus:outline-none ${triggerClassName ?? ""}`}
      >
        {displayValue}
      </button>

      {typeof document !== "undefined" && createPortal(calendarContent, document.body)}
    </div>
  );
}

