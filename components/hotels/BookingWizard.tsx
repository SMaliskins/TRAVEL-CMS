"use client";

import { useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  ShieldCheck,
  ShieldX,
  Bed,
  X,
} from "lucide-react";
import { ProviderBadge } from "./ProviderBadge";
import type {
  NormalizedRate,
  AggregatedHotel,
  ValuationResult,
} from "@/lib/providers/types";

interface BookingWizardProps {
  rate: NormalizedRate;
  hotel: AggregatedHotel;
  checkIn: string;
  checkOut: string;
  onComplete: (result: BookingWizardResult) => void;
  onCancel: () => void;
}

export interface BookingWizardResult {
  bookingCode: string;
  status: string;
  hotelConfirmation?: string;
}

interface GuestInfo {
  firstName: string;
  lastName: string;
  nationality: string;
  email: string;
  phone: string;
}

const STEPS = [
  { label: "Rate Summary", num: 1 },
  { label: "Guest Details", num: 2 },
  { label: "Confirm Price", num: 3 },
  { label: "Confirmation", num: 4 },
] as const;

export function BookingWizard({
  rate,
  hotel,
  checkIn,
  checkOut,
  onComplete,
  onCancel,
}: BookingWizardProps) {
  const [step, setStep] = useState(1);
  const [guest, setGuest] = useState<GuestInfo>({
    firstName: "",
    lastName: "",
    nationality: "",
    email: "",
    phone: "",
  });
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [valuating, setValuating] = useState(false);
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState<BookingWizardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGuestValid =
    guest.firstName.trim() !== "" &&
    guest.lastName.trim() !== "" &&
    guest.email.trim() !== "";

  const handleValuate = useCallback(async () => {
    if (!rate.requiresValuation) {
      setValuation({
        available: true,
        totalPrice: rate.totalPrice,
        currency: rate.currency,
        cancellationDeadline: rate.freeCancellationBefore,
        remarks: [],
        rateDetails: {},
      });
      return;
    }

    setValuating(true);
    setError(null);
    try {
      const res = await fetch("/api/hotels/valuate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateId: rate.rateId,
          provider: rate.provider,
          checkIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Valuation failed");
      setValuation(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Valuation failed");
    } finally {
      setValuating(false);
    }
  }, [rate, checkIn]);

  const handleBook = useCallback(async () => {
    setBooking(true);
    setError(null);
    try {
      const res = await fetch("/api/hotels/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateId: rate.rateId,
          provider: rate.provider,
          checkIn,
          checkOut,
          rooms: [
            {
              adults: [
                { firstName: guest.firstName, lastName: guest.lastName },
              ],
            },
          ],
          nationality: guest.nationality,
          email: guest.email,
          phone: guest.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      const bookingResult: BookingWizardResult = {
        bookingCode: data.data.bookingCode,
        status: data.data.status,
        hotelConfirmation: data.data.hotelConfirmation,
      };
      setResult(bookingResult);
      setStep(4);
      onComplete(bookingResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  }, [rate, checkIn, checkOut, guest, onComplete]);

  const goNext = useCallback(async () => {
    if (step === 2 && !isGuestValid) return;
    if (step === 2) {
      setStep(3);
      handleValuate();
      return;
    }
    if (step === 3) {
      handleBook();
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  }, [step, isGuestValid, handleValuate, handleBook]);

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const isFree = rate.cancellationType === "free";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-lg mx-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 px-6 pt-6 pb-4">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step > s.num ? "bg-emerald-500 text-white" : ""}
                  ${step === s.num ? "bg-indigo-500 text-white ring-4 ring-indigo-100" : ""}
                  ${step < s.num ? "bg-slate-100 text-slate-400" : ""}`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 rounded transition-colors ${
                    step > s.num ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mb-4">
          {STEPS[step - 1].label}
        </p>

        {/* Step content */}
        <div className="px-6 pb-6 min-h-[300px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-slate-800">
                    {hotel.name}
                  </h4>
                  <ProviderBadge provider={rate.provider} size="md" />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Bed className="w-4 h-4 text-slate-400" />
                  {rate.roomName}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {isFree ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600">Free cancellation</span>
                    </>
                  ) : (
                    <>
                      <ShieldX className="w-4 h-4 text-red-400" />
                      <span className="text-red-500">Non-refundable</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-sm text-slate-500">
                    {checkIn} — {checkOut}
                  </span>
                  <span className="text-xl font-bold text-slate-800">
                    {rate.currency} {rate.totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    First Name *
                  </label>
                  <input
                    value={guest.firstName}
                    onChange={(e) =>
                      setGuest({ ...guest, firstName: e.target.value })
                    }
                    className="booking-input"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Last Name *
                  </label>
                  <input
                    value={guest.lastName}
                    onChange={(e) =>
                      setGuest({ ...guest, lastName: e.target.value })
                    }
                    className="booking-input"
                    placeholder="Smith"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nationality
                </label>
                <input
                  value={guest.nationality}
                  onChange={(e) =>
                    setGuest({ ...guest, nationality: e.target.value })
                  }
                  className="booking-input"
                  placeholder="e.g. US, GB, DE"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={guest.email}
                  onChange={(e) =>
                    setGuest({ ...guest, email: e.target.value })
                  }
                  className="booking-input"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={guest.phone}
                  onChange={(e) =>
                    setGuest({ ...guest, phone: e.target.value })
                  }
                  className="booking-input"
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {valuating && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="text-sm text-slate-500">
                    Confirming price with {rate.provider}…
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                  {error}
                </div>
              )}

              {valuation && !valuating && (
                <div className="space-y-3">
                  {!valuation.available ? (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                      This rate is no longer available. Please go back and select
                      another option.
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <p className="text-sm font-semibold text-emerald-700 mb-1">
                          Price confirmed
                        </p>
                        <p className="text-2xl font-bold text-emerald-800">
                          {valuation.currency}{" "}
                          {valuation.totalPrice.toLocaleString()}
                        </p>
                        {valuation.totalPrice !== rate.totalPrice && (
                          <p className="text-xs text-emerald-600 mt-1">
                            Original estimate: {rate.currency}{" "}
                            {rate.totalPrice.toLocaleString()}
                          </p>
                        )}
                      </div>
                      {valuation.remarks.length > 0 && (
                        <div className="space-y-1">
                          {valuation.remarks.map((r, i) => (
                            <p key={i} className="text-xs text-slate-500">
                              • {r}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 4 && result && (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Booking {result.status === "confirmed" ? "Confirmed" : "Pending"}
              </h3>
              <div className="w-full space-y-2 p-4 rounded-xl bg-slate-50">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Booking Code</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {result.bookingCode}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span
                    className={`font-semibold capitalize ${
                      result.status === "confirmed"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
                {result.hotelConfirmation && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">
                      Hotel Confirmation
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {result.hotelConfirmation}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white/80">
          {step > 1 && step < 4 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={
                (step === 2 && !isGuestValid) ||
                (step === 3 && (valuating || !valuation?.available)) ||
                booking
              }
              className="booking-btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
            >
              {booking && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 3 ? "Confirm Booking" : "Next"}
              {!booking && step < 3 && <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <button onClick={onCancel} className="booking-btn-primary">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
