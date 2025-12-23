"use client";

import { useState, useRef, useEffect } from "react";
import RangeCalendar from "./RangeCalendar";
import { formatDateRange } from "@/utils/dateFormat";

interface DateRangePickerProps {
  label: string;
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
}

export default function DateRangePicker({
  label,
  from,
  to,
  onChange,
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempStart, setTempStart] = useState<string | undefined>(() => from);
  const [tempEnd, setTempEnd] = useState<string | undefined>(() => to);
  const containerRef = useRef<HTMLDivElement>(null);
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
    onChange(tempStart, tempEnd);
    setIsCalendarOpen(false);
  };

  const displayValue = formatDateRange(from, to);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs text-gray-600">{label}</label>
      <button
        type="button"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-left text-sm focus:border-black focus:outline-none"
      >
        {displayValue}
      </button>

      {isCalendarOpen && (
        <div
          ref={calendarRef}
          data-calendar-dropdown
          className="absolute left-0 top-full z-50 mt-1 w-[680px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <RangeCalendar
            startDate={tempStart}
            endDate={tempEnd}
            onDateSelect={handleDateSelect}
            onClear={handleClear}
            autoCloseOnRangeComplete={true}
          />
          <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setTempStart(from);
                setTempEnd(to);
                setIsCalendarOpen(false);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

