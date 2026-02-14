"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { DirectoryRecord } from "@/lib/types/directory";

interface HotelSuggestion {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface HotelSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  onHotelSelected?: (hotel: Omit<HotelSuggestion, "id">) => void;
  placeholder?: string;
}

function getSupplierName(record: DirectoryRecord): string {
  const personName = [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  return record.companyName || personName || "Unknown supplier";
}

export default function HotelSuggestInput({
  value,
  onChange,
  onHotelSelected,
  placeholder = "Search hotel...",
}: HotelSuggestInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<HotelSuggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const params = new URLSearchParams({
          search: value.trim(),
          role: "supplier",
          limit: "10",
        });

        const response = await fetch(`/api/directory?${params.toString()}`, {
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = await response.json();
        const data: DirectoryRecord[] = payload.data || [];
        const mapped = data.map((record) => ({
          id: record.id,
          name: getSupplierName(record),
          address: record.legalAddress || record.actualAddress,
          phone: record.phone,
          email: record.email,
        }));
        setSuggestions(mapped);
      } catch (error) {
        console.error("Hotel search error:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value, isOpen]);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
      />

      {isOpen && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {value.trim().length < 2 ? (
            <div className="px-3 py-2 text-xs text-gray-500">Type at least 2 characters</div>
          ) : isLoading ? (
            <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">No matching suppliers</div>
          ) : (
            suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.name);
                  onHotelSelected?.({
                    name: item.name,
                    address: item.address,
                    phone: item.phone,
                    email: item.email,
                  });
                  setIsOpen(false);
                }}
                className="w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-amber-50 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-800">{item.name}</div>
                {(item.address || item.phone || item.email) && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {item.address || item.phone || item.email}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
