"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Company {
  id: string;
  name: string;
}

interface FieldMapping {
  group: string;
  lotusField: string;
  dbTable: string;
  dbColumn: string;
  sample: string;
}

interface PreviewData {
  dryRun: true;
  totalRecords: number;
  newRecords: number;
  existingRecords: number;
  preview: Array<{
    number: number;
    tourNumber: string;
    client: string;
    destination: string;
    dates: string;
    price: number;
    paid: number;
    debt: number;
    currency: string;
    travellers: string[];
    invoices: number;
    status: number;
  }>;
  clients: Array<{ name: string; personalCode: string; phone: string; email: string }>;
  travellers: Array<{ name: string; personalCode: string }>;
  fieldMapping: FieldMapping[];
}

interface ImportResult {
  success: true;
  ordersCreated: number;
  ordersSkipped: number;
  clientsCreated: number;
  clientsExisting: number;
  servicesCreated: number;
  travellersCreated: number;
  invoicesCreated: number;
  errors: string[];
}

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importLimit, setImportLimit] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ percent: number; processed: number; total: number; current: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"data" | "mapping">("data");

  useEffect(() => {
    fetch("/api/superadmin/companies?limit=100")
      .then((r) => {
        if (!r.ok) { if (r.status === 401) router.push("/superadmin/login"); throw new Error("Auth"); }
        return r.json();
      })
      .then((data) => setCompanies(data.companies || []))
      .catch(() => {});
  }, [router]);

  const handlePreview = async () => {
    if (!file || !selectedCompany) return;
    setIsLoading(true);
    setError("");
    setPreview(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("companyId", selectedCompany);
    form.append("dryRun", "true");
    if (importLimit > 0) form.append("limit", String(importLimit));

    try {
      const res = await fetch("/api/superadmin/import/lotus", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Preview failed"); return; }
      setPreview(data);
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedCompany) return;
    if (!confirm(`Import ${preview?.totalRecords || "all"} orders into "${companies.find(c => c.id === selectedCompany)?.name}"?`)) return;

    setIsLoading(true);
    setError("");
    setResult(null);
    setProgress({ percent: 0, processed: 0, total: preview?.totalRecords || 0, current: "" });

    const form = new FormData();
    form.append("file", file);
    form.append("companyId", selectedCompany);
    if (importLimit > 0) form.append("limit", String(importLimit));

    try {
      const res = await fetch("/api/superadmin/import/lotus", { method: "POST", body: form });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({ error: "Import failed" }));
        if (!res.ok || data.error) {
          setError(data.error || "Import failed");
        }
        setProgress(null);
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Streaming not supported");
        setProgress(null);
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataMatch = line.match(/^data: (.+)$/m);
          if (!dataMatch) continue;
          try {
            const event = JSON.parse(dataMatch[1]);

            if (event.type === "progress") {
              setProgress({
                percent: event.percent,
                processed: event.processed,
                total: event.total,
                current: event.current,
              });
            } else if (event.type === "done") {
              finished = true;
              setResult({
                success: true,
                ordersCreated: event.ordersCreated,
                ordersSkipped: event.ordersSkipped,
                clientsCreated: event.clientsCreated,
                clientsExisting: event.clientsExisting,
                servicesCreated: event.servicesCreated || 0,
                travellersCreated: event.travellersCreated,
                invoicesCreated: event.invoicesCreated,
                errors: event.errors || [],
              });
              setPreview(null);
              setProgress(null);
            } else if (event.type === "error") {
              finished = true;
              setError(event.error || "Import failed on server");
              setProgress(null);
            }
          } catch {}
        }
      }

      if (!finished) {
        setError("Import stream ended unexpectedly. Check results in the database.");
        setProgress(null);
      }
    } catch {
      setError("Network error — connection lost during import");
      setProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Data Import</h1>
        <p className="text-slate-500 text-sm">Import orders from Lotus Notes CGN export</p>
      </div>

      {/* Step 1: Select company + file */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">1. Select Company & File</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Company</label>
            <select
              value={selectedCompany}
              onChange={(e) => { setSelectedCompany(e.target.value); setPreview(null); setResult(null); }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lotus CGN File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".cgn,.txt,.nsf"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-purple-50 file:text-purple-700 file:rounded file:font-medium file:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Limit (0 = all)</label>
            <input
              type="number"
              min={0}
              value={importLimit}
              onChange={(e) => setImportLimit(parseInt(e.target.value) || 0)}
              placeholder="0 = all records"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <button
          onClick={handlePreview}
          disabled={!file || !selectedCompany || isLoading}
          className="px-6 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isLoading && !preview ? "Parsing..." : "Preview"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>
      )}

      {/* Progress bar */}
      {progress && (
        <div className="bg-white rounded-xl border border-purple-200 p-6 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">Importing...</h2>
            <span className="text-2xl font-bold text-purple-700">{progress.percent}%</span>
          </div>

          <div className="w-full bg-purple-100 rounded-full h-4 overflow-hidden">
            <div
              className="bg-purple-600 h-4 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{progress.processed.toLocaleString()} / {progress.total.toLocaleString()} orders</span>
            {progress.current && <span className="font-mono text-xs text-slate-400">Current: {progress.current}</span>}
          </div>
        </div>
      )}

      {/* Step 2: Preview + Mapping */}
      {preview && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">2. Preview & Field Mapping</h2>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("data")}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${activeTab === "data" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Data Preview
              </button>
              <button
                onClick={() => setActiveTab("mapping")}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${activeTab === "mapping" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Field Mapping
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Total in File" value={preview.totalRecords} />
            <Stat label="New (to import)" value={preview.newRecords} color="emerald" />
            <Stat label="Already Imported" value={preview.existingRecords} color={preview.existingRecords > 0 ? "amber" : "slate"} />
            <Stat label="Unique Clients" value={preview.clients.length} />
            <Stat label="Travellers" value={preview.travellers.length} />
          </div>

          {preview.existingRecords > 0 && preview.newRecords === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              All {preview.existingRecords} orders from this file are already imported. Nothing new to import.
            </div>
          )}

          {preview.existingRecords > 0 && preview.newRecords > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              {preview.existingRecords} orders already imported — they will be skipped. Only {preview.newRecords} new orders will be created.
            </div>
          )}

          {activeTab === "data" && (
            <>
              {preview.preview.length > 0 && <p className="text-xs text-slate-500">Preview of new orders (not yet in database):</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Tour #</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Client</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Destination</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Dates</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Price</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Paid</th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">Debt</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Travellers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((o, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-800">{o.tourNumber}</td>
                        <td className="py-2 px-3 text-slate-800">{o.client}</td>
                        <td className="py-2 px-3 text-slate-600">{o.destination}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{o.dates}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-800">{o.price.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{o.paid.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-red-600">{o.debt > 0 ? o.debt.toLocaleString() : "—"}</td>
                        <td className="py-2 px-3 text-slate-600 text-xs">{o.travellers.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.newRecords > 5 && (
                <p className="text-xs text-slate-400">Showing first 5 of {preview.newRecords} new records</p>
              )}
            </>
          )}

          {activeTab === "mapping" && preview.fieldMapping && (
            <FieldMappingTable mapping={preview.fieldMapping} />
          )}

          <button
            onClick={handleImport}
            disabled={isLoading || preview.newRecords === 0}
            className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40 transition"
          >
            {isLoading ? "Importing..." : preview.newRecords === 0 ? "Nothing to import" : `Import ${preview.newRecords} New Orders`}
          </button>
        </div>
      )}

      {/* Step 3: Result */}
      {result && (
        <div className="bg-white rounded-xl border border-emerald-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Import Complete</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Stat label="Orders Created" value={result.ordersCreated} color="emerald" />
            <Stat label="Orders Skipped" value={result.ordersSkipped} color="slate" />
            <Stat label="Services" value={result.servicesCreated} color="blue" />
            <Stat label="Clients Created" value={result.clientsCreated} color="violet" />
            <Stat label="Clients Existing" value={result.clientsExisting} color="slate" />
            <Stat label="Travellers" value={result.travellersCreated} color="amber" />
            <Stat label="Invoices" value={result.invoicesCreated} color="amber" />
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-700 mb-2">Errors ({result.errors.length}):</p>
              <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const GROUP_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Order: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  Finance: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  Client: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-400" },
  Travellers: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  Service: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-400" },
  Invoice: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-400" },
  Skipped: { bg: "bg-slate-50", text: "text-slate-400", dot: "bg-slate-300" },
};

function FieldMappingTable({ mapping }: { mapping: FieldMapping[] }) {
  const groups = Array.from(new Set(mapping.map((m) => m.group)));

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const rows = mapping.filter((m) => m.group === group);
        const colors = GROUP_COLORS[group] || GROUP_COLORS.Skipped;
        const isSkipped = group === "Skipped";

        return (
          <div key={group}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                {group}
              </span>
              {isSkipped && <span className="text-xs text-slate-400">(not imported)</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${colors.bg}`}>
                    <th className="text-left py-1.5 px-3 text-xs font-medium text-slate-500 w-1/4">Lotus Field</th>
                    <th className="text-left py-1.5 px-3 text-xs font-medium text-slate-500">
                      <span className="inline-block w-4 text-center text-slate-300">→</span>
                    </th>
                    <th className="text-left py-1.5 px-3 text-xs font-medium text-slate-500 w-1/5">DB Table</th>
                    <th className="text-left py-1.5 px-3 text-xs font-medium text-slate-500 w-1/4">Column</th>
                    <th className="text-left py-1.5 px-3 text-xs font-medium text-slate-500">Sample Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${isSkipped ? "opacity-50" : ""}`}>
                      <td className="py-1.5 px-3 font-mono text-xs text-slate-700">{row.lotusField}</td>
                      <td className="py-1.5 px-3 text-center text-slate-300">→</td>
                      <td className="py-1.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${isSkipped ? "bg-slate-100 text-slate-400 line-through" : `${colors.bg} ${colors.text}`}`}>
                          {row.dbTable}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-xs text-slate-600">{row.dbColumn}</td>
                      <td className="py-1.5 px-3 text-xs text-slate-500 truncate max-w-[200px]">{row.sample}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color = "slate" }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-50 text-slate-900",
    emerald: "bg-emerald-50 text-emerald-900",
    blue: "bg-blue-50 text-blue-900",
    violet: "bg-violet-50 text-violet-900",
    amber: "bg-amber-50 text-amber-900",
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color] || colors.slate}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
