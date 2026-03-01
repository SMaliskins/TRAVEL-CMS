'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';

interface Service {
  id: string;
  name: string;
  category: string;
  servicePrice: number;
  clientPrice: number;
  payer: string;
  payerPartyId?: string;
  client: string;
  clientName?: string;
  payerName?: string;
  supplierName?: string;
  serviceName?: string;
  clientPartyId?: string;
  assignedTravellerIds?: string[];
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
  travellerIds?: string[];
}

interface ServiceSplitConfig {
  numParts: number;
  parts: SplitPart[];
}

interface SplitModalMultiProps {
  services: Service[];
  orderCode: string;
  onClose: () => void;
  onServicesUpdated: (updated: unknown[]) => void;
}

export default function SplitModalMulti({ services, orderCode, onClose, onServicesUpdated }: SplitModalMultiProps) {
  const [splitConfigs, setSplitConfigs] = useState<Record<string, ServiceSplitConfig>>({});
  const [saving, setSaving] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  // Fetch parties list
  useEffect(() => {
    const fetchParties = async () => {
      try {
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
          allParties = (data.parties || []).map((p: Party) => ({ ...p, isFromOrder: false }));
        }

        // Fetch parties from current order
        const orderRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });
        
        let orderPartyIds: string[] = [];
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          const servicesRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
            headers: {
              ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
          });
          if (servicesRes.ok) {
            const servicesData = await servicesRes.json();
            orderPartyIds = [
              ...new Set([
                orderData.order?.client_party_id,
                ...servicesData.services
                  .map((s: { payer_party_id?: string }) => s.payer_party_id)
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

        // Sort: order parties first
        allParties.sort((a, b) => {
          if (a.isFromOrder && !b.isFromOrder) return -1;
          if (!a.isFromOrder && b.isFromOrder) return 1;
          return a.display_name.localeCompare(b.display_name);
        });

        setParties(allParties);
      } catch (err) {
        console.error("Failed to fetch parties:", err);
      } finally {
        setIsLoadingParties(false);
      }
    };

    fetchParties();
  }, [orderCode]);

  // Initialize configs for services
  useEffect(() => {
    const initialConfigs: Record<string, ServiceSplitConfig> = {};
    services.forEach(service => {
      if (!splitConfigs[service.id]) {
        const originalPayer = parties.find(p => p.id === service.payerPartyId);
        const travellerIds = service.assignedTravellerIds || [];
        const t0 = travellerIds.slice(0, Math.ceil(travellerIds.length / 2));
        const t1 = travellerIds.slice(Math.ceil(travellerIds.length / 2));
        initialConfigs[service.id] = {
          numParts: 2,
          parts: [
            {
              clientAmount: service.clientPrice / 2,
              serviceAmount: service.servicePrice / 2,
              payerName: originalPayer?.display_name || service.payer || "",
              payerPartyId: service.payerPartyId,
              travellerIds: t0,
            },
            {
              clientAmount: service.clientPrice / 2,
              serviceAmount: service.servicePrice / 2,
              payerName: "",
              payerPartyId: undefined,
              travellerIds: t1,
            },
          ],
        };
      }
    });
    if (Object.keys(initialConfigs).length > 0) {
      setSplitConfigs(prev => ({ ...prev, ...initialConfigs }));
    }
  }, [services, parties, splitConfigs]);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Flight': '✈️',
      'Hotel': '🏨',
      'Transfer': '🚗',
      'Tour': '🗺️',
      'Insurance': '🛡️',
      'Visa': '📄',
      'Rent a Car': '🚙',
      'Cruise': '🚢',
      'Other': '📦'
    };
    return icons[category] || '📦';
  };

  const adjustNumParts = (serviceId: string, numParts: number, service: Service) => {
    const currentConfig = splitConfigs[serviceId];
    const pricePerPartClient = service.clientPrice / numParts;
    const pricePerPartService = service.servicePrice / numParts;
    const travellerIds = service.assignedTravellerIds || [];
    const perPart = Math.floor(travellerIds.length / numParts) || 1;
    
    const newParts: SplitPart[] = Array(numParts).fill(null).map((_, idx) => {
      const start = Math.min(idx * perPart, travellerIds.length);
      const end = idx === numParts - 1 ? travellerIds.length : Math.min(start + perPart, travellerIds.length);
      const partTravellerIds = travellerIds.slice(start, end);
      return {
        clientAmount: idx === numParts - 1 
          ? service.clientPrice - pricePerPartClient * (numParts - 1)
          : pricePerPartClient,
        serviceAmount: idx === numParts - 1
          ? service.servicePrice - pricePerPartService * (numParts - 1)
          : pricePerPartService,
        payerName: currentConfig?.parts[idx]?.payerName || "",
        payerPartyId: currentConfig?.parts[idx]?.payerPartyId,
        travellerIds: partTravellerIds,
      };
    });

    setSplitConfigs(prev => ({
      ...prev,
      [serviceId]: { numParts, parts: newParts },
    }));
  };

  const divideEqually = (serviceId: string, service: Service) => {
    const config = splitConfigs[serviceId];
    if (!config) return;

    const equalClient = Math.round((service.clientPrice / config.numParts) * 100) / 100;
    const equalService = Math.round((service.servicePrice / config.numParts) * 100) / 100;
    
    const newParts = config.parts.map((part, idx) => ({
      ...part,
      clientAmount: idx === config.numParts - 1 
        ? Math.round((service.clientPrice - equalClient * (config.numParts - 1)) * 100) / 100
        : equalClient,
      serviceAmount: idx === config.numParts - 1
        ? Math.round((service.servicePrice - equalService * (config.numParts - 1)) * 100) / 100
        : equalService,
    }));

    setSplitConfigs(prev => ({
      ...prev,
      [serviceId]: { ...config, parts: newParts },
    }));
  };

  const addPart = (serviceId: string, service: Service) => {
    const config = splitConfigs[serviceId];
    if (!config) return;
    
    const totalClient = config.parts.reduce((s, p) => s + p.clientAmount, 0);
    const totalService = config.parts.reduce((s, p) => s + p.serviceAmount, 0);
    const remainingClient = Math.max(0, service.clientPrice - totalClient);
    const remainingService = Math.max(0, service.servicePrice - totalService);
    const assignedIds = service.assignedTravellerIds || [];
    const usedCount = config.parts.reduce((s, p) => s + (p.travellerIds?.length || 0), 0);
    const newPartTravellerIds = assignedIds.slice(usedCount);
    
    const newParts = [
      ...config.parts,
      {
        clientAmount: remainingClient,
        serviceAmount: remainingService,
        payerName: "",
        payerPartyId: undefined,
        travellerIds: newPartTravellerIds,
      },
    ];

    setSplitConfigs(prev => ({
      ...prev,
      [serviceId]: { numParts: newParts.length, parts: newParts },
    }));
  };

  const removePart = (serviceId: string, partIndex: number, service: Service) => {
    const config = splitConfigs[serviceId];
    if (!config || config.numParts <= 2) return;
    
    const newParts = config.parts.filter((_, idx) => idx !== partIndex);
    
    // Recalculate last part to match total
    const sumClientExceptLast = newParts.slice(0, -1).reduce((s, p) => s + p.clientAmount, 0);
    const sumServiceExceptLast = newParts.slice(0, -1).reduce((s, p) => s + p.serviceAmount, 0);
    newParts[newParts.length - 1].clientAmount = Math.round((service.clientPrice - sumClientExceptLast) * 100) / 100;
    newParts[newParts.length - 1].serviceAmount = Math.round((service.servicePrice - sumServiceExceptLast) * 100) / 100;

    setSplitConfigs(prev => ({
      ...prev,
      [serviceId]: { numParts: newParts.length, parts: newParts },
    }));
  };

  const updatePart = (serviceId: string, partIndex: number, field: keyof SplitPart, value: unknown, service: Service) => {
    const config = splitConfigs[serviceId];
    if (!config) return;

    const newParts = [...config.parts];
    
    if (field === "payerPartyId") {
      const party = parties.find(p => p.id === value);
      newParts[partIndex] = {
        ...newParts[partIndex],
        payerPartyId: value as string,
        payerName: party?.display_name || "",
      };
    } else if (field === "clientAmount") {
      const newAmount = parseFloat(value as string) || 0;
      newParts[partIndex] = { ...newParts[partIndex], clientAmount: newAmount };
      
      // Auto-calculate service amount proportionally
      const ratio = newAmount / service.clientPrice;
      newParts[partIndex].serviceAmount = Math.round(service.servicePrice * ratio * 100) / 100;
      
      // Adjust last part to match total
      if (partIndex !== config.numParts - 1) {
        const sumOfOthers = newParts.slice(0, -1).reduce((sum, p) => sum + p.clientAmount, 0);
        newParts[config.numParts - 1].clientAmount = Math.max(0, Math.round((service.clientPrice - sumOfOthers) * 100) / 100);
        
        const lastRatio = newParts[config.numParts - 1].clientAmount / service.clientPrice;
        newParts[config.numParts - 1].serviceAmount = Math.round(service.servicePrice * lastRatio * 100) / 100;
      }
    } else {
      newParts[partIndex] = { ...newParts[partIndex], [field]: value };
    }

    setSplitConfigs(prev => ({
      ...prev,
      [serviceId]: { ...config, parts: newParts },
    }));
  };

  const validateService = (serviceId: string, service: Service) => {
    const config = splitConfigs[serviceId];
    if (!config) return { valid: false, error: "Not configured" };

    const totalClient = config.parts.reduce((sum, p) => sum + p.clientAmount, 0);
    const totalService = config.parts.reduce((sum, p) => sum + p.serviceAmount, 0);
    const hasEmptyPayers = config.parts.some(p => !p.payerPartyId);
    const hasDuplicatePayers = new Set(config.parts.map(p => p.payerPartyId).filter(Boolean)).size !== config.parts.filter(p => p.payerPartyId).length;

    if (Math.abs(totalClient - service.clientPrice) > 0.01) {
      return { valid: false, error: `Client total mismatch` };
    }
    if (Math.abs(totalService - service.servicePrice) > 0.01) {
      return { valid: false, error: `Service total mismatch` };
    }
    if (hasEmptyPayers) {
      return { valid: false, error: "Missing payers" };
    }
    if (hasDuplicatePayers) {
      return { valid: false, error: "Duplicate payers" };
    }

    return { valid: true, error: null };
  };

  const totalConfiguredParts = useMemo(() => {
    return Object.entries(splitConfigs).reduce((sum, [serviceId, config]) => {
      const service = services.find(s => s.id === serviceId);
      if (!service) return sum;
      const validation = validateService(serviceId, service);
      return sum + (validation.valid ? config.numParts : 0);
    }, 0);
  }, [splitConfigs, services]);

  const allValid = useMemo(() => {
    return services.every(service => {
      const validation = validateService(service.id, service);
      return validation.valid;
    });
  }, [splitConfigs, services]);

  const handleApplyAll = async () => {
    if (!allValid) {
      setError("Please fix all validation errors before applying");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      for (const service of services) {
        const config = splitConfigs[service.id];
        if (!config || config.numParts < 2) continue;

        const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}/split`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            parts: config.parts.map(part => ({
              amount: part.clientAmount,
              serviceAmount: part.serviceAmount,
              payerName: part.payerName,
              payerPartyId: part.payerPartyId,
              travellerIds: part.travellerIds || [],
            }))
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to split ${service.name}`);
        }
      }

      onServicesUpdated([]);
    } catch (err) {
      console.error('Split error:', err);
      setError(err instanceof Error ? err.message : 'Error applying split');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-amber-50">
          <h2 className="text-xl font-semibold text-gray-900">
            Split {services.length} Services
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - All services as cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingParties ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            services.map((service) => {
              const config = splitConfigs[service.id];
              const validation = validateService(service.id, service);
              
              return (
                <div 
                  key={service.id} 
                  className={`border rounded-xl p-4 ${validation.valid ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}
                >
                  {/* Service header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCategoryIcon(service.category)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <p className="text-xs text-gray-500">
                          Client: €{service.clientPrice.toFixed(2)} | Service: €{service.servicePrice.toFixed(2)} | Payer: {service.payer || '-'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => divideEqually(service.id, service)}
                        className="px-3 py-1 text-sm text-amber-700 hover:bg-amber-100 rounded border border-amber-300 bg-amber-50"
                      >
                        Divide Equally
                      </button>
                      <button
                        onClick={() => addPart(service.id, service)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
                      >
                        + Add Part
                      </button>
                    </div>
                  </div>

                  {/* Parts */}
                  {config && (
                    <div className="space-y-2">
                      {config.parts.map((part, partIdx) => (
                        <div key={partIdx} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100">
                          <span className="text-xs font-medium text-gray-400 w-5">#{partIdx + 1}</span>
                          
                          {/* Payer Combobox */}
                          <div className="flex-1 min-w-[180px]">
                            <PayerSelect
                              parties={parties}
                              value={part.payerPartyId || ""}
                              onChange={(partyId) => updatePart(service.id, partIdx, "payerPartyId", partyId, service)}
                              placeholder="Select payer..."
                            />
                          </div>
                          
                          {/* Client Price */}
                          <div className="w-24">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">C:</span>
                              <input
                                type="number"
                                step="0.01"
                                value={part.clientAmount || ''}
                                onChange={(e) => updatePart(service.id, partIdx, "clientAmount", e.target.value, service)}
                                disabled={partIdx === config.numParts - 1}
                                className={`w-full px-2 py-1 text-sm border rounded ${
                                  partIdx === config.numParts - 1 ? 'bg-gray-50 text-gray-500' : 'border-gray-300'
                                }`}
                              />
                            </div>
                          </div>
                          
                          {/* Service Price (auto) */}
                          <div className="w-24">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">S:</span>
                              <input
                                type="number"
                                value={part.serviceAmount.toFixed(2)}
                                readOnly
                                className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-50 text-gray-500"
                              />
                            </div>
                          </div>
                          
                          {/* Remove button */}
                          {config.numParts > 2 && (
                            <button
                              onClick={() => removePart(service.id, partIdx, service)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Remove part"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {/* Totals */}
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-600">Total Client Price:</span>
                          <span className={`font-semibold ${
                            Math.abs(config.parts.reduce((s, p) => s + p.clientAmount, 0) - service.clientPrice) < 0.01 
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            €{config.parts.reduce((s, p) => s + p.clientAmount, 0).toFixed(2)}
                            <span className="text-gray-400 font-normal"> / €{service.clientPrice.toFixed(2)}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="font-medium text-gray-600">Total Service Price:</span>
                          <span className={`font-semibold ${
                            Math.abs(config.parts.reduce((s, p) => s + p.serviceAmount, 0) - service.servicePrice) < 0.01 
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            €{config.parts.reduce((s, p) => s + p.serviceAmount, 0).toFixed(2)}
                            <span className="text-gray-400 font-normal"> / €{service.servicePrice.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                      
                      {/* Validation status */}
                      {!validation.valid && (
                        <p className="text-xs text-red-500 mt-1">{validation.error}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {totalConfiguredParts > 0 ? (
              <span className="text-green-600">✓ {totalConfiguredParts} parts configured</span>
            ) : (
              <span className="text-gray-400">Configure splits above</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyAll}
              disabled={saving || !allValid}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Applying...' : `Apply Split`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact Payer Select component
function PayerSelect({
  parties,
  value,
  onChange,
  placeholder,
}: {
  parties: Party[];
  value: string;
  onChange: (partyId: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedParty = parties.find((p) => p.id === value);

  const filteredParties = parties.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase())
  );

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
        className={`w-full px-2 py-1 text-sm border rounded pr-6 ${
          selectedParty ? 'border-green-300 bg-green-50' : 'border-gray-300'
        }`}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none">
        <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 max-h-48 overflow-auto">
          {filteredParties.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No results</div>
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
                className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 ${
                  party.id === value ? "bg-amber-100" : ""
                } ${party.isFromOrder ? "font-medium" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{party.display_name}</span>
                  {party.isFromOrder && <span className="text-xs text-amber-500">★</span>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
