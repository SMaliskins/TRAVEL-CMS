"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import type { DirectoryRecord } from "@/lib/types/directory";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { t } from "@/lib/i18n";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { formatPhoneForDisplay } from "@/utils/phone";

type RelatedPartiesResponse = {
  parties: { partyId: string; tags: RelatedPartyTag[] }[];
  nameOnlyPayers: string[];
};

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

export default function OrderClientsDataTab({
  orderCode,
  lang,
}: {
  orderCode: string;
  lang: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ partyId: string; tags: RelatedPartyTag[]; record: DirectoryRecord }[]>([]);
  const [nameOnlyPayers, setNameOnlyPayers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setLoaded([]);
      setNameOnlyPayers([]);
      try {
        const metaRes = await fetchWithAuth(`/api/orders/${encodeURIComponent(orderCode)}/related-parties`);
        const metaJson = (await metaRes.json()) as RelatedPartiesResponse & { error?: string };
        if (!metaRes.ok || metaJson.error) {
          if (!cancelled) setError(metaJson.error || "Failed to load");
          return;
        }
        if (cancelled) return;
        setNameOnlyPayers(metaJson.nameOnlyPayers || []);

        const partyList = metaJson.parties || [];
        const records = await Promise.all(
          partyList.map(async ({ partyId, tags }) => {
            const res = await fetchWithAuth(`/api/directory/${encodeURIComponent(partyId)}`);
            const data = await res.json();
            if (!res.ok || data.error || !data.record) {
              return null;
            }
            return { partyId, tags, record: data.record as DirectoryRecord };
          })
        );

        if (cancelled) return;
        setLoaded(records.filter(Boolean) as { partyId: string; tags: RelatedPartyTag[]; record: DirectoryRecord }[]);
      } catch {
        if (!cancelled) setError("Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderCode]);

  const sorted = useMemo(() => sortParties(loaded), [loaded]);

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
          <table className="w-full min-w-[920px] border-collapse text-sm">
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
                <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600 w-14" />
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

                return (
                  <tr key={partyId} className="hover:bg-gray-50/80">
                    <td className="sticky left-0 z-[1] border-r border-gray-100 bg-white px-3 py-2 font-medium text-gray-900">
                      <Link
                        href={`/directory/${partyId}`}
                        className="text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {rowDisplayName(record)}
                      </Link>
                      {record.isActive === false && (
                        <span className="ml-1.5 text-[10px] font-normal uppercase text-amber-700">
                          {t(lang, "order.clientsData.archived")}
                        </span>
                      )}
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
                    <td className="px-3 py-2 text-gray-700 break-all">
                      {record.email ? (
                        <a href={`mailto:${record.email}`} className="text-blue-600 hover:underline">
                          {record.email}
                        </a>
                      ) : null}
                      {record.email && phoneDisp ? <span className="text-gray-400"> · </span> : null}
                      {phoneDisp ? <span>{phoneDisp}</span> : null}
                      {!record.email && !phoneDisp ? "—" : null}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Link
                        href={`/directory/${partyId}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        {t(lang, "order.clientsData.table.open")}
                      </Link>
                    </td>
                  </tr>
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
