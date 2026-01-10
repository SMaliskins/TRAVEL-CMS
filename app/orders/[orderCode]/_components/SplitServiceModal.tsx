"use client";

import { useState, useEffect } from "react";

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

export default function SplitServiceModal({
  service,
  orderCode,
  onClose,
  onSuccess,
}: SplitServiceModalProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [originalPayer, setOriginalPayer] = useState<Party | null>(null);
  
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
  useEffect(() => {
    const fetchParties = async () => {
      try {
        const response = await fetch("/api/party");
        if (response.ok) {
          const data = await response.json();
          setParties(data.parties || []);
          
          // Find original payer
          if (service.payerPartyId) {
            const payer = data.parties.find((p: Party) => p.id === service.payerPartyId);
            if (payer) {
              setOriginalPayer(payer);
              // Set first part to original payer
              setParts(prev => [
                { ...prev[0], payerName: payer.display_name, payerPartyId: payer.id },
                ...prev.slice(1)
              ]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch parties:", err);
      } finally {
        setIsLoadingParties(false);
      }
    };
    fetchParties();
  }, [service.payerPartyId]);

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
      // When client amount changes, proportionally adjust service amount
      const ratio = value / service.clientPrice;
      newParts[index] = {
        ...newParts[index],
        clientAmount: value,
        serviceAmount: service.servicePrice * ratio,
      };
    } else {
      newParts[index] = { ...newParts[index], [field]: value };
    }
    
    setParts(newParts);
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
            <button onClick={addPart} className="text-sm text-blue-600 hover:text-blue-800">
              + Add Part
            </button>
          </div>

          <div className="space-y-3">
            {parts.map((part, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-sm font-medium text-gray-500">#{index + 1}</div>
                  
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    {/* Payer Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Payer {index === 0 && originalPayer && "(Original)"}
                      </label>
                      <select
                        value={part.payerPartyId || ""}
                        onChange={(e) => updatePart(index, "payerPartyId", e.target.value)}
                        disabled={isLoadingParties}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select payer...</option>
                        {parties.map((party) => (
                          <option key={party.id} value={party.id}>
                            {party.display_name} ({party.party_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Client Amount */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Client Price (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={part.clientAmount}
                        onChange={(e) => updatePart(index, "clientAmount", parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Service Amount (auto-calculated, read-only) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Service Price (€)
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
  );
}
