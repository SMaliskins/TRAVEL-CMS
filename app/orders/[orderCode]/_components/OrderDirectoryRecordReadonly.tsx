"use client";

import Link from "next/link";
import type { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { formatPhoneForDisplay } from "@/utils/phone";
import { resolvePublicMediaUrl } from "@/lib/resolvePublicMediaUrl";
import { t } from "@/lib/i18n";
import type { RelatedPartyTag } from "@/lib/types/orderRelatedParties";

function ageFromDob(dob: string | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,11rem)_1fr] gap-x-3 gap-y-0.5 py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-900 break-words">{value}</dd>
    </div>
  );
}

const ROLES_HIDDEN: DirectoryRole[] = ["referral", "subagent"];

export default function OrderDirectoryRecordReadonly({
  record,
  tags,
  lang,
}: {
  record: DirectoryRecord;
  tags: RelatedPartyTag[];
  lang: string;
}) {
  const displayName =
    record.type === "person"
      ? `${record.firstName || ""} ${record.lastName || ""}`.trim() || "—"
      : record.companyName || "—";

  const visibleRoles = record.roles.filter((r) => !ROLES_HIDDEN.includes(r));
  const personAge = record.type === "person" ? ageFromDob(record.dob) : null;

  const avatarSrc =
    record.type === "person" && record.avatarUrl
      ? resolvePublicMediaUrl(record.avatarUrl, "avatars") || record.avatarUrl
      : record.type === "company" && record.companyAvatarUrl
        ? resolvePublicMediaUrl(record.companyAvatarUrl, "avatars") || record.companyAvatarUrl
        : null;

  const tagLabel = (tag: RelatedPartyTag) => t(lang, `order.clientsData.tags.${tag}`);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-16 w-16 shrink-0 rounded-full border border-gray-200 object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-medium text-gray-600">
              {record.type === "person"
                ? (record.firstName?.[0] || record.lastName?.[0] || "?").toUpperCase()
                : (record.companyName?.[0] || "?").toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {displayName}
              {personAge !== null && (
                <span className="ml-2 text-sm font-normal text-gray-500">({personAge} y)</span>
              )}
            </h3>
            <p className="text-sm text-gray-500 capitalize">{record.type}</p>
            {record.isActive === false && (
              <span className="mt-1 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Archived
              </span>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800"
                >
                  {tagLabel(tag)}
                </span>
              ))}
            </div>
            {visibleRoles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {visibleRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700"
                  >
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/directory/${record.id}`}
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
        >
          {t(lang, "order.clientsData.openDirectory")}
        </Link>
      </div>

      <dl className="mt-4 space-y-0 divide-y divide-gray-100">
        <p className="py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(lang, "order.clientsData.section.contact")}
        </p>
        <Row label="Email" value={record.email ? <a href={`mailto:${record.email}`} className="text-blue-600 hover:underline">{record.email}</a> : null} />
        <Row label="Phone" value={record.phone ? formatPhoneForDisplay(record.phone) || record.phone : null} />
        <Row label="Country" value={record.country} />

        {record.type === "person" && (
          <>
            <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t(lang, "order.clientsData.section.person")}
            </p>
            <Row label="Title" value={record.title} />
            <Row label="Gender" value={record.gender} />
            <Row label="Date of birth" value={record.dob ? formatDateDDMMYYYY(record.dob) : null} />
            <Row label="Personal code" value={record.personalCode} />
            <Row label="Citizenship" value={record.citizenship} />
            <Row label="Nationality" value={record.nationality} />

            <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t(lang, "order.clientsData.section.passport")}
            </p>
            <Row label="Passport no." value={record.passportNumber} />
            <Row label="Passport name" value={record.passportFullName} />
            <Row label="Issue date" value={record.passportIssueDate ? formatDateDDMMYYYY(record.passportIssueDate) : null} />
            <Row label="Expiry" value={record.passportExpiryDate ? formatDateDDMMYYYY(record.passportExpiryDate) : null} />
            <Row label="Issuing country" value={record.passportIssuingCountry} />
            <Row
              label="Alien passport"
              value={record.isAlienPassport ? "Yes" : undefined}
            />

            <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t(lang, "order.clientsData.section.preferences")}
            </p>
            <Row label="Seat" value={record.seatPreference || undefined} />
            <Row label="Meal" value={record.mealPreference || undefined} />
            <Row label="Notes" value={record.preferencesNotes || undefined} />
          </>
        )}

        {record.type === "company" && (
          <>
            <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t(lang, "order.clientsData.section.company")}
            </p>
            <Row label="Registration no." value={record.regNumber} />
            <Row label="VAT no." value={record.vatNumber} />
            <Row label="Legal address" value={record.legalAddress} />
            <Row label="Actual address" value={record.actualAddress} />
            <Row label="Contact person" value={record.contactPerson} />
            <Row
              label="Correspondence languages"
              value={record.correspondenceLanguages?.length ? record.correspondenceLanguages.join(", ") : undefined}
            />
            <Row label="Invoice language" value={record.invoiceLanguage} />
          </>
        )}

        <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(lang, "order.clientsData.section.banking")}
        </p>
        <Row label="Bank" value={record.bankName} />
        <Row label="IBAN" value={record.iban} />
        <Row label="SWIFT" value={record.swift} />
        {record.bankAccounts?.map((acc, i) => (
          <div key={i} className="py-2 border-b border-gray-100 text-sm">
            <div className="text-xs font-medium uppercase text-gray-400 mb-1">Bank account {i + 1}</div>
            <div className="text-gray-800">{[acc.bankName, acc.iban, acc.swift].filter(Boolean).join(" · ") || "—"}</div>
          </div>
        ))}

        {(record.corporateAccounts?.length || record.loyaltyCards?.length) ? (
          <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t(lang, "order.clientsData.section.accounts")}
          </p>
        ) : null}
        {record.corporateAccounts?.map((c, i) => (
          <Row
            key={`corp-${i}`}
            label={`Corporate · ${c.providerName || "—"}`}
            value={[c.accountCode, c.providerId].filter(Boolean).join(" · ") || undefined}
          />
        ))}
        {record.loyaltyCards?.map((c, i) => (
          <Row
            key={`loy-${i}`}
            label={`Loyalty · ${c.providerName || "—"}`}
            value={[c.programName, c.cardCode].filter(Boolean).join(" · ") || undefined}
          />
        ))}

        <p className="pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(lang, "order.clientsData.section.audit")}
        </p>
        <Row label="Created" value={record.createdAt ? formatDateDDMMYYYY(record.createdAt.slice(0, 10)) : null} />
        <Row label="Updated" value={record.updatedAt ? formatDateDDMMYYYY(record.updatedAt.slice(0, 10)) : null} />
        <Row label="Created by" value={record.createdByDisplayName} />
        <Row label="Updated by" value={record.updatedByDisplayName} />
      </dl>
    </section>
  );
}
