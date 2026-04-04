"use client";

import React, { Fragment, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrderClientsDataParties, orderPageQueryKeys } from "@/lib/orders/orderPageQueries";
import type { DirectoryRecord, LoyaltyCard } from "@/lib/types/directory";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { t } from "@/lib/i18n";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { formatPhoneForDisplay } from "@/utils/phone";
import { useToast } from "@/contexts/ToastContext";

function canRemoveTravellerFromOrder(
  tags: RelatedPartyTag[],
  partyId: string,
  leadPartyId: string | null | undefined
): boolean {
  if (!tags.includes("traveller")) return false;
  if (leadPartyId && partyId === leadPartyId) return false;
  return true;
}

type LoyaltyRow = { providerName: string; programName: string; cardCode: string };

type PreferencesDraft = {
  loyaltyCards: LoyaltyRow[];
  seatPreference: "" | "window" | "aisle";
  mealPreference: string;
  languagesStr: string;
  preferencesNotes: string;
};

const MEAL_OPTIONS = [
  "",
  "standard",
  "vegan",
  "vegetarian",
  "halal",
  "kosher",
  "gluten_free",
  "lactose_free",
  "diabetic",
  "child",
  "other",
] as const;

function cell(s: string | null | undefined): string {
  const v = (s ?? "").trim();
  return v || "—";
}

function rowDisplayName(record: DirectoryRecord): string {
  if (record.type === "company") return record.companyName?.trim() || "—";
  return `${record.firstName || ""} ${record.lastName || ""}`.trim() || "—";
}

function personalOrReg(record: DirectoryRecord): string {
  if (record.type === "company") return cell(record.regNumber);
  return cell(record.personalCode);
}

function sortParties(
  items: { partyId: string; tags: RelatedPartyTag[]; record: DirectoryRecord }[]
) {
  return [...items].sort((a, b) => {
    const aLead = a.tags.includes("lead_client") ? 0 : 1;
    const bLead = b.tags.includes("lead_client") ? 0 : 1;
    if (aLead !== bLead) return aLead - bLead;
    return rowDisplayName(a.record).toLowerCase().localeCompare(rowDisplayName(b.record).toLowerCase());
  });
}

function recordToDraft(record: DirectoryRecord): PreferencesDraft {
  const fromCards = record.loyaltyCards?.length
    ? record.loyaltyCards.map((c) => ({
        providerName: c.providerName || "",
        programName: c.programName || "",
        cardCode: c.cardCode || "",
      }))
    : [{ providerName: "", programName: "", cardCode: "" }];
  return {
    loyaltyCards: fromCards,
    seatPreference: record.seatPreference === "window" || record.seatPreference === "aisle" ? record.seatPreference : "",
    mealPreference: record.mealPreference && (MEAL_OPTIONS as readonly string[]).includes(record.mealPreference) ? record.mealPreference : "",
    languagesStr: (record.correspondenceLanguages || []).filter(Boolean).join(", "),
    preferencesNotes: (record.preferencesNotes ?? "").trim(),
  };
}

function toLoyaltyPayload(rows: LoyaltyRow[]): LoyaltyCard[] {
  return rows
    .filter((r) => r.providerName.trim() || r.programName.trim() || r.cardCode.trim())
    .map((r) => ({
      providerName: r.providerName.trim() || "—",
      programName: r.programName.trim() || undefined,
      cardCode: r.cardCode.trim(),
    }));
}

function mealOptionLabel(code: string): string {
  if (!code) return "";
  return code.replace(/_/g, " ");
}

