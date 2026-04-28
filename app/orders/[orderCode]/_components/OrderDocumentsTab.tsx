"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY, parseDisplayToIso } from "@/utils/dateFormat";
import ContentModal from "@/components/ContentModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { FileUp, FileText, Download, Trash2, Eye, Pencil, Check, X, Link2, AlertTriangle, Sparkles } from "lucide-react";
import {
  fetchOrderDocuments,
  fetchOrderServicesList,
  orderPageQueryKeys,
  type OrderDocumentListRow,
  type OrderDocumentsQueryResult,
} from "@/lib/orders/orderPageQueries";
import {
  suggestServiceMatchesForDocument,
  describeAutoMatchReasons,
  type AutoMatchSuggestion,
} from "@/lib/finances/supplierInvoiceAutoMatch";

type OrderDocument = OrderDocumentListRow;

type MatchableService = {
  id: string;
  category?: string | null;
  serviceName?: string | null;
  service_name?: string | null;
  supplierName?: string | null;
  supplier_name?: string | null;
  serviceDateFrom?: string | null;
  service_date_from?: string | null;
  serviceDateTo?: string | null;
  service_date_to?: string | null;
  servicePrice?: number | null;
  service_price?: number | null;
  supplierInvoiceRequirement?: string | null;
  supplier_invoice_requirement?: string | null;
  supplierInvoiceDocumentCount?: number | null;
  supplier_invoice_document_count?: number | null;
};

