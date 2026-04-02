import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

async function profileDisplayName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();
  const row = data as { first_name?: string | null; last_name?: string | null } | null;
  const n = `${row?.first_name || ""} ${row?.last_name || ""}`.trim();
  return n || userId;
}

function formatLogTimestamp(): string {
  const d = new Date();
  const date = formatDateDDMMYYYY(d.toISOString().slice(0, 10));
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} ${time}`;
}

const PAYMENT_FIELD_LABELS: Record<string, string> = {
  amount: "Amount",
  method: "Method",
  paid_at: "Paid at",
  payer_name: "Payer name",
  note: "Note",
  currency: "Currency",
  account_id: "Bank account",
  invoice_id: "Linked invoice",
  payer_party_id: "Payer (party)",
  processor: "Processor",
  processing_fee: "Processing fee",
  status: "Status",
};

function formatPaymentLogValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "amount" || key === "processing_fee") {
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return `€${n.toFixed(2)}`;
  }
  return String(val);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const sa = a === null || a === undefined ? "" : String(a);
  const sb = b === null || b === undefined ? "" : String(b);
  if (sa === sb) return true;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && Math.abs(na - nb) < 0.005) return true;
  return false;
}

export function diffPaymentUpdates(
  before: Record<string, unknown>,
  updates: Record<string, unknown>
): Array<{ field: string; old: string; new: string }> {
  const changes: Array<{ field: string; old: string; new: string }> = [];
  for (const key of Object.keys(updates)) {
    const newVal = updates[key];
    const oldVal = before[key];
    if (valuesEqual(oldVal, newVal)) continue;
    const label = PAYMENT_FIELD_LABELS[key] || key;
    changes.push({
      field: label,
      old: formatPaymentLogValue(key, oldVal),
      new: formatPaymentLogValue(key, newVal),
    });
  }
  return changes;
}

export function formatPaymentSnapshotForLog(row: Record<string, unknown>): string {
  const keys = [
    "amount",
    "method",
    "paid_at",
    "payer_name",
    "note",
    "currency",
    "status",
    "invoice_id",
    "account_id",
  ] as const;
  const lines: string[] = [];
  for (const k of keys) {
    if (row[k] === undefined) continue;
    const label = PAYMENT_FIELD_LABELS[k] || k;
    lines.push(`${label}: ${formatPaymentLogValue(k, row[k])}`);
  }
  return lines.join("\n");
}

/** Order → Log tab (order_communications, not an email). */
export async function insertPaymentUpdatedOrderLog(params: {
  companyId: string;
  orderId: string;
  userId: string;
  paymentId: string;
  changes: Array<{ field: string; old: string; new: string }>;
}): Promise<void> {
  if (params.changes.length === 0) return;
  const author = await profileDisplayName(params.userId);
  const when = formatLogTimestamp();
  const lines = params.changes.map((c) => `${c.field}: ${c.old} → ${c.new}`);
  const body = [`By: ${author}`, `At: ${when}`, `Payment ID: ${params.paymentId}`, ...lines].join("\n");
  const { error } = await supabaseAdmin.from("order_communications").insert({
    company_id: params.companyId,
    order_id: params.orderId,
    type: "other",
    subject: "Payment updated",
    body,
    sent_by: params.userId,
    email_sent: false,
    delivery_status: null,
    open_count: 0,
    email_kind: "general",
  });
  if (error) console.error("[paymentOrderLog] insert update log:", error.message);
}

export async function insertPaymentDeletedOrderLog(params: {
  companyId: string;
  orderId: string;
  userId: string;
  paymentId: string;
  snapshot: string;
}): Promise<void> {
  const author = await profileDisplayName(params.userId);
  const when = formatLogTimestamp();
  const body = [
    `By: ${author}`,
    `At: ${when}`,
    `Payment ID: ${params.paymentId} (deleted)`,
    "",
    params.snapshot,
  ].join("\n");
  const { error } = await supabaseAdmin.from("order_communications").insert({
    company_id: params.companyId,
    order_id: params.orderId,
    type: "other",
    subject: "Payment deleted",
    body,
    sent_by: params.userId,
    email_sent: false,
    delivery_status: null,
    open_count: 0,
    email_kind: "general",
  });
  if (error) console.error("[paymentOrderLog] insert delete log:", error.message);
}
