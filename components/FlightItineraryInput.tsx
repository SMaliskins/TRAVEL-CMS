"use client";

import { useState, useRef } from "react";
// Date formatting utilities available if needed
// import { formatDateDDMMYYYY } from "@/utils/dateFormat";

export interface FlightSegment {
  id: string;
  flightNumber: string;
  airline?: string;
  departure: string; // Airport code (GVA)
  departureCity?: string; // City name (Geneva)
  departureCountry?: string; // Country code (CH)
  arrival: string; // Airport code (LHR)
  arrivalCity?: string; // City name (London)
  arrivalCountry?: string; // Country code (GB)
  departureDate: string; // YYYY-MM-DD
  departureTimeScheduled: string; // HH:mm - scheduled
  departureTimeActual?: string; // HH:mm - actual/real time
  arrivalDate: string; // YYYY-MM-DD (can be +1 day from departure)
  arrivalTimeScheduled: string; // HH:mm - scheduled
  arrivalTimeActual?: string; // HH:mm - actual/real time
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureGate?: string;
  arrivalGate?: string;
  aircraft?: string;
  duration?: string; // e.g., "1h 45m"
  departureStatus: "on_time" | "delayed" | "cancelled" | "landed" | "scheduled";
  arrivalStatus: "on_time" | "delayed" | "cancelled" | "landed" | "scheduled";
  statusNote?: string;
  // New fields
  bookingClass?: string; // e.g., "Z", "Y", "C", "F"
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  bookingRef?: string; // PNR/Booking reference
  ticketNumber?: string;
  baggage?: string; // e.g., "2PC"
  seat?: string; // e.g., "07A"
  meal?: string;
  passengerName?: string;
}

interface FlightItineraryInputProps {
  segments: FlightSegment[];
  onSegmentsChange: (segments: FlightSegment[]) => void;
  readonly?: boolean;
}

