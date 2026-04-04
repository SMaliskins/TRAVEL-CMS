"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/i18n";
import { computeServiceLineEconomics } from "@/lib/orders/serviceEconomics";
import {
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface Props {
  orderCode: string;
  orderId: string;
  currency: string;
  lang: string;
  hasReferral: boolean;
  /** When set, service rows reuse parent fetch (`null` = parent still loading). Omit to fetch services inside this component. */
  servicesFromParent?: unknown[] | null;
}

type ServiceRow = {
  id: string;
  category: string;
  serviceName: string;
  serviceType: string;
  resStatus: string;
  clientPrice: number;
  servicePrice: number;
  commissionAmount: number | null;
  vatRate: number | null;
  referralIncludeInCommission: boolean;
  referralCommissionPercentOverride: number | null;
  referralCommissionFixedAmount: number | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  processing_fee: number;
  processor: string | null;
};

type Econ = {
  clientSigned: number;
  serviceSigned: number;
  marginGross: number;
  vatOnMargin: number;
  profitNetOfVat: number;
};

type ServiceWithEcon = ServiceRow & {
  econ: Econ;
  feeShare: number;
  referralAmount: number;
  netProfit: number;
};

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pctOfRevenue(value: number, revenue: number): string {
  if (revenue <= 0) return "—";
  return `${((Math.abs(value) / revenue) * 100).toFixed(1)}%`;
}

function pctOfGrossMargin(value: number, margin: number): string {
  if (margin <= 0) return "—";
  return `${((value / margin) * 100).toFixed(1)}%`;
}

/** Excluded from revenue/margin totals; shown only under Cancelled. */
function isExcludedFromFinanceTotals(svc: ServiceRow): boolean {
  if ((svc.resStatus || "").toLowerCase() === "cancelled") return true;
  if (svc.serviceType === "cancellation") return true;
  return false;
}

/** One subtle line under amounts (KPI + Margin Flow only) */
function PctSubline({ pct, label, align = "start" }: { pct: string; label: string; align?: "start" | "end" }) {
  const cls = align === "end" ? "text-right" : "text-left";
  return (
    <div className={`mt-0.5 text-[11px] tabular-nums text-gray-500 ${cls}`}>
      {pct === "—" ? "—" : `${pct} ${label}`}
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  bank_transfer: "#3b82f6",
  card: "#8b5cf6",
  cash: "#10b981",
  other: "#6b7280",
};

function mapApiRowsToFinanceServices(rows: unknown[]): ServiceRow[] {
  return rows.map((r) => {
    const s = r as Record<string, unknown>;
    return {
      id: String(s.id),
      category: String(s.category || ""),
      serviceName: String(s.serviceName || ""),
      serviceType: String(s.serviceType || "original"),
      resStatus: String(s.resStatus || ""),
      clientPrice: Number(s.clientPrice) || 0,
      servicePrice: Number(s.servicePrice) || 0,
      commissionAmount: s.commissionAmount != null ? Number(s.commissionAmount) : null,
      vatRate: s.vatRate != null ? Number(s.vatRate) : null,
      referralIncludeInCommission: s.referralIncludeInCommission !== false,
      referralCommissionPercentOverride: s.referralCommissionPercentOverride != null ? Number(s.referralCommissionPercentOverride) : null,
      referralCommissionFixedAmount: s.referralCommissionFixedAmount != null ? Number(s.referralCommissionFixedAmount) : null,
    };
  });
}

export default function OrderFinanceOverview({ orderCode, orderId, currency, lang, hasReferral, servicesFromParent }: Props) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const session = (await supabase.auth.getSession()).data.session;
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      if (servicesFromParent !== undefined) {
        if (servicesFromParent === null) {
          setLoading(true);
          return;
        }
        setLoading(true);
        const payRes = await fetch(`/api/finances/payments?orderId=${orderId}`, { headers });
        if (cancelled) return;
        const payData = payRes.ok ? await payRes.json() : { payments: [] };
        const payMapped: PaymentRow[] = (payData.payments || payData.data || []).map((p: Record<string, unknown>) => ({
          id: String(p.id),
          amount: Number(p.amount) || 0,
          method: String(p.method || "other"),
          status: String(p.status || "active"),
          processing_fee: Number(p.processing_fee) || 0,
          processor: p.processor ? String(p.processor) : null,
        }));
        setServices(mapApiRowsToFinanceServices(servicesFromParent));
        setPayments(payMapped);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [svcRes, payRes] = await Promise.all([
        fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, { headers }),
        fetch(`/api/finances/payments?orderId=${orderId}`, { headers }),
      ]);

      if (cancelled) return;

      const svcData = svcRes.ok ? await svcRes.json() : { services: [] };
      const payData = payRes.ok ? await payRes.json() : { payments: [] };

      const mapped = mapApiRowsToFinanceServices(svcData.services || []);

      const payMapped: PaymentRow[] = (payData.payments || payData.data || []).map((p: Record<string, unknown>) => ({
        id: String(p.id),
        amount: Number(p.amount) || 0,
        method: String(p.method || "other"),
        status: String(p.status || "active"),
        processing_fee: Number(p.processing_fee) || 0,
        processor: p.processor ? String(p.processor) : null,
      }));

      setServices(mapped);
      setPayments(payMapped);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [orderCode, orderId, servicesFromParent]);

  const activePayments = useMemo(() => payments.filter((p) => p.status !== "cancelled"), [payments]);

  const computed = useMemo(() => {
    const active: ServiceWithEcon[] = [];
    const cancelled: ServiceWithEcon[] = [];

    for (const svc of services) {
      const econ = computeServiceLineEconomics({
        client_price: svc.clientPrice,
        service_price: svc.servicePrice,
        service_type: svc.serviceType,
        category: svc.category,
        commission_amount: svc.commissionAmount,
        vat_rate: svc.vatRate,
      });
      const row: ServiceWithEcon = { ...svc, econ, feeShare: 0, referralAmount: 0, netProfit: 0 };
      if (isExcludedFromFinanceTotals(svc)) {
        cancelled.push(row);
      } else {
        active.push(row);
      }
    }

    const totalRevenue = active.reduce((s, r) => s + r.econ.clientSigned, 0);
    const totalMarginGross = active.reduce((s, r) => s + r.econ.marginGross, 0);
    const totalCost = totalRevenue - totalMarginGross;
    const totalVat = active.reduce((s, r) => s + r.econ.vatOnMargin, 0);
    const totalProcessingFees = activePayments.reduce((s, p) => s + p.processing_fee, 0);

    const totalPositiveMargin = active.reduce((s, r) => s + Math.max(r.econ.marginGross, 0), 0);
    for (const row of active) {
      row.feeShare =
        totalPositiveMargin > 0 && totalProcessingFees > 0
          ? Math.round(totalProcessingFees * (Math.max(row.econ.marginGross, 0) / totalPositiveMargin) * 100) / 100
          : 0;
    }

    let totalReferral = 0;
    if (hasReferral) {
      const totalOrigProfit = active
        .filter((r) => r.referralIncludeInCommission)
        .reduce((s, r) => s + r.econ.profitNetOfVat, 0);

      const profitAfterFees = totalMarginGross - totalVat -
        (totalMarginGross > 0 ? totalProcessingFees * ((totalMarginGross - totalVat) / totalMarginGross) : 0);

      for (const row of active) {
        if (!row.referralIncludeInCommission) continue;
        if (row.referralCommissionFixedAmount != null && row.referralCommissionFixedAmount > 0) {
          row.referralAmount = row.referralCommissionFixedAmount;
        } else if (row.referralCommissionPercentOverride != null && row.referralCommissionPercentOverride > 0) {
          const lineProfitShare = totalOrigProfit > 0
            ? profitAfterFees * (row.econ.profitNetOfVat / totalOrigProfit)
            : 0;
          row.referralAmount = Math.round(lineProfitShare * row.referralCommissionPercentOverride / 100 * 100) / 100;
        }
        totalReferral += row.referralAmount;
      }
    }

    for (const row of active) {
      const adjMargin = row.econ.marginGross - row.feeShare;
      const ratio = row.econ.marginGross > 0 ? adjMargin / row.econ.marginGross : 1;
      const adjVat = Math.round(row.econ.vatOnMargin * ratio * 100) / 100;
      row.netProfit = adjMargin - adjVat - row.referralAmount;
    }

    const adjustedMargin = totalMarginGross - totalProcessingFees;
    const feeRatio = totalMarginGross > 0 ? adjustedMargin / totalMarginGross : 1;
    const adjustedVat = Math.round(totalVat * feeRatio * 100) / 100;
    const profitAfterFeesAndVat = adjustedMargin - adjustedVat;
    const netProfit = profitAfterFeesAndVat - totalReferral;
    const totalPaid = activePayments.reduce((s, p) => s + p.amount, 0);
    const totalPaidNet = totalPaid - totalProcessingFees;

    const METHOD_LABELS: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      card: "CC",
      cash: "Cash",
    };

    const paidLines: { method: string; label: string; gross: number; fee: number; net: number }[] = [];
    const methodAgg = new Map<string, { gross: number; fee: number }>();
    for (const p of activePayments) {
      const cur = methodAgg.get(p.method) || { gross: 0, fee: 0 };
      cur.gross += p.amount;
      cur.fee += p.processing_fee;
      methodAgg.set(p.method, cur);
    }
    Array.from(methodAgg.entries()).forEach(([method, agg]) => {
      paidLines.push({
        method,
        label: METHOD_LABELS[method] || method,
        gross: agg.gross,
        fee: agg.fee,
        net: agg.gross - agg.fee,
      });
    });

    return {
      active,
      cancelled,
      totalRevenue,
      totalCost,
      totalMarginGross,
      totalVat,
      totalProcessingFees,
      totalReferral,
      adjustedVat,
      netProfit,
      totalPaid,
      totalPaidNet,
      paidLines,
    };
  }, [services, activePayments, hasReferral]);

  const plRows = useMemo(() => {
    const { totalRevenue, totalCost, totalMarginGross, totalVat, totalProcessingFees, totalReferral, adjustedVat: adjVat, netProfit } = computed;
    if (totalRevenue <= 0) return [];
    const vatDisplay = totalProcessingFees > 0 ? adjVat : totalVat;
    const rows: { label: string; value: number; running: number; sign: "+" | "−"; color: string; bold?: boolean }[] = [];
    let running = totalRevenue;
    rows.push({ label: t(lang, "order.finances.revenue"), value: totalRevenue, running, sign: "+", color: "#3b82f6", bold: true });
    running -= totalCost;
    rows.push({ label: `− ${t(lang, "order.finances.cost")}`, value: totalCost, running, sign: "−", color: "#6b7280" });
    rows.push({ label: t(lang, "order.finances.grossMargin"), value: totalMarginGross, running, sign: "+", color: "#10b981", bold: true });
    running -= vatDisplay;
    rows.push({ label: `− ${t(lang, "order.finances.vat")}`, value: vatDisplay, running, sign: "−", color: "#f59e0b" });
    if (totalProcessingFees > 0) {
      running -= totalProcessingFees;
      rows.push({ label: `− ${t(lang, "order.finances.processingFees")}`, value: totalProcessingFees, running, sign: "−", color: "#ef4444" });
    }
    if (hasReferral && totalReferral > 0) {
      running -= totalReferral;
      rows.push({ label: `− ${t(lang, "order.finances.referralCommission")}`, value: totalReferral, running, sign: "−", color: "#8b5cf6" });
    }
    rows.push({ label: t(lang, "order.finances.netProfit"), value: netProfit, running: netProfit, sign: "+", color: netProfit >= 0 ? "#059669" : "#dc2626", bold: true });
    return rows;
  }, [computed, lang, hasReferral]);

  const pieData = useMemo(() => {
    return computed.paidLines.map((pl) => ({
      name: pl.label,
      value: Math.round(pl.net * 100) / 100,
      color: METHOD_COLORS[pl.method] || "#6b7280",
    }));
  }, [computed.paidLines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-800" />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 shadow-sm text-center text-gray-500">
        {t(lang, "order.finances.noServices")}
      </div>
    );
  }

  const { active, cancelled, totalRevenue, totalCost, totalMarginGross, totalVat, totalProcessingFees, totalReferral, adjustedVat, netProfit, totalPaidNet, paidLines } = computed;
  const outstanding = totalRevenue - totalPaidNet;

  const kpis: { id: string; label: string; value: number; color: string; bg: string }[] = [
    { id: "revenue", label: t(lang, "order.finances.revenue"), value: totalRevenue, color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
    { id: "cost", label: t(lang, "order.finances.cost"), value: totalCost, color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
    { id: "margin", label: t(lang, "order.finances.grossMargin"), value: totalMarginGross, color: totalMarginGross >= 0 ? "text-emerald-700" : "text-red-700", bg: totalMarginGross >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100" },
    { id: "vat", label: t(lang, "order.finances.vat"), value: totalProcessingFees > 0 ? adjustedVat : totalVat, color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
    ...(totalProcessingFees > 0
      ? [{ id: "fees", label: t(lang, "order.finances.processingFees"), value: totalProcessingFees, color: "text-red-600", bg: "bg-red-50 border-red-100" }]
      : []),
    ...(hasReferral && totalReferral > 0
      ? [{ id: "referral", label: t(lang, "order.finances.referralCommission"), value: totalReferral, color: "text-purple-700", bg: "bg-purple-50 border-purple-100" }]
      : []),
    { id: "net", label: t(lang, "order.finances.netProfit"), value: netProfit, color: netProfit >= 0 ? "text-emerald-800" : "text-red-800", bg: netProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200" },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {kpis.map((k) => {
          const useMarginPct = ["vat", "fees", "referral", "net"].includes(k.id) && totalMarginGross > 0;
          const pct =
            totalRevenue <= 0
              ? "—"
              : k.id === "revenue"
                ? "100.0%"
                : useMarginPct
                  ? pctOfGrossMargin(k.value, totalMarginGross)
                  : pctOfRevenue(k.value, totalRevenue);
          const pctLabel = useMarginPct ? t(lang, "order.finances.pctOfGrossMargin") : t(lang, "order.finances.pctOfRevenue");
          return (
            <div key={k.id} className={`shrink-0 rounded-xl border px-4 py-3 min-w-[140px] ${k.bg}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{k.label}</div>
              <div className={`text-lg font-bold tabular-nums ${k.color}`}>{fmt(k.value, currency)}</div>
              <PctSubline pct={pct} label={pctLabel} align="start" />
            </div>
          );
        })}
      </div>

      {/* P&L Waterfall */}
      {plRows.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t(lang, "order.finances.marginFlow")}</h3>
          <div className="space-y-1.5">
            {plRows.map((row, idx) => {
              const barPct = totalRevenue > 0 ? (Math.abs(row.value) / totalRevenue) * 100 : 0;
              const sharePct =
                totalRevenue <= 0
                  ? "—"
                  : idx === 0
                    ? "100.0%"
                    : idx <= 2
                      ? pctOfRevenue(row.value, totalRevenue)
                      : pctOfGrossMargin(row.value, totalMarginGross);
              const shareLabel =
                totalRevenue <= 0
                  ? ""
                  : idx <= 2
                    ? t(lang, "order.finances.pctOfRevenue")
                    : t(lang, "order.finances.pctOfGrossMargin");
              return (
                <div key={row.label} className={`flex items-center gap-3 ${row.bold ? "py-1" : "py-0.5"}`}>
                  <div className={`w-[160px] shrink-0 text-xs ${row.bold ? "font-bold text-gray-900" : "text-gray-500"} truncate`}>
                    {row.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="w-full bg-gray-50 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(barPct, 100)}%`, backgroundColor: row.color, opacity: row.bold ? 1 : 0.7 }}
                      />
                    </div>
                  </div>
                  <div className={`w-[148px] shrink-0 text-right tabular-nums text-xs ${row.bold ? "font-bold text-gray-900" : "text-gray-600"}`}>
                    <div>{fmt(row.value, currency)}</div>
                    <PctSubline pct={sharePct} label={shareLabel} align="end" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Breakdown Table */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t(lang, "order.finances.serviceBreakdown")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 800 }}>
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                <th className="text-left px-2 py-2 font-semibold">#</th>
                <th className="text-left px-2 py-2 font-semibold">{t(lang, "order.finances.service")}</th>
                <th className="text-left px-2 py-2 font-semibold">{t(lang, "order.finances.category")}</th>
                <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.clientPrice")}</th>
                <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.cost")}</th>
                <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.grossMargin")}</th>
                <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.vat")}</th>
                {totalProcessingFees > 0 && (
                  <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.fees")}</th>
                )}
                {hasReferral && (
                  <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.refCom")}</th>
                )}
                <th className="text-right px-2 py-2 font-semibold">{t(lang, "order.finances.netProfit")}</th>
              </tr>
            </thead>
            <tbody>
              {active.map((row, idx) => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-2 font-medium text-gray-800 max-w-[200px] truncate">{row.serviceName}</td>
                  <td className="px-2 py-2 text-gray-500">{row.category}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-800">{fmt(row.econ.clientSigned, currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-600">{fmt(row.econ.clientSigned - row.econ.marginGross, currency)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums font-medium ${row.econ.marginGross >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {fmt(row.econ.marginGross, currency)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-700">{fmt(row.econ.vatOnMargin, currency)}</td>
                  {totalProcessingFees > 0 && (
                    <td className="px-2 py-2 text-right tabular-nums text-red-600">
                      {row.feeShare > 0 ? fmt(row.feeShare, currency) : "—"}
                    </td>
                  )}
                  {hasReferral && (
                    <td className="px-2 py-2 text-right tabular-nums text-purple-700">
                      {row.referralAmount > 0 ? fmt(row.referralAmount, currency) : "—"}
                    </td>
                  )}
                  <td className={`px-2 py-2 text-right tabular-nums font-bold ${row.netProfit >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                    {fmt(row.netProfit, currency)}
                  </td>
                </tr>
              ))}
              {/* Totals */}
              <tr className="border-t-2 border-gray-300 font-bold text-gray-900">
                <td className="px-2 py-2" colSpan={3}>{t(lang, "order.finances.total")}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(totalRevenue, currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(totalCost, currency)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${totalMarginGross >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {fmt(totalMarginGross, currency)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                  {fmt(totalProcessingFees > 0 ? adjustedVat : totalVat, currency)}
                </td>
                {totalProcessingFees > 0 && (
                  <td className="px-2 py-2 text-right tabular-nums text-red-600">{fmt(totalProcessingFees, currency)}</td>
                )}
                {hasReferral && (
                  <td className="px-2 py-2 text-right tabular-nums text-purple-700">{fmt(totalReferral, currency)}</td>
                )}
                <td className={`px-2 py-2 text-right tabular-nums ${netProfit >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                  {fmt(netProfit, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cancelled services */}
        {cancelled.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t(lang, "order.finances.cancelled")}</h4>
            <table className="w-full text-xs opacity-60" style={{ minWidth: 800 }}>
              <tbody>
                {cancelled.map((row, idx) => (
                  <tr key={row.id} className="border-b border-gray-50 line-through">
                    <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1.5 text-gray-500 max-w-[200px] truncate">{row.serviceName}</td>
                    <td className="px-2 py-1.5 text-gray-400">{row.category}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.econ.clientSigned, currency)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.econ.clientSigned - row.econ.marginGross, currency)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.econ.marginGross, currency)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.econ.vatOnMargin, currency)}</td>
                    {totalProcessingFees > 0 && <td className="px-2 py-1.5 text-right">—</td>}
                    {hasReferral && <td className="px-2 py-1.5 text-right">—</td>}
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(row.econ.profitNetOfVat, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Overview */}
      {activePayments.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t(lang, "order.finances.paymentOverview")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: summary */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{t(lang, "order.finances.billed")}</span>
                <span className="text-sm font-bold tabular-nums text-gray-900">{fmt(totalRevenue, currency)}</span>
              </div>
              {paidLines.map((pl) => (
                <div key={pl.method} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    {t(lang, "order.finances.paid")} by {pl.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-emerald-700">{fmt(pl.net, currency)}</span>
                </div>
              ))}
              {totalProcessingFees > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{t(lang, "order.finances.processingFees")}</span>
                  <span className="text-sm font-bold tabular-nums text-red-600">{fmt(totalProcessingFees, currency)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{t(lang, "order.finances.outstanding")}</span>
                <span className={`text-sm font-bold tabular-nums ${outstanding > 0 ? "text-red-600" : outstanding < 0 ? "text-blue-600" : "text-gray-500"}`}>
                  {fmt(outstanding, currency)}
                </span>
              </div>
            </div>

            {/* Right: pie chart */}
            {pieData.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{t(lang, "order.finances.byMethod")}</div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${fmt(value, currency)}`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => {
                          const n = Number(value);
                          return [fmt(Number.isFinite(n) ? n : 0, currency), ""];
                        }}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
