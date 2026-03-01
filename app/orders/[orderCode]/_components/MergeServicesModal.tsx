'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "@/lib/supabaseClient";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { useModalOverlay } from "@/contexts/ModalOverlayContext";

interface Service {
  id: string;
  name: string;
  category: string;
  servicePrice: number;
  clientPrice: number;
  supplier: string;
  supplierPartyId?: string;
  payer: string;
  payerPartyId?: string;
  client: string;
  clientPartyId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface Party {
  id: string;
  display_name: string;
  party_type: string;
  isFromOrder?: boolean;
}

interface MergeServicesModalProps {
  services: Service[];
  orderCode: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MergeServicesModal({ services, orderCode, onClose, onSuccess }: MergeServicesModalProps) {
  useModalOverlay();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  
  // Merged service config
  const [mergedName, setMergedName] = useState(services[0]?.name || "");
  const [payerPartyId, setPayerPartyId] = useState<string | undefined>(services[0]?.payerPartyId);
  
  useEscapeKey(onClose);

  // Check if all services have the same supplier
  const suppliers = [...new Set(services.map(s => s.supplierPartyId).filter(Boolean))];
  const hasSameSupplier = suppliers.length <= 1;
  const supplierName = services[0]?.supplier || "-";

  // Calculate totals
  const totalClientPrice = services.reduce((sum, s) => sum + s.clientPrice, 0);
  const totalServicePrice = services.reduce((sum, s) => sum + s.servicePrice, 0);
  
  // Calculate date range (earliest start, latest end)
  const allDateFroms = services.map(s => s.dateFrom).filter(Boolean) as string[];
  const allDateTos = services.map(s => s.dateTo).filter(Boolean) as string[];
  const mergedDateFrom = allDateFroms.length > 0 
    ? allDateFroms.sort()[0] 
    : undefined;
  const mergedDateTo = allDateTos.length > 0 
    ? allDateTos.sort().reverse()[0] 
    : undefined;

  // Fetch parties
  useEffect(() => {
    const fetchParties = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/party", {
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          setParties(data.parties || []);
        }
      } catch (err) {
        console.error("Failed to fetch parties:", err);
      } finally {
        setIsLoadingParties(false);
      }
    };
    fetchParties();
  }, []);

  const handleMerge = async () => {
    if (!hasSameSupplier) {
      setError("Cannot merge services with different suppliers");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create merged service
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          serviceName: mergedName,
          category: services[0].category,
          clientPrice: totalClientPrice,
          servicePrice: totalServicePrice,
          supplierPartyId: services[0].supplierPartyId,
          supplierName: services[0].supplier,
          clientPartyId: services[0].clientPartyId,
          clientName: services[0].client,
          payerPartyId: payerPartyId,
          payerName: parties.find(p => p.id === payerPartyId)?.display_name || services[0].payer,
          dateFrom: mergedDateFrom,
          dateTo: mergedDateTo,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create merged service");
      }

      // Delete original services
      for (const service of services) {
        await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`, {
          method: 'DELETE',
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Merge error:', err);
      setError(err instanceof Error ? err.message : 'Error merging services');
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-purple-50">
          <h2 className="text-xl font-semibold text-gray-900">
            Merge {services.length} Services
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Validation warning */}
          {!hasSameSupplier && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium">Cannot merge services with different suppliers</p>
              <p className="text-sm text-red-600 mt-1">
                All selected services must have the same supplier to be merged.
              </p>
            </div>
          )}

          {/* Services to merge */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Services to merge:</h3>
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <span>{getCategoryIcon(service.category)}</span>
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <p className="text-xs text-gray-500">
                      Supplier: {service.supplier || '-'} | Payer: {service.payer || '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-blue-600">€{service.clientPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">€{service.servicePrice.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Merged result */}
          {hasSameSupplier && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
              <h3 className="font-semibold text-purple-900">Merged Service Result</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service Name</label>
                  <input
                    type="text"
                    value={mergedName}
                    onChange={(e) => setMergedName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Merged service name"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payer</label>
                  <PayerSelect
                    parties={parties}
                    value={payerPartyId || ""}
                    onChange={setPayerPartyId}
                    placeholder="Select payer..."
                    disabled={isLoadingParties}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-purple-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Supplier (same):</span>
                  <span className="font-medium text-gray-900">{supplierName}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">Total Client Price:</span>
                  <span className="font-semibold text-blue-600 text-lg">€{totalClientPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Total Service Price:</span>
                  <span className="font-semibold text-green-600 text-lg">€{totalServicePrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={saving || !hasSameSupplier || !mergedName.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Merging...' : 'Merge Services'}
          </button>
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
  disabled,
}: {
  parties: Party[];
  value: string;
  onChange: (partyId: string) => void;
  placeholder?: string;
  disabled?: boolean;
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
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg pr-8 ${
          selectedParty ? 'border-purple-300 bg-purple-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && !disabled && (
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
                className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 ${
                  party.id === value ? "bg-purple-100" : ""
                }`}
              >
                {party.display_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
