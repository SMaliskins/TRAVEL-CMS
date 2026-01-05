"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import PartySelect from "@/components/PartySelect";
import DateRangePicker from "@/components/DateRangePicker";
import FlightItineraryInput, { FlightSegment } from "@/components/FlightItineraryInput";

interface AddServiceModalProps {
  orderCode: string;
  // Default client from order
  defaultClientId?: string | null;
  defaultClientName?: string;
  onClose: () => void;
  onServiceAdded: (service: ServiceData) => void;
}

export interface ServiceData {
  id: string;
  category: string;
  serviceName: string;
  dateFrom: string;
  dateTo: string;
  supplierPartyId: string | null;
  supplierName: string;
  clientPartyId: string | null;
  clientName: string;
  payerPartyId: string | null;
  payerName: string;
  servicePrice: number;
  clientPrice: number;
  resStatus: "booked" | "confirmed" | "changed" | "rejected" | "cancelled";
  refNr: string;
  ticketNr: string;
  travellerIds: string[];
  // Hotel-specific
  hotelName?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  // Transfer-specific
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  estimatedDuration?: string;
  linkedFlightId?: string;
  // Flight-specific
  flightSegments?: FlightSegment[];
}

const SERVICE_CATEGORIES = [
  "Flight",
  "Hotel",
  "Transfer",
  "Tour",
  "Insurance",
  "Visa",
  "Rent a Car",
  "Cruise",
  "Other",
];

