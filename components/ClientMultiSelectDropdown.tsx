"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { DirectoryRecord } from "@/lib/types/directory";

interface ClientToAdd {
  id: string;
  name: string;
}

interface ClientMultiSelectDropdownProps {
  onAddClients: (clients: ClientToAdd[]) => void;
  existingClientIds?: string[];
}

function getDisplayName(record: DirectoryRecord): string {
  const personName = [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  return personName || record.companyName || "Unknown client";
}

export default function ClientMultiSelectDropdown({
  onAddClients,
  existingClientIds = [],
}: ClientMultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ClientToAdd[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const params = new URLSearchParams({
          search: query.trim(),
          role: "client",
          limit: "10",
        });

        const response = await fetch(`/api/directory?${params.toString()}`, {
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });

        if (!response.ok) {
          setResults([]);
          return;
        }

        const payload = await response.json();
        const data: DirectoryRecord[] = payload.data || [];
        const mapped = data
          .filter((record) => !existingClientIds.includes(record.id))
          .map((record) => ({
            id: record.id,
            name: getDisplayName(record),
          }));
        setResults(mapped);
      } catch (error) {
        console.error("Client search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen, existingClientIds]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        + Add from directory
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client..."
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {query.trim().length < 2 ? (
              <div className="px-2 py-3 text-xs text-gray-500">Type at least 2 characters</div>
            ) : isLoading ? (
              <div className="px-2 py-3 text-xs text-gray-500">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-500">No clients found</div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onAddClients([item]);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
