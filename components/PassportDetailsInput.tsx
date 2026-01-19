"use client";

import { useState, useRef, useEffect } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

export interface PassportData {
  passportNumber?: string;
  passportIssueDate?: string; // YYYY-MM-DD
  passportExpiryDate?: string; // YYYY-MM-DD
  passportIssuingCountry?: string;
  passportFullName?: string;
  dob?: string; // YYYY-MM-DD (can be updated from passport)
  nationality?: string;
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
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Handle paste from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (readonly || !pasteAreaRef.current?.contains(e.target as Node)) return;
      
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
      setParseError("Please upload an image or PDF file");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      if (isPDF) {
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

  // Parse PDF with AI
  const parsePDFWithAI = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "pdf");
      
      const response = await fetch("/api/ai/parse-passport", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse PDF");
      }
      
      const result = await response.json();
      
      if (result.passport) {
        onChange(result.passport);
        setParseError(null);
      } else {
        setParseError("Could not extract passport information from PDF");
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

      const response = await fetch("/api/ai/parse-passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse image");
      }

      const result = await response.json();
      
      if (result.passport) {
        onChange(result.passport);
        setParseError(null);
      } else {
        setParseError("Could not extract passport information from image");
      }
    } catch (err) {
      console.error("Image parse error:", err);
      setParseError(err instanceof Error ? err.message : "Failed to parse image");
    } finally {
      setIsParsing(false);
    }
  };

  // Parse text with AI
  const parseTextWithAI = async () => {
    if (!textInput.trim()) {
      setParseError("Please enter passport text");
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const response = await fetch("/api/ai/parse-passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse text");
      }

      const result = await response.json();
      
      if (result.passport) {
        onChange(result.passport);
        setParseError(null);
        setTextInput("");
        setShowTextInput(false);
      } else {
        setParseError("Could not extract passport information from text");
      }
    } catch (err) {
      console.error("Text parse error:", err);
      setParseError(err instanceof Error ? err.message : "Failed to parse text");
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
          
          {uploadedImage ? (
            <div className="space-y-3">
              <img
                src={uploadedImage}
                alt="Passport preview"
                className="max-h-48 mx-auto rounded border border-gray-200"
              />
              <button
                type="button"
                onClick={() => setUploadedImage(null)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Remove image
              </button>
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
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isParsing}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                >
                  {isUploading || isParsing ? "Processing..." : "Upload passport image or PDF"}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  or drag and drop, or paste (Ctrl+V)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text Input Toggle */}
      {!readonly && !showTextInput && (
        <button
          type="button"
          onClick={() => setShowTextInput(true)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Or paste text directly →
        </button>
      )}

      {/* Text Input */}
      {!readonly && showTextInput && (
        <div className="space-y-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste passport text here..."
            rows={4}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={parseTextWithAI}
              disabled={isParsing || !textInput.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isParsing ? "Parsing..." : "Parse Text"}
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

      {/* Error Message */}
      {parseError && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {parseError}
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

