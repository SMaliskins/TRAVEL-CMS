"use client";

import { useState, useRef } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
  arrivalDate: string; // YYYY-MM-DD
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
            className="px-3 py-1 text-sm bg-black text-white rounded hover:bg-gray-800"
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

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setParseError("Please upload an image file");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      await parseImageWithAI(file);
    } catch (err) {
      console.error("Upload error:", err);
      setParseError("Failed to process image");
    } finally {
      setIsUploading(false);
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

  // Parse text input
  const parseTextInput = () => {
    if (!textInput.trim()) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const lines = textInput.split("\n").filter((l) => l.trim());
      const parsedSegments: FlightSegment[] = [];

      for (const line of lines) {
        // Try to parse: "LX348 GVA-LHR 06.01 15:55-16:40"
        const flightMatch = line.match(/([A-Z]{2}\d{2,4})/);
        const routeMatch = line.match(/([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/);
        const dateMatch = line.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
        const timeMatch = line.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);

        if (flightMatch || routeMatch) {
          const currentYear = new Date().getFullYear();
          let dateStr = "";
          
          if (dateMatch) {
            const day = dateMatch[1].padStart(2, "0");
            const month = dateMatch[2].padStart(2, "0");
            const year = dateMatch[3] 
              ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3])
              : currentYear.toString();
            dateStr = `${year}-${month}-${day}`;
          }

          parsedSegments.push({
            id: `seg-${Date.now()}-${parsedSegments.length}`,
            flightNumber: flightMatch?.[1] || "",
            departure: routeMatch?.[1] || "",
            arrival: routeMatch?.[2] || "",
            departureDate: dateStr,
            departureTimeScheduled: timeMatch?.[1] || "",
            arrivalDate: dateStr,
            arrivalTimeScheduled: timeMatch?.[2] || "",
            departureStatus: "scheduled",
            arrivalStatus: "scheduled",
          });
        }
      }

      if (parsedSegments.length > 0) {
        onSegmentsChange([...segments, ...parsedSegments]);
        setTextInput("");
        setShowTextInput(false);
      } else {
        setParseError("Could not parse. Try format: LX348 GVA-LHR 06.01 15:55-16:40");
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
            accept="image/*"
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
            {isUploading ? "Uploading..." : "Upload Screenshot"}
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
              className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
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
