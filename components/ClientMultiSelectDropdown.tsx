"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

interface Party {
  id: string;
  display_name: string;
  name?: string;
  first_name?: string;
  last_name?: string;
}

interface ClientEntry {
  id: string | null;
  name: string;
}

interface ClientMultiSelectDropdownProps {
  onAddClients: (clients: ClientEntry[]) => void;
  existingClientIds: (string | null)[];
  placeholder?: string;
  className?: string;
}

export default function ClientMultiSelectDropdown({
  onAddClients,
  existingClientIds,
  placeholder = "Add accompanying persons...",
  className = "",
}: ClientMultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight?: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchParties = useCallback(async (query: string) => {
    if (query.length < 2) {
      setParties([]);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ search: query, limit: "15", role: "client" });
      const response = await fetch(`/api/directory?${params}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const results = data.data || data.records || [];
        setParties(results.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          display_name: (r.displayName as string) || (r.display_name as string) ||
            [r.firstName || r.first_name, r.lastName || r.last_name].filter(Boolean).join(" ") ||
            (r.companyName as string) || (r.company_name as string) || "",
          first_name: (r.firstName as string) || (r.first_name as string),
          last_name: (r.lastName as string) || (r.last_name as string),
        })));
      } else {
        setParties([]);
      }
    } catch {
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchParties(search);
      debounceRef.current = null;
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, searchParties]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target) &&
          buttonRef.current && !buttonRef.current.contains(target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.max(8, rect.right - 320);
      const dropdownHeight = 280;
      const margin = 8;
      const spaceAbove = rect.top - margin;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      if (spaceAbove >= dropdownHeight) {
        setDropdownStyle({
          bottom: window.innerHeight - rect.top + 4,
          left,
          maxHeight: Math.min(dropdownHeight, spaceAbove - 4),
        });
      } else if (spaceBelow >= dropdownHeight) {
        setDropdownStyle({
          top: rect.bottom + 4,
          left,
          maxHeight: Math.min(dropdownHeight, spaceBelow - 4),
        });
      } else if (spaceAbove >= spaceBelow) {
        setDropdownStyle({
          bottom: window.innerHeight - rect.top + 4,
          left,
          maxHeight: Math.max(120, spaceAbove - 4),
        });
      } else {
        setDropdownStyle({
          top: rect.bottom + 4,
          left,
          maxHeight: Math.max(120, spaceBelow - 4),
        });
      }
    } else {
      setDropdownStyle(null);
    }
  }, [isOpen]);

  const toggleCheck = (party: Party) => {
    const displayName = party.display_name || party.name ||
      [party.first_name, party.last_name].filter(Boolean).join(" ");
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(party.id)) {
        next.delete(party.id);
      } else {
        next.add(party.id);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    const toAdd: ClientEntry[] = [];
    checkedIds.forEach((id) => {
      const party = parties.find((p) => p.id === id);
      if (party && !existingClientIds.includes(id)) {
        const name = party.display_name || party.name ||
          [party.first_name, party.last_name].filter(Boolean).join(" ");
        toAdd.push({ id: party.id, name: name || "" });
      }
    });
    if (toAdd.length > 0) {
      onAddClients(toAdd);
    }
    setCheckedIds(new Set());
    setIsOpen(false);
    setSearch("");
    setParties([]);
  };

  const dropdownContent = isOpen && dropdownStyle && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] w-80 min-w-64 rounded-lg border border-gray-200 bg-white shadow-lg flex flex-col overflow-hidden"
      style={{
        ...(dropdownStyle.bottom != null ? { bottom: dropdownStyle.bottom } : {}),
        ...(dropdownStyle.top != null ? { top: dropdownStyle.top } : {}),
        left: dropdownStyle.left,
        ...(dropdownStyle.maxHeight != null ? { maxHeight: dropdownStyle.maxHeight } : {}),
      }}
    >
          <div className="p-2 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto max-h-48">
            {loading && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">Searching...</div>
            )}
            {!loading && search.length < 2 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">Type 2+ characters</div>
            )}
            {!loading && search.length >= 2 && parties.length === 0 && (
              <div className="px-3 py-4 text-sm text-center space-y-2">
                <p className="text-gray-500">No results</p>
                <Link
                  href={`/directory/new?name=${encodeURIComponent(search.trim())}`}
                  className="inline-block text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Add to directory
                </Link>
              </div>
            )}
            {!loading &&
              parties.map((party) => {
                const displayName = party.display_name || party.name ||
                  [party.first_name, party.last_name].filter(Boolean).join(" ");
                const isChecked = checkedIds.has(party.id);
                const alreadyAdded = existingClientIds.includes(party.id);
                return (
                  <label
                    key={party.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                      alreadyAdded ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => !alreadyAdded && toggleCheck(party)}
                      disabled={alreadyAdded}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 truncate">{displayName || party.id}</span>
                    {alreadyAdded && (
                      <span className="text-xs text-gray-400">added</span>
                    )}
                  </label>
                );
              })}
          </div>
          {checkedIds.size > 0 && (
            <div className="p-2 border-t bg-gray-50">
              <button
                type="button"
                onClick={handleAddSelected}
                className="w-full py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Add {checkedIds.size} selected
              </button>
            </div>
          )}
    </div>
  );

  return (
    <>
      <div className={className}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          + Add Accompanying Persons
        </button>
      </div>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}
