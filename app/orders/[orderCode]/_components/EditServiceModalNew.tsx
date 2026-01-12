'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DirectoryCombobox from '@/components/DirectoryCombobox';

interface Service {
  id: string;
  name: string;
  category: string;
  servicePrice: number;
  clientPrice: number;
  resStatus: string | null;
  refNr?: string | null;
  ticketNr?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  supplier?: string | null;
  client?: string | null;
  payer?: string | null;
  supplier_party_id?: string | null;
  client_party_id?: string | null;
  payer_party_id?: string | null;
}

interface EditServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onServiceUpdated: (updated: Partial<Service> & { id: string }) => void;
}

export default function EditServiceModalNew({
  service,
  orderCode,
  onClose,
  onServiceUpdated,
}: EditServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: service.name,
    category: service.category,
    service_price: service.servicePrice,
    client_price: service.clientPrice,
    res_status: service.resStatus || '',
    ref_nr: service.refNr || '',
    ticket_nr: service.ticketNr || '',
    date_from: service.dateFrom || '',
    date_to: service.dateTo || '',
    supplier_id: service.supplier_party_id || null,
    client_id: service.client_party_id || null,
    payer_id: service.payer_party_id || null,
  });

  // Auto-calculated margin
  const margin = useMemo(() => {
    return formData.client_price - formData.service_price;
  }, [formData.service_price, formData.client_price]);

  const marginPercent = useMemo(() => {
    if (formData.service_price === 0) return 0;
    return (margin / formData.service_price) * 100;
  }, [margin, formData.service_price]);

  // Handle client change (auto-fill payer if empty)
  const handleClientChange = (clientId: string | null) => {
    setFormData((prev) => ({
      ...prev,
      client_id: clientId,
      payer_id: prev.payer_id || clientId, // Auto-fill payer
    }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            service_name: formData.name,
            category: formData.category,
            service_price: formData.service_price,
            client_price: formData.client_price,
            res_status: formData.res_status || null,
            ref_nr: formData.ref_nr || null,
            service_date_from: formData.date_from || null,
            service_date_to: formData.date_to || null,
            ticket_nr: formData.ticket_nr || null,
            supplier_party_id: formData.supplier_id,
            client_party_id: formData.client_id,
            payer_party_id: formData.payer_id,
          }),
        }
      );

      if (response.ok) {
        onServiceUpdated({
          id: service.id,
          name: formData.name,
          category: formData.category,
          servicePrice: formData.service_price,
          clientPrice: formData.client_price,
          resStatus: formData.res_status || null,
          refNr: formData.ref_nr,
          ticketNr: formData.ticket_nr,
          dateFrom: formData.date_from,
          dateTo: formData.date_to,
        });
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to update service');
      }
    } catch (err) {
      console.error('Update error:', err);
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Edit Service</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic Info Card */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Basic Info
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Select category</option>
                  <option value="Flight">🛫 Flight</option>
                  <option value="Hotel">🏨 Hotel</option>
                  <option value="Transfer">🚗 Transfer</option>
                  <option value="Tour">🗺️ Tour</option>
                  <option value="Insurance">🛡️ Insurance</option>
                  <option value="Visa">📄 Visa</option>
                  <option value="Rent a Car">🚙 Rent a Car</option>
                  <option value="Cruise">🚢 Cruise</option>
                  <option value="Other">📦 Other</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formData.res_status}
                  onChange={(e) =>
                    setFormData({ ...formData, res_status: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Not set</option>
                  <option value="booked">✅ Booked</option>
                  <option value="confirmed">✅ Confirmed</option>
                  <option value="changed">🟡 Changed</option>
                  <option value="rejected">🔴 Rejected</option>
                  <option value="cancelled">🚫 Cancelled</option>
                </select>
              </div>
            </div>

            {/* Name */}
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. RIX-DXB-RIX"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* Service Dates */}
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">
                Service Dates
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={formData.date_from}
                  onChange={(e) =>
                    setFormData({ ...formData, date_from: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="date"
                  value={formData.date_to}
                  onChange={(e) =>
                    setFormData({ ...formData, date_to: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Pricing
            </h3>

            <div className="grid grid-cols-3 gap-4 items-end">
              {/* Service Price */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Service Price (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.service_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_price: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Your cost</p>
              </div>

              {/* Client Price */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client Price (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.client_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      client_price: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Client pays</p>
              </div>

              {/* Margin (auto-calculated) */}
              <div>
                <label className="block text-sm font-medium mb-1">Margin</label>
                <div className="px-3 py-2 bg-white border rounded-lg h-[42px] flex items-center">
                  <span
                    className={`font-semibold ${
                      margin > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    €{margin.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({marginPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Parties Card */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Parties
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Supplier
                </label>
                <DirectoryCombobox
                  value={formData.supplier_id}
                  onChange={(value) =>
                    setFormData({ ...formData, supplier_id: value })
                  }
                  placeholder="Type to search..."
                  filter={(item) => item.roles.includes('supplier')}
                  allowEmpty
                />
                <p className="text-xs text-gray-500 mt-1">Optional</p>
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client <span className="text-red-500">*</span>
                </label>
                <DirectoryCombobox
                  value={formData.client_id}
                  onChange={handleClientChange}
                  placeholder="Select client"
                  filter={(item) => item.roles.includes('client')}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Who travels</p>
              </div>

              {/* Payer */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payer <span className="text-red-500">*</span>
                </label>
                <DirectoryCombobox
                  value={formData.payer_id}
                  onChange={(value) =>
                    setFormData({ ...formData, payer_id: value })
                  }
                  placeholder="Select payer"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Who pays</p>
              </div>
            </div>
          </div>

          {/* References Card */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              References
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Ref Nr */}
              <div>
                <label className="block text-sm font-medium mb-1">Ref Nr</label>
                <input
                  type="text"
                  value={formData.ref_nr}
                  onChange={(e) =>
                    setFormData({ ...formData, ref_nr: e.target.value })
                  }
                  placeholder="e.g. ABC123"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Booking reference</p>
              </div>

              {/* Ticket Nr */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Ticket Nr
                </label>
                <input
                  type="text"
                  value={formData.ticket_nr}
                  onChange={(e) =>
                    setFormData({ ...formData, ticket_nr: e.target.value })
                  }
                  placeholder="e.g. 1234567890123"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">For flights/tours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save Service'}
          </button>
        </div>
      </div>
    </div>
  );
}