function StatusBadge({
  children,
  tone = "gray",
  onClick,
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "blue" | "gray" | "red" | "purple";
  onClick?: () => void;
}) {
  const colors = {
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
    red: "border-red-200 bg-red-50 text-red-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };
  const className = `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[tone]} ${
    onClick ? "cursor-pointer hover:opacity-80" : ""
  }`;
  return (
    <button type="button" className={className} onClick={onClick} disabled={!onClick}>
      {children}
    </button>
  );
}

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
  const [matchDoc, setMatchDoc] = useState<OrderDocument | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [savingMatch, setSavingMatch] = useState(false);
  const { data: servicesForMatch = [], isPending: servicesLoading } = useQuery({
    queryKey: orderPageQueryKeys.services(orderCode),
    queryFn: () => fetchOrderServicesList(orderCode),
    enabled: Boolean(orderCode),
  });

  const documentSuggestionCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!documents.length) return map;
    const services = servicesForMatch as MatchableService[];
    for (const doc of documents) {
      if (doc.document_type !== "invoice" || doc.document_state === "deleted") continue;
      if ((doc.matched_service_count || 0) > 0) continue;
      const alreadyMatched = (doc.matched_services || []).map((service) => service.id);
      const { suggestedServiceIds } = suggestServiceMatchesForDocument(
        {
          supplier_name: doc.supplier_name ?? null,
          amount: doc.amount ?? null,
          invoice_date: doc.invoice_date ?? null,
        },
        services,
        alreadyMatched
      );
      if (suggestedServiceIds.length > 0) map.set(doc.id, suggestedServiceIds.length);
    }
    return map;
  }, [documents, servicesForMatch]);

  const supplierInvoiceBreakdown = useMemo(() => {
    const missingServices: MatchableService[] = [];
    let matched = 0;
    let periodic = 0;
    let notRequired = 0;
    for (const raw of servicesForMatch as MatchableService[]) {
      const requirement =
        raw.supplierInvoiceRequirement || raw.supplier_invoice_requirement || "required";
      const count = Number(raw.supplierInvoiceDocumentCount ?? raw.supplier_invoice_document_count ?? 0);
      if (requirement === "not_required") {
        notRequired += 1;
      } else if (requirement === "periodic") {
        periodic += 1;
      } else if (count > 0) {
        matched += 1;
      } else {
        missingServices.push(raw);
      }
    }
    return { missingServices, matched, periodic, notRequired };
  }, [servicesForMatch]);
  const supplierInvoiceCounts = {
    missing: supplierInvoiceBreakdown.missingServices.length,
    matched: supplierInvoiceBreakdown.matched,
    periodic: supplierInvoiceBreakdown.periodic,
    notRequired: supplierInvoiceBreakdown.notRequired,
  };

  const [updatingRequirementServiceId, setUpdatingRequirementServiceId] = useState<string | null>(null);
  const [showAllMissingServices, setShowAllMissingServices] = useState(false);

  const updateServiceRequirement = useCallback(
    async (serviceId: string, requirement: "required" | "periodic" | "not_required") => {
      setUpdatingRequirementServiceId(serviceId);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderCode)}/services/${encodeURIComponent(serviceId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ supplier_invoice_requirement: requirement }),
          }
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to update service requirement");
        }
        await queryClient.invalidateQueries({ queryKey: orderPageQueryKeys.services(orderCode) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update service requirement");
      } finally {
        setUpdatingRequirementServiceId(null);
      }
    },
    [orderCode, queryClient]
  );

  useEffect(() => {
    setDocPage(1);
  }, [orderCode]);

  const showDocumentsEmptyOnboarding =
    !loading && (docPagination?.total ?? 0) === 0 && documents.length === 0;

  const matchDocSuggestions = useMemo(() => {
    if (!matchDoc) {
      return { suggestedServiceIds: [] as string[], details: new Map<string, AutoMatchSuggestion>() };
    }
    const alreadyMatched = (matchDoc.matched_services || []).map((service) => service.id);
    return suggestServiceMatchesForDocument(
      {
        supplier_name: matchDoc.supplier_name ?? null,
        amount: matchDoc.amount ?? null,
        invoice_date: matchDoc.invoice_date ?? null,
      },
      servicesForMatch as MatchableService[],
      alreadyMatched
    );
  }, [matchDoc, servicesForMatch]);

  const openMatchModal = (doc: OrderDocument) => {
    setMatchDoc(doc);
    const initial = new Set<string>((doc.matched_services || []).map((service) => service.id));
    const { suggestedServiceIds } = suggestServiceMatchesForDocument(
      {
        supplier_name: doc.supplier_name ?? null,
        amount: doc.amount ?? null,
        invoice_date: doc.invoice_date ?? null,
      },
      servicesForMatch as MatchableService[],
      Array.from(initial)
    );
    if (initial.size === 0) {
      for (const id of suggestedServiceIds) initial.add(id);
    }
    setSelectedServiceIds(initial);
  };

  const applyAllSuggestions = () => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      for (const id of matchDocSuggestions.suggestedServiceIds) next.add(id);
      return next;
    });
  };

  const closeMatchModal = () => {
    setMatchDoc(null);
    setSelectedServiceIds(new Set());
    setSavingMatch(false);
  };

  const saveMatch = async () => {
    if (!matchDoc) return;
    setSavingMatch(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/documents/${matchDoc.id}/match-services`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ serviceIds: Array.from(selectedServiceIds) }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save service match");
      }
      await queryClient.invalidateQueries({ queryKey: ["order-documents", orderCode] });
      await queryClient.invalidateQueries({ queryKey: orderPageQueryKeys.services(orderCode) });
      closeMatchModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save service match");
      setSavingMatch(false);
    }
  };

  const renderMatchBadge = (doc: OrderDocument) => {
    if (doc.document_state === "deleted") return <StatusBadge tone="red">Deleted</StatusBadge>;
    if (doc.document_state === "replaced") return <StatusBadge tone="amber">Replaced</StatusBadge>;
    const count = doc.matched_service_count || 0;
    if (count > 0) {
      return (
        <StatusBadge tone="green" onClick={() => openMatchModal(doc)}>
          Matched: {count}
        </StatusBadge>
      );
    }
    return (
      <StatusBadge tone="amber" onClick={() => openMatchModal(doc)}>
        Unmatched
      </StatusBadge>
    );
  };

  const renderAccountingBadge = (doc: OrderDocument) => {
    const state = doc.accounting_state || "pending";
    if (state === "processed") {
      return (
        <div>
          <StatusBadge tone="green">Processed</StatusBadge>
          {doc.accounting_processed_at && (
            <div className="mt-1 text-[11px] text-gray-500">{formatDateDDMMYYYY(doc.accounting_processed_at)}</div>
          )}
        </div>
      );
    }
    if (state === "attention") {
      return <StatusBadge tone="red">Attention{doc.attention_reason ? `: ${doc.attention_reason}` : ""}</StatusBadge>;
    }
    if (state === "cancelled_processed") return <StatusBadge tone="purple">Cancelled processed</StatusBadge>;
    return <StatusBadge tone="gray">Pending</StatusBadge>;
  };

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
    const doc = documents.find((item) => item.id === docId);
    const message =
      doc?.accounting_state === "processed" || doc?.accounting_state === "attention"
        ? "This invoice was already processed by accounting. It will be marked as deleted and sent to Attention instead of being permanently removed."
        : "Delete this document?";
    if (!confirm(message)) return;
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

      <div className="mb-3 flex flex-wrap items-center gap-3">
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
        {!servicesLoading && (servicesForMatch as MatchableService[]).length > 0 && (
          <div className="inline-flex flex-wrap items-center gap-2 text-xs">
            {supplierInvoiceCounts.missing > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                <AlertTriangle size={12} />
                {supplierInvoiceCounts.missing} service{supplierInvoiceCounts.missing === 1 ? "" : "s"} without supplier invoice
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-green-700">
                <Check size={12} />
                All required services matched
              </span>
            )}
            {supplierInvoiceCounts.matched > 0 && (
              <span className="text-gray-500">{supplierInvoiceCounts.matched} matched</span>
            )}
            {supplierInvoiceCounts.periodic > 0 && (
              <span className="text-gray-500">{supplierInvoiceCounts.periodic} periodic</span>
            )}
            {supplierInvoiceCounts.notRequired > 0 && (
              <span className="text-gray-500">{supplierInvoiceCounts.notRequired} not required</span>
            )}
          </div>
        )}
      </div>

      {!servicesLoading && supplierInvoiceBreakdown.missingServices.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between border-b border-amber-200/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-amber-800">
            <span>Services waiting for a supplier invoice</span>
            {supplierInvoiceBreakdown.missingServices.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllMissingServices((prev) => !prev)}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
              >
                {showAllMissingServices
                  ? "Show less"
                  : `Show all ${supplierInvoiceBreakdown.missingServices.length}`}
              </button>
            )}
          </div>
          <ul className="divide-y divide-amber-100">
            {(showAllMissingServices
              ? supplierInvoiceBreakdown.missingServices
              : supplierInvoiceBreakdown.missingServices.slice(0, 3)
            ).map((svc) => {
              const id = String(svc.id);
              const name = svc.serviceName || svc.service_name || "Service";
              const supplier = svc.supplierName || svc.supplier_name || "No supplier";
              const dateFrom = svc.serviceDateFrom || svc.service_date_from;
              const dateTo = svc.serviceDateTo || svc.service_date_to;
              const price = svc.servicePrice ?? svc.service_price;
              const dateLabel =
                dateFrom && dateTo && dateFrom !== dateTo
                  ? `${formatDateDDMMYYYY(dateFrom)} — ${formatDateDDMMYYYY(dateTo)}`
                  : dateFrom
                    ? formatDateDDMMYYYY(dateFrom)
                    : "";
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs text-gray-700"
                >
                  <span className="min-w-0 flex-1 truncate" title={`${name}${supplier ? ` · ${supplier}` : ""}`}>
                    <span className="font-medium text-gray-900">{name}</span>
                    {supplier ? <span className="text-gray-500"> · {supplier}</span> : null}
                  </span>
                  {dateLabel ? (
                    <span className="whitespace-nowrap text-gray-500" title="Service dates">
                      {dateLabel}
                    </span>
                  ) : null}
                  {typeof price === "number" ? (
                    <span className="whitespace-nowrap text-gray-500">€{price.toFixed(2)}</span>
                  ) : null}
                  <select
                    value="required"
                    disabled={updatingRequirementServiceId === id}
                    onChange={(event) =>
                      void updateServiceRequirement(
                        id,
                        event.target.value as "required" | "periodic" | "not_required"
                      )
                    }
                    className="h-6 rounded border border-amber-200 bg-white px-1.5 text-[11px] text-gray-700 focus:border-amber-400 focus:outline-none disabled:opacity-50"
                    aria-label={`Supplier invoice requirement for ${name}`}
                  >
                    <option value="required">Required</option>
                    <option value="periodic">Periodic</option>
                    <option value="not_required">Not required</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Invoice No.</th>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Service Match</th>
              <th className="px-4 py-2">Accounting</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const isParsing = parsingIds.has(doc.id);
              const isEditing = editingId === doc.id;
              const cellEmpty = () => isParsing ? <span className="text-gray-500 text-xs flex items-center gap-1"><span className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full block" /> Parsing...</span> : <span className="text-gray-400">—</span>;
              return (
                <tr key={doc.id} className={`border-b border-gray-100 ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`} title={doc.file_name || undefined}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <FileText size={12} />
                      {doc.document_type === "invoice" ? "Invoice" : "Other"}
                    </span>
                  </td>

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
                        ) : cellEmpty()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {doc.invoice_number ? doc.invoice_number : cellEmpty()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={doc.supplier_name || ""}>
                        {doc.supplier_name ? doc.supplier_name : cellEmpty()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{doc.invoice_date ? formatDateDDMMYYYY(doc.invoice_date) : formatDateDDMMYYYY(doc.created_at)}</td>
                    </>
                  )}

                  <td className="px-4 py-3">{renderMatchBadge(doc)}</td>
                  <td className="px-4 py-3">{renderAccountingBadge(doc)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatSize(doc.file_size)}</td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEdit(doc.id)} className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100" title="Save changes"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200" title="Cancel"><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end">
                        {(() => {
                          const suggestionCount = documentSuggestionCounts.get(doc.id) ?? 0;
                          const tooltip =
                            suggestionCount > 0
                              ? `Match services · ${suggestionCount} suggestion${suggestionCount === 1 ? "" : "s"} available`
                              : "Match services";
                          return (
                            <button
                              type="button"
                              onClick={() => openMatchModal(doc)}
                              className={`relative mr-2 inline-flex items-center justify-center rounded p-1 transition-colors disabled:opacity-40 ${
                                suggestionCount > 0
                                  ? "text-emerald-700 hover:bg-emerald-50"
                                  : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"
                              }`}
                              title={tooltip}
                              disabled={doc.document_type !== "invoice" || doc.document_state === "deleted"}
                            >
                              <Link2 size={16} />
                              {suggestionCount > 0 && (
                                <Sparkles size={10} className="absolute -right-1 -top-1 text-emerald-500" />
                              )}
                            </button>
                          );
                        })()}
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

      {matchDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Match services</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {matchDoc.file_name}
                  {matchDoc.supplier_name ? ` · ${matchDoc.supplier_name}` : ""}
                  {matchDoc.invoice_number ? ` · ${matchDoc.invoice_number}` : ""}
                </p>
                {matchDocSuggestions.suggestedServiceIds.length > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                    <Sparkles size={12} />
                    {matchDocSuggestions.suggestedServiceIds.length} suggested match
                    {matchDocSuggestions.suggestedServiceIds.length === 1 ? "" : "es"} based on supplier name
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeMatchModal}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              {servicesLoading ? (
                <div className="py-8 text-center text-gray-500">Loading services...</div>
              ) : servicesForMatch.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No services found for this order.</div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {(servicesForMatch as MatchableService[]).map((service) => {
                    const id = String(service.id);
                    const checked = selectedServiceIds.has(id);
                    const name = service.serviceName || service.service_name || "Service";
                    const supplier = service.supplierName || service.supplier_name || "No supplier";
                    const dateFrom = service.serviceDateFrom || service.service_date_from;
                    const dateTo = service.serviceDateTo || service.service_date_to;
                    const price = service.servicePrice ?? service.service_price;
                    const requirement =
                      service.supplierInvoiceRequirement || service.supplier_invoice_requirement || "required";
                    const suggestion = matchDocSuggestions.details.get(id);
                    return (
                      <label
                        key={id}
                        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                          suggestion ? "bg-emerald-50/40 hover:bg-emerald-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedServiceIds((prev) => {
                              const next = new Set(prev);
                              if (event.target.checked) next.add(id);
                              else next.delete(id);
                              return next;
                            });
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{name}</span>
                            <StatusBadge tone={requirement === "periodic" ? "blue" : requirement === "not_required" ? "gray" : "amber"}>
                              {requirement === "not_required" ? "Not required" : requirement === "periodic" ? "Periodic" : "Required"}
                            </StatusBadge>
                            {suggestion && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-medium text-emerald-700"
                                title={describeAutoMatchReasons(suggestion.reasons)}
                              >
                                <Sparkles size={10} />
                                Suggested
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {[service.category, supplier, dateFrom ? formatDateDDMMYYYY(dateFrom) : null, dateTo && dateTo !== dateFrom ? formatDateDDMMYYYY(dateTo) : null]
                              .filter(Boolean)
                              .join(" · ")}
                            {typeof price === "number" ? ` · €${price.toFixed(2)}` : ""}
                          </div>
                          {suggestion && (
                            <div className="mt-1 text-[11px] text-emerald-700">
                              {describeAutoMatchReasons(suggestion.reasons)}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedServiceIds(new Set())}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={savingMatch}
                >
                  Clear match
                </button>
                {matchDocSuggestions.suggestedServiceIds.length > 0 && (
                  <button
                    type="button"
                    onClick={applyAllSuggestions}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    disabled={savingMatch}
                    title="Select all suggested services"
                  >
                    <Sparkles size={14} />
                    Apply {matchDocSuggestions.suggestedServiceIds.length} suggestion
                    {matchDocSuggestions.suggestedServiceIds.length === 1 ? "" : "s"}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeMatchModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={savingMatch}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveMatch}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={savingMatch}
                >
                  {savingMatch ? "Saving..." : "Save match"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