export default function OrderClientsDataTab({
  orderCode,
  lang,
}: {
  orderCode: string;
  lang: string;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const partiesQueryKey = orderPageQueryKeys.clientsDataParties(orderCode);
  const {
    data,
    isPending: loading,
    error: queryError,
    isError,
  } = useQuery({
    queryKey: partiesQueryKey,
    queryFn: () => fetchOrderClientsDataParties(orderCode),
    enabled: Boolean(orderCode),
  });
  const error = isError && queryError instanceof Error ? queryError.message : null;
  const nameOnlyPayers = data?.nameOnlyPayers ?? [];
  const leadPartyId = data?.leadPartyId ?? null;
  const loaded = useMemo(() => {
    const rows = data?.partyRows || [];
    return rows
      .filter((r): r is typeof r & { record: DirectoryRecord } => r.record != null)
      .map((r) => ({ partyId: r.partyId, tags: r.tags, record: r.record }));
  }, [data]);
  const [removingPartyId, setRemovingPartyId] = useState<string | null>(null);

  const [expandedPartyId, setExpandedPartyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PreferencesDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => sortParties(loaded), [loaded]);

  const toggleRow = (partyId: string, record: DirectoryRecord) => {
    setExpandedPartyId((cur) => {
      if (cur === partyId) {
        setDraft(null);
        return null;
      }
      setDraft(recordToDraft(record));
      return partyId;
    });
  };

  const updateDraft = (patch: Partial<PreferencesDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const updateLoyaltyRow = (index: number, patch: Partial<LoyaltyRow>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.loyaltyCards];
      next[index] = { ...next[index], ...patch };
      return { ...d, loyaltyCards: next };
    });
  };

  const addLoyaltyRow = () => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        loyaltyCards: [...d.loyaltyCards, { providerName: "", programName: "", cardCode: "" }],
      };
    });
  };

  const removeLoyaltyRow = (index: number) => {
    setDraft((d) => {
      if (!d) return d;
      if (d.loyaltyCards.length <= 1) {
        return {
          ...d,
          loyaltyCards: [{ providerName: "", programName: "", cardCode: "" }],
        };
      }
      return {
        ...d,
        loyaltyCards: d.loyaltyCards.filter((_, i) => i !== index),
      };
    });
  };

  const handleCancelEdit = () => {
    setExpandedPartyId(null);
    setDraft(null);
  };

  const handleSave = async (partyId: string, record: DirectoryRecord) => {
    if (!draft) return;
    setSaving(true);
    try {
      const loyaltyCards = toLoyaltyPayload(draft.loyaltyCards);
      const correspondenceLanguages = draft.languagesStr
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        type: record.type,
        loyaltyCards,
      };

      if (record.type === "person") {
        body.seatPreference = draft.seatPreference || null;
        body.mealPreference = draft.mealPreference || null;
        body.preferencesNotes = draft.preferencesNotes.trim() || null;
        body.correspondenceLanguages = correspondenceLanguages;
      } else {
        body.correspondenceLanguages = correspondenceLanguages;
      }

      const res = await fetchWithAuth(`/api/directory/${encodeURIComponent(partyId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error || !json.record) {
        showToast("error", `${t(lang, "order.clientsData.edit.error")}: ${json.error || res.statusText}`);
        return;
      }
      const updated = json.record as DirectoryRecord;
      void queryClient.invalidateQueries({ queryKey: partiesQueryKey });
      setDraft(recordToDraft(updated));
      showToast("success", t(lang, "order.clientsData.edit.saved"));
    } catch {
      showToast("error", t(lang, "order.clientsData.edit.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTravellerFromOrder = async (partyId: string) => {
    if (!window.confirm(t(lang, "order.clientsData.removeConfirm"))) return;
    setRemovingPartyId(partyId);
    try {
      const res = await fetchWithAuth(
        `/api/orders/${encodeURIComponent(orderCode)}/travellers/${encodeURIComponent(partyId)}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        const msg = json.error || "";
        if (msg.includes("main client")) {
          showToast("error", t(lang, "order.clientsData.removeBlockedLead"));
        } else if (msg.includes("assigned to services") || msg.includes("Remove from services")) {
          showToast("error", t(lang, "order.clientsData.removeBlockedServices"));
        } else {
          showToast("error", `${t(lang, "order.clientsData.removeError")}: ${msg || res.statusText}`);
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: partiesQueryKey });
      if (expandedPartyId === partyId) {
        setExpandedPartyId(null);
        setDraft(null);
      }
      showToast("success", t(lang, "order.clientsData.removeSuccess"));
    } catch {
      showToast("error", t(lang, "order.clientsData.removeError"));
    } finally {
      setRemovingPartyId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        {t(lang, "order.clientsData.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {sorted.length === 0 && nameOnlyPayers.length === 0 ? (
        <p className="text-sm text-gray-500">{t(lang, "order.clientsData.empty")}</p>
      ) : null}

      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {t(lang, "order.clientsData.table.name")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">
                  {t(lang, "order.clientsData.table.roles")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {t(lang, "order.clientsData.table.type")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">
                  {t(lang, "order.clientsData.table.dob")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[7rem]">
                  {t(lang, "order.clientsData.table.personalOrReg")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[6rem]">
                  {t(lang, "order.clientsData.table.passport")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">
                  {t(lang, "order.clientsData.table.passportIssued")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap">
                  {t(lang, "order.clientsData.table.passportExpires")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 min-w-[10rem]">
                  {t(lang, "order.clientsData.table.contact")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sorted.map(({ partyId, tags, record }) => {
                const isPerson = record.type === "person";
                const dob = isPerson && record.dob ? formatDateDDMMYYYY(record.dob) : "—";
                const issued =
                  isPerson && record.passportIssueDate ? formatDateDDMMYYYY(record.passportIssueDate) : "—";
                const expires =
                  isPerson && record.passportExpiryDate ? formatDateDDMMYYYY(record.passportExpiryDate) : "—";
                const phoneDisp = record.phone ? formatPhoneForDisplay(record.phone) || record.phone : "";
                const isOpen = expandedPartyId === partyId;
                const showRemove = canRemoveTravellerFromOrder(tags, partyId, leadPartyId);

                return (
                  <Fragment key={partyId}>
                    <tr
                      className={`cursor-pointer hover:bg-slate-50/90 ${isOpen ? "bg-slate-50/80" : ""}`}
                      onClick={() => toggleRow(partyId, record)}
                    >
                      <td className="sticky left-0 z-[1] border-r border-gray-100 bg-white px-3 py-2 font-medium text-gray-900">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span className="text-gray-400 tabular-nums w-4 shrink-0" aria-hidden>
                              {isOpen ? "▼" : "▶"}
                            </span>
                            <span className="text-gray-900">{rowDisplayName(record)}</span>
                            {record.isActive === false && (
                              <span className="text-[10px] font-normal uppercase text-amber-700">
                                {t(lang, "order.clientsData.archived")}
                              </span>
                            )}
                          </span>
                          {showRemove ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5">
                              <span className="text-gray-200 select-none" aria-hidden>
                                ·
                              </span>
                              <button
                                type="button"
                                title={t(lang, "order.clientsData.removeFromOrder")}
                                className="text-[11px] font-normal text-gray-400 transition-colors hover:text-red-800 hover:underline disabled:opacity-40"
                                disabled={removingPartyId !== null}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleRemoveTravellerFromOrder(partyId);
                                }}
                              >
                                {removingPartyId === partyId
                                  ? "…"
                                  : t(lang, "order.clientsData.removeFromOrderShort")}
                              </button>
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800"
                            >
                              {t(lang, `order.clientsData.tags.${tag}`)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 capitalize text-gray-700">{record.type}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-800 whitespace-nowrap">{dob}</td>
                      <td className="px-3 py-2 font-mono text-[13px] text-gray-800">{personalOrReg(record)}</td>
                      <td className="px-3 py-2 font-mono text-[13px] text-gray-800">
                        <span className="inline-flex items-center gap-1">
                          {isPerson ? cell(record.passportNumber) : "—"}
                          {isPerson && record.isAlienPassport ? (
                            <span className="text-red-600" title={t(lang, "order.clientsData.alienPassportHint")}>
                              ●
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-gray-800 whitespace-nowrap">{issued}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-800 whitespace-nowrap">{expires}</td>
                      <td
                        className="px-3 py-2 text-gray-700 break-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.email ? (
                          <a href={`mailto:${record.email}`} className="text-blue-600 hover:underline">
                            {record.email}
                          </a>
                        ) : null}
                        {record.email && phoneDisp ? <span className="text-gray-400"> · </span> : null}
                        {phoneDisp ? <span>{phoneDisp}</span> : null}
                        {!record.email && !phoneDisp ? "—" : null}
                      </td>
                    </tr>
                    {isOpen && draft && (
                      <tr className="bg-slate-50/95">
                        <td colSpan={9} className="border-b border-gray-100 px-3 py-4">
                          <div
                            className="max-w-4xl space-y-4"
                            onClick={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <p className="text-xs text-gray-500">{t(lang, "order.clientsData.edit.hint")}</p>

                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t(lang, "order.clientsData.section.accounts")}
                              </p>
                              {draft.loyaltyCards.map((row, idx) => (
                                <div
                                  key={idx}
                                  className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-12 sm:items-end"
                                >
                                  <label className="sm:col-span-4">
                                    <span className="mb-1 block text-[11px] text-gray-500">
                                      {t(lang, "order.clientsData.edit.loyaltyProvider")}
                                    </span>
                                    <input
                                      type="text"
                                      value={row.providerName}
                                      onChange={(e) => updateLoyaltyRow(idx, { providerName: e.target.value })}
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="sm:col-span-3">
                                    <span className="mb-1 block text-[11px] text-gray-500">
                                      {t(lang, "order.clientsData.edit.loyaltyProgram")}
                                    </span>
                                    <input
                                      type="text"
                                      value={row.programName}
                                      onChange={(e) => updateLoyaltyRow(idx, { programName: e.target.value })}
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                  <label className="sm:col-span-4">
                                    <span className="mb-1 block text-[11px] text-gray-500">
                                      {t(lang, "order.clientsData.edit.loyaltyCardNo")}
                                    </span>
                                    <input
                                      type="text"
                                      value={row.cardCode}
                                      onChange={(e) => updateLoyaltyRow(idx, { cardCode: e.target.value })}
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm font-mono"
                                    />
                                  </label>
                                  <div className="sm:col-span-1 flex justify-end pb-1">
                                    <button
                                      type="button"
                                      onClick={() => removeLoyaltyRow(idx)}
                                      className="text-xs text-red-600 hover:underline"
                                    >
                                      {t(lang, "order.clientsData.edit.remove")}
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={addLoyaltyRow}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800"
                              >
                                + {t(lang, "order.clientsData.edit.addLoyaltyCard")}
                              </button>
                            </div>

                            {record.type === "person" && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium text-gray-700">
                                    {t(lang, "order.clientsData.edit.seat")}
                                  </span>
                                  <select
                                    value={draft.seatPreference}
                                    onChange={(e) =>
                                      updateDraft({
                                        seatPreference: e.target.value as "" | "window" | "aisle",
                                      })
                                    }
                                    className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
                                  >
                                    <option value="">{t(lang, "order.clientsData.edit.seatAny")}</option>
                                    <option value="window">window</option>
                                    <option value="aisle">aisle</option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium text-gray-700">
                                    {t(lang, "order.clientsData.edit.meal")}
                                  </span>
                                  <select
                                    value={draft.mealPreference}
                                    onChange={(e) => updateDraft({ mealPreference: e.target.value })}
                                    className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
                                  >
                                    <option value="">{t(lang, "order.clientsData.edit.mealAny")}</option>
                                    {MEAL_OPTIONS.filter(Boolean).map((m) => (
                                      <option key={m} value={m}>
                                        {mealOptionLabel(m)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            )}

                            <label className="block">
                              <span className="mb-1 block text-xs font-medium text-gray-700">
                                {t(lang, "order.clientsData.edit.languages")}
                              </span>
                              <input
                                type="text"
                                value={draft.languagesStr}
                                onChange={(e) => updateDraft({ languagesStr: e.target.value })}
                                className="w-full rounded border border-gray-200 px-2 py-2 text-sm"
                                placeholder="en, lv, ru"
                              />
                            </label>

                            {record.type === "person" && (
                              <label className="block">
                                <span className="mb-1 block text-xs font-medium text-gray-700">
                                  {t(lang, "order.clientsData.edit.notes")}
                                </span>
                                <textarea
                                  value={draft.preferencesNotes}
                                  onChange={(e) => updateDraft({ preferencesNotes: e.target.value })}
                                  rows={3}
                                  className="w-full rounded border border-gray-200 px-2 py-2 text-sm"
                                />
                              </label>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleSave(partyId, record)}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {saving ? t(lang, "order.clientsData.edit.saving") : t(lang, "order.clientsData.edit.save")}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={handleCancelEdit}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                {t(lang, "order.clientsData.edit.cancel")}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {nameOnlyPayers.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-900">
            {t(lang, "order.clientsData.payerNameOnlyTitle")}
          </h3>
          <p className="mt-1 text-xs text-amber-800/90">{t(lang, "order.clientsData.payerNameOnlyHint")}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-800">
            {nameOnlyPayers.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
