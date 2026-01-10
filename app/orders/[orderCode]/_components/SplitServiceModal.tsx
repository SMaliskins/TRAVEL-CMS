"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Service {
  id: string;
  name: string;
  category: string;
  clientPrice: number;
  servicePrice: number;
  supplier?: string;
  refNr?: string;
  dateFrom?: string;
  dateTo?: string;
  payerPartyId?: string;
  clientPartyId?: string;
}

interface Party {
  id: string;
  display_name: string;
  party_type: string;
  isFromOrder?: boolean;
}

interface SplitPart {
  clientAmount: number;
  serviceAmount: number;
  payerName: string;
  payerPartyId?: string;
}

interface SplitServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onSuccess: () => void;
}


// Helper to normalize decimal input (accept both "," and ".")
const normalizeDecimal = (value: string): number => {
  const normalized = value.replace(",", ".");
  return parseFloat(normalized) || 0;
};

export default function SplitServiceModal({
  service,
  orderCode,
  onClose,
  onSuccess,
}: SplitServiceModalProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [originalPayer, setOriginalPayer] = useState<Party | null>(null);
  const [showAddPayerModal, setShowAddPayerModal] = useState(false);
  const [newPayerName, setNewPayerName] = useState("");
  
  const [parts, setParts] = useState<SplitPart[]>([
    { 
      clientAmount: service.clientPrice / 2,
      serviceAmount: service.servicePrice / 2,
      payerName: "",
      payerPartyId: service.payerPartyId || undefined,
    },
    { 
      clientAmount: service.clientPrice / 2,
      serviceAmount: service.servicePrice / 2,
      payerName: "",
      payerPartyId: undefined,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch parties list
  const fetchParties = async () => {
    console.log("[SplitModal] Fetching parties...");
    console.log("[SplitModal] Service payerPartyId:", service.payerPartyId);
    console.log("[SplitModal] Order code:", orderCode);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      // Fetch all parties
      const allPartiesRes = await fetch("/api/party", {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });
      let allParties: Party[] = [];
      if (allPartiesRes.ok) {
        const data = await allPartiesRes.json();
        allParties = (data.parties || []).map((p: any) => ({ ...p, isFromOrder: false }));
      }

      // Fetch parties from current order (payers)
      const orderRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`);
      let orderPartyIds: string[] = [];
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        // Get unique party IDs from order services
        const servicesRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`);
        if (servicesRes.ok) {
          const servicesData = await servicesRes.json();
          orderPartyIds = [
            ...new Set([
              orderData.order?.client_party_id,
              ...servicesData.services
                .map((s: any) => s.payer_party_id)
                .filter(Boolean),
            ]),
          ].filter(Boolean) as string[];
        }
      }

      // Mark parties from order
      allParties.forEach((p) => {
        if (orderPartyIds.includes(p.id)) {
          p.isFromOrder = true;
        }
      });

      // Sort: order parties first, then alphabetically
      allParties.sort((a, b) => {
        if (a.isFromOrder && !b.isFromOrder) return -1;
        if (!a.isFromOrder && b.isFromOrder) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

      console.log("[SplitModal] Fetched parties:", allParties.length);
      console.log("[SplitModal] Order party IDs:", orderPartyIds);
      setParties(allParties);
      
      // Find original payer
      if (service.payerPartyId) {
        const payer = allParties.find((p) => p.id === service.payerPartyId);
        if (payer) {
          console.log("[SplitModal] Found original payer:", payer.display_name);
          setOriginalPayer(payer);
          // Set first part to original payer
          setParts(prev => [
            { ...prev[0], payerName: payer.display_name, payerPartyId: payer.id },
            ...prev.slice(1)
          ]);
        } else {
          console.log("[SplitModal] Original payer NOT found for ID:", service.payerPartyId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch parties:", err);
    } finally {
      setIsLoadingParties(false);
    }
  };

  useEffect(() => {
    fetchParties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const totalClientAmount = parts.reduce((sum, part) => sum + part.clientAmount, 0);
  const totalServiceAmount = parts.reduce((sum, part) => sum + part.serviceAmount, 0);
  const isValidClientTotal = Math.abs(totalClientAmount - service.clientPrice) < 0.01;
  const isValidServiceTotal = Math.abs(totalServiceAmount - service.servicePrice) < 0.01;
  const hasEmptyPayers = parts.some((part) => !part.payerPartyId);

  const addPart = () => {
    const remainingClient = service.clientPrice - totalClientAmount;
    const remainingService = service.servicePrice - totalServiceAmount;
    setParts([
      ...parts,
      { 
        clientAmount: remainingClient > 0 ? remainingClient : 0,
        serviceAmount: remainingService > 0 ? remainingService : 0,
        payerName: "",
        payerPartyId: undefined,
      },
    ]);
  };

  const removePart = (index: number) => {
    if (parts.length > 2) {
      setParts(parts.filter((_, i) => i !== index));
    }
  };

  const updatePart = (index: number, field: keyof SplitPart, value: any) => {
    const newParts = [...parts];
    
    if (field === "payerPartyId") {
      const party = parties.find(p => p.id === value);
      newParts[index] = { 
        ...newParts[index], 
        payerPartyId: value,
        payerName: party?.display_name || "",
      };
    } else if (field === "clientAmount") {
      newParts[index] = {
        ...newParts[index],
        clientAmount: value,
      };
      
      if (index !== parts.length - 1) {
        const sumOfOthers = newParts
          .slice(0, -1)
          .reduce((sum, p) => sum + p.clientAmount, 0);
        const remainder = service.clientPrice - sumOfOthers;
        newParts[newParts.length - 1].clientAmount = Math.max(0, remainder);
        
        newParts.forEach((part, i) => {
          const ratio = part.clientAmount / service.clientPrice;
          newParts[i].serviceAmount = service.servicePrice * ratio;
        });
      }
    } else {
      newParts[index] = { ...newParts[index], [field]: value };
    }
    
    setParts(newParts);
  };

    const divideEqually = () => {
    const equalClientAmount = Math.round((service.clientPrice / parts.length) * 100) / 100;
    const equalServiceAmount = Math.round((service.servicePrice / parts.length) * 100) / 100;
    
    // Calculate remainder for last part
    const totalClientExceptLast = equalClientAmount * (parts.length - 1);
    const totalServiceExceptLast = equalServiceAmount * (parts.length - 1);
    const lastClientAmount = Math.round((service.clientPrice - totalClientExceptLast) * 100) / 100;
    const lastServiceAmount = Math.round((service.servicePrice - totalServiceExceptLast) * 100) / 100;
    
    setParts(parts.map((part, idx) => ({
      ...part,
      clientAmount: idx === parts.length - 1 ? lastClientAmount : equalClientAmount,
      serviceAmount: idx === parts.length - 1 ? lastServiceAmount : equalServiceAmount,
    })));
  };

const handleSplit = async () => {
    if (!isValidClientTotal) {
      setError(`Total client amount (€${totalClientAmount.toFixed(2)}) must equal original (€${service.clientPrice.toFixed(2)})`);
      return;
    }

    if (!isValidServiceTotal) {
      setError(`Total service amount (€${totalServiceAmount.toFixed(2)}) must equal original (€${service.servicePrice.toFixed(2)})`);
      return;
    }

    if (hasEmptyPayers) {
      setError("All parts must have a payer selected");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}/split`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            parts: parts.map(p => ({
              amount: p.clientAmount,
              serviceAmount: p.serviceAmount,
              payerName: p.payerName,
              payerPartyId: p.payerPartyId,
            }))
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to split service");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to split service");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Split Service</h2>
              <p className="mt-1 text-sm text-gray-500">
                Divide &quot;{service.name}&quot; into multiple parts for different payers
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Original Service Info */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Category:</span>
                <span className="ml-2 text-gray-900">{service.category}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Client Price:</span>
                <span className="ml-2 text-lg font-semibold text-blue-600">€{service.clientPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Service Price:</span>
                <span className="ml-2 text-lg font-semibold text-green-600">€{service.servicePrice.toFixed(2)}</span>
              </div>
              {service.supplier && (
                <div>
                  <span className="font-medium text-gray-700">Supplier:</span>
                  <span className="ml-2 text-gray-900">{service.supplier}</span>
                </div>
              )}
              {service.dateFrom && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">Dates:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(service.dateFrom).toLocaleDateString()} - {new Date(service.dateTo || service.dateFrom).toLocaleDateString()}
                  </span>
                </div>
              )}
              {originalPayer && (
                <div className="col-span-3">
                  <span className="font-medium text-gray-700">Original Payer:</span>
                  <span className="ml-2 text-gray-900">{originalPayer.display_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Split Parts Form */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Split into parts:</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={divideEqually}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-300 transition-colors"
                >
                  Divide Equally
                </button>
                <button onClick={addPart} className="text-sm text-blue-600 hover:text-blue-800">
                  + Add Part
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {parts.map((part, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-sm font-medium text-gray-500">#{index + 1}</div>
                    
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      {/* Payer Combobox */}
                      <PayerCombobox
                        parties={parties}
                        value={part.payerPartyId || ""}
                        onChange={(partyId) => updatePart(index, "payerPartyId", partyId)}
                        disabled={isLoadingParties}
                        label={`Payer ${index === 0 && originalPayer ? "(Original)" : ""}`}
                        onAddNew={(name) => {
                          setNewPayerName(name);
                          setShowAddPayerModal(true);
                        }}
                      />

                      {/* Client Amount */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Client Price (€) {index === parts.length - 1 && "(Auto)"}
                        </label>
                        <input
                          type="number"
                          value={part.clientAmount}
                          onChange={(e) => updatePart(index, "clientAmount", parseFloat(e.target.value) || 0)}
                          disabled={index === parts.length - 1}
                          className={`w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                            index === parts.length - 1 ? 'bg-gray-50 border-gray-200 text-gray-600' : 'border-gray-300'
                          }`}
                        />
                      </div>

                      {/* Service Amount */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Service Price (€) (Auto)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          readOnly
                          className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                        />
                      </div>
                    </div>

                    {parts.length > 2 && (
                      <button onClick={() => removePart(index)} className="flex-shrink-0 text-red-600 hover:text-red-800 mt-6" title="Remove part">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Validation */}
            <div className="mt-4 rounded-lg bg-gray-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total Client Price:</span>
                <span className={`text-lg font-semibold ${isValidClientTotal ? "text-green-600" : "text-red-600"}`}>
                  €{totalClientAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total Service Price:</span>
                <span className={`text-lg font-semibold ${isValidServiceTotal ? "text-green-600" : "text-red-600"}`}>
                  €{totalServiceAmount.toFixed(2)}
                </span>
              </div>
              {(!isValidClientTotal || !isValidServiceTotal) && (
                <p className="text-xs text-red-600">
                  ⚠️ Totals must equal original amounts
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSplit}
              disabled={isSaving || !isValidClientTotal || !isValidServiceTotal || hasEmptyPayers || isLoadingParties}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Splitting..." : "Split Service"}
            </button>
          </div>
        </div>
      </div>

      {/* Add New Payer Modal */}
      {showAddPayerModal && (
        <AddPayerModal
          defaultName={newPayerName}
          onClose={() => {
            setShowAddPayerModal(false);
            setNewPayerName("");
          }}
          onSuccess={() => {
            setShowAddPayerModal(false);
            setNewPayerName("");
            fetchParties();
          }}
        />
      )}
    </>
  );
}

// Combobox component for payer selection with search
function PayerCombobox({
  parties,
  value,
  onChange,
  disabled,
  label,
  onAddNew,
}: {
  parties: Party[];
  value: string;
  onChange: (partyId: string) => void;
  disabled?: boolean;
  label?: string;
  onAddNew?: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedParty = parties.find((p) => p.id === value);

  const filteredParties = parties.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search query matches any existing party
  const hasExactMatch = filteredParties.some(
    (p) => p.display_name.toLowerCase() === search.trim().toLowerCase()
  );
  const showAddNew = search.trim() && !hasExactMatch && onAddNew;

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
      <label className="block text-xs font-medium text-gray-700 mb-1">{label || "Payer"}</label>
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
          placeholder="Type to search or select..."
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
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {showAddNew && (
            <button
              type="button"
              onClick={() => {
                if (onAddNew) {
                  onAddNew(search.trim());
                  setIsOpen(false);
                  setSearch("");
                }
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 text-green-600 font-medium border-b border-gray-200"
            >
              + Add &quot;{search.trim()}&quot;
            </button>
          )}
          
          {filteredParties.length === 0 && !showAddNew ? (
            <div className="px-3 py-2 text-sm text-gray-500">No payers found</div>
          ) : (
            filteredParties.map((party) => (
              <button
                key={party.id}
                type="button"
                onClick={() => {
                  onChange(party.id);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                  party.id === value ? "bg-blue-100" : ""
                } ${party.isFromOrder ? "font-medium" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span>{party.display_name}</span>
                  <span className="text-xs text-gray-500">
                    {party.isFromOrder && "★ "}
                    {party.party_type}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Simple Add Payer Modal component
function AddPayerModal({ 
  defaultName, 
  onClose, 
  onSuccess 
}: { 
  defaultName?: string;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [displayName, setDisplayName] = useState(defaultName || "");
  const [partyType, setPartyType] = useState<"person" | "company">("person");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          party_type: partyType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create payer");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create payer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add New Payer</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter payer name"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Party Type
            </label>
            <select
              value={partyType}
              onChange={(e) => setPartyType(e.target.value as "person" | "company")}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="person">Person</option>
              <option value="company">Company</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !displayName.trim()}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Add Payer"}
          </button>
        </div>
      </div>
    </div>
  );
}
