"use client";

import { useEffect, useState, useMemo } from "react";
import type { DirectoryRecord } from "@/lib/types/directory";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { t } from "@/lib/i18n";
import OrderDirectoryRecordReadonly from "./OrderDirectoryRecordReadonly";

type RelatedPartiesResponse = {
  parties: { partyId: string; tags: RelatedPartyTag[] }[];
  nameOnlyPayers: string[];
};

function sortParties(
  items: { partyId: string; tags: RelatedPartyTag[]; record: DirectoryRecord }[]
) {
  return [...items].sort((a, b) => {
    const aLead = a.tags.includes("lead_client") ? 0 : 1;
    const bLead = b.tags.includes("lead_client") ? 0 : 1;
    if (aLead !== bLead) return aLead - bLead;
    const nameA =
      a.record.type === "person"
        ? `${a.record.firstName || ""} ${a.record.lastName || ""}`.trim().toLowerCase()
        : (a.record.companyName || "").toLowerCase();
    const nameB =
      b.record.type === "person"
        ? `${b.record.firstName || ""} ${b.record.lastName || ""}`.trim().toLowerCase()
        : (b.record.companyName || "").toLowerCase();
    return nameA.localeCompare(nameB);
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

      {sorted.map(({ partyId, tags, record }) => (
        <OrderDirectoryRecordReadonly key={partyId} record={record} tags={tags} lang={lang} />
      ))}

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
