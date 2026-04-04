"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY, parseDisplayToIso } from "@/utils/dateFormat";
import ContentModal from "@/components/ContentModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { FileUp, FileText, Download, Trash2, Eye, Pencil, Check, X } from "lucide-react";
import {
  fetchOrderDocuments,
  orderPageQueryKeys,
  type OrderDocumentListRow,
  type OrderDocumentsQueryResult,
} from "@/lib/orders/orderPageQueries";

type OrderDocument = OrderDocumentListRow;

interface ParsedInvoice {
  supplier?: string;
  amount?: number;
  currency?: string;
  invoice_number?: string;
  invoice_date?: string;
}

interface Props {
  orderCode: string;
}

export default function OrderDocumentsTab({ orderCode }: Props) {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const queryClient = useQueryClient();
  const [docPage, setDocPage] = useState(1);
  const docsQueryKey = orderPageQueryKeys.documents(orderCode, docPage);
  const {
    data: documentsPayload,
    isPending: loading,
    error: queryLoadError,
    isError: loadFailed,
  } = useQuery({
    queryKey: docsQueryKey,
    queryFn: () => fetchOrderDocuments(orderCode, docPage),
    enabled: Boolean(orderCode),
  });
  const documents = documentsPayload?.documents ?? [];
  const docPagination = documentsPayload?.pagination;
  const docTotalPages =
    docPagination && docPagination.limit > 0
      ? Math.max(1, Math.ceil(docPagination.total / docPagination.limit))
      : 1;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayError =
    error || (loadFailed && queryLoadError instanceof Error ? queryLoadError.message : null);
  const [previewDoc, setPreviewDoc] = useState<OrderDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [attemptedParse, setAttemptedParse] = useState<Set<string>>(new Set());
  const [parsingIds, setParsingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<OrderDocument>>({});
  const [docDropActive, setDocDropActive] = useState(false);

  useEffect(() => {
    setDocPage(1);
  }, [orderCode]);

  const showDocumentsEmptyOnboarding =
    !loading && (docPagination?.total ?? 0) === 0 && documents.length === 0;

  const parseDocument = useCallback(async (doc: OrderDocument): Promise<void> => {
    const mime = (doc.mime_type || doc.file_name || "").toLowerCase();
    const isPdf = mime.includes("pdf");
    const isImage = /\.(png|jpg|jpeg|webp)$/i.test(doc.file_name || "") || /^image\/(png|jpeg|jpg|webp)$/.test(mime);
    if (!isPdf && !isImage) return;
    setParsingIds((prev) => new Set(prev).add(doc.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents/${doc.id}/parse`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        const updatePayload = {
          amount: json.amount ?? null,
          currency: json.currency ?? "EUR",
          invoice_number: json.invoice_number ?? null,
          supplier_name: json.supplier ?? null,
          invoice_date: json.invoice_date ?? null,
        };

        const patchRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents/${doc.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify(updatePayload),
        });

        if (patchRes.ok) {
          queryClient.setQueriesData<OrderDocumentsQueryResult>(
            { queryKey: ["order-documents", orderCode] },
            (prev) =>
              prev
                ? {
                    ...prev,
                    documents: prev.documents.map((d) =>
                      d.id === doc.id ? { ...d, ...updatePayload } : d
                    ),
                  }
                : prev
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setParsingIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
      setAttemptedParse((prev) => new Set(prev).add(doc.id));
    }
  }, [orderCode, queryClient]);

  // Parse existing documents on load (e.g. uploaded before, or page refresh)
  useEffect(() => {
    if (!documents.length) return;
    documents.forEach((doc) => {
      const mime = (doc.mime_type || doc.file_name || "").toLowerCase();
      const isPdf = mime.includes("pdf");
      const isImage = /\.(png|jpg|jpeg|webp)$/i.test(doc.file_name || "") || /^image\/(png|jpeg|jpg|webp)$/.test(mime);

      const missingAiData = doc.amount == null && doc.invoice_number == null && doc.supplier_name == null;
      if ((isPdf || isImage) && missingAiData && !attemptedParse.has(doc.id) && !parsingIds.has(doc.id)) {
        parseDocument(doc);
      }
    });
  }, [documents, attemptedParse, parsingIds, parseDocument]);

  const startEdit = (doc: OrderDocument) => {
    setEditingId(doc.id);
    setEditForm({
      amount: doc.amount,
      currency: doc.currency || "EUR",
      invoice_number: doc.invoice_number,
      supplier_name: doc.supplier_name,
      invoice_date: doc.invoice_date ? (parseDisplayToIso(doc.invoice_date) || doc.invoice_date) : null,
    });
  };

  const saveEdit = async (docId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents/${docId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        queryClient.setQueriesData<OrderDocumentsQueryResult>(
          { queryKey: ["order-documents", orderCode] },
          (prev) =>
            prev
              ? {
                  ...prev,
                  documents: prev.documents.map((d) => (d.id === docId ? { ...d, ...editForm } : d)),
                }
              : prev
        );
      } else {
        setError("Failed to save document details.");
      }
    } catch {
      setError("Failed to save document details.");
    } finally {
      setEditingId(null);
    }
  };

  const compressImage = useCallback(async (file: File, maxWidth = 1600, quality = 0.8): Promise<File> => {
    const isImage = /^image\/(png|jpeg|jpg|webp)$/.test(file.type);
    if (!isImage) return file;
    return new Promise((resolve) => {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        let { width, height } = img;
        const needsResize = width > maxWidth;
        const needsConvert = file.type === "image/png";
        if (!needsResize && !needsConvert) { resolve(file); return; }
        if (needsResize) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const outType = needsConvert ? "image/webp" : file.type;
        const outExt = outType === "image/webp" ? ".webp" : (file.name.match(/\.\w+$/)?.[0] || ".jpg");
        const outName = file.name.replace(/\.\w+$/, outExt);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], outName, { type: outType }) : file),
          outType,
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
      img.src = objUrl;
    });
  }, []);

  const uploadFile = useCallback(
    async (rawFile: File) => {
      if (!orderCode) return;
      setUploading(true);
      setError(null);
      try {
        const file = await compressImage(rawFile);
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
          const newDoc = json.document as OrderDocument;
          setDocPage(1);
          await queryClient.invalidateQueries({ queryKey: ["order-documents", orderCode] });
          const mime = (newDoc.mime_type || newDoc.file_name || "").toLowerCase();
          const isPdf = mime.includes("pdf");
          const isImage = /\.(png|jpg|jpeg|webp)$/i.test(newDoc.file_name || "") ||
            /^image\/(png|jpeg|jpg|webp)$/.test(mime);
          if (isPdf || isImage) parseDocument(newDoc);
        } else {
          const err = await res.json().catch(() => ({}));
          let msg = err.error || "Upload failed";
          if (res.status === 503 || /connection failed|fetch failed|TypeError/i.test(msg)) {
            msg = "Database connection failed. Please try again later.";
          }
          setError(msg);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Upload failed";
        setError(/fetch failed|TypeError|connection/i.test(errMsg) ? "Database connection failed. Please try again later." : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [orderCode, compressImage, parseDocument, queryClient]
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    await uploadFile(rawFile);
    e.target.value = "";
  };

  const handleDocDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setDocDropActive(true);
  };

  const handleDocDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) {
      setDocDropActive(false);
    }
  };

  const handleDocDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDocDropActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
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
        await queryClient.invalidateQueries({ queryKey: ["order-documents", orderCode] });
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

  const handlePreview = async (doc: OrderDocument) => {
    if (!doc.download_url) return;
    setPreviewDoc(doc);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/documents/${doc.id}/file`,
        { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }
      );
      if (!res.ok) throw new Error("Failed to load file");
      const blob = await res.blob();
      setPreviewBlobUrl(URL.createObjectURL(blob));
    } catch {
      setError("Failed to load preview");
      setPreviewDoc(null);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t(lang, "order.tab.documents")}</h2>
      <p className="mb-4 text-sm text-gray-600">{t(lang, "order.documentsDesc")}</p>

      <div className="mb-4 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <FileUp size={18} />
          {uploading ? t(lang, "order.uploading") : t(lang, "order.uploadInvoice")}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {displayError && (
        <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{displayError}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">{t(lang, "order.loadingDocuments")}</div>
      ) : showDocumentsEmptyOnboarding ? (
        <div
          className={`rounded-lg border-2 border-dashed py-12 text-center text-gray-500 transition-colors ${
            docDropActive ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-200" : "border-gray-200"
          }`}
          onDragLeave={handleDocDropZoneDragLeave}
          onDragOver={handleDocDropZoneDragOver}
          onDrop={handleDocDropZoneDrop}
        >
          {t(lang, "order.noDocumentsYet")}
        </div>
      ) : (
        <>
        {documents.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No documents on this page.</p>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-600">
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Invoice No.</th>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const isParsing = parsingIds.has(doc.id);
              const isEditing = editingId === doc.id;
              const cellEmpty = (val: unknown) => isParsing ? <span className="text-gray-500 text-xs flex items-center gap-1"><span className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full block" /> Parsing...</span> : <span className="text-gray-400">—</span>;
              return (
                <tr key={doc.id} className={`border-b border-gray-100 ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <FileText size={12} />
                      {doc.document_type === "invoice" ? "Invoice" : "Other"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={doc.file_name}>{doc.file_name}</td>

                  {isEditing ? (
                    <>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <select
                            value={editForm.currency || "EUR"}
                            onChange={e => setEditForm(p => ({ ...p, currency: e.target.value }))}
                            className="w-14 rounded border border-gray-300 p-1 text-xs bg-white"
                          >
                            <option value="EUR">€</option>
                            <option value="USD">$</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.amount ?? ""}
                            onChange={e => setEditForm(p => ({ ...p, amount: e.target.value ? Number(e.target.value) : null }))}
                            className="w-20 rounded border border-gray-300 p-1 text-xs bg-white"
                            placeholder="Amount"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.invoice_number || ""}
                          onChange={e => setEditForm(p => ({ ...p, invoice_number: e.target.value }))}
                          className="w-full rounded border border-gray-300 p-1 text-xs bg-white"
                          placeholder="Inv No."
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.supplier_name || ""}
                          onChange={e => setEditForm(p => ({ ...p, supplier_name: e.target.value }))}
                          className="w-full rounded border border-gray-300 p-1 text-xs bg-white"
                          placeholder="Supplier"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={editForm.invoice_date || ""}
                          onChange={e => setEditForm(p => ({ ...p, invoice_date: e.target.value }))}
                          className="w-full rounded border border-gray-300 p-1 text-xs bg-white"
                          placeholder="Date"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-600">
                        {doc.amount != null ? (
                          <span className="font-medium">
                            {doc.currency === "USD" ? "$" : "€"}
                            {Number(doc.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        ) : cellEmpty(doc.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {doc.invoice_number ? doc.invoice_number : cellEmpty(doc.invoice_number)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={doc.supplier_name || ""}>
                        {doc.supplier_name ? doc.supplier_name : cellEmpty(doc.supplier_name)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{doc.invoice_date ? formatDateDDMMYYYY(doc.invoice_date) : formatDateDDMMYYYY(doc.created_at)}</td>
                    </>
                  )}

                  <td className="px-4 py-3 text-gray-500">{formatSize(doc.file_size)}</td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEdit(doc.id)} className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100" title="Save changes"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200" title="Cancel"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => startEdit(doc)}
                          className="mr-2 inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 transition-colors"
                          title="Edit Extracted Data"
                          disabled={isParsing}
                        >
                          <Pencil size={16} />
                        </button>
                        {doc.download_url && (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePreview(doc)}
                              className="mr-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Preview"
                            >
                              <Eye size={16} />
                            </button>
                            <a
                              href={doc.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mr-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Download"
                            >
                              <Download size={16} />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
        {docTotalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <span>
              Page {docPage} of {docTotalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={docPage <= 1}
                onClick={() => setDocPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={docPage >= docTotalPages}
                onClick={() => setDocPage((p) => p + 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
        <div
          className={`mt-4 rounded-lg border-2 border-dashed py-6 text-center text-sm transition-colors ${
            docDropActive ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-200" : "border-gray-200 text-gray-400"
          }`}
          onDragLeave={handleDocDropZoneDragLeave}
          onDragOver={handleDocDropZoneDragOver}
          onDrop={handleDocDropZoneDrop}
        >
          {uploading ? t(lang, "order.uploading") : t(lang, "order.dropFilesHere")}
        </div>
        </>
      )}

      <ContentModal
        isOpen={!!previewDoc}
        onClose={() => {
          setPreviewDoc(null);
          if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
        }}
        title={previewDoc?.file_name}
        url={previewBlobUrl ?? undefined}
      />
    </div>
  );
}
