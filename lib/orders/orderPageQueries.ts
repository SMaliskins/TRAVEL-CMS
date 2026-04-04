/**
 * ORDER_PAGE_PERF_SPEC Step 4: shared React Query keys + fetchers for order page tabs.
 */

import { supabase } from "@/lib/supabaseClient";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import type { DirectoryRecord } from "@/lib/types/directory";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";

export const orderPageQueryKeys = {
  services: (orderCode: string) => ["order-services", orderCode] as const,
  documents: (orderCode: string) => ["order-documents", orderCode] as const,
  communications: (orderCode: string) => ["order-communications", orderCode] as const,
  clientsDataParties: (orderCode: string) => ["order-clients-data-parties", orderCode] as const,
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

export async function fetchOrderDocuments(orderCode: string): Promise<OrderDocumentListRow[]> {
  const headers = await authHeaders();
  const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/documents`, {
    headers,
    credentials: "include",
  });
  const json = (await res.json().catch(() => ({}))) as { documents?: OrderDocumentListRow[]; error?: string };
  if (!res.ok) {
    const msg =
      res.status === 503
        ? "Database connection failed. Please try again later."
        : json.error || "Failed to load documents";
    throw new Error(msg);
  }
  return json.documents ?? [];
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
};

export async function fetchOrderCommunications(orderCode: string): Promise<CommunicationListRow[]> {
  const headers = await authHeaders();
  const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/communications`, {
    headers,
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { communications?: CommunicationListRow[] };
  return data.communications ?? [];
};

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
