"use client";

import { useState, useRef } from "react";

interface CompanyDocData {
  companyName?: string;
  regNumber?: string;
  vatNumber?: string;
  legalAddress?: string;
  country?: string;
  bankName?: string;
  iban?: string;
  swift?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

interface CompanyDocParserProps {
  onParsed: (data: CompanyDocData) => void;
  readonly?: boolean;
}

export default function CompanyDocParser({ onParsed, readonly }: CompanyDocParserProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedFields, setParsedFields] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
    setIsParsing(true);
    setParseError(null);
    setParsedFields([]);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/ai/parse-company-doc", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        credentials: "include",
        body: formData,
      });
      const result = await response.json();
      if (response.ok && result.company) {
        const c = result.company as CompanyDocData;
        const filled = Object.entries(c).filter(([, v]) => v).map(([k]) => k);
        setParsedFields(filled);
        onParsed(c);
      } else {
        setParseError(result.error || "Could not parse document. Please fill in manually.");
      }
    } catch {
      setParseError("Network error. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  if (readonly) return null;

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isParsing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors disabled:opacity-50"
      >
        {isParsing ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
            Parsing...
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Parse document
          </>
        )}
      </button>
      <span className="text-[11px] text-gray-400">PDF or image of registration certificate, invoice, etc.</span>
      {parseError && <span className="text-[11px] text-red-500">{parseError}</span>}
      {parsedFields.length > 0 && !parseError && (
        <span className="text-[11px] text-green-600">
          Filled: {parsedFields.join(", ")}
        </span>
      )}
    </div>
  );
}
