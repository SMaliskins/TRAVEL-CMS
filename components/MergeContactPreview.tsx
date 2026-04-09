"use client";

import type { DirectoryRecord } from "@/lib/types/directory";
import {
  directoryRecordDisplayName,
  directoryRecordAvatarUrl,
} from "@/components/DirectoryContactPickerRow";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

function formatDirectoryId(r: DirectoryRecord): string {
  if (r.displayId != null) return String(r.displayId).padStart(5, "0");
  return `${r.id.slice(0, 8)}…`;
}

/** True when passport full name is set and clearly differs from directory card name (same risk as wrong merge). */
export function passportNameDiffersFromCard(record: DirectoryRecord): boolean {
  if (record.type !== "person" || !record.passportFullName?.trim()) return false;
  const card = directoryRecordDisplayName(record).toLowerCase().replace(/\s+/g, " ").trim();
  const pass = record.passportFullName.toLowerCase().replace(/\s+/g, " ").trim();
  if (!card || card === "—") return false;
  return card !== pass;
}

export function MergeContactPreviewCard({
  record,
  variant,
}: {
  record: DirectoryRecord;
  variant: "source" | "target";
}) {
  const name = directoryRecordDisplayName(record);
  const avatarUrl = directoryRecordAvatarUrl(record);
  const border =
    variant === "source"
      ? "border-amber-300 bg-amber-50/40"
      : "border-emerald-300 bg-emerald-50/40";
  const badge =
    variant === "source"
      ? "bg-amber-200 text-amber-950"
      : "bg-emerald-200 text-emerald-950";
  const label = variant === "source" ? "Source (archived after merge)" : "Target (kept)";

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  return (
    <div className={`rounded-lg border-2 p-3 ${border}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge}`}>{label}</span>
        <span className="font-mono text-xs text-gray-500">ID {formatDirectoryId(record)}</span>
      </div>
      <div className="flex gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full border border-gray-200 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5 text-sm text-gray-800">
          <div className="font-semibold text-gray-900">{name}</div>
          <div className="text-xs text-gray-500 capitalize">
            {record.type} ·{" "}
            {(record.roles || []).filter((r) => r !== "referral").join(", ") || "—"}
          </div>
          {record.email ? (
            <div>
              <span className="text-gray-500">Email:</span> {record.email}
            </div>
          ) : null}
          {record.phone ? (
            <div>
              <span className="text-gray-500">Phone:</span> {record.phone}
            </div>
          ) : null}
          {record.type === "person" && record.passportFullName ? (
            <div>
              <span className="text-gray-500">Passport name:</span> {record.passportFullName}
            </div>
          ) : null}
          {record.type === "person" && record.passportNumber ? (
            <div>
              <span className="text-gray-500">Passport No.:</span> {record.passportNumber}
            </div>
          ) : null}
          {record.type === "person" && record.dob ? (
            <div>
              <span className="text-gray-500">DOB:</span> {formatDateDDMMYYYY(record.dob)}
            </div>
          ) : null}
        </div>
      </div>
      {passportNameDiffersFromCard(record) ? (
        <p className="mt-2 rounded border border-amber-500 bg-amber-100 px-2 py-1.5 text-xs font-medium text-amber-950">
          Passport name differs from card name — check this is the person you intend to merge.
        </p>
      ) : null}
    </div>
  );
}

export function MergeIrreversibleNotice() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      <strong>Warning:</strong> Merge cannot be undone automatically in the app. Orders and travellers will
      point to the target; source contacts will be archived (inactive).
    </div>
  );
}

export function MergeConfirmCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
      />
      <span>
        I confirm the contacts above are correct. I understand merge is permanent unless restored from a
        database backup.
      </span>
    </label>
  );
}
