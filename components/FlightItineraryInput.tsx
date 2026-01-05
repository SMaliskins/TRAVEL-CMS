"use client";

import { useState, useRef } from "react";

export interface FlightSegment {
  id: string;
  flightNumber: string;
  departure: string; // City/Airport
  arrival: string; // City/Airport
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  arrivalDate: string; // YYYY-MM-DD
  arrivalTime: string; // HH:mm
  aircraft?: string;
  status?: "scheduled" | "delayed" | "cancelled" | "landed";
  statusNote?: string;
}

interface FlightItineraryInputProps {
  segments: FlightSegment[];
  onSegmentsChange: (segments: FlightSegment[]) => void;
}

export default function FlightItineraryInput({
  segments,
  onSegmentsChange,
}: FlightItineraryInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setParseError("Please upload an image file");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Parse with AI (placeholder - would call actual API)
      await parseImageWithAI(file);
    } catch (err) {
      console.error("Upload error:", err);
      setParseError("Failed to process image");
    } finally {
      setIsUploading(false);
    }
  };

  // Parse image with AI (OpenAI Vision API)
  const parseImageWithAI = async (file: File) => {
    setIsParsing(true);
    setParseError(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:image/... prefix
        };
        reader.readAsDataURL(file);
      });

      // Call API to parse with AI
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
          onSegmentsChange(data.segments);
        } else {
          setParseError("Could not extract flight information from image");
        }
      } else {
        // AI parsing not available, show manual entry
        setParseError("AI parsing not available. Please enter flight details manually.");
        setShowTextInput(true);
      }
    } catch (err) {
      console.error("AI parse error:", err);
      setParseError("AI parsing not available. Please enter flight details manually.");
      setShowTextInput(true);
    } finally {
      setIsParsing(false);
    }
  };

  // Parse text input manually
  const parseTextInput = () => {
    if (!textInput.trim()) return;

    setIsParsing(true);
    setParseError(null);

    try {
      // Simple regex parsing for common flight formats
      // Example: "BT401 RIX-FCO 15.01 08:30-11:45"
      const lines = textInput.split("\n").filter((l) => l.trim());
      const parsedSegments: FlightSegment[] = [];

      for (const line of lines) {
        // Try to parse flight number
        const flightMatch = line.match(/([A-Z]{2}\d{3,4})/);
        // Try to parse route
        const routeMatch = line.match(/([A-Z]{3})\s*[-–]\s*([A-Z]{3})/);
        // Try to parse date
        const dateMatch = line.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
        // Try to parse times
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
            departureTime: timeMatch?.[1] || "",
            arrivalDate: dateStr, // Same day by default
            arrivalTime: timeMatch?.[2] || "",
            status: "scheduled",
          });
        }
      }

      if (parsedSegments.length > 0) {
        onSegmentsChange([...segments, ...parsedSegments]);
        setTextInput("");
        setShowTextInput(false);
      } else {
        setParseError("Could not parse flight information. Please check the format.");
      }
    } catch (err) {
      console.error("Parse error:", err);
      setParseError("Failed to parse text");
    } finally {
      setIsParsing(false);
    }
  };

  // Add segment manually
  const addEmptySegment = () => {
    const newSegment: FlightSegment = {
      id: `seg-${Date.now()}`,
      flightNumber: "",
      departure: "",
      arrival: "",
      departureDate: "",
      departureTime: "",
      arrivalDate: "",
      arrivalTime: "",
      status: "scheduled",
    };
    onSegmentsChange([...segments, newSegment]);
  };

  // Update segment
  const updateSegment = (id: string, field: keyof FlightSegment, value: string) => {
    onSegmentsChange(
      segments.map((seg) =>
        seg.id === id ? { ...seg, [field]: value } : seg
      )
    );
  };

  // Remove segment
  const removeSegment = (id: string) => {
    onSegmentsChange(segments.filter((seg) => seg.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Upload / Text Input Toggle */}
      <div className="flex items-center gap-4">
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
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {isUploading ? "Uploading..." : "Upload Screenshot"}
        </button>

        <button
          type="button"
          onClick={() => setShowTextInput(!showTextInput)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Paste Text
        </button>

        <button
          type="button"
          onClick={addEmptySegment}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Manually
        </button>
      </div>

      {/* Uploaded Image Preview */}
      {uploadedImage && (
        <div className="relative">
          <img
            src={uploadedImage}
            alt="Uploaded itinerary"
            className="max-h-40 rounded border border-gray-200"
          />
          <button
            type="button"
            onClick={() => setUploadedImage(null)}
            className="absolute top-1 right-1 p-1 bg-white rounded-full shadow hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Text Input */}
      {showTextInput && (
        <div className="space-y-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste flight itinerary text here...&#10;Example: BT401 RIX-FCO 15.01 08:30-11:45"
            rows={4}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={parseTextInput}
              disabled={isParsing || !textInput.trim()}
              className="px-3 py-1.5 text-sm bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
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
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          {parseError}
        </div>
      )}

      {/* Flight Segments */}
      {segments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Flight Segments</h4>
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">
                  Segment {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSegment(segment.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-2">
                <input
                  type="text"
                  value={segment.flightNumber}
                  onChange={(e) => updateSegment(segment.id, "flightNumber", e.target.value)}
                  placeholder="Flight #"
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
                <input
                  type="text"
                  value={segment.departure}
                  onChange={(e) => updateSegment(segment.id, "departure", e.target.value)}
                  placeholder="From (RIX)"
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
                <input
                  type="text"
                  value={segment.arrival}
                  onChange={(e) => updateSegment(segment.id, "arrival", e.target.value)}
                  placeholder="To (FCO)"
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
                <input
                  type="text"
                  value={segment.aircraft || ""}
                  onChange={(e) => updateSegment(segment.id, "aircraft", e.target.value)}
                  placeholder="Aircraft"
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <input
                  type="date"
                  value={segment.departureDate}
                  onChange={(e) => updateSegment(segment.id, "departureDate", e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
                <input
                  type="time"
                  value={segment.departureTime}
                  onChange={(e) => updateSegment(segment.id, "departureTime", e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
                <input
                  type="date"
                  value={segment.arrivalDate}
                  onChange={(e) => updateSegment(segment.id, "arrivalDate", e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
                <input
                  type="time"
                  value={segment.arrivalTime}
                  onChange={(e) => updateSegment(segment.id, "arrivalTime", e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
                />
              </div>

              {/* Status indicator */}
              {segment.status && segment.status !== "scheduled" && (
                <div className={`mt-2 text-xs px-2 py-1 rounded inline-block ${
                  segment.status === "delayed" ? "bg-yellow-100 text-yellow-800" :
                  segment.status === "cancelled" ? "bg-red-100 text-red-800" :
                  segment.status === "landed" ? "bg-green-100 text-green-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {segment.status.charAt(0).toUpperCase() + segment.status.slice(1)}
                  {segment.statusNote && `: ${segment.statusNote}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
