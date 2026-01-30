"use client";

import { useState, useRef, useEffect } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
  personalCode?: string; // Record No / Запис N (персональный код)
}

interface PassportDetailsInputProps {
  data: PassportData;
  onChange: (data: PassportData) => void;
  readonly?: boolean;
}

export default function PassportDetailsInput({
  data,
  onChange,
  readonly = false,
}: PassportDetailsInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
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
      setParseError("Please upload a PDF file");
      return;
    }

    if (isImage) {
      // Show preview and upload as avatar
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload image as avatar
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("/api/upload-avatar", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          onChange({ ...data, avatarUrl: result.url });
          setParseError("Photo saved. Please fill in passport details manually or upload PDF for automatic parsing.");
        } else {
          setParseError("Image uploaded but could not be saved. Please upload PDF for automatic parsing.");
        }
      } catch (err) {
        console.error("Avatar upload error:", err);
        setParseError("Failed to save image. Please fill in details manually.");
      } finally {
        setIsUploading(false);
      }
      
      setIsEditing(true); // Open edit mode for manual input
      return;
    }

    setIsUploading(true);
    setParseError(null);
    setParseWarning(null);

    try {
      await parsePDF(file);
    } catch (err) {
      console.error("Upload error:", err);
      setParseError("Failed to process file");
    } finally {
      setIsUploading(false);
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

  // Parse PDF (regex-based, no AI)
  const parsePDF = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/parse-passport-mrz", {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      
      if (response.ok && result.passport) {
        onChange(result.passport);
        setParseError(null);
        setParseWarning(result.photoError ? `Photo not extracted: ${result.photoError}` : null);
      } else {
        setParseError(result.error || "Could not parse passport. Please fill in manually.");
        setIsEditing(true); // Open edit mode for manual input
      }
    } catch (err) {
      console.error("PDF parse error:", err);
      setParseError(err instanceof Error ? err.message : "Failed to parse PDF");
      setIsEditing(true);
    } finally {
      setIsParsing(false);
    }
  };

  // Update field
  const updateField = (field: keyof PassportData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!readonly && (
        <div
          ref={pasteAreaRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {(uploadedImage || data.avatarUrl) ? (
            <div className="space-y-3">
              <img
                src={uploadedImage || data.avatarUrl}
                alt="Passport preview"
                className="max-h-48 mx-auto rounded border border-gray-200"
              />
              {!readonly && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImage(null);
                    if (data.avatarUrl) onChange({ ...data, avatarUrl: undefined });
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isParsing}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isUploading || isParsing ? "Processing..." : "Upload PDF or Image"}
                </button>
                <p className="text-xs text-gray-500">
                  or drag & drop, or <strong>Ctrl+V</strong> to paste
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {parseError && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {parseError}
        </div>
      )}
      {/* Warning (e.g. photo not extracted) */}
      {parseWarning && (
        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {parseWarning}
        </div>
      )}

      {/* Passport Fields */}
      <div className="space-y-3">
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
            {data.avatarUrl && (
              <div className="col-span-2 flex items-center gap-3">
                <img
                  src={data.avatarUrl}
                  alt="Passport photo"
                  className="h-20 w-20 rounded-full object-cover border border-gray-200"
                />
                <span className="text-xs text-gray-500">Photo extracted from passport</span>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Passport Number</label>
              <input
                type="text"
                value={data.passportNumber || ""}
                onChange={(e) => updateField("passportNumber", e.target.value)}
                disabled={readonly}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name (as in passport)</label>
              <input
                type="text"
                value={data.passportFullName || ""}
                onChange={(e) => updateField("passportFullName", e.target.value)}
                disabled={readonly}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Issue Date</label>
              <input
                type="date"
                value={data.passportIssueDate || ""}
                onChange={(e) => updateField("passportIssueDate", e.target.value)}
                disabled={readonly}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expiry Date</label>
              <input
                type="date"
                value={data.passportExpiryDate || ""}
                onChange={(e) => updateField("passportExpiryDate", e.target.value)}
                disabled={readonly}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Issuing Country</label>
              <input
                type="text"
                value={data.passportIssuingCountry || ""}
                onChange={(e) => updateField("passportIssuingCountry", e.target.value)}
                disabled={readonly}
                placeholder="US, GB, DE..."
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nationality</label>
              <input
                type="text"
                value={data.nationality || ""}
                onChange={(e) => updateField("nationality", e.target.value)}
                disabled={readonly}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date of Birth</label>
              <input
                type="date"
                value={data.dob || ""}
                onChange={(e) => updateField("dob", e.target.value)}
                disabled={readonly}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {data.avatarUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={data.avatarUrl}
                  alt="Passport photo"
                  className="h-16 w-16 rounded-full object-cover border border-gray-200"
                />
                <span className="text-gray-500">Photo</span>
              </div>
            )}
            {data.passportNumber && (
              <div>
                <span className="text-gray-500">Passport Number:</span>{" "}
                <span className="font-medium">{data.passportNumber}</span>
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
            {!data.passportNumber && !data.passportFullName && (
              <div className="text-gray-400 italic">No passport details entered</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

