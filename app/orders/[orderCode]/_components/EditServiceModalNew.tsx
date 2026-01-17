'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PartySelect from '@/components/PartySelect';
import DateRangePicker from '@/components/DateRangePicker';
import FlightItineraryInput, { FlightSegment } from '@/components/FlightItineraryInput';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';

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
  supplierPartyId?: string | null;
  clientPartyId?: string | null;
  payerPartyId?: string | null;
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

interface EditServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onServiceUpdated: (updated: Partial<Service> & { id: string }) => void;
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

const RES_STATUS_OPTIONS = [
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "changed", label: "Changed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function EditServiceModalNew({
  service,
  orderCode,
  onClose,
  onServiceUpdated,
}: EditServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - initialized from service
  const [category, setCategory] = useState(service.category);
  const [serviceName, setServiceName] = useState(service.name);
  const [dateFrom, setDateFrom] = useState<string | undefined>(service.dateFrom || undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(service.dateTo || undefined);
  const [supplierPartyId, setSupplierPartyId] = useState<string | null>(service.supplierPartyId || null);
  const [supplierName, setSupplierName] = useState(service.supplier || "");
  
  // Client (single for now, matching service structure)
  interface ClientEntry {
    id: string | null;
    name: string;
  }
  const [clients, setClients] = useState<ClientEntry[]>([
    { id: service.clientPartyId || null, name: service.client || "" }
  ]);
  
  const [payerPartyId, setPayerPartyId] = useState<string | null>(service.payerPartyId || null);
  const [payerName, setPayerName] = useState(service.payer || "");
  const [servicePrice, setServicePrice] = useState(String(service.servicePrice || 0));
  const [clientPrice, setClientPrice] = useState(String(service.clientPrice || 0));
  const [resStatus, setResStatus] = useState(service.resStatus || "booked");
  const [refNr, setRefNr] = useState(service.refNr || "");
  const [ticketNr, setTicketNr] = useState(service.ticketNr || "");
  
  // Hotel-specific fields
  const [hotelName, setHotelName] = useState(service.hotelName || "");
  const [hotelAddress, setHotelAddress] = useState(service.hotelAddress || "");
  const [hotelPhone, setHotelPhone] = useState(service.hotelPhone || "");
  const [hotelEmail, setHotelEmail] = useState(service.hotelEmail || "");
  
  // Transfer-specific fields
  const [pickupLocation, setPickupLocation] = useState(service.pickupLocation || "");
  const [dropoffLocation, setDropoffLocation] = useState(service.dropoffLocation || "");
  const [pickupTime, setPickupTime] = useState(service.pickupTime || "");
  const [estimatedDuration, setEstimatedDuration] = useState(service.estimatedDuration || "");
  const [linkedFlightId, setLinkedFlightId] = useState<string | null>(service.linkedFlightId || null);
  
  // Flight-specific fields
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>(service.flightSegments || []);

  // ESC key handler
  useEscapeKey(onClose);
  
  // Client management functions
  const addClient = () => {
    setClients([...clients, { id: null, name: "" }]);
  };
  
  const updateClient = (index: number, id: string | null, name: string) => {
    const updated = [...clients];
    updated[index] = { id, name };
    setClients(updated);
  };
  
  const removeClient = (index: number) => {
    if (clients.length <= 1) return;
    setClients(clients.filter((_, i) => i !== index));
  };

  // Determine which fields to show based on category
  const showTicketNr = category === "Flight";
  const showHotelFields = category === "Hotel";
  const showTransferFields = category === "Transfer";
  const showFlightItinerary = category === "Flight";

  const handleSave = async () => {
    if (!serviceName.trim()) {
      setError("Service name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const primaryClient = clients.find(c => c.id) || clients[0];

      const payload: Record<string, unknown> = {
        category,
        service_name: serviceName.trim(),
        service_date_from: dateFrom || null,
        service_date_to: dateTo || dateFrom || null,
        supplier_party_id: supplierPartyId,
        supplier_name: supplierName,
        clientPartyId: primaryClient?.id || null,
        client_name: primaryClient?.name || "",
        payerPartyId: payerPartyId,
        payer_name: payerName,
        service_price: parseFloat(servicePrice) || 0,
        client_price: parseFloat(clientPrice) || 0,
        res_status: resStatus || "booked",
        ref_nr: refNr || null,
        ticket_nr: showTicketNr ? ticketNr : null,
      };

      // Add hotel-specific fields
      if (showHotelFields) {
        payload.hotel_name = hotelName;
        payload.hotel_address = hotelAddress;
        payload.hotel_phone = hotelPhone;
        payload.hotel_email = hotelEmail;
      }

      // Add transfer-specific fields
      if (showTransferFields) {
        payload.pickup_location = pickupLocation;
        payload.dropoff_location = dropoffLocation;
        payload.pickup_time = pickupTime;
        payload.estimated_duration = estimatedDuration;
        payload.linked_flight_id = linkedFlightId;
      }

      // Add flight-specific fields
      if (showFlightItinerary && flightSegments.length > 0) {
        payload.flight_segments = flightSegments;
      }

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
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        onServiceUpdated({
          id: service.id,
          name: serviceName,
          category,
          servicePrice: parseFloat(servicePrice) || 0,
          clientPrice: parseFloat(clientPrice) || 0,
          resStatus,
          refNr,
          ticketNr,
          dateFrom,
          dateTo,
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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Service</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
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
                placeholder="Service description..."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Dates with range calendar picker */}
          <DateRangePicker
            label="Service Dates"
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />

          {/* Row 3: Supplier */}
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

          {/* Row 4: Clients + Payer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">
                  Client{clients.length > 1 ? "s" : ""}
                </label>
                <button
                  type="button"
                  onClick={addClient}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {clients.map((client, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <PartySelect
                        value={client.id}
                        onChange={(id, name) => updateClient(index, id, name)}
                        // roleFilter="client" - removed to allow any party
                        initialDisplayName={client.name}
                      />
                    </div>
                    {clients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeClient(index)}
                        className="px-2 text-red-500 hover:text-red-700"
                        title="Remove client"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payer</label>
              <PartySelect
                value={payerPartyId}
                onChange={(id, name) => {
                  setPayerPartyId(id);
                  setPayerName(name);
                }}
                // roleFilter="client" - removed to allow any party
                initialDisplayName={payerName}
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

          {/* Row 6: Status + References */}
          <div className={`grid gap-4 ${showTicketNr ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Res Status</label>
              <select
                value={resStatus}
                onChange={(e) => setResStatus(e.target.value)}
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
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
