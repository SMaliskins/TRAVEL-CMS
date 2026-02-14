"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ClientOption {
  id: string;
  name: string;
}

interface ClientMultiSelectDropdownProps {
  onAddClients: (toAdd: ClientOption[]) => void;
  existingClientIds: string[];
}

export default function ClientMultiSelectDropdown({
  onAddClients,
  existingClientIds,
}: ClientMultiSelectDropdownProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchClients = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ search: query, limit: "10", role: "client" });
      const res = await fetch(`/api/directory?${params}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || data.records || [];
        const opts: ClientOption[] = list.map((r: { id: string; displayName?: string; display_name?: string; firstName?: string; lastName?: string }) => ({
          id: r.id,
          name: r.displayName || r.display_name || [r.firstName, r.lastName].filter(Boolean).join(" ") || "",
        })).filter((c: ClientOption) => c.name && !existingClientIds.includes(c.id));
        setResults(opts);
        if (opts.length > 0) setIsOpen(true);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [existingClientIds]);

  const handleSelect = (client: ClientOption) => {
    onAddClients([client]);
    setSearch("");
    setResults([]);
    setIsOpen(false);
  };

  const showDropdown = search.length >= 2;
  useEffect(() => {
    const t = setTimeout(() => { if (showDropdown) searchClients(search); }, 300);
    return () => clearTimeout(t);
  }, [search, showDropdown, searchClients]);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder="+ Add client"
        className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 left-0 mt-1 w-56 max-h-40 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
