"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { FileUp, FileText, Download, Trash2 } from "lucide-react";

interface OrderDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string | null;
  created_at: string;
  download_url?: string | null;
}

interface Props {
  orderCode: string;
}

export default function OrderDocumentsTab({ orderCode }: Props) {
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!orderCode) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.documents || []);
      } else {
        setDocuments([]);
      }
    } catch (e) {
      console.error("Load documents error:", e);
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [orderCode]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderCode) return;
    setUploading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.set("file", file);
      formData.set("document_type", "invoice");
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        setDocuments((prev) => [json.document, ...prev]);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Upload failed");
      }
    } catch (e) {
      setError("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents/${docId}`, {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } else {
        setError("Failed to delete");
      }
    } catch (e) {
      setError("Failed to delete");
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Documents</h2>
      <p className="mb-4 text-sm text-gray-600">Upload invoices and other documents for this order. They will be visible in Finances.</p>

      <div className="mb-4 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <FileUp size={18} />
          {uploading ? "Uploading..." : "Upload invoice"}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-gray-500">
          No documents yet. Upload an invoice or other document above.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-600">
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    <FileText size={12} />
                    {doc.document_type === "invoice" ? "Invoice" : "Other"}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{doc.file_name}</td>
                <td className="px-4 py-3 text-gray-600">{formatDateDDMMYYYY(doc.created_at)}</td>
                <td className="px-4 py-3 text-gray-500">{formatSize(doc.file_size)}</td>
                <td className="px-4 py-3 text-right">
                  {doc.download_url && (
                    <a
                      href={doc.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mr-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
