"use client";

import { useState, useEffect, useRef } from "react";

interface Party {
  id: string;
  display_name: string;
}

interface PartyComboboxProps {
  parties: Party[];
  value: string;
  onChange: (partyId: string, partyName: string) => void;
  disabled?: boolean;
  label: string;
  placeholder?: string;
}

export default function PartyCombobox({
  parties,
  value,
  onChange,
  disabled,
  label,
  placeholder = "Type to search or select...",
}: PartyComboboxProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedParty = parties.find((p) => p.id === value);

  const filteredParties = parties.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? search : selectedParty?.display_name || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
          {filteredParties.length > 0 ? (
            filteredParties.map((party) => (
              <div
                key={party.id}
                onClick={() => {
                  onChange(party.id, party.display_name);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="cursor-pointer px-3 py-2 hover:bg-blue-50 text-sm"
              >
                {party.display_name}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
