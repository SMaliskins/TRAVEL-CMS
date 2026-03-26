"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/i18n";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";
import { useToast } from "@/contexts/ToastContext";

type ApiService = Record<string, unknown>;

type Row = {
  id: string;
  category: string;
  serviceName: string;
  resStatus: string;
  clientName: string;
  supplierName: string;
  clientPrice: number;
  servicePrice: number;
  include: boolean;
  pctOverride: number | null;
  fixedOverride: number | null;
  marginGross: number;
  vatOnMargin: number;
  profitNet: number;
};

function formatMoney(n: number) {
  return `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Draft or stored numeric field; empty string in draft → null */
function parseDraftDecimal(
  draft: string | undefined,
  stored: number | null
): number | null {
  if (draft !== undefined) {
    const trimmed = draft.trim().replace(",", ".");
    if (trimmed === "") return null;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return stored;
}

/**
 * Live estimate: if % is set (draft or saved), use profit (ex VAT) × %; otherwise use fixed.
 * Lets you type % while fixed is still in the field — Est follows % until you save (then PATCH clears the other).
 */
function estimatedReferralAmount(
  r: Row,
  draftPct: Record<string, string>,
  draftFixed: Record<string, string>
): number | null {
  const pct = parseDraftDecimal(draftPct[r.id], r.pctOverride);
  if (pct != null) {
    return Math.round(r.profitNet * (pct / 100) * 100) / 100;
  }
  const fixed = parseDraftDecimal(draftFixed[r.id], r.fixedOverride);
  if (fixed != null) return fixed;
  return null;
}

function mapService(raw: ApiService): Row {
  const econ = computeServiceLineEconomics({
    client_price: raw.clientPrice ?? raw.client_price,
    service_price: raw.servicePrice ?? raw.service_price,
    service_type:
      raw.serviceType != null || raw.service_type != null
        ? String(raw.serviceType ?? raw.service_type)
        : undefined,
    category: raw.category != null ? String(raw.category) : undefined,
    commission_amount: raw.commissionAmount ?? raw.commission_amount,
    vat_rate: raw.vatRate ?? raw.vat_rate,
  });
  return {
    id: String(raw.id),
    category: String(raw.category || ""),
    serviceName: String(raw.serviceName ?? raw.service_name ?? ""),
    resStatus: String(raw.resStatus ?? raw.res_status ?? ""),
    clientName: String(raw.clientName ?? raw.client_name ?? "—"),
    supplierName: String(raw.supplierName ?? raw.supplier_name ?? "—"),
    clientPrice: Number(raw.clientPrice ?? raw.client_price ?? 0),
    servicePrice: Number(raw.servicePrice ?? raw.service_price ?? 0),
    include: (raw.referralIncludeInCommission ?? raw.referral_include_in_commission) !== false,
    pctOverride: (() => {
      const v = raw.referralCommissionPercentOverride ?? raw.referral_commission_percent_override;
      if (v == null || v === "") return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    })(),
    fixedOverride: (() => {
      const v = raw.referralCommissionFixedAmount ?? raw.referral_commission_fixed_amount;
      if (v == null || v === "") return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    })(),
    marginGross: econ.marginGross,
    vatOnMargin: econ.vatOnMargin,
    profitNet: econ.profitNetOfVat,
  };
}

export default function OrderReferralServicesPanel({
  orderCode,
  orderId: orderIdProp,
  referralPartyId,
  lang,
}: {
  orderCode: string;
  orderId?: string;
  referralPartyId: string | null;
  lang: string;
}) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalProcessingFees, setTotalProcessingFees] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [draftPct, setDraftPct] = useState<Record<string, string>>({});
  const [draftFixed, setDraftFixed] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!orderCode) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast("error", (err as { error?: string }).error || `Failed to load services (${res.status})`);
        return;
      }
      const data = await res.json();
      setRows((data.services || []).map((r: ApiService) => mapService(r)));
      setDraftPct({});
      setDraftFixed({});

      // Load processing fees from payments
      if (orderIdProp) {
        const feesRes = await fetch(
          `/api/finances/payments?orderId=${orderIdProp}`,
          {
            headers: {
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
          }
        );
        if (feesRes.ok) {
          const feesData = await feesRes.json();
          const fees = ((feesData.data || []) as { processing_fee?: number; status?: string }[])
            .filter((p) => p.status !== "cancelled")
            .reduce((sum, p) => sum + (Number(p.processing_fee) || 0), 0);
          setTotalProcessingFees(fees);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [orderCode, orderIdProp, showToast]);

  useEffect(() => {
    void load();
  }, [load, referralPartyId]);

  const persist = useCallback(
    async (serviceId: string, body: Record<string, unknown>) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderCode)}/services/${serviceId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify(body),
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: string;
          message?: string;
        };
        if (!res.ok) {
          const msg =
            data.error ||
            data.details ||
            data.message ||
            `Could not save (${res.status}). Check DB migrations for referral columns.`;
          showToast("error", msg);
          return;
        }
        await load();
      } catch {
        showToast("error", "Network error while saving");
        await load();
      }
    },
    [orderCode, load, showToast]
  );

  const schedulePct = (serviceId: string, raw: string) => {
    const prev = timers.current[`pct-${serviceId}`];
    if (prev) clearTimeout(prev);
    timers.current[`pct-${serviceId}`] = setTimeout(() => {
      const trimmed = raw.trim().replace(",", ".");
      const num = trimmed === "" ? null : parseFloat(trimmed);
      if (trimmed !== "" && !Number.isFinite(num)) return;
      void persist(serviceId, {
        referralCommissionPercentOverride: num,
        referralCommissionFixedAmount: num != null ? null : undefined,
      });
      delete timers.current[`pct-${serviceId}`];
    }, 500);
  };

  const scheduleFixed = (serviceId: string, raw: string) => {
    const prev = timers.current[`fix-${serviceId}`];
    if (prev) clearTimeout(prev);
    timers.current[`fix-${serviceId}`] = setTimeout(() => {
      const trimmed = raw.trim().replace(",", ".");
      const num = trimmed === "" ? null : parseFloat(trimmed);
      if (trimmed !== "" && !Number.isFinite(num)) return;
      void persist(serviceId, {
        referralCommissionFixedAmount: num,
        referralCommissionPercentOverride: num != null ? null : undefined,
      });
      delete timers.current[`fix-${serviceId}`];
    }, 500);
  };

  if (!referralPartyId) {
    return (
      <p className="text-sm text-gray-500">{t(lang, "order.referralServicesNeedPartner")}</p>
    );
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(lang, "order.referralServicesTitle")}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {loading ? "…" : t(lang, "order.referralServicesRefresh")}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{t(lang, "order.referralServicesHint")}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[1260px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-2 py-2 font-medium text-gray-700">{t(lang, "order.servCategory")}</th>
              <th className="px-2 py-2 font-medium text-gray-700">{t(lang, "order.servName")}</th>
              <th className="px-2 py-2 font-medium text-gray-700">{t(lang, "order.servStatus")}</th>
              <th className="px-2 py-2 font-medium text-gray-700">{t(lang, "order.servClient")}</th>
              <th className="px-2 py-2 font-medium text-gray-700">{t(lang, "order.servSupplier")}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700">{t(lang, "order.servClientPrice")}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700">{t(lang, "order.servServicePrice")}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700">Fees</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700">{t(lang, "order.referralColMarginGross")}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700">{t(lang, "order.referralColProfitNet")}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700">{t(lang, "order.referralColVat")}</th>
              <th className="px-2 py-2 text-center font-medium text-gray-700">{t(lang, "order.servReferralIncludeShort")}</th>
              <th className="px-2 py-2 text-center font-medium text-gray-700">{t(lang, "order.referralColPctShort")}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-700" title={t(lang, "order.referralColEstHint")}>
                {t(lang, "order.referralColEstShort")}
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-700">{t(lang, "order.referralColFixedShort")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {(() => {
              const totalMargin = rows.reduce((s, r) => s + Math.max(r.marginGross, 0), 0);
              return rows.map((r) => {
                const feeShare = totalMargin > 0 && totalProcessingFees > 0
                  ? Math.round(totalProcessingFees * (Math.max(r.marginGross, 0) / totalMargin) * 100) / 100
                  : 0;
                const adjustedMargin = r.marginGross - feeShare;
                const ratio = r.marginGross > 0 ? adjustedMargin / r.marginGross : 1;
                const adjustedVat = Math.round(r.vatOnMargin * ratio * 100) / 100;
                const adjustedProfitNet = Math.round((adjustedMargin - adjustedVat) * 100) / 100;
                const est = estimatedReferralAmount(r, draftPct, draftFixed);
                return (
              <tr key={r.id} className="hover:bg-gray-50/80">
                <td className="px-2 py-1.5 text-gray-700">{r.category}</td>
                <td className="px-2 py-1.5 font-medium text-gray-900 max-w-[220px] truncate" title={r.serviceName}>
                  {r.serviceName}
                </td>
                <td className="px-2 py-1.5 capitalize text-gray-700">{r.resStatus}</td>
                <td className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{r.clientName}</td>
                <td className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{r.supplierName}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(r.clientPrice)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(r.servicePrice)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-red-600">{feeShare > 0 ? formatMoney(feeShare) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-gray-800">{formatMoney(adjustedMargin)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">{formatMoney(adjustedProfitNet)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{formatMoney(adjustedVat)}</td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRows((prev) =>
                        prev.map((x) => (x.id === r.id ? { ...x, include: checked } : x))
                      );
                      void persist(r.id, { referralIncludeInCommission: checked });
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    title={t(lang, "order.servReferralIncludeHint")}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center tabular-nums"
                    placeholder="—"
                    title={t(lang, "order.referralColPctHint")}
                    value={
                      draftPct[r.id] !== undefined
                        ? draftPct[r.id]
                        : r.pctOverride != null
                          ? String(r.pctOverride)
                          : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftPct((d) => ({ ...d, [r.id]: v }));
                      schedulePct(r.id, v);
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-gray-700" title={t(lang, "order.referralColEstHint")}>
                  {est != null ? formatMoney(est) : "—"}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-16 rounded border border-gray-200 px-1 py-0.5 text-right tabular-nums"
                    placeholder="—"
                    title={t(lang, "order.referralColFixedHint")}
                    value={
                      draftFixed[r.id] !== undefined
                        ? draftFixed[r.id]
                        : r.fixedOverride != null
                          ? String(r.fixedOverride)
                          : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftFixed((d) => ({ ...d, [r.id]: v }));
                      scheduleFixed(r.id, v);
                    }}
                  />
                </td>
              </tr>
            );
            });
            })()}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-gray-400">
        {t(lang, "order.referralServicesFootnote")}
      </p>
    </div>
  );
}
