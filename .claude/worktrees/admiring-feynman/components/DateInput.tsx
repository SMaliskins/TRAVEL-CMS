"use client";

import { useCallback, useMemo, useRef } from "react";
import { useDateFormat } from "@/contexts/CompanySettingsContext";
import { formatDateDDMMYYYY, type DateFormatPattern } from "@/utils/dateFormat";
import { Calendar } from "lucide-react";

interface DateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
}

function parseDisplayToIso(display: string, fmt: DateFormatPattern): string | null {
  const sep = fmt === "yyyy-mm-dd" ? "-" : ".";
  const parts = display.split(sep);
  if (parts.length !== 3) return null;
  let d: string, m: string, y: string;
  if (fmt === "dd.mm.yyyy") [d, m, y] = parts;
  else if (fmt === "mm.dd.yyyy") [m, d, y] = parts;
  else [y, m, d] = parts;
  if (d.length === 2 && m.length === 2 && y.length === 4) return `${y}-${m}-${d}`;
  return null;
}

export default function DateInput({ value, onChange, className = "", placeholder }: DateInputProps) {
  const dateFormat = useDateFormat();
  const hiddenRef = useRef<HTMLInputElement>(null);

  const separator = useMemo(() => (dateFormat === "yyyy-mm-dd" ? "-" : "."), [dateFormat]);
  const displayValue = useMemo(() => (value ? formatDateDDMMYYYY(value, dateFormat) : ""), [value, dateFormat]);
  const phText = placeholder ?? dateFormat;

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const sep = separator;
      const allowed = sep === "-" ? /[^\d-]/g : /[^\d.]/g;
      let v = e.target.value.replace(allowed, "");
      const digits = v.replace(/[.\-]/g, "");
      if (dateFormat === "yyyy-mm-dd") {
        if (digits.length <= 4) v = digits;
        else if (digits.length <= 6) v = digits.slice(0, 4) + sep + digits.slice(4);
        else v = digits.slice(0, 4) + sep + digits.slice(4, 6) + sep + digits.slice(6, 8);
      } else {
        if (digits.length <= 2) v = digits;
        else if (digits.length <= 4) v = digits.slice(0, 2) + sep + digits.slice(2);
        else v = digits.slice(0, 2) + sep + digits.slice(2, 4) + sep + digits.slice(4, 8);
      }
      const iso = parseDisplayToIso(v, dateFormat);
      if (iso) onChange(iso);
      else if (v === "") onChange("");
    },
    [dateFormat, separator, onChange],
  );

  const handleCalendarPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        placeholder={phText}
        maxLength={10}
        className={className || "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"}
      />
      <button
        type="button"
        onClick={() => hiddenRef.current?.showPicker()}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        <Calendar size={14} strokeWidth={1.8} />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handleCalendarPick}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
