"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Party {
  id: string;
  display_name: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  party_type?: string;
}

interface PartySelectProps {
  value: string | null;
  onChange: (id: string | null, displayName: string) => void;
  error?: string;
  required?: boolean;
  roleFilter?: string; // e.g., "client" to filter by role
}

export default function PartySelect({ 
  value, 
  onChange, 
  error, 
  required,
  roleFilter = "client" 
}: PartySelectProps) {
  const [inputValue, setInputValue] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showCreateOption, setShowCreateOption] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search parties
  const searchParties = useCallback(async (query: string) => {
    if (query.length < 2) {
      setParties([]);
      setShowCreateOption(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Search via API or directly
      const response = await fetch(`/api/directory?search=${encodeURIComponent(query)}&role=${roleFilter}&limit=10`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.records || data.parties || [];
        setParties(results);
        // Show create option if no exact match
        const exactMatch = results.some((p: Party) => 
          (p.display_name || p.name || "").toLowerCase() === query.toLowerCase()
        );
        setShowCreateOption(!exactMatch && query.length >= 2);
      } else {
        setParties([]);
        setShowCreateOption(query.length >= 2);
      }
    } catch (err) {
      console.error("Party search error:", err);
      setParties([]);
      setShowCreateOption(query.length >= 2);
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter]);

  // Debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchParties(val);
    }, 300);
  };

  // Select a party
  const handleSelect = (party: Party) => {
    const displayName = party.display_name || party.name || 
                       [party.first_name, party.last_name].filter(Boolean).join(" ");
    setSelectedParty(party);
    setInputValue(displayName);
    setIsOpen(false);
    onChange(party.id, displayName);
  };

  // Create new party
  const handleCreateNew = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          display_name: inputValue.trim(),
          name: inputValue.trim(),
          party_type: "person", // Default to person
          roles: [roleFilter],
          is_active: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newParty: Party = {
          id: data.id || data.party?.id,
          display_name: inputValue.trim(),
        };
        handleSelect(newParty);
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Failed to create party:", errData);
        alert(`Failed to create: ${errData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Create party error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load selected party on mount if value exists
  useEffect(() => {
    if (value && !selectedParty) {
      // Fetch party details
      const fetchParty = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`/api/directory/${value}`, {
            headers: {
              ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            const party = data.record || data;
            if (party) {
              setSelectedParty(party);
              setInputValue(party.display_name || party.name || "");
            }
          }
        } catch (err) {
          console.error("Fetch party error:", err);
        }
      };
      fetchParty();
    }
  }, [value, selectedParty]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear selection
  const handleClear = () => {
    setSelectedParty(null);
    setInputValue("");
    onChange(null, "");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search or type name..."
          className={`w-full rounded-lg border px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-black focus:ring-black"
          }`}
          required={required}
          autoComplete="off"
        />
        {(inputValue || selectedParty) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (inputValue.length >= 2 || parties.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
          )}

          {!isLoading && parties.length === 0 && inputValue.length >= 2 && (
            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
          )}

          {parties.map((party) => (
            <button
              key={party.id}
              type="button"
              onClick={() => handleSelect(party)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
            >
              <span>{party.display_name || party.name || [party.first_name, party.last_name].filter(Boolean).join(" ")}</span>
              {party.party_type && (
                <span className="text-xs text-gray-400">{party.party_type}</span>
              )}
            </button>
          ))}

          {/* Create new option */}
          {showCreateOption && !isLoading && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full px-3 py-2 text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-t border-gray-200"
            >
              <span className="font-medium">+ Create &quot;{inputValue}&quot;</span>
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
