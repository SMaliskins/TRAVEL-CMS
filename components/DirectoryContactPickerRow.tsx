"use client";

import type { DirectoryRecord } from "@/lib/types/directory";

export function directoryRecordDisplayName(r: DirectoryRecord): string {
  return r.type === "person"
    ? `${r.firstName || ""} ${r.lastName || ""}`.trim() || "—"
    : r.companyName || "—";
}

export function directoryRecordAvatarUrl(r: DirectoryRecord): string | null {
  if (r.type === "person") return r.avatarUrl || null;
  return r.companyAvatarUrl || null;
}

function initialsFromRecord(r: DirectoryRecord): string {
  const name = directoryRecordDisplayName(r);
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "?"
  );
}

interface DirectoryContactPickerRowProps {
  record: DirectoryRecord;
  isSelected: boolean;
  onClick: () => void;
  /** Tailwind extras for the button (e.g. border-b) */
  className?: string;
}

/** Single row for directory search pickers (merge modals, etc.) — person or company avatar */
export default function DirectoryContactPickerRow({
  record,
  isSelected,
  onClick,
  className = "",
}: DirectoryContactPickerRowProps) {
  const name = directoryRecordDisplayName(record);
  const avatarUrl = directoryRecordAvatarUrl(record);
  const initials = initialsFromRecord(record);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
        isSelected ? "bg-blue-50 text-blue-800" : "text-gray-900"
      } ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
          {initials}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        {record.email ? (
          <span className="block truncate text-xs text-gray-500">{record.email}</span>
        ) : null}
      </span>
    </button>
  );
}
