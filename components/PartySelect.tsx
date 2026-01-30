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
  roleFilter?: string;
  /** Initial display name to show without API fetch */
  initialDisplayName?: string;
}

export default function PartySelect({ 
  value, 
  onChange, 
  error, 
  required,
  roleFilter = "client",
  initialDisplayName = "",
}: PartySelectProps) {
  // Initialize inputValue with initialDisplayName if provided
  const [inputValue, setInputValue] = useState(initialDisplayName);
  const [parties, setParties] = useState<Party[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showCreateOption, setShowCreateOption] = useState(false);
  
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState<"person" | "company">("person");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPersonalCode, setCreatePersonalCode] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createRegNumber, setCreateRegNumber] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Supplier-specific: service areas
  const [createServiceAreas, setCreateServiceAreas] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [wasCleared, setWasCleared] = useState(false);

  // Update inputValue when initialDisplayName changes (e.g., after async load)
  // But don't restore if user manually cleared the field
  useEffect(() => {
    if (initialDisplayName && !inputValue && !wasCleared) {
      setInputValue(initialDisplayName);
    }
  }, [initialDisplayName, inputValue, wasCleared]);

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
      
      // Build query params with role filter
      const params = new URLSearchParams({
        search: query,
        limit: "10",
      });
      if (roleFilter) {
        params.set("role", roleFilter);
      }
      
      const response = await fetch(`/api/directory?${params.toString()}`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.data || data.records || data.parties || [];
        
        const transformedResults: Party[] = results.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          display_name: (r.displayName as string) || (r.display_name as string) || 
                       [r.firstName || r.first_name, r.lastName || r.last_name].filter(Boolean).join(" ") ||
                       (r.companyName as string) || (r.company_name as string) || 
                       (r.name as string) || "",
          first_name: (r.firstName as string) || (r.first_name as string),
          last_name: (r.lastName as string) || (r.last_name as string),
          party_type: (r.type as string) || (r.party_type as string),
        }));
        
        setParties(transformedResults);
        
        const exactMatch = transformedResults.some((p: Party) => 
          (p.display_name || "").toLowerCase() === query.toLowerCase()
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchParties(val);
    }, 300);
  };

  const handleSelect = (party: Party) => {
    const displayName = party.display_name || party.name || 
                       [party.first_name, party.last_name].filter(Boolean).join(" ");
    setSelectedParty(party);
    setInputValue(displayName);
    setIsOpen(false);
    onChange(party.id, displayName);
  };

  // Open create form with pre-filled data
  const handleOpenCreateForm = () => {
    const nameParts = inputValue.trim().split(/\s+/);
    setCreateFirstName(nameParts[0] || "");
    setCreateLastName(nameParts.slice(1).join(" ") || "");
    setCreateCompanyName(inputValue.trim());
    setCreateType("person");
    setCreateError("");
    setShowCreateForm(true);
    setIsOpen(false);
  };

  // Create new party via form
  const handleCreateSubmit = async () => {
    setCreateError("");
    
    // Validate
    if (createType === "person") {
      if (!createFirstName.trim() || !createLastName.trim()) {
        setCreateError("First name and last name are required");
        return;
      }
    } else {
      if (!createCompanyName.trim()) {
        setCreateError("Company name is required");
        return;
      }
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload: Record<string, unknown> = {
        type: createType,
        roles: [roleFilter],
        isActive: true,
      };

      if (createType === "person") {
        payload.firstName = createFirstName.trim();
        payload.lastName = createLastName.trim();
        if (createPersonalCode.trim()) payload.personalCode = createPersonalCode.trim();
        if (createPhone.trim()) payload.phone = createPhone.trim();
        if (createEmail.trim()) payload.email = createEmail.trim();
      } else {
        payload.companyName = createCompanyName.trim();
        if (createAddress.trim()) payload.legalAddress = createAddress.trim();
        if (createRegNumber.trim()) payload.regNumber = createRegNumber.trim();
      }
      
      // Add service areas for suppliers
      if (roleFilter === "supplier" && createServiceAreas.length > 0) {
        payload.serviceAreas = createServiceAreas;
      }
      
      const response = await fetch("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const displayName = createType === "person" 
          ? `${createFirstName.trim()} ${createLastName.trim()}`
          : createCompanyName.trim();
        
        // API returns { ok: true, record: { id, display_name } }
        const partyId = data.record?.id || data.id || data.party?.id;
        
        if (!partyId) {
          console.error("API response missing party id:", data);
          setCreateError("Client created but ID not returned");
          return;
        }
        
        const newParty: Party = {
          id: partyId,
          display_name: displayName,
          party_type: createType,
        };
        
        handleSelect(newParty);
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        const errData = await response.json().catch(() => ({}));
        setCreateError(errData.error || "Failed to create");
      }
    } catch (err) {
      console.error("Create party error:", err);
      setCreateError("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateFirstName("");
    setCreateLastName("");
    setCreatePersonalCode("");
    setCreatePhone("");
    setCreateEmail("");
    setCreateCompanyName("");
    setCreateAddress("");
    setCreateRegNumber("");
    setCreateServiceAreas([]);
    setCreateError("");
  };
  
  // Service area options for suppliers
  const SERVICE_AREA_OPTIONS = [
    "Flight",
    "Hotel", 
    "Transfer",
    "Tour",
    "Insurance",
    "Visa",
    "Rent a Car",
    "Cruise",
    "Other",
  ];
  
  const toggleServiceArea = (area: string) => {
    setCreateServiceAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    resetCreateForm();
    inputRef.current?.focus();
  };

  // Sync inputValue when initialDisplayName changes
  useEffect(() => {
    if (initialDisplayName) {
      setInputValue(initialDisplayName);
    }
  }, [initialDisplayName]);

  // Load selected party on mount (only if no initialDisplayName provided)
  useEffect(() => {
    if (value && !selectedParty && !initialDisplayName) {
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
  }, [value, selectedParty, initialDisplayName]);

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
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleClear = () => {
    setSelectedParty(null);
    setInputValue("");
    setWasCleared(true);
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
          onFocus={() => {
            setIsOpen(true);
            // Trigger search on focus if there's already text
            if (inputValue.length >= 2) {
              searchParties(inputValue);
            }
          }}
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
      {isOpen && (inputValue.length >= 2 || parties.length > 0) && !showCreateForm && (
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

          {showCreateOption && !isLoading && (
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="w-full px-3 py-2 text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-t border-gray-200"
            >
              <span className="font-medium">+ Create &quot;{inputValue}&quot;</span>
            </button>
          )}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="absolute z-50 mt-1 w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg p-4 max-h-[80vh] overflow-y-auto">
          <h4 className="font-medium text-sm mb-3">
            {roleFilter === "supplier" ? "Create New Supplier" : "Create New Client"}
          </h4>
          
          {/* Type selector */}
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="createType"
                checked={createType === "person"}
                onChange={() => setCreateType("person")}
                className="text-blue-600"
              />
              Person
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="createType"
                checked={createType === "company"}
                onChange={() => setCreateType("company")}
                className="text-blue-600"
              />
              Company
            </label>
          </div>

          {createType === "person" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={createFirstName}
                  onChange={(e) => setCreateFirstName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
                <input
                  type="text"
                  placeholder="Last Name *"
                  value={createLastName}
                  onChange={(e) => setCreateLastName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <input
                type="text"
                placeholder="Personal Code"
                value={createPersonalCode}
                onChange={(e) => setCreatePersonalCode(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  placeholder="Phone"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Company Name *"
                value={createCompanyName}
                onChange={(e) => setCreateCompanyName(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="text"
                placeholder="Address"
                value={createAddress}
                onChange={(e) => setCreateAddress(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="text"
                placeholder="Reg. Number"
                value={createRegNumber}
                onChange={(e) => setCreateRegNumber(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          )}
          
          {/* Service Areas for Suppliers */}
          {roleFilter === "supplier" && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">Service Areas</label>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_AREA_OPTIONS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleServiceArea(area)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      createServiceAreas.includes(area)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          )}

          {createError && (
            <p className="text-xs text-red-600 mt-2">{createError}</p>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={handleCancelCreate}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isCreating}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
