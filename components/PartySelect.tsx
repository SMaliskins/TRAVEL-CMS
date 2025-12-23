"use client";

import { useState, useEffect } from "react";

interface PartySelectProps {
  value: string | null;
  onChange: (id: string | null, displayName: string) => void;
  error?: string;
  required?: boolean;
}

export default function PartySelect({ value, onChange, error, required }: PartySelectProps) {
  const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Load parties from API
    setParties([]);
  }, []);

  return (
    <div>
      <select
        value={value || ""}
        onChange={(e) => {
          const selectedId = e.target.value || null;
          const selectedParty = parties.find((p) => p.id === selectedId);
          onChange(selectedId, selectedParty?.name || "");
        }}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-black focus:ring-black"
        }`}
        required={required}
      >
        <option value="">Select a party...</option>
        {parties.map((party) => (
          <option key={party.id} value={party.id}>
            {party.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {loading && <p className="mt-1 text-xs text-gray-500">Loading...</p>}
    </div>
  );
}