const RES_STATUS_OPTIONS: { value: ServiceData["resStatus"]; label: string }[] = [
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "changed", label: "Changed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AddServiceModal({ 
  orderCode,
  defaultClientId,
  defaultClientName,
  onClose, 
  onServiceAdded 
}: AddServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState("Flight");
  const [serviceName, setServiceName] = useState("");
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [supplierPartyId, setSupplierPartyId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [clientPartyId, setClientPartyId] = useState<string | null>(defaultClientId || null);
  const [clientName, setClientName] = useState(defaultClientName || "");
  const [payerPartyId, setPayerPartyId] = useState<string | null>(defaultClientId || null);
  const [payerName, setPayerName] = useState(defaultClientName || "");
  const [servicePrice, setServicePrice] = useState("");
  const [clientPrice, setClientPrice] = useState("");
  const [resStatus, setResStatus] = useState<ServiceData["resStatus"]>("booked");
  const [refNr, setRefNr] = useState("");
  const [ticketNr, setTicketNr] = useState("");
  
  // Hotel-specific fields
  const [hotelName, setHotelName] = useState("");
  const [hotelAddress, setHotelAddress] = useState("");
  const [hotelPhone, setHotelPhone] = useState("");
  const [hotelEmail, setHotelEmail] = useState("");
  
  // Transfer-specific fields
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [linkedFlightId, setLinkedFlightId] = useState<string | null>(null);
  
  // Flight-specific fields
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>([]);

  // Auto-fill client/payer when defaultClient changes
  useEffect(() => {
    if (defaultClientId && defaultClientName) {
      setClientPartyId(defaultClientId);
      setClientName(defaultClientName);
      setPayerPartyId(defaultClientId);
      setPayerName(defaultClientName);
    }
  }, [defaultClientId, defaultClientName]);

  // Determine which fields to show based on category
  const showTicketNr = category === "Flight";
  const showHotelFields = category === "Hotel";
  const showTransferFields = category === "Transfer";
  const showFlightItinerary = category === "Flight";
  
  // Auto-generate service name from flight segments
  useEffect(() => {
    if (category === "Flight" && flightSegments.length > 0 && !serviceName) {
      const route = flightSegments
        .map((s) => s.departure)
        .concat(flightSegments[flightSegments.length - 1]?.arrival || "")
        .filter(Boolean)
        .join(" - ");
      if (route) {
        setServiceName(route);
      }
      
      // Auto-set dates from segments
      const firstDep = flightSegments[0]?.departureDate;
      const lastArr = flightSegments[flightSegments.length - 1]?.arrivalDate || firstDep;
      if (firstDep && !dateFrom) {
        setDateFrom(firstDep);
      }
      if (lastArr && !dateTo) {
        setDateTo(lastArr);
      }
    }
  }, [flightSegments, category, serviceName, dateFrom, dateTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serviceName.trim()) {
      setError("Service name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const payload: Record<string, unknown> = {
        category,
        serviceName: serviceName.trim(),
        dateFrom: dateFrom || null,
        dateTo: dateTo || dateFrom || null,
        supplierPartyId,
        supplierName,
        clientPartyId,
        clientName,
        payerPartyId,
        payerName,
        servicePrice: parseFloat(servicePrice) || 0,
        clientPrice: parseFloat(clientPrice) || 0,
        resStatus,
        refNr,
        ticketNr: showTicketNr ? ticketNr : "",
        travellerIds: [],
      };
      
      // Add hotel-specific fields
      if (showHotelFields) {
        payload.hotelName = hotelName;
        payload.hotelAddress = hotelAddress;
        payload.hotelPhone = hotelPhone;
        payload.hotelEmail = hotelEmail;
      }
      
      // Add transfer-specific fields
      if (showTransferFields) {
        payload.pickupLocation = pickupLocation;
        payload.dropoffLocation = dropoffLocation;
        payload.pickupTime = pickupTime;
        payload.estimatedDuration = estimatedDuration;
        payload.linkedFlightId = linkedFlightId;
      }
      
      // Add flight-specific fields
      if (showFlightItinerary && flightSegments.length > 0) {
        payload.flightSegments = flightSegments;
      }

      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        onServiceAdded(data.service);
        onClose();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || "Failed to create service");
      }
    } catch (err) {
      console.error("Create service error:", err);
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Service</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Row 1: Category + Name */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder={
                  category === "Flight" ? "e.g., Riga - Istanbul - New York - Riga" :
                  category === "Hotel" ? "e.g., Grand Hotel Rome" :
                  category === "Transfer" ? "e.g., Airport - Hotel" :
                  "Service description..."
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Dates with range calendar picker (same as order) */}
          <DateRangePicker
            label="Service Dates"
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />

          {/* Row 3: Supplier (filtered by role=supplier) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <PartySelect
              value={supplierPartyId}
              onChange={(id, name) => {
                setSupplierPartyId(id);
                setSupplierName(name);
              }}
              roleFilter="supplier"
            />
          </div>

          {/* Row 4: Client + Payer (auto-filled from order) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <PartySelect
                value={clientPartyId}
                onChange={(id, name) => {
                  setClientPartyId(id);
                  setClientName(name);
                }}
                roleFilter="client"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payer</label>
              <PartySelect
                value={payerPartyId}
                onChange={(id, name) => {
                  setPayerPartyId(id);
                  setPayerName(name);
                }}
                roleFilter="client"
              />
            </div>
          </div>

          {/* Row 5: Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Price (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={clientPrice}
                onChange={(e) => setClientPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {/* Row 6: Status + References (conditional Ticket Nr) */}
          <div className={`grid gap-4 ${showTicketNr ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Res Status</label>
              <select
                value={resStatus}
                onChange={(e) => setResStatus(e.target.value as ServiceData["resStatus"])}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {RES_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ref Nr</label>
              <input
                type="text"
                value={refNr}
                onChange={(e) => setRefNr(e.target.value)}
                placeholder="Booking reference"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
            {showTicketNr && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Nr</label>
                <input
                  type="text"
                  value={ticketNr}
                  onChange={(e) => setTicketNr(e.target.value)}
                  placeholder="e.g., 555-1234567890"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Hotel-specific fields */}
          {showHotelFields && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Hotel Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Name</label>
                  <input
                    type="text"
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
                    placeholder="e.g., Grand Hotel Rome"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={hotelAddress}
                    onChange={(e) => setHotelAddress(e.target.value)}
                    placeholder="Hotel address"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={hotelPhone}
                      onChange={(e) => setHotelPhone(e.target.value)}
                      placeholder="+39 06 1234567"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={hotelEmail}
                      onChange={(e) => setHotelEmail(e.target.value)}
                      placeholder="hotel@example.com"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flight-specific fields - Itinerary */}
          {showFlightItinerary && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Flight Itinerary</h3>
              <FlightItineraryInput
                segments={flightSegments}
                onSegmentsChange={setFlightSegments}
              />
            </div>
          )}

          {/* Transfer-specific fields */}
          {showTransferFields && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Transfer Itinerary</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      placeholder="e.g., FCO Airport Terminal 3"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dropoff Location</label>
                    <input
                      type="text"
                      value={dropoffLocation}
                      onChange={(e) => setDropoffLocation(e.target.value)}
                      placeholder="e.g., Grand Hotel Rome"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time</label>
                    <input
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Est. Duration</label>
                    <input
                      type="text"
                      value={estimatedDuration}
                      onChange={(e) => setEstimatedDuration(e.target.value)}
                      placeholder="e.g., 45 min"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link to Flight</label>
                    <select
                      value={linkedFlightId || ""}
                      onChange={(e) => setLinkedFlightId(e.target.value || null)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                    >
                      <option value="">No linked flight</option>
                      {/* TODO: Populate with flights from this order */}
                    </select>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Airport Transfer Tips:</strong><br />
                    • Arrival: Schedule pickup +15 min after landing time<br />
                    • Departure: Schedule to arrive at airport 2h 10min before flight
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
