"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CodeWriterLanguage =
  | "text"
  | "typescript"
  | "javascript"
  | "json"
  | "sql"
  | "bash"
  | "python";

export interface CodeWriterProps {
  storageKey?: string;
  defaultValue?: string;
  defaultLanguage?: CodeWriterLanguage;
  defaultFilename?: string;
  minRows?: number;
}

type PersistedState = {
  value: string;
  language: CodeWriterLanguage;
  filename: string;
};

function isCodeWriterLanguage(value: unknown): value is CodeWriterLanguage {
  return (
    value === "text" ||
    value === "typescript" ||
    value === "javascript" ||
    value === "json" ||
    value === "sql" ||
    value === "bash" ||
    value === "python"
  );
}

function getExtension(language: CodeWriterLanguage): string {
  switch (language) {
    case "typescript":
      return "ts";
    case "javascript":
      return "js";
    case "json":
      return "json";
    case "sql":
      return "sql";
    case "bash":
      return "sh";
    case "python":
      return "py";
    case "text":
    default:
      return "txt";
  }
}

function getMimeType(language: CodeWriterLanguage): string {
  switch (language) {
    case "typescript":
      return "text/typescript";
    case "javascript":
      return "text/javascript";
    case "json":
      return "application/json";
    case "sql":
      return "application/sql";
    case "bash":
      return "text/x-shellscript";
    case "python":
      return "text/x-python";
    case "text":
    default:
      return "text/plain";
  }
}

function ensureFilenameExtension(filename: string, ext: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return `snippet.${ext}`;
  if (trimmed.includes(".")) return trimmed;
  return `${trimmed}.${ext}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy method
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function CodeWriter({
  storageKey = "travelcms.codeWriter",
  defaultValue = "",
  defaultLanguage = "typescript",
  defaultFilename = "snippet",
  minRows = 14,
}: CodeWriterProps) {
  const [value, setValue] = useState(defaultValue);
  const [language, setLanguage] = useState<CodeWriterLanguage>(defaultLanguage);
  const [filename, setFilename] = useState(defaultFilename);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  const ext = useMemo(() => getExtension(language), [language]);

  const stats = useMemo(() => {
    const lines = value.length === 0 ? 0 : value.split("\n").length;
    return { chars: value.length, lines };
  }, [value]);

  // Load persisted state once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedState> | null;
      if (!parsed) return;
      if (typeof parsed.value === "string") setValue(parsed.value);
      if (isCodeWriterLanguage(parsed.language)) setLanguage(parsed.language);
      if (typeof parsed.filename === "string") setFilename(parsed.filename);
    } catch {
      // ignore corrupted storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: PersistedState = { value, language, filename };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore quota / disabled storage
    }
  }, [filename, language, storageKey, value]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const flashStatus = (message: string) => {
    setStatus(message);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(null), 2000);
  };

  const handleCopy = async () => {
    if (!value.trim()) {
      flashStatus("Nothing to copy");
      return;
    }
    const ok = await copyToClipboard(value);
    flashStatus(ok ? "Copied" : "Copy failed");
  };

  const handleDownload = () => {
    if (typeof window === "undefined") return;
    const resolvedName = ensureFilenameExtension(filename, ext);
    const blob = new Blob([value], { type: getMimeType(language) });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resolvedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    flashStatus("Downloaded");
  };

  const handleClear = () => {
    setValue("");
    flashStatus("Cleared");
  };

  const handleReset = () => {
    setValue(defaultValue);
    setLanguage(defaultLanguage);
    setFilename(defaultFilename);
    flashStatus("Reset");
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodeWriterLanguage)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900"
              aria-label="Language"
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="json">JSON</option>
              <option value="sql">SQL</option>
              <option value="bash">Bash</option>
              <option value="python">Python</option>
              <option value="text">Plain text</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">File</label>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={`snippet.${ext}`}
              className="h-9 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 md:w-64"
              aria-label="Filename"
            />
          </div>

          <div className="text-xs text-gray-500">
            {stats.lines} lines · {stats.chars} chars
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {status}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Download
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="p-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={minRows}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm leading-6 text-gray-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-black/10"
          placeholder="Write code here…"
        />
      </div>
    </div>
  );
}

