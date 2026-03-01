"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
  payer?: string;
  client?: string;
  clientName?: string;
  payerName?: string;
}

interface Party {
  id: string;
  display_name: string;
  party_type: string;
  isFromOrder?: boolean;
}

interface Traveller {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface SplitPart {
  clientAmount: number;
  serviceAmount: number;
  payerName: string;
  payerPartyId?: string;
  travellerIds: string[];
}

export interface SuggestedTravellerGroup {
  id: string;
  name: string;
  travellers: Traveller[];
}

interface SplitServiceModalProps {
  service: Service;
  orderCode: string;
  /** Travellers assigned to this service (initial split) */
  travellers: Traveller[];
  /** All travellers in the order (pool for Smart add) */
  orderTravellers?: Traveller[];
  /** Order main client party id (for suggested-travellers API) */
  mainClientId?: string | null;
  /** Refetch order travellers after adding from directory */
  onTravellersRefetch?: () => void;
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
  travellers,
  orderTravellers = [],
  mainClientId,
  onTravellersRefetch,
  onClose,
  onSuccess,
}: SplitServiceModalProps) {
  useModalOverlay();
  console.log("[SplitModal INIT] Service:", {
    id: service.id,
    name: service.name,
    payerPartyId: service.payerPartyId,
    clientPartyId: service.clientPartyId,
    clientPrice: service.clientPrice,
    servicePrice: service.servicePrice,
  });

  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [originalPayer, setOriginalPayer] = useState<Party | null>(null);
  const [showAddPayerModal, setShowAddPayerModal] = useState(false);
  const [newPayerName, setNewPayerName] = useState("");
  
  // Default traveller split: first half to part 0, rest to part 1
  const defaultTravellerSplit = (): [string[], string[]] => {
    const ids = travellers.map((t) => t.id);
    if (ids.length === 0) return [[], []];
    const mid = Math.ceil(ids.length / 2);
    return [ids.slice(0, mid), ids.slice(mid)];
  };
  const [defaultT0, defaultT1] = defaultTravellerSplit();

  const [parts, setParts] = useState<SplitPart[]>([
    {
      clientAmount: service.clientPrice / 2,
      serviceAmount: service.servicePrice / 2,
      payerName: "",
      payerPartyId: undefined,
      travellerIds: defaultT0,
    },
    {
      clientAmount: service.clientPrice / 2,
      serviceAmount: service.servicePrice / 2,
      payerName: "",
      payerPartyId: undefined,
      travellerIds: defaultT1,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedTravellerGroup[]>([]);

  // ESC key handler
  useEscapeKey(onClose);

  // Fetch suggested travellers (often with main client in other orders)
  useEffect(() => {
    if (!mainClientId) {
      setSuggestedGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/parties/${encodeURIComponent(mainClientId)}/suggested-travellers`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          credentials: "include",
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          const groups = (data.suggestedGroups || []).map((g: { id: string; name: string; travellers: Array<{ id: string; firstName?: string; lastName?: string }> }) => ({
            id: g.id,
            name: g.name,
            travellers: (g.travellers || []).map((t: { id: string; firstName?: string; lastName?: string }) => ({
              id: t.id,
              firstName: t.firstName,
              lastName: t.lastName,
            })),
          }));
          setSuggestedGroups(groups);
        }
      } catch (_) {
        if (!cancelled) setSuggestedGroups([]);
      }
    })();
    return () => { cancelled = true; };
  }, [mainClientId]);

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
      const orderRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });
      let orderPartyIds: string[] = [];
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        // Get unique party IDs from order services
        const servicesRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });
        if (servicesRes.ok) {
          const servicesData = await servicesRes.json();
          const payerIds = (servicesData.services || []).map((s: any) => s.payer_party_id).filter(Boolean);
          const clientIds = (servicesData.services || []).map((s: any) => s.client_party_id).filter(Boolean);
          orderPartyIds = [
            ...new Set([
              orderData.order?.client_party_id,
              ...payerIds,
              ...clientIds,
              ...orderTravellers.map((t) => t.id).filter(Boolean),
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
      console.log("[SplitModal] Looking for payer with ID:", service.payerPartyId);
      setParties(allParties);
      
      // Find original payer
      if (service.payerPartyId) {
        const payer = allParties.find((p) => p.id === service.payerPartyId);
        console.log("[SplitModal] Search result for payerPartyId:", payer);
        if (payer) {
          console.log("[SplitModal] Found original payer:", payer.display_name);
          setOriginalPayer(payer);
          // Parts will be updated in useEffect when originalPayer changes
        } else {
          console.log("[SplitModal] Original payer NOT found for ID:", service.payerPartyId);
          console.log("[SplitModal] Available party IDs:", allParties.map(p => p.id));
        }
      } else {
        console.log("[SplitModal] No payerPartyId in service, trying fallback by name");
        // Fallback: try to find payer by name
        if (service.payer && service.payer !== "-") {
          const payerByName = allParties.find((p) => 
            p.display_name.toLowerCase() === service.payer?.toLowerCase()
          );
          if (payerByName) {
            console.log("[SplitModal] Found payer by name:", payerByName.display_name);
            setOriginalPayer(payerByName);
          } else {
            console.log("[SplitModal] Payer not found by name:", service.payer);
          }
        } else {
          console.log("[SplitModal] No payer name available");
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

  // Update first part with original payer when it's found
  useEffect(() => {
    if (originalPayer && parties.length > 0) {
      console.log("[SplitModal useEffect] Setting original payer to first part:", originalPayer.display_name);
      setParts(prev => [
        { ...prev[0], payerName: originalPayer.display_name, payerPartyId: originalPayer.id },
        ...prev.slice(1)
      ]);
    }
  }, [originalPayer, parties.length]); // Run when originalPayer is set

  const totalClientAmount = parts.reduce((sum, part) => sum + (parseFloat(String(part.clientAmount)) || 0), 0);
  const totalServiceAmount = parts.reduce((sum, part) => sum + (parseFloat(String(part.serviceAmount)) || 0), 0);
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
        travellerIds: [],
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
    } else if (field === "travellerIds") {
      newParts[index] = { ...newParts[index], travellerIds: Array.isArray(value) ? value : [] };
    } else if (field === "clientAmount") {
      newParts[index] = {
        ...newParts[index],
        clientAmount: parseFloat(value) || 0,
      };
      
      if (index !== parts.length - 1) {
        const sumOfOthers = newParts
          .slice(0, -1)
          .reduce((sum, p) => sum + p.clientAmount, 0);
        const remainder = service.clientPrice - sumOfOthers;
        newParts[newParts.length - 1].clientAmount = Math.max(0, remainder);
        
        newParts.forEach((part, i) => {
          const clientAmt = part.clientAmount || 0;
          const ratio = clientAmt / service.clientPrice;
          newParts[i].serviceAmount = Math.round(service.servicePrice * ratio * 100) / 100;
        });
        
        // Adjust last part to match exact total
        const totalService = newParts.reduce((sum, p) => sum + p.serviceAmount, 0);
        const diff = Math.round((service.servicePrice - totalService) * 100) / 100;
        if (diff !== 0) {
          newParts[newParts.length - 1].serviceAmount = Math.round((newParts[newParts.length - 1].serviceAmount + diff) * 100) / 100;
        }
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
      setError(`Total client amount (€${Number(totalClientAmount).toFixed(2)}) must equal original (€${service.clientPrice.toFixed(2)})`);
      return;
    }

    if (!isValidServiceTotal) {
      setError(`Total service amount (€${Number(totalServiceAmount).toFixed(2)}) must equal original (€${service.servicePrice.toFixed(2)})`);
      return;
    }

    if (hasEmptyPayers) {
      setError("All parts must have a payer selected");
      return;
    }
    // Check for duplicate payers
    const payerIds = parts.map(p => p.payerPartyId).filter(Boolean);
    const uniquePayerIds = new Set(payerIds);
    if (payerIds.length !== uniquePayerIds.size) {
      setError("Each part must have a different payer. Remove duplicate payers.");
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
              travellerIds: p.travellerIds,
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
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
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
                    {formatDateDDMMYYYY(service.dateFrom)} - {formatDateDDMMYYYY(service.dateTo || service.dateFrom)}
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
                    
                    <div className="flex-1 grid grid-cols-4 gap-3">
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

                      {/* Travellers: in order + suggested + search (active only) */}
                      <TravellersSelect
                        orderTravellers={orderTravellers}
                        suggestedGroups={suggestedGroups}
                        orderCode={orderCode}
                        onTravellersRefetch={onTravellersRefetch}
                        selectedIds={part.travellerIds}
                        onChange={(ids) => updatePart(index, "travellerIds", ids)}
                        label="Travellers"
                      />

                      {/* Client Amount */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Client Price (€) {index === parts.length - 1 && "(Auto)"}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={part.clientAmount || ''}
                          onChange={(e) => {
                            let val = e.target.value;
                            // Replace comma and Cyrillic 'ю' with period
                            val = val.replace(/[,ю]/g, '.');
                            // Remove all non-numeric except first dot
                            val = val.replace(/[^0-9.]/g, '');
                            // Keep only first dot
                            const partsVal = val.split('.');
                            if (partsVal.length > 2) {
                              val = partsVal[0] + '.' + partsVal.slice(1).join('');
                            }
                            // Store as string during editing, convert for calculations
                            updatePart(index, "clientAmount", val);
                          }}
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
                          value={part.serviceAmount.toFixed(2)}
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
                  €{Number(totalClientAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total Service Price:</span>
                <span className={`text-lg font-semibold ${isValidServiceTotal ? "text-green-600" : "text-red-600"}`}>
                  €{Number(totalServiceAmount).toFixed(2)}
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

// Travellers multi-select: In order + Suggested (smart add) + Directory search (active only)
function TravellersSelect({
  orderTravellers,
  suggestedGroups,
  orderCode,
  onTravellersRefetch,
  selectedIds,
  onChange,
  label,
}: {
  orderTravellers: Traveller[];
  suggestedGroups: SuggestedTravellerGroup[];
  orderCode: string;
  onTravellersRefetch?: () => void;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Traveller[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedFromSearch, setAddedFromSearch] = useState<Traveller[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestedFlat = useMemo(() => suggestedGroups.flatMap((g) => g.travellers), [suggestedGroups]);
  const allTravellersForDisplay = useMemo(() => {
    const byId = new Map<string, Traveller>();
    orderTravellers.forEach((t) => byId.set(t.id, t));
    suggestedFlat.forEach((t) => byId.set(t.id, t));
    addedFromSearch.forEach((t) => byId.set(t.id, t));
    return Array.from(byId.values());
  }, [orderTravellers, suggestedFlat, addedFromSearch]);

  const toggleTraveller = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const displayName = (t: Traveller) =>
    t.name?.trim() || [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id;
  const initials = (t: Traveller) => {
    const name = displayName(t);
    if (!name) return t.id.slice(0, 2).toUpperCase();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const addFromSearch = async (t: Traveller) => {
    onChange([...selectedIds, t.id]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/orders/${encodeURIComponent(orderCode)}/travellers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ partyId: t.id }),
      });
      setAddedFromSearch((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
      onTravellersRefetch?.();
    } catch (_) {
      // keep selection; refetch may not run
    }
    setSearchQuery("");
    setSearchResults([]);
  };

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
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `/api/directory?search=${encodeURIComponent(searchQuery)}&limit=10`,
          { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, credentials: "include" }
        );
        if (!cancelled && res.ok) {
          const data = await res.json();
          const list = (data.data || []).filter((r: { type?: string }) => r.type === "person").map((r: { id: string; firstName?: string; lastName?: string }) => ({
            id: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
          }));
          setSearchResults(list);
        }
      } catch (_) {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery]);

  const visibleIds = selectedIds.slice(0, 3);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-gray-700 mb-1">{label || "Travellers"}</label>
      <div
        className="min-h-[34px] w-full rounded border border-gray-300 px-2 py-1.5 flex items-center gap-0.5 flex-wrap cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen((o) => !o)}
      >
        <div className="flex items-center gap-0.5">
          {visibleIds.map((travellerId) => {
            const t = allTravellersForDisplay.find((x) => x.id === travellerId);
            if (!t) return (
              <div key={travellerId} className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600" title={travellerId}>
                ?
              </div>
            );
            return (
              <div
                key={t.id}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800"
                title={displayName(t)}
              >
                {initials(t)}
              </div>
            );
          })}
          {selectedIds.length > 3 && (
            <span className="text-xs text-gray-500">+{selectedIds.length - 3}</span>
          )}
        </div>
        <span className="ml-1 flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white text-gray-500 text-xs" aria-hidden>
          ▼
        </span>
      </div>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 max-h-64 overflow-auto min-w-[220px]">
          {/* Search directory (returns only active) */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search directory..."
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
              aria-label="Search directory for traveller"
            />
          </div>
          {searchQuery.length >= 2 && (
            <div className="border-b border-gray-100 p-1">
              {isSearching ? (
                <div className="px-2 py-1 text-sm text-gray-500">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-2 py-1 text-sm text-gray-500">No contacts found</div>
              ) : (
                searchResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addFromSearch(t)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-green-50 text-left rounded"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-800">
                      {initials(t)}
                    </span>
                    <span>{displayName(t)}</span>
                    <span className="text-xs text-green-600 ml-auto">+ Add</span>
                  </button>
                ))
              )}
            </div>
          )}
          {/* In this order */}
          {orderTravellers.length > 0 && (
            <div className="p-1 border-b border-gray-100">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">In this order</div>
              {orderTravellers.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleTraveller(t.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">{initials(t)}</span>
                  <span>{displayName(t)}</span>
                </label>
              ))}
            </div>
          )}
          {/* Suggested (often with client in other orders) */}
          {suggestedGroups.map((group) => (
            group.travellers.length > 0 && (
              <div key={group.id} className="p-1 border-b border-gray-100 last:border-b-0">
                <div className="px-2 py-1 text-xs font-medium text-gray-500">{group.name}</div>
                {group.travellers.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleTraveller(t.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">{initials(t)}</span>
                    <span>{displayName(t)}</span>
                  </label>
                ))}
              </div>
            )
          ))}
          {orderTravellers.length === 0 && suggestedGroups.every((g) => !g.travellers.length) && !searchQuery && (
            <div className="px-3 py-2 text-sm text-gray-500">Search or add from directory</div>
          )}
        </div>
      )}
    </div>
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

  // Debug logging for first part
  useEffect(() => {
    if (label?.includes("Original")) {
      console.log("[PayerCombobox Original]", {
        value,
        selectedParty: selectedParty?.display_name,
        partiesCount: parties.length,
      });
    }
  }, [value, selectedParty, parties.length, label]);

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
