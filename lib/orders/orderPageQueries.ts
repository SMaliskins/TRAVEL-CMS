/**
 * ORDER_PAGE_PERF_SPEC Step 4: shared React Query keys + fetchers for order page tabs.
 */

import { supabase } from "@/lib/supabaseClient";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import type { DirectoryRecord } from "@/lib/types/directory";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";

/** Paginated tab fetch sizes (ORDER_PAGE_PERF_SPEC). */
export const ORDER_DOCUMENTS_PAGE_SIZE = 30;
export const ORDER_COMMUNICATIONS_PAGE_SIZE = 40;

/** Clients Data tab + idle prefetch: avoid refetch while user switches tabs on the same order. */
export const ORDER_CLIENTS_DATA_STALE_MS = 60_000;

/** Invoices & Payments tab — first page + prefetch after bootstrap. */
export const ORDER_INVOICES_LIST_PAGE_SIZE = 30;
export const ORDER_INVOICES_STALE_MS = 60_000;

export type OrderInvoicesPaymentSummary = {
  totalPaid: number;
  linkedToInvoices: number;
  deposit: number;
};

export type OrderInvoicesQueryResult = {
  invoices: unknown[];
  paymentSummary: OrderInvoicesPaymentSummary | null;
  pagination: { page: number; pageSize: number; total: number } | null;
};

export const orderPageQueryKeys = {
  services: (orderCode: string) => ["order-services", orderCode] as const,
  documents: (orderCode: string, page: number) => ["order-documents", orderCode, page] as const,
  communications: (orderCode: string, page: number) => ["order-communications", orderCode, page] as const,
  clientsDataParties: (orderCode: string) => ["order-clients-data-parties", orderCode] as const,
  invoices: (orderCode: string, page: number, pageSize: number) =>
    ["order-invoices", orderCode, page, pageSize] as const,
};

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function fetchOrderServicesList(orderCode: string): Promise<unknown[]> {
  const headers = await authHeaders();
  const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
    headers,
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { services?: unknown[] };
  return data.services ?? [];
}

/** Row shape matches OrderDocumentsTab `OrderDocument`. */
export type OrderDocumentListRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string | null;
  created_at: string;
  download_url?: string | null;
  amount?: number | null;
  currency?: string | null;
  invoice_number?: string | null;
  supplier_name?: string | null;
  invoice_date?: string | null;
};

export type ListPagination = { offset: number; limit: number; total: number };

export type OrderDocumentsQueryResult = {
  documents: OrderDocumentListRow[];
  pagination?: ListPagination;
};

export async function fetchOrderDocuments(
  orderCode: string,
  page = 1
): Promise<OrderDocumentsQueryResult> {
  const headers = await authHeaders();
  const offset = (Math.max(1, page) - 1) * ORDER_DOCUMENTS_PAGE_SIZE;
  const res = await fetch(
    `/api/orders/${encodeURIComponent(orderCode)}/documents?limit=${ORDER_DOCUMENTS_PAGE_SIZE}&offset=${offset}`,
    {
      headers,
      credentials: "include",
    }
  );
  const json = (await res.json().catch(() => ({}))) as {
    documents?: OrderDocumentListRow[];
    pagination?: ListPagination;
    error?: string;
  };
  if (!res.ok) {
    const msg =
      res.status === 503
        ? "Database connection failed. Please try again later."
        : json.error || "Failed to load documents";
    throw new Error(msg);
  }
  return { documents: json.documents ?? [], pagination: json.pagination };
}

export type CommunicationListRow = {
  id: string;
  type: string;
  recipient_email: string | null;
  subject: string | null;
  body: string | null;
  sent_at: string;
  sender_name: string | null;
  email_sent: boolean;
  delivery_status: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  open_count: number;
  invoice_id: string | null;
  service_id: string | null;
  email_kind?: string | null;
};

export type OrderCommunicationsQueryResult = {
  communications: CommunicationListRow[];
  pagination?: ListPagination;
};

/** Tab: paginated log. Optional `invoiceIds` (e.g. InvoiceList) uses filter + high limit instead of page. */
export async function fetchOrderCommunications(
  orderCode: string,
  page = 1,
  opts?: { invoiceIds?: string[] }
): Promise<OrderCommunicationsQueryResult> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (opts?.invoiceIds?.length) {
    params.set("invoiceIds", opts.invoiceIds.slice(0, 200).join(","));
    params.set("limit", "500");
    params.set("offset", "0");
  } else {
    params.set("limit", String(ORDER_COMMUNICATIONS_PAGE_SIZE));
    params.set("offset", String((Math.max(1, page) - 1) * ORDER_COMMUNICATIONS_PAGE_SIZE));
  }
  const res = await fetch(
    `/api/orders/${encodeURIComponent(orderCode)}/communications?${params.toString()}`,
    {
      headers,
      credentials: "include",
    }
  );
  if (!res.ok) return { communications: [] };
  const data = (await res.json()) as {
    communications?: CommunicationListRow[];
    pagination?: ListPagination;
  };
  return { communications: data.communications ?? [], pagination: data.pagination };
}

export type ClientsDataPartiesPayload = {
  parties: { partyId: string; tags: RelatedPartyTag[] }[];
  leadPartyId?: string | null;
  nameOnlyPayers: string[];
  partyRows?: { partyId: string; tags: RelatedPartyTag[]; record: DirectoryRecord | null }[];
  error?: string;
};

export async function fetchOrderClientsDataParties(orderCode: string): Promise<ClientsDataPartiesPayload> {
  const metaRes = await fetchWithAuth(`/api/orders/${encodeURIComponent(orderCode)}/clients-data-parties`);
  const metaJson = (await metaRes.json()) as ClientsDataPartiesPayload;
  if (!metaRes.ok || metaJson.error) {
    throw new Error(metaJson.error || "Failed to load");
  }
  return metaJson;
}

export async function fetchOrderInvoicesPage(
  orderCode: string,
  page: number,
  pageSize: number = ORDER_INVOICES_LIST_PAGE_SIZE
): Promise<OrderInvoicesQueryResult> {
  const headers = await authHeaders();
  const response = await fetch(
    `/api/orders/${encodeURIComponent(orderCode)}/invoices?page=${page}&pageSize=${pageSize}`,
    {
      credentials: "include",
      headers,
    }
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let rawMsg = typeof (errorData as { error?: string }).error === "string" ? (errorData as { error: string }).error : "";
    if (/fetch failed|TypeError|ECONNREFUSED|ETIMEDOUT/i.test(rawMsg)) {
      rawMsg = "Database connection failed. Please try again later.";
    } else if (!rawMsg || /^[{}[\]]+$/.test(rawMsg.trim())) {
      rawMsg =
        response.status === 503
          ? "Database connection failed. Please try again later."
          : response.status === 404
            ? "Order not found."
            : `Failed to load invoices (${response.status})`;
    }
    throw new Error(rawMsg);
  }
  const data = (await response.json()) as {
    invoices?: unknown[];
    paymentSummary?: OrderInvoicesPaymentSummary | null;
    pagination?: { page: number; pageSize: number; total: number };
  };
  return {
    invoices: data.invoices ?? [],
    paymentSummary: data.paymentSummary ?? null,
    pagination: data.pagination ?? null,
  };
}
