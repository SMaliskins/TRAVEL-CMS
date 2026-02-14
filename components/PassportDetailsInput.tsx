"use client";

import { useState, useRef, useEffect } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import SingleDatePicker from "@/components/SingleDatePicker";

export interface PassportData {
  passportNumber?: string;
  passportIssueDate?: string; // YYYY-MM-DD
  passportExpiryDate?: string; // YYYY-MM-DD
  passportIssuingCountry?: string;
  passportFullName?: string;
  firstName?: string;  // Given name(s) - from MRZ
  lastName?: string;  // Surname - from MRZ
  dob?: string; // YYYY-MM-DD (can be updated from passport)
  nationality?: string;
  avatarUrl?: string; // Photo extracted from passport
  personalCode?: string; // Record No / Запис N (personal code)
  /** Estonia/Latvia Alien's passport – show red icon next to passport section */
  isAlienPassport?: boolean;
}

interface PassportDetailsInputProps {
  data: PassportData;
  onChange: (data: PassportData, options?: { parsedFields?: Set<string> }) => void;
  readonly?: boolean;
  parsedFields?: Set<string>;
}

export default function PassportDetailsInput({
  data,
  onChange,
  readonly = false,
  parsedFields,
}: PassportDetailsInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Handle paste from clipboard (Ctrl+V) - works globally
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (readonly) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleFileUpload(file);
          }
          return;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [readonly]);

  // Handle file upload (images and PDFs)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";

    if (!isImage && !isPDF) {
      setParseError("Please upload an image or PDF");
      return;
    }

    // Only AI parsing (image and PDF)
    setIsUploading(true);
    setIsParsing(true);
    setParseError(null);
    setParseWarning(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/ai/parse-passport", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (response.ok && result.passport) {
        const p = result.passport as Record<string, unknown>;
        const parsed = new Set<string>(Object.keys(p).filter((k) => p[k] != null && p[k] !== ""));
        onChange({ ...data, ...result.passport }, { parsedFields: parsed });
        setParseError(null);
        setIsEditing(true);
      } else {
        setParseError(result.error || "Could not parse passport. Please fill in manually.");
        setIsEditing(true);
      }
    } catch (err) {
      console.error("Parse error:", err);
      setParseError("Failed to parse. Please try again or fill in manually.");
      setIsEditing(true);
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  // Update field
  const updateField = (field: keyof PassportData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const isParsed = (field: string) => parsedFields?.has(field) ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6">
        {/* Upload Area - narrow, left */}
        {!readonly && (
          <div className="w-40 shrink-0">
            <div
              ref={pasteAreaRef}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors bg-gray-50/50"
              role="region"
              aria-label="Upload passport document for AI parsing"
              title="Upload passport PDF or image for AI parsing (OpenAI + Anthropic). Both PDF and images are parsed."
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-hidden="true"
              />
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                    role="img"
                    aria-label="AI-powered parsing"
                    title="AI parsing (OpenAI GPT-4o, Anthropic Claude)"
                  >
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    AI
                  </span>
                  <svg
                    className="h-10 w-10 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-700">Passport (PDF or image)</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isParsing}
                  className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Upload passport PDF or image for AI parsing"
                >
                  {isUploading || isParsing ? "Processing…" : "Upload"}
                </button>
                <p className="text-[11px] text-gray-500 leading-tight">
                  PDF or image · drag & drop · <kbd className="px-1 font-mono bg-gray-200 rounded">Ctrl+V</kbd>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Passport Fields - right */}
        <div className="flex-1 min-w-[260px] space-y-3">
          <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Passport Details</h4>
          {!readonly && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {isEditing ? "Done" : "Edit"}
            </button>
          )}
        </div>

        {isEditing || readonly ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Passport Number</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={data.passportNumber || ""}
                  onChange={(e) => updateField("passportNumber", e.target.value)}
                  disabled={readonly}
                  className={`flex-1 min-w-0 rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 ${data.isAlienPassport ? "border-red-400 bg-red-50" : ""} ${isParsed("passportNumber") ? "border-green-500 ring-1 ring-green-500" : "border-gray-300"}`}
                />
                {data.isAlienPassport && (
                  <span
                    className="inline-flex shrink-0 items-center rounded px-2 py-1.5 text-xs font-medium text-red-800 bg-red-100 border border-red-300"
                    title="Alien's passport (Estonia/Latvia)"
                    aria-label="Alien's passport"
                  >
                    Alien&apos;s Passport
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name (as in passport)</label>
              <input
                type="text"
                value={data.passportFullName || ""}
                onChange={(e) => updateField("passportFullName", e.target.value)}
                disabled={readonly}
                className={`w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 ${isParsed("passportFullName") ? "border-green-500 ring-1 ring-green-500" : "border-gray-300"}`}
              />
            </div>
            <div>
              {readonly ? (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Issue Date</label>
                  <div className="py-1.5 text-sm text-gray-900">{data.passportIssueDate ? formatDateDDMMYYYY(data.passportIssueDate) : "—"}</div>
                </>
              ) : (
                <SingleDatePicker
                  label="Issue Date"
                  value={data.passportIssueDate}
                  onChange={(date) => updateField("passportIssueDate", date || "")}
                  placeholder="dd.mm.yyyy"
                  parsed={isParsed("passportIssueDate")}
                />
              )}
            </div>
            <div>
              {readonly ? (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Expiry Date</label>
                  <div className="py-1.5 text-sm text-gray-900">{data.passportExpiryDate ? formatDateDDMMYYYY(data.passportExpiryDate) : "—"}</div>
                </>
              ) : (
                <SingleDatePicker
                  label="Expiry Date"
                  value={data.passportExpiryDate}
                  onChange={(date) => updateField("passportExpiryDate", date || "")}
                  placeholder="dd.mm.yyyy"
                  parsed={isParsed("passportExpiryDate")}
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Issuing Country</label>
              <input
                type="text"
                value={data.passportIssuingCountry || ""}
                onChange={(e) => updateField("passportIssuingCountry", e.target.value)}
                disabled={readonly}
                placeholder="US, GB, DE..."
                className={`w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 ${isParsed("passportIssuingCountry") ? "border-green-500 ring-1 ring-green-500" : "border-gray-300"}`}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nationality</label>
              <input
                type="text"
                value={data.nationality || ""}
                onChange={(e) => updateField("nationality", e.target.value)}
                disabled={readonly}
                className={`w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 ${isParsed("nationality") ? "border-green-500 ring-1 ring-green-500" : "border-gray-300"}`}
              />
            </div>
            <div>
              {readonly ? (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Date of Birth</label>
                  <div className="py-1.5 text-sm text-gray-900">{data.dob ? formatDateDDMMYYYY(data.dob) : "—"}</div>
                </>
              ) : (
                <SingleDatePicker
                  label="Date of Birth"
                  value={data.dob}
                  onChange={(date) => updateField("dob", date || "")}
                  placeholder="dd.mm.yyyy"
                  parsed={isParsed("dob")}
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Personal code</label>
              <input
                type="text"
                value={data.personalCode || ""}
                onChange={(e) => updateField("personalCode", e.target.value)}
                disabled={readonly}
                placeholder="e.g. 123456-12345"
                className={`w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 ${isParsed("personalCode") ? "border-green-500 ring-1 ring-green-500" : "border-gray-300"}`}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {data.passportNumber && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500">Passport Number:</span>{" "}
                <span className="font-medium">{data.passportNumber}</span>
                {data.isAlienPassport && (
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-red-800 bg-red-100 border border-red-300"
                    title="Alien's passport (Estonia/Latvia)"
                    aria-label="Alien's passport"
                  >
                    Alien&apos;s Passport
                  </span>
                )}
              </div>
            )}
            {data.passportFullName && (
              <div>
                <span className="text-gray-500">Full Name:</span>{" "}
                <span className="font-medium">{data.passportFullName}</span>
              </div>
            )}
            {(data.passportIssueDate || data.passportExpiryDate) && (
              <div>
                <span className="text-gray-500">Valid:</span>{" "}
                <span className="font-medium">
                  {data.passportIssueDate ? formatDateDDMMYYYY(data.passportIssueDate) : "?"} -{" "}
                  {data.passportExpiryDate ? formatDateDDMMYYYY(data.passportExpiryDate) : "?"}
                </span>
              </div>
            )}
            {data.passportIssuingCountry && (
              <div>
                <span className="text-gray-500">Issuing Country:</span>{" "}
                <span className="font-medium">{data.passportIssuingCountry}</span>
              </div>
            )}
            {data.nationality && (
              <div>
                <span className="text-gray-500">Nationality:</span>{" "}
                <span className="font-medium">{data.nationality}</span>
              </div>
            )}
            {data.dob && (
              <div>
                <span className="text-gray-500">Date of Birth:</span>{" "}
                <span className="font-medium">{formatDateDDMMYYYY(data.dob)}</span>
              </div>
            )}
            {data.personalCode && (
              <div>
                <span className="text-gray-500">Personal code:</span>{" "}
                <span className="font-medium">{data.personalCode}</span>
              </div>
            )}
            {!data.passportNumber && !data.passportFullName && (
              <div className="text-gray-400 italic">No passport details entered</div>
            )}
          </div>
        )}
        </div>
      </div>
      {parseError && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {parseError}
        </div>
      )}
      {parseWarning && (
        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {parseWarning}
        </div>
      )}
    </div>
  );
}

