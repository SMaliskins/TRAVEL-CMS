"use client";

import { useState } from "react";

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
}

interface SplitPart {
  amount: number;
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
  const [parts, setParts] = useState<SplitPart[]>([
    { amount: service.clientPrice / 2, payerName: "", payerPartyId: undefined },
    { amount: service.clientPrice / 2, payerName: "", payerPartyId: undefined },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = parts.reduce((sum, part) => sum + part.amount, 0);
  const isValidTotal = Math.abs(totalAmount - service.clientPrice) < 0.01;
  const hasEmptyPayers = parts.some((part) => !part.payerName.trim());

  const addPart = () => {
    const remainingAmount = service.clientPrice - totalAmount;
    setParts([
      ...parts,
      { amount: remainingAmount > 0 ? remainingAmount : 0, payerName: "", payerPartyId: undefined },
    ]);
  };

  const removePart = (index: number) => {
    if (parts.length > 2) {
      setParts(parts.filter((_, i) => i !== index));
    }
  };

  const updatePart = (index: number, field: keyof SplitPart, value: any) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], [field]: value };
    setParts(newParts);
  };

  const handleSplit = async () => {
    if (!isValidTotal) {
      setError(`Total amount (€${totalAmount.toFixed(2)}) must equal original amount (€${service.clientPrice.toFixed(2)})`);
      return;
    }

    if (hasEmptyPayers) {
      setError("All parts must have a payer name");
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
          body: JSON.stringify({ parts }),
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
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
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

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <span className="ml-2 text-gray-900">{service.category}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Original Price:</span>
              <span className="ml-2 text-lg font-semibold text-gray-900">€{service.clientPrice.toFixed(2)}</span>
            </div>
            {service.supplier && (
              <div>
                <span className="font-medium text-gray-700">Supplier:</span>
                <span className="ml-2 text-gray-900">{service.supplier}</span>
              </div>
            )}
            {service.dateFrom && (
              <div>
                <span className="font-medium text-gray-700">Dates:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(service.dateFrom).toLocaleDateString()} - {new Date(service.dateTo || service.dateFrom).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Split into parts:</h3>
            <button onClick={addPart} className="text-sm text-blue-600 hover:text-blue-800">
              + Add Part
            </button>
          </div>

          <div className="space-y-3">
            {parts.map((part, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                <div className="flex-shrink-0 text-sm font-medium text-gray-500">#{index + 1}</div>
                
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payer Name</label>
                  <input
                    type="text"
                    value={part.payerName}
                    onChange={(e) => updatePart(index, "payerName", e.target.value)}
                    placeholder="Enter payer name"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={part.amount}
                    onChange={(e) => updatePart(index, "amount", parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {parts.length > 2 && (
                  <button onClick={() => removePart(index)} className="flex-shrink-0 text-red-600 hover:text-red-800" title="Remove part">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Total:</span>
              <span className={`text-lg font-semibold ${isValidTotal ? "text-green-600" : "text-red-600"}`}>
                €{totalAmount.toFixed(2)}
              </span>
            </div>
            {!isValidTotal && (
              <p className="mt-2 text-xs text-red-600">
                ⚠️ Total must equal €{service.clientPrice.toFixed(2)} (difference: €{Math.abs(totalAmount - service.clientPrice).toFixed(2)})
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
            disabled={isSaving || !isValidTotal || hasEmptyPayers}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Splitting..." : "Split Service"}
          </button>
        </div>
      </div>
    </div>
  );
}
