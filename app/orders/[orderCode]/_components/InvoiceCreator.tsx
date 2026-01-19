"use client";

import React, { useState, useMemo } from "react";

interface Service {
  id: string;
  name: string;
  clientPrice: number;
  category: string;
  dateFrom?: string;
  dateTo?: string;
}

interface InvoiceCreatorProps {
  orderCode: string;
  clientName: string | null;
  selectedServices: Service[];
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InvoiceCreator({
  orderCode,
  clientName,
  selectedServices,
  onClose,
  onSuccess,
}: InvoiceCreatorProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${orderCode}-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14); // Default: 14 days
    return date.toISOString().split('T')[0];
  });
  const [clientNameEditable, setClientNameEditable] = useState(clientName || "");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0); // VAT %

  const subtotal = useMemo(() => 
    selectedServices.reduce((sum, s) => sum + s.clientPrice, 0),
    [selectedServices]
  );

  const taxAmount = useMemo(() => 
    (subtotal * taxRate) / 100,
    [subtotal, taxRate]
  );

  const total = useMemo(() => 
    subtotal + taxAmount,
    [subtotal, taxAmount]
  );

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!clientNameEditable.trim()) {
      alert('Please enter client name');
      return;
    }

    if (selectedServices.length === 0) {
      alert('Please select at least one service');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: invoiceNumber,
          client_name: clientNameEditable,
          client_address: clientAddress,
          client_email: clientEmail,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          status: 'draft',
          notes,
          items: selectedServices.map((s) => ({
            service_id: s.id,
            service_name: s.name,
            service_category: s.category,
            service_date_from: s.dateFrom,
            service_date_to: s.dateTo,
            quantity: 1,
            unit_price: s.clientPrice,
            line_total: s.clientPrice,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }

      alert('✅ Invoice created successfully!');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      alert(`Failed to create invoice: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* LEFT PANEL: Invoice Form */}
      <div className="space-y-6 overflow-y-auto pr-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close invoice creator"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Invoice Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Invoice Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Code</label>
              <input
                type="text"
                value={orderCode}
                disabled
                className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Client Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Bill To</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              value={clientNameEditable}
              onChange={(e) => setClientNameEditable(e.target.value)}
              placeholder="Client name"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="Client address"
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Services List */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Services ({selectedServices.length})</h3>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{service.name}</div>
                  <div className="text-xs text-gray-500">{service.category}</div>
                </div>
                <div className="text-right font-semibold text-gray-900">{formatCurrency(service.clientPrice)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tax & Totals */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Tax & Total</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
              step="0.1"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT ({taxRate}%):</span>
              <span className="font-semibold">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or payment terms..."
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 sticky bottom-0 bg-gray-50 p-4 -mx-4 border-t">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Save & Issue Invoice
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Live Preview */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Live Preview</span>
          <button
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => alert('Print/PDF export coming soon')}
          >
            Export PDF
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto h-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {/* Invoice Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">INVOICE</h1>
            <div className="text-sm text-gray-600">
              <div><strong>Invoice #:</strong> {invoiceNumber || "-"}</div>
              <div><strong>Date:</strong> {formatDate(invoiceDate)}</div>
              <div><strong>Due Date:</strong> {formatDate(dueDate)}</div>
            </div>
          </div>

          {/* From/To Section */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">From</h3>
              <div className="text-sm text-gray-900">
                <div className="font-semibold">Your Company Name</div>
                <div className="text-gray-600 mt-1">
                  Your Address<br />
                  City, Country<br />
                  contact@company.com
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
              <div className="text-sm text-gray-900">
                <div className="font-semibold">{clientNameEditable || "-"}</div>
                {clientAddress && (
                  <div className="text-gray-600 mt-1 whitespace-pre-line">{clientAddress}</div>
                )}
                {clientEmail && (
                  <div className="text-gray-600 mt-1">{clientEmail}</div>
                )}
              </div>
            </div>
          </div>

          {/* Services Table */}
          <div className="mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 font-semibold text-gray-700">Service</th>
                  <th className="text-left py-2 font-semibold text-gray-700">Category</th>
                  <th className="text-right py-2 font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedServices.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-gray-400 italic">
                      No services selected
                    </td>
                  </tr>
                ) : (
                  selectedServices.map((service, idx) => (
                    <tr key={service.id} className={idx < selectedServices.length - 1 ? "border-b border-gray-200" : ""}>
                      <td className="py-2 text-gray-900">{service.name}</td>
                      <td className="py-2 text-gray-600">{service.category}</td>
                      <td className="py-2 text-right text-gray-900">{formatCurrency(service.clientPrice)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT ({taxRate}%):</span>
                  <span className="text-gray-900 font-semibold">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-2">
                <span>Total:</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h4>
              <p className="text-sm text-gray-700 whitespace-pre-line">{notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
