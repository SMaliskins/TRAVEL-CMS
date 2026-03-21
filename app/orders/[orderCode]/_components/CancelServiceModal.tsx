'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FlightSegment } from '@/components/FlightItineraryInput';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { formatDateDDMMYYYY } from '@/utils/dateFormat';

export type CancellationRefundType = 'fully_refunded' | 'partial_refunded' | 'non_refunded';

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
  client?: string | null;
  clientPartyId?: string | null;
  payer?: string | null;
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
  useModalOverlay();
  const [step, setStep] = useState<1 | 2>(1);
  const [refundType, setRefundType] = useState<CancellationRefundType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refundAmount, setRefundAmount] = useState<string>(service.servicePrice.toFixed(2));
  const [cancellationFee, setCancellationFee] = useState<string>('0');
  const [roundToWhole, setRoundToWhole] = useState(false);

  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  const prevRefundTypeRef = useRef<CancellationRefundType | null>(null);
  useEffect(() => {
    if (refundType === null) return;
    if (refundType !== prevRefundTypeRef.current) {
      prevRefundTypeRef.current = refundType;
      if (refundType === 'fully_refunded') {
        setRefundAmount(service.servicePrice.toFixed(2));
        setCancellationFee('0');
      } else if (refundType === 'partial_refunded') {
        setRefundAmount(service.servicePrice.toFixed(2));
        setCancellationFee('0');
      } else if (refundType === 'non_refunded') {
        setRefundAmount('0');
        setCancellationFee('0');
      }
    }
  }, [refundType, service.servicePrice, service.clientPrice]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const refund = parseFloat(refundAmount) || 0;
      const ourReturn = parseFloat(cancellationFee) || 0;
      const creditToClient = roundToWhole ? Math.round(refund + ourReturn) : refund + ourReturn;
      const apiCancellationFee = refund - creditToClient;

      const cloneRes = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            cloneFromServiceId: service.id,
            cancellationRefundType: refundType,
            refundAmount: refund,
            cancellationFee: apiCancellationFee,
          }),
        }
      );
      if (!cloneRes.ok) {
        const errData = await cloneRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create cancellation record');
      }

      const updateResponse = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ res_status: 'cancelled' }),
        }
      );
      if (!updateResponse.ok) {
        throw new Error('Failed to mark original service as cancelled');
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

  const refundNum = parseFloat(refundAmount) || 0;
  const ourReturnNum = parseFloat(cancellationFee) || 0;
  const marge = Math.max(0, service.clientPrice - service.servicePrice);
  const supplierRetention = service.servicePrice - refundNum;
  const clientCreditRaw = refundNum + ourReturnNum;
  const clientCredit = roundToWhole ? Math.round(clientCreditRaw) : clientCreditRaw;
  const isCredit = clientCredit > 0;

  const applyOurReturnPercent = (pct: number) => {
    const amount = Math.round(marge * (pct / 100) * 100) / 100;
    setCancellationFee(amount.toFixed(2));
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div ref={trapRef} role="dialog" aria-modal="true" className="w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
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
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Service to Cancel</h3>
            <div className="text-sm font-medium text-gray-900">{service.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(service.dateFrom || '')} — {formatDate(service.dateTo || '')}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              <span className="text-gray-600">Cost: <span className="font-medium">{service.servicePrice.toFixed(2)} EUR</span></span>
              <span className="text-gray-600">Client paid: <span className="font-medium">{service.clientPrice.toFixed(2)} EUR</span></span>
              <span className="text-gray-600">Marge: <span className="font-medium">{marge.toFixed(2)} EUR</span></span>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Refund type</h3>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => { setRefundType('fully_refunded'); setStep(2); }}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-green-400 hover:bg-green-50/50 text-left transition-colors"
                >
                  <span className="text-lg">✓</span>
                  <div>
                    <span className="font-medium text-gray-900">Fully refunded</span>
                    <p className="text-xs text-gray-500">Supplier refunds full amount</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setRefundType('partial_refunded'); setStep(2); }}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-colors"
                >
                  <span className="text-lg">◐</span>
                  <div>
                    <span className="font-medium text-gray-900">Partial refund</span>
                    <p className="text-xs text-gray-500">Part refund from supplier, part retained</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setRefundType('non_refunded'); setStep(2); }}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/30 text-left transition-colors"
                >
                  <span className="text-lg">✕</span>
                  <div>
                    <span className="font-medium text-gray-900">Non-refunded</span>
                    <p className="text-xs text-gray-500">No refund from supplier</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 2 && refundType && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cancellation details</h3>
                <button type="button" onClick={() => setStep(1)} className="text-xs text-blue-600 hover:underline">
                  Change type
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Refund from supplier (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    onInput={(e) => setRefundAmount((e.target as HTMLInputElement).value)}
                    disabled={refundType === 'non_refunded'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Supplier retention</span>
                  <span className="font-medium">{supplierRetention.toFixed(2)} EUR</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Our return / contribution (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cancellationFee}
                    onChange={(e) => setCancellationFee(e.target.value)}
                    onInput={(e) => setCancellationFee((e.target as HTMLInputElement).value)}
                    disabled={refundType === 'non_refunded'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
                  />
                  {refundType !== 'non_refunded' && marge > 0 && (
                    <div className="mt-2">
                      <span className="text-[11px] text-gray-500 block mb-1.5">% of Marge (we add to refund):</span>
                      <div className="flex flex-wrap gap-2">
                        {[20, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => applyOurReturnPercent(pct)}
                            className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-red-500"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roundToWhole}
                    onChange={(e) => setRoundToWhole(e.target.checked)}
                    disabled={refundType === 'non_refunded'}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Round payout to whole numbers</span>
                </label>
                <div className={`p-3 rounded-lg border ${isCredit ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Credit to client (refund)</span>
                    <span className={`text-sm font-semibold ${isCredit ? 'text-green-700' : 'text-gray-700'}`}>
                      {roundToWhole ? clientCredit : clientCredit.toFixed(2)} EUR
                    </span>
                  </div>
                  {isCredit && (
                    <p className="text-xs text-gray-500 mt-1">
                      A credit note will be issued and closed with a refund payment to the client; balance will be settled.
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {step === 2 && refundType && (
          <div className="sticky bottom-0 bg-gray-50 border-t px-4 py-3 flex justify-between items-center">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <> <span className="animate-spin">...</span> Processing... </>
              ) : (
                <> Confirm cancellation </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