// Format date for display (06.01.2026)
function formatFlightDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Calculate flight duration from times
function calculateDuration(depTime: string, arrTime: string): string {
  if (!depTime || !arrTime) return "";
  
  const [depH, depM] = depTime.split(":").map(Number);
  const [arrH, arrM] = arrTime.split(":").map(Number);
  
  let totalMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // Next day arrival
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}h ${minutes}m`;
}

// Status text component
function StatusText({ status, time }: { status: FlightSegment["departureStatus"]; time?: string }) {
  const config = {
    on_time: { label: "On time", color: "text-green-600" },
    scheduled: { label: "Scheduled", color: "text-gray-500" },
    delayed: { label: "Delayed", color: "text-red-600" },
    cancelled: { label: "Cancelled", color: "text-red-600" },
    landed: { label: "Landed", color: "text-green-600" },
  };
  
  const { label, color } = config[status] || config.scheduled;
  
  return (
    <div className="text-right">
      <div className={`text-sm font-medium ${color}`}>{label}</div>
      {time && <div className={`text-xl font-bold ${color}`}>{time}</div>}
    </div>
  );
}

// Flight Card Component (Swiss/FlightStats style)
function FlightCard({ 
  segment, 
  onEdit, 
  onRemove,
  readonly = false,
}: { 
  segment: FlightSegment; 
  onEdit: () => void;
  onRemove: () => void;
  readonly?: boolean;
}) {
  const duration = segment.duration || calculateDuration(
    segment.departureTimeScheduled, 
    segment.arrivalTimeScheduled
  );
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header - Date and Flight Number */}
      <div className="px-5 py-4 flex items-start justify-between">
        <div className="text-gray-700 font-medium">
          {formatFlightDate(segment.departureDate)}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            {/* Airline logo placeholder - red plane icon for Swiss style */}
            <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
            <span className="font-bold text-gray-900">{segment.flightNumber}</span>
          </div>
          {segment.airline && (
            <div className="text-sm text-gray-500 mt-0.5">{segment.airline}</div>
          )}
        </div>
      </div>
      
      {/* Divider */}
      <div className="border-t border-gray-100" />
      
      {/* Route section - GVA → LHR with duration */}
      <div className="px-5 py-6">
        <div className="flex items-center justify-between">
          {/* Departure */}
          <div>
            <div className="text-3xl font-bold text-gray-900">{segment.departure}</div>
            <div className="text-sm text-gray-500 mt-1">
              {segment.departureCity || segment.departure}
            </div>
          </div>
          
          {/* Center - Plane icon and duration */}
          <div className="flex-1 flex flex-col items-center px-4">
            <svg className="h-6 w-6 text-gray-400 mb-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
            {duration && (
              <div className="text-sm text-gray-500">Duration: {duration}</div>
            )}
          </div>
          
          {/* Arrival */}
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">{segment.arrival}</div>
            <div className="text-sm text-gray-500 mt-1">
              {segment.arrivalCity || segment.arrival}
            </div>
          </div>
        </div>
      </div>
      
      {/* Time details - Scheduled vs Actual */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex justify-between">
          {/* Departure times */}
          <div>
            <StatusText 
              status={segment.departureStatus} 
              time={segment.departureTimeActual || segment.departureTimeScheduled}
            />
            <div className="mt-2">
              <div className="text-xs text-gray-500">Scheduled</div>
              <div className="text-lg font-semibold text-gray-900">
                {segment.departureTimeScheduled || "—"}
              </div>
            </div>
          </div>
          
          {/* Arrival times */}
          <div className="text-right">
            <StatusText 
              status={segment.arrivalStatus} 
              time={segment.arrivalTimeActual || segment.arrivalTimeScheduled}
            />
            <div className="mt-2">
              <div className="text-xs text-gray-500">Scheduled</div>
              <div className="text-lg font-semibold text-gray-900">
                {segment.arrivalTimeScheduled || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Booking info (if available) */}
      {(segment.cabinClass || segment.seat || segment.baggage || segment.passengerName) && (
        <div className="px-5 py-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {segment.cabinClass && (
              <span className="text-gray-700 font-medium capitalize">
                {segment.cabinClass.replace("_", " ")}
                {segment.bookingClass && ` (${segment.bookingClass})`}
              </span>
            )}
            {segment.seat && (
              <span className="text-gray-600">Seat: {segment.seat}</span>
            )}
            {segment.baggage && (
              <span className="text-gray-600">Baggage: {segment.baggage}</span>
            )}
            {segment.passengerName && (
              <span className="text-gray-600">{segment.passengerName}</span>
            )}
          </div>
        </div>
      )}
      
      {/* Terminal info (if available) */}
      {(segment.departureTerminal || segment.arrivalTerminal) && (
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between text-sm">
          <div>
            {segment.departureTerminal && (
              <span className="text-gray-600">
                Terminal {segment.departureTerminal}
                {segment.departureGate && ` • Gate ${segment.departureGate}`}
              </span>
            )}
          </div>
          <div>
            {segment.arrivalTerminal && (
              <span className="text-gray-600">
                Terminal {segment.arrivalTerminal}
                {segment.arrivalGate && ` • Gate ${segment.arrivalGate}`}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Actions */}
      {!readonly && (
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// Edit form for a segment
function SegmentEditForm({
  segment,
  onSave,
  onCancel,
}: {
  segment: FlightSegment;
  onSave: (updated: FlightSegment) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FlightSegment>(segment);
  
  const updateField = (field: keyof FlightSegment, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Edit Flight Segment</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
      
      {/* Flight info */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Airline</label>
          <input
            type="text"
            value={form.airline || ""}
            onChange={(e) => updateField("airline", e.target.value)}
            placeholder="SWISS"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Flight #</label>
          <input
            type="text"
            value={form.flightNumber}
            onChange={(e) => updateField("flightNumber", e.target.value)}
            placeholder="LX348"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={form.departureDate}
            onChange={(e) => {
              updateField("departureDate", e.target.value);
              if (!form.arrivalDate) updateField("arrivalDate", e.target.value);
            }}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Duration</label>
          <input
            type="text"
            value={form.duration || ""}
            onChange={(e) => updateField("duration", e.target.value)}
            placeholder="1h 45m"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      
      {/* Departure */}
      <div>
        <div className="text-xs font-medium text-gray-700 mb-2">DEPARTURE</div>
        <div className="grid grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Airport</label>
            <input
              type="text"
              value={form.departure}
              onChange={(e) => updateField("departure", e.target.value.toUpperCase())}
              placeholder="GVA"
              maxLength={3}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              type="text"
              value={form.departureCity || ""}
              onChange={(e) => updateField("departureCity", e.target.value)}
              placeholder="Geneva"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Scheduled</label>
            <input
              type="time"
              value={form.departureTimeScheduled}
              onChange={(e) => updateField("departureTimeScheduled", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Actual</label>
            <input
              type="time"
              value={form.departureTimeActual || ""}
              onChange={(e) => updateField("departureTimeActual", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={form.departureStatus}
              onChange={(e) => updateField("departureStatus", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="scheduled">Scheduled</option>
              <option value="on_time">On Time</option>
              <option value="delayed">Delayed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Terminal</label>
            <input
              type="text"
              value={form.departureTerminal || ""}
              onChange={(e) => updateField("departureTerminal", e.target.value)}
              placeholder="1"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Arrival */}
      <div>
        <div className="text-xs font-medium text-gray-700 mb-2">ARRIVAL</div>
        <div className="grid grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Airport</label>
            <input
              type="text"
              value={form.arrival}
              onChange={(e) => updateField("arrival", e.target.value.toUpperCase())}
              placeholder="LHR"
              maxLength={3}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              type="text"
              value={form.arrivalCity || ""}
              onChange={(e) => updateField("arrivalCity", e.target.value)}
              placeholder="London Heathrow"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Scheduled</label>
            <input
              type="time"
              value={form.arrivalTimeScheduled}
              onChange={(e) => updateField("arrivalTimeScheduled", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Actual</label>
            <input
              type="time"
              value={form.arrivalTimeActual || ""}
              onChange={(e) => updateField("arrivalTimeActual", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={form.arrivalStatus}
              onChange={(e) => updateField("arrivalStatus", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="scheduled">Scheduled</option>
              <option value="on_time">On Time</option>
              <option value="delayed">Delayed</option>
              <option value="cancelled">Cancelled</option>
              <option value="landed">Landed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Terminal</label>
            <input
              type="text"
              value={form.arrivalTerminal || ""}
              onChange={(e) => updateField("arrivalTerminal", e.target.value)}
              placeholder="2"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>
      
      {/* Booking Details */}
      <div>
        <div className="text-xs font-medium text-gray-700 mb-2">BOOKING DETAILS</div>
        <div className="grid grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cabin Class</label>
            <select
              value={form.cabinClass || ""}
              onChange={(e) => updateField("cabinClass", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">-</option>
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fare Class</label>
            <input
              type="text"
              value={form.bookingClass || ""}
              onChange={(e) => updateField("bookingClass", e.target.value.toUpperCase())}
              placeholder="Z"
              maxLength={2}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Booking Ref</label>
            <input
              type="text"
              value={form.bookingRef || ""}
              onChange={(e) => updateField("bookingRef", e.target.value.toUpperCase())}
              placeholder="ZBBVXE"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Seat</label>
            <input
              type="text"
              value={form.seat || ""}
              onChange={(e) => updateField("seat", e.target.value.toUpperCase())}
              placeholder="07A"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Baggage</label>
            <input
              type="text"
              value={form.baggage || ""}
              onChange={(e) => updateField("baggage", e.target.value)}
              placeholder="2PC"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Passenger</label>
            <input
              type="text"
              value={form.passengerName || ""}
              onChange={(e) => updateField("passengerName", e.target.value)}
              placeholder="SMITH/JOHN MR"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlightItineraryInput({
  segments,
  onSegmentsChange,
  readonly = false,
}: FlightItineraryInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload (images and PDFs)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";
    
    if (!isImage && !isPDF) {
      setParseError("Please upload an image or PDF file");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      if (isPDF) {
        // For PDF, we send it to AI for parsing
        await parsePDFWithAI(file);
      } else {
        // For images, show preview and parse
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
        await parseImageWithAI(file);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setParseError("Failed to process file");
    } finally {
      setIsUploading(false);
    }
  };
  
  // Parse PDF with AI
  const parsePDFWithAI = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "pdf");
      
      const response = await fetch("/api/ai/parse-flight-itinerary", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse PDF");
      }
      
      const data = await response.json();
      
      if (data.segments && data.segments.length > 0) {
        // Map API response to FlightSegment format
        const newSegments: FlightSegment[] = data.segments.map((seg: Record<string, unknown>, idx: number) => ({
          id: `seg-${Date.now()}-${idx}`,
          flightNumber: seg.flightNumber || "",
          airline: seg.airline,
          departure: seg.departure || seg.departureAirport || "",
          departureCity: seg.departureCity,
          departureCountry: seg.departureCountry,
          arrival: seg.arrival || seg.arrivalAirport || "",
          arrivalCity: seg.arrivalCity,
          arrivalCountry: seg.arrivalCountry,
          departureDate: seg.departureDate || "",
          departureTimeScheduled: seg.departureTime || seg.departureTimeScheduled || "",
          arrivalDate: seg.arrivalDate || seg.departureDate || "",
          arrivalTimeScheduled: seg.arrivalTime || seg.arrivalTimeScheduled || "",
          departureTerminal: seg.departureTerminal,
          arrivalTerminal: seg.arrivalTerminal,
          aircraft: seg.aircraft,
          duration: seg.duration,
          cabinClass: seg.cabinClass,
          bookingClass: seg.bookingClass,
          bookingRef: seg.bookingRef,
          ticketNumber: seg.ticketNumber,
          baggage: seg.baggage,
          seat: seg.seat,
          passengerName: seg.passengerName,
          departureStatus: "scheduled",
          arrivalStatus: "scheduled",
        }));
        
        onSegmentsChange([...segments, ...newSegments]);
      } else {
        setParseError("Could not extract flight information from PDF");
      }
    } catch (err) {
      console.error("PDF parse error:", err);
      setParseError(err instanceof Error ? err.message : "Failed to parse PDF");
    } finally {
      setIsParsing(false);
    }
  };

  // Parse image with AI
  const parseImageWithAI = async (file: File) => {
    setIsParsing(true);
    setParseError(null);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/ai/parse-flight-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image: base64,
          mimeType: file.type,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.segments && data.segments.length > 0) {
          onSegmentsChange([...segments, ...data.segments]);
        } else {
          setParseError("Could not extract flight information. Try manual entry.");
          addEmptySegment();
        }
      } else {
        setParseError("AI parsing unavailable. Please enter manually.");
        addEmptySegment();
      }
    } catch (err) {
      console.error("AI parse error:", err);
      setParseError("AI parsing unavailable. Please enter manually.");
      addEmptySegment();
    } finally {
      setIsParsing(false);
    }
  };

  // Parse text input - supports multiple formats including Amadeus/Galileo
  const parseTextInput = () => {
    if (!textInput.trim()) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const text = textInput.trim();
      const parsedSegments: FlightSegment[] = [];
      
      // Try to parse Amadeus/Galileo format first
      // Example: "FLIGHT     LX 348 - SWISS INTERNATIONAL AIR LINES         TUE 06 JANUARY 2026"
      const amadeusFlightMatch = text.match(/FLIGHT\s+([A-Z]{2})\s*(\d{2,4})\s*-\s*([^\n]+?)(?:\s{2,}|\n)/i);
      const departureLine = text.match(/DEPARTURE:\s*([^,]+),\s*([A-Z]{2})\s*\(([^)]+)\)(?:,\s*TERMINAL\s*(\d+))?\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{1,2}:\d{2})/i);
      const arrivalLine = text.match(/ARRIVAL:\s*([^,]+),\s*([A-Z]{2})\s*\(([^)]+)\)(?:,\s*TERMINAL\s*(\d+))?\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{1,2}:\d{2})/i);
      const durationMatch = text.match(/DURATION:\s*(\d{2}):(\d{2})/i);
      const classMatch = text.match(/RESERVATION\s+CONFIRMED,\s*(\w+)\s*\(([A-Z])\)/i);
      const bookingRefMatch = text.match(/BOOKING\s*REF:\s*([A-Z0-9]+)/i) || text.match(/FLIGHT\s+BOOKING\s+REF:\s*[A-Z]{2}\/([A-Z0-9]+)/i);
      const baggageMatch = text.match(/BAGGAGE\s+ALLOWANCE:\s*(\d+PC)/i);
      const seatMatch = text.match(/SEAT:\s*(\d+[A-Z])/i);
      const ticketMatch = text.match(/TICKET:\s*[A-Z]{2}\/ETKT\s+(\d+\s*\d+)/i);
      const passengerMatch = text.match(/FOR\s+([A-Z]+\/[A-Z]+\s+(?:MR|MRS|MS|MISS|MSTR))/i) || text.match(/^\s*([A-Z]+\/[A-Z]+\s+(?:MR|MRS|MS))\s*$/im);
      const aircraftMatch = text.match(/EQUIPMENT:\s*(.+?)(?:\n|$)/i);

      if (amadeusFlightMatch && departureLine && arrivalLine) {
        // Parse Amadeus format
        const airlineCode = amadeusFlightMatch[1];
        const flightNum = amadeusFlightMatch[2];
        const airlineName = amadeusFlightMatch[3].trim();
        
        // Parse dates - format: "06 JAN" 
        const months: Record<string, string> = {
          JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
          JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
        };
        
        // Get year from header if present
        const yearMatch = text.match(/(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})/i);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
        
        const depDay = departureLine[5].padStart(2, "0");
        const depMonth = months[departureLine[6].toUpperCase()] || "01";
        const depDate = `${year}-${depMonth}-${depDay}`;
        
        const arrDay = arrivalLine[5].padStart(2, "0");
        const arrMonth = months[arrivalLine[6].toUpperCase()] || "01";
        // Handle arrival on next day
        let arrDate = `${year}-${arrMonth}-${arrDay}`;
        if (parseInt(arrDay) < parseInt(depDay) && arrMonth === depMonth) {
          // Arrival is next month or year - for now assume same month next day logic
          const nextDate = new Date(`${year}-${depMonth}-${depDay}`);
          nextDate.setDate(nextDate.getDate() + 1);
          arrDate = nextDate.toISOString().split("T")[0];
        }
        
        // Extract IATA code from airport name like "HEATHROW" -> need to map or extract
        // For now use the parenthesis content as hint
        const depAirportName = departureLine[3]; // e.g., "GENEVA INTERNATIONAL"
        const arrAirportName = arrivalLine[3]; // e.g., "HEATHROW"
        
        // Try to extract IATA from known airports or use city code
        const getIATA = (name: string, city: string): string => {
          const known: Record<string, string> = {
            "HEATHROW": "LHR", "GATWICK": "LGW", "STANSTED": "STN",
            "GENEVA INTERNATIONAL": "GVA", "CHARLES DE GAULLE": "CDG",
            "FIUMICINO": "FCO", "SCHIPHOL": "AMS", "FRANKFURT": "FRA",
          };
          return known[name.toUpperCase()] || city.substring(0, 3).toUpperCase();
        };
        
        const segment: FlightSegment = {
          id: `seg-${Date.now()}-0`,
          flightNumber: `${airlineCode}${flightNum}`,
          airline: airlineName,
          departure: getIATA(depAirportName, departureLine[1]),
          departureCity: departureLine[1],
          departureCountry: departureLine[2],
          arrival: getIATA(arrAirportName, arrivalLine[1]),
          arrivalCity: arrivalLine[1],
          arrivalCountry: arrivalLine[2],
          departureDate: depDate,
          departureTimeScheduled: departureLine[7],
          arrivalDate: arrDate,
          arrivalTimeScheduled: arrivalLine[7],
          departureTerminal: departureLine[4] || undefined,
          arrivalTerminal: arrivalLine[4] || undefined,
          duration: durationMatch ? `${parseInt(durationMatch[1])}h ${parseInt(durationMatch[2])}m` : undefined,
          cabinClass: classMatch ? (classMatch[1].toLowerCase() as "economy" | "business" | "first") : undefined,
          bookingClass: classMatch ? classMatch[2] : undefined,
          bookingRef: bookingRefMatch ? bookingRefMatch[1] : undefined,
          baggage: baggageMatch ? baggageMatch[1] : undefined,
          seat: seatMatch ? seatMatch[1] : undefined,
          ticketNumber: ticketMatch ? ticketMatch[1].replace(/\s/g, "") : undefined,
          passengerName: passengerMatch ? passengerMatch[1] : undefined,
          aircraft: aircraftMatch ? aircraftMatch[1].trim() : undefined,
          departureStatus: "scheduled",
          arrivalStatus: "scheduled",
        };
        
        parsedSegments.push(segment);
      } else {
        // Try FlyDubai/Emirates format
        // Example: "Departure from Riga (Flight FZ 1442)\nEconomy Lite\n20 December 2025..."
        const flyDubaiPattern = /(?:Departure|Return)\s+from\s+([^\(]+)\s*\(Flight\s+([A-Z]{2})\s*(\d+)\)/gi;
        const flyDubaiMatches = [...text.matchAll(flyDubaiPattern)];
        
        if (flyDubaiMatches.length > 0) {
          // Parse FlyDubai format
          const months: Record<string, string> = {
            january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
            july: "07", august: "08", september: "09", october: "10", november: "11", december: "12"
          };
          
          // Split by "Departure from" or "Return from" to get each segment
          const segments = text.split(/(?=Departure from|Return from)/i).filter(s => s.trim());
          
          for (const segText of segments) {
            // Extract flight info
            const flightMatch = segText.match(/(?:Departure|Return)\s+from\s+([^\(]+)\s*\(Flight\s+([A-Z]{2})\s*(\d+)\)/i);
            if (!flightMatch) continue;
            
            const departureCity = flightMatch[1].trim();
            const airlineCode = flightMatch[2];
            const flightNum = flightMatch[3];
            
            // Extract cabin class
            const classMatch = segText.match(/Economy\s*(?:Lite|Flex|Value)?|Business|First/i);
            const cabinClass = classMatch ? classMatch[0].toLowerCase().includes("economy") ? "economy" : 
                               classMatch[0].toLowerCase().includes("business") ? "business" : "first" : undefined;
            
            // Extract dates: "20 December 2025, Saturday" and times
            // Pattern: "20 December 2025, Saturday		21 December 2025, Sunday"
            const dateTimePattern = /(\d{1,2})\s+(\w+)\s+(\d{4}),?\s*\w*\s*(?:\+1 day)?\s*(\d{1,2}:\d{2})?\s*\n?\s*([^\n]*?)\s*\(([A-Z]{3})\)\s*(\d{1,2}h\s*\d{1,2}min|\d+h\s*\d+m)?\s*(?:Non-stop)?\s*(\d{1,2}:\d{2})?\s*\n?\s*([^\n]*?)\s*\(([A-Z]{3})\)/gi;
            
            // Simpler extraction
            const datesMatch = segText.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi);
            const timesMatch = segText.match(/(\d{1,2}:\d{2})/g);
            const airportsMatch = segText.match(/\(([A-Z]{3})\)/g);
            const durationMatch = segText.match(/(\d{1,2})h\s*(\d{1,2})min/i);
            const terminalMatch = segText.match(/Terminal\s*(\d+)/gi);
            const nextDayMatch = segText.includes("+1 day");
            
            if (datesMatch && datesMatch.length >= 1 && timesMatch && timesMatch.length >= 2 && airportsMatch && airportsMatch.length >= 2) {
              // Parse departure date
              const depDateParts = datesMatch[0].match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
              let depDate = "";
              let arrDate = "";
              
              if (depDateParts) {
                const day = depDateParts[1].padStart(2, "0");
                const month = months[depDateParts[2].toLowerCase()] || "01";
                const year = depDateParts[3];
                depDate = `${year}-${month}-${day}`;
                
                // Parse arrival date
                if (datesMatch.length >= 2) {
                  const arrDateParts = datesMatch[1].match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
                  if (arrDateParts) {
                    const arrDay = arrDateParts[1].padStart(2, "0");
                    const arrMonth = months[arrDateParts[2].toLowerCase()] || "01";
                    const arrYear = arrDateParts[3];
                    arrDate = `${arrYear}-${arrMonth}-${arrDay}`;
                  }
                } else if (nextDayMatch) {
                  // +1 day
                  const nextDay = new Date(depDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  arrDate = nextDay.toISOString().split("T")[0];
                } else {
                  arrDate = depDate;
                }
              }
              
              const depAirport = airportsMatch[0].replace(/[()]/g, "");
              const arrAirport = airportsMatch[1].replace(/[()]/g, "");
              
              // Extract city names from text before airports
              const depCityMatch = segText.match(new RegExp(`([A-Za-z\\s]+)\\s*\\(${depAirport}\\)`, "i"));
              const arrCityMatch = segText.match(new RegExp(`([A-Za-z\\s]+)\\s*\\(${arrAirport}\\)`, "i"));
              
              const segment: FlightSegment = {
                id: `seg-${Date.now()}-${parsedSegments.length}`,
                flightNumber: `${airlineCode}${flightNum}`,
                airline: airlineCode === "FZ" ? "flydubai" : airlineCode === "EK" ? "Emirates" : undefined,
                departure: depAirport,
                departureCity: depCityMatch ? depCityMatch[1].trim() : departureCity,
                arrival: arrAirport,
                arrivalCity: arrCityMatch ? arrCityMatch[1].trim() : undefined,
                departureDate: depDate,
                departureTimeScheduled: timesMatch[0],
                arrivalDate: arrDate,
                arrivalTimeScheduled: timesMatch[1],
                departureTerminal: terminalMatch && terminalMatch[0] ? terminalMatch[0].replace(/Terminal\s*/i, "") : undefined,
                arrivalTerminal: terminalMatch && terminalMatch[1] ? terminalMatch[1].replace(/Terminal\s*/i, "") : undefined,
                duration: durationMatch ? `${durationMatch[1]}h ${durationMatch[2]}m` : undefined,
                cabinClass,
                departureStatus: "scheduled",
                arrivalStatus: "scheduled",
              };
              
              parsedSegments.push(segment);
            }
          }
        }
        
        // If still no segments, try simple format
        if (parsedSegments.length === 0) {
          // Fallback to simple format: "LX348 GVA-LHR 06.01 15:55-16:40"
          const lines = text.split("\n").filter((l) => l.trim());
        
          for (const line of lines) {
          const flightMatch = line.match(/([A-Z]{2})\s*(\d{2,4})/);
          const routeMatch = line.match(/([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/);
          const dateMatch = line.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
          const timeMatch = line.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);

          if (flightMatch || routeMatch) {
            const currentYear = new Date().getFullYear();
            let depDateStr = "";
            let arrDateStr = "";
            
            if (dateMatch) {
              const day = dateMatch[1].padStart(2, "0");
              const month = dateMatch[2].padStart(2, "0");
              const year = dateMatch[3] 
                ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3])
                : currentYear.toString();
              depDateStr = `${year}-${month}-${day}`;
              arrDateStr = depDateStr; // Same day by default
              
              // Check if arrival time < departure time (next day arrival)
              if (timeMatch) {
                const depTime = timeMatch[1];
                const arrTime = timeMatch[2];
                if (arrTime < depTime) {
                  // Arrival is next day
                  const nextDay = new Date(depDateStr);
                  nextDay.setDate(nextDay.getDate() + 1);
                  arrDateStr = nextDay.toISOString().split("T")[0];
                }
              }
            }

            parsedSegments.push({
              id: `seg-${Date.now()}-${parsedSegments.length}`,
              flightNumber: flightMatch ? `${flightMatch[1]}${flightMatch[2]}` : "",
              departure: routeMatch?.[1] || "",
              arrival: routeMatch?.[2] || "",
              departureDate: depDateStr,
              departureTimeScheduled: timeMatch?.[1] || "",
              arrivalDate: arrDateStr,
              arrivalTimeScheduled: timeMatch?.[2] || "",
              departureStatus: "scheduled",
              arrivalStatus: "scheduled",
            });
            }
          }
        }
      }

      if (parsedSegments.length > 0) {
        onSegmentsChange([...segments, ...parsedSegments]);
        setTextInput("");
        setShowTextInput(false);
      } else {
        setParseError("Could not parse. Supported formats:\n• LX348 GVA-LHR 06.01 15:55-16:40\n• Amadeus/Galileo booking\n• FlyDubai/Emirates itinerary");
      }
    } catch (err) {
      console.error("Parse error:", err);
      setParseError("Failed to parse text");
    } finally {
      setIsParsing(false);
    }
  };

  // Add empty segment
  const addEmptySegment = () => {
    const newSegment: FlightSegment = {
      id: `seg-${Date.now()}`,
      flightNumber: "",
      departure: "",
      arrival: "",
      departureDate: "",
      departureTimeScheduled: "",
      arrivalDate: "",
      arrivalTimeScheduled: "",
      departureStatus: "scheduled",
      arrivalStatus: "scheduled",
    };
    onSegmentsChange([...segments, newSegment]);
    setEditingId(newSegment.id);
  };

  // Update segment
  const updateSegment = (updated: FlightSegment) => {
    onSegmentsChange(segments.map((seg) => seg.id === updated.id ? updated : seg));
    setEditingId(null);
  };

  // Remove segment
  const removeSegment = (id: string) => {
    onSegmentsChange(segments.filter((seg) => seg.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      {!readonly && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isParsing}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isUploading ? "Processing..." : "Upload (Image/PDF)"}
          </button>

          <button
            type="button"
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Paste Text
          </button>

          <button
            type="button"
            onClick={addEmptySegment}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Flight
          </button>
        </div>
      )}

      {/* Uploaded Image Preview */}
      {uploadedImage && (
        <div className="relative inline-block">
          <img
            src={uploadedImage}
            alt="Uploaded itinerary"
            className="max-h-32 rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={() => setUploadedImage(null)}
            className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Text Input */}
      {showTextInput && (
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste flight details here...&#10;Format: LX348 GVA-LHR 06.01 15:55-16:40"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={parseTextInput}
              disabled={isParsing || !textInput.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isParsing ? "Parsing..." : "Parse"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowTextInput(false);
                setTextInput("");
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Parsing indicator */}
      {isParsing && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Parsing flight information...
        </div>
      )}

      {/* Error message */}
      {parseError && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {parseError}
        </div>
      )}

      {/* Flight Segments - FlightStats style cards */}
      {segments.length > 0 && (
        <div className="space-y-4">
          {segments.map((segment) => (
            editingId === segment.id ? (
              <SegmentEditForm
                key={segment.id}
                segment={segment}
                onSave={updateSegment}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <FlightCard
                key={segment.id}
                segment={segment}
                onEdit={() => setEditingId(segment.id)}
                onRemove={() => removeSegment(segment.id)}
                readonly={readonly}
              />
            )
          ))}
        </div>
      )}

      {/* Empty state */}
      {segments.length === 0 && !showTextInput && !readonly && (
        <div className="text-center py-8 text-gray-500">
          <svg className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <p className="text-sm">No flight segments added</p>
          <p className="text-xs mt-1">Upload a screenshot, paste text, or add manually</p>
        </div>
      )}
    </div>
  );
}
