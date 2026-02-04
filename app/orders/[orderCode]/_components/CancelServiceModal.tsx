'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FlightSegment } from '@/components/FlightItineraryInput';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { formatDateDDMMYYYY } from '@/utils/dateFormat';

interface Service {
  id: string;
  name: string;
  category: string;
  servicePrice: number;
  clientPrice: number;
  resStatus: string | null;
  refNr?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  supplier?: string | null;
  supplierPartyId?: string | null;
  clientPartyId?: string | null;
  payerPartyId?: string | null;
  flightSegments?: FlightSegment[];
}

interface CancelServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onCancellationConfirmed: () => void;
}

export default function CancelServiceModal({
  service,
  orderCode,
  onClose,
  onCancellationConfirmed,
}: CancelServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cancellation fees
  const [refundAmount, setRefundAmount] = useState<string>(service.servicePrice.toFixed(2));
  const [cancellationFee, setCancellationFee] = useState<string>('0');
  const [clientPrice, setClientPrice] = useState<string>('0');
  
  useEscapeKey(onClose);
  
  // Auto-calculate client price based on refund and fee
  useEffect(() => {
    const refund = parseFloat(refundAmount) || 0;
    const fee = parseFloat(cancellationFee) || 0;
    // Client price = what client pays (positive) or receives back (negative)
    // If refund > original client price, client gets money back (negative)
    // Formula: Original client price - Refund + Cancellation Fee
    const originalClientPrice = service.clientPrice;
    const calculatedClientPrice = -refund + fee; // Negative = credit to client
    setClientPrice(calculatedClientPrice.toFixed(2));
  }, [refundAmount, cancellationFee, service.clientPrice]);
  
  // Submit cancellation
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Update original service status to 'cancelled'
      const updateResponse = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            res_status: 'cancelled',
          }),
        }
      );
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update original service status');
      }
      
      // 2. Create cancellation service (only if there are fees/refunds)
      const refund = parseFloat(refundAmount) || 0;
      const fee = parseFloat(cancellationFee) || 0;
      const clientPriceNum = parseFloat(clientPrice) || 0;
      
      if (refund !== 0 || fee !== 0 || clientPriceNum !== 0) {
        const cancellationServicePayload = {
          serviceName: `Cancellation: ${service.name}`,
          category: service.category,
          dateFrom: service.dateFrom,
          dateTo: service.dateTo,
          supplierPartyId: service.supplierPartyId,
          supplierName: service.supplier,
          clientPartyId: service.clientPartyId,
          payerPartyId: service.payerPartyId,
          servicePrice: -refund, // Negative = money back from supplier
          clientPrice: clientPriceNum, // Negative = credit to client
          resStatus: 'confirmed',
          refNr: service.refNr,
          // Amendment fields
          parentServiceId: service.id,
          serviceType: 'cancellation',
          cancellationFee: fee,
          refundAmount: refund,
        };
        
        const createResponse = await fetch(
          `/api/orders/${encodeURIComponent(orderCode)}/services`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify(cancellationServicePayload),
          }
        );
        
        if (!createResponse.ok) {
          const errData = await createResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create cancellation service');
        }
      }
      
      onCancellationConfirmed();
      onClose();
    } catch (err) {
      console.error('Cancel service error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process cancellation');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatDate = (dateStr: string) => formatDateDDMMYYYY(dateStr || null);
  
  const clientPriceNum = parseFloat(clientPrice) || 0;
  const isCredit = clientPriceNum < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Cancel Service</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Service Info */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Service to Cancel</h3>
            <div className="text-sm font-medium text-gray-900">{service.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(service.dateFrom || '')} - {formatDate(service.dateTo || '')}
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-gray-600">Original Cost: <span className="font-medium">{service.servicePrice.toFixed(2)} EUR</span></span>
              <span className="text-gray-600">Client Price: <span className="font-medium">{service.clientPrice.toFixed(2)} EUR</span></span>
            </div>
          </div>
          
          {/* Cancellation Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cancellation Details</h3>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Refund Amount from Supplier</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Amount refunded by supplier/airline</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cancellation Fee</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={cancellationFee}
                  onChange={(e) => setCancellationFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Your agency fee for handling cancellation</p>
            </div>
            
            <div className={`p-3 rounded-lg border ${isCredit ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Price (calculated)</label>
              <div className="text-lg font-semibold">
                <span className={isCredit ? 'text-green-700' : 'text-amber-700'}>
                  {clientPriceNum.toFixed(2)} EUR
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isCredit 
                  ? 'Credit to client (refund to issue)' 
                  : clientPriceNum === 0 
                    ? 'No charge or refund' 
                    : 'Client pays this amount'}
              </p>
            </div>
          </div>
          
          {/* Summary */}
          <div className="p-3 bg-gray-100 rounded-lg text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>Original client paid:</span>
              <span className="font-medium">{service.clientPrice.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between">
              <span>Refund from supplier:</span>
              <span className="font-medium text-green-600">+{parseFloat(refundAmount || '0').toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between">
              <span>Cancellation fee:</span>
              <span className="font-medium text-red-600">-{parseFloat(cancellationFee || '0').toFixed(2)} EUR</span>
            </div>
            <div className="border-t border-gray-300 pt-1 mt-1 flex justify-between font-medium">
              <span>Net to client:</span>
              <span className={isCredit ? 'text-green-700' : 'text-amber-700'}>
                {Math.abs(clientPriceNum).toFixed(2)} EUR {isCredit ? '(credit)' : '(charge)'}
              </span>
            </div>
          </div>
          
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-4 py-3 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">...</span>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Cancellation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
