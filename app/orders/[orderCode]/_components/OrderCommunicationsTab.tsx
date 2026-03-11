"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
} from "lucide-react";

interface Communication {
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
}

function DeliveryBadge({ status, openedAt, openCount }: {
  status: string | null;
  openedAt: string | null;
  openCount: number;
}) {
  if (openedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <Eye className="h-3 w-3" />
        Opened{openCount > 1 ? ` (${openCount}×)` : ""}
      </span>
    );
  }

  switch (status) {
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          <CheckCircle2 className="h-3 w-3" />
          Delivered
        </span>
      );
    case "bounced":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          Bounced
        </span>
      );
    case "complained":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
          <AlertTriangle className="h-3 w-3" />
          Complained
        </span>
      );
    case "sent":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          <Clock className="h-3 w-3" />
          Sent
        </span>
      );
  }
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    to_client: { label: "To Client", cls: "bg-indigo-50 text-indigo-700" },
    from_client: { label: "From Client", cls: "bg-teal-50 text-teal-700" },
    to_supplier: { label: "To Supplier", cls: "bg-amber-50 text-amber-700" },
    from_supplier: { label: "From Supplier", cls: "bg-cyan-50 text-cyan-700" },
    other: { label: "Other", cls: "bg-gray-100 text-gray-600" },
  };
  const t = labels[type] || labels.other;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>
      {t.label}
    </span>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function OrderCommunicationsTab({ orderCode }: { orderCode: string }) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/communications`);
      if (res.ok) {
        const data = await res.json();
        setCommunications(data.communications || []);
      }
    } catch (err) {
      console.error("Failed to fetch communications:", err);
    } finally {
      setLoading(false);
    }
  }, [orderCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No communications yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Email Log
        </h3>
        <button
          onClick={fetchData}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {communications.map((c) => (
          <div key={c.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <TypeBadge type={c.type} />
                  <DeliveryBadge
                    status={c.delivery_status}
                    openedAt={c.opened_at}
                    openCount={c.open_count}
                  />
                  {c.invoice_id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                      <FileText className="h-3 w-3" />
                      Invoice
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium text-gray-900 truncate">
                  {c.subject || "(no subject)"}
                </p>

                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {c.recipient_email && (
                    <span className="truncate">→ {c.recipient_email}</span>
                  )}
                  {c.sender_name && (
                    <span>by {c.sender_name}</span>
                  )}
                </div>

                {c.body && (
                  <p className="mt-1 text-xs text-gray-400 truncate max-w-md">
                    {c.body}
                  </p>
                )}
              </div>

              <div className="text-right text-xs text-gray-500 whitespace-nowrap shrink-0">
                <div>{formatDateDDMMYYYY(c.sent_at)}</div>
                <div>{formatTime(c.sent_at)}</div>
                {c.delivered_at && (
                  <div className="text-blue-500 mt-0.5">
                    ✓ {formatTime(c.delivered_at)}
                  </div>
                )}
                {c.opened_at && (
                  <div className="text-green-600 mt-0.5">
                    👁 {formatTime(c.opened_at)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
