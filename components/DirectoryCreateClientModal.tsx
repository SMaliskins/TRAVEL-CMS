"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { formatNameForDb } from "@/utils/nameFormat";

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .replace(/(^|\s|[-/(])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

type DuplicateItem = { id: string; displayName: string; displayId?: string | number };

export interface DirectoryCreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with new party id and display name after successful create (or when user picks a duplicate match). */
  onCreated: (partyId: string, displayName: string) => void;
  /** Search text to prefill person (first word / rest) or company name. */
  initialNameQuery?: string;
}

/**
 * Same client-creation flow as PartySelect (POST /api/directory/create, duplicate handling).
 * Client role only — no supplier service areas.
 */
export default function DirectoryCreateClientModal({
  isOpen,
  onClose,
  onCreated,
  initialNameQuery = "",
}: DirectoryCreateClientModalProps) {
  useModalOverlay(isOpen);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const [createType, setCreateType] = useState<"person" | "company">("person");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPersonalCode, setCreatePersonalCode] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createRegNumber, setCreateRegNumber] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [forceConfirmed, setForceConfirmed] = useState(false);

  const resetForm = useCallback(() => {
    setCreateFirstName("");
    setCreateLastName("");
    setCreatePersonalCode("");
    setCreatePhone("");
    setCreateEmail("");
    setCreateCompanyName("");
    setCreateAddress("");
    setCreateRegNumber("");
    setCreateError("");
    setDuplicates([]);
    setForceConfirmed(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const q = (initialNameQuery || "").trim();
    const parts = q.split(/\s+/);
    setCreateFirstName(parts[0] || "");
    setCreateLastName(parts.slice(1).join(" ") || "");
    setCreateCompanyName(q);
    setCreateType("person");
    setCreateError("");
    setDuplicates([]);
    setForceConfirmed(false);
  }, [isOpen, initialNameQuery]);

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleCreateSubmit = async () => {
    setCreateError("");

    if (createType === "person") {
      if (!createFirstName.trim() || !createLastName.trim()) {
        setCreateError("First name and last name are required");
        return;
      }
    } else if (!createCompanyName.trim()) {
      setCreateError("Company name is required");
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const payload: Record<string, unknown> = {
        type: createType,
        roles: ["client"],
        isActive: true,
      };

      if (createType === "person") {
        payload.firstName = formatNameForDb(createFirstName.trim());
        payload.lastName = formatNameForDb(createLastName.trim());
        if (createPersonalCode.trim()) payload.personalCode = createPersonalCode.trim();
        if (createPhone.trim()) payload.phone = createPhone.trim();
        if (createEmail.trim()) payload.email = createEmail.trim();
      } else {
        payload.companyName = toTitleCase(createCompanyName.trim());
        if (createAddress.trim()) payload.legalAddress = toTitleCase(createAddress.trim());
        if (createRegNumber.trim()) payload.regNumber = createRegNumber.trim();
      }

      const response = await fetch("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const displayName =
          createType === "person"
            ? `${createFirstName.trim()} ${createLastName.trim()}`
            : createCompanyName.trim();
        const partyId = data.record?.id || data.id || data.party?.id;
        if (!partyId) {
          setCreateError("Client created but ID not returned");
          return;
        }
        resetForm();
        onClose();
        onCreated(partyId, displayName);
      } else if (response.status === 409) {
        const errData = await response.json().catch(() => ({}));
        if (errData.error === "duplicate_found" && errData.duplicates?.length > 0) {
          setDuplicates(errData.duplicates as DuplicateItem[]);
          setCreateError(errData.message || "A contact with this name already exists.");
        } else {
          setCreateError(errData.message || "Duplicate found");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setCreateError(errData.error || "Failed to create");
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectDuplicate = (dup: DuplicateItem) => {
    resetForm();
    onClose();
    onCreated(dup.id, dup.displayName);
  };

  const handleForceCreate = async () => {
    if (!forceConfirmed) {
      setForceConfirmed(true);
      return;
    }
    setForceConfirmed(false);
    setDuplicates([]);
    setCreateError("");
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: Record<string, unknown> = {
        type: createType,
        roles: ["client"],
        isActive: true,
        skipDedupCheck: true,
      };
      if (createType === "person") {
        payload.firstName = formatNameForDb(createFirstName.trim());
        payload.lastName = formatNameForDb(createLastName.trim());
        if (createPersonalCode.trim()) payload.personalCode = createPersonalCode.trim();
        if (createPhone.trim()) payload.phone = createPhone.trim();
        if (createEmail.trim()) payload.email = createEmail.trim();
      } else {
        payload.companyName = toTitleCase(createCompanyName.trim());
        if (createAddress.trim()) payload.legalAddress = toTitleCase(createAddress.trim());
        if (createRegNumber.trim()) payload.regNumber = createRegNumber.trim();
      }
      const response = await fetch("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        const displayName =
          createType === "person"
            ? `${createFirstName.trim()} ${createLastName.trim()}`
            : createCompanyName.trim();
        const partyId = data.record?.id || data.id || data.party?.id;
        if (partyId) {
          resetForm();
          onClose();
          onCreated(partyId, displayName);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setCreateError(errData.error || "Failed to create");
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => e.target === e.currentTarget && !isCreating && handleCancel()}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-create-client-title"
        className="bg-white rounded-lg border border-gray-200 shadow-xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="directory-create-client-title" className="font-medium text-sm mb-3">
          Create New Client
        </h4>

        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="directoryCreateType"
              checked={createType === "person"}
              onChange={() => setCreateType("person")}
              className="text-blue-600"
            />
            Person
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="directoryCreateType"
              checked={createType === "company"}
              onChange={() => setCreateType("company")}
              className="text-blue-600"
            />
            Company
          </label>
        </div>

        {createType === "person" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="First Name *"
                value={createFirstName}
                onChange={(e) => setCreateFirstName(e.target.value)}
                onBlur={() => setCreateFirstName((v) => formatNameForDb(v))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="text"
                placeholder="Last Name *"
                value={createLastName}
                onChange={(e) => setCreateLastName(e.target.value)}
                onBlur={() => setCreateLastName((v) => formatNameForDb(v))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <input
              type="text"
              placeholder="Personal Code"
              value={createPersonalCode}
              onChange={(e) => setCreatePersonalCode(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="tel"
                placeholder="Phone"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="email"
                placeholder="Email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Company Name *"
              value={createCompanyName}
              onChange={(e) => setCreateCompanyName(e.target.value)}
              onBlur={() => setCreateCompanyName((v) => toTitleCase(v))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            <input
              type="text"
              placeholder="Address"
              value={createAddress}
              onChange={(e) => setCreateAddress(e.target.value)}
              onBlur={() => setCreateAddress((v) => toTitleCase(v))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            <input
              type="text"
              placeholder="Reg. Number"
              value={createRegNumber}
              onChange={(e) => setCreateRegNumber(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        )}

        {createError && !duplicates.length && (
          <p className="text-xs text-red-600 mt-2">{createError}</p>
        )}

        {duplicates.length > 0 && (
          <div className="mt-3 p-3 rounded-lg border border-amber-300 bg-amber-50">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              A contact with this name already exists:
            </p>
            {duplicates.map((dup) => (
              <button
                key={dup.id}
                type="button"
                onClick={() => handleSelectDuplicate(dup)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-left hover:bg-amber-100 transition-colors"
              >
                <span className="font-medium text-gray-900">{dup.displayName}</span>
                <span className="text-xs text-gray-500">
                  ID: {String(dup.displayId || "").padStart(5, "0")}
                </span>
              </button>
            ))}
            <div className="flex gap-2 mt-2 pt-2 border-t border-amber-200">
              <button
                type="button"
                onClick={handleForceCreate}
                disabled={isCreating}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded disabled:opacity-50 ${
                  forceConfirmed
                    ? "text-red-700 border border-red-400 bg-red-50 hover:bg-red-100"
                    : "text-amber-700 border border-amber-300 hover:bg-amber-100"
                }`}
              >
                {isCreating ? "Creating..." : forceConfirmed ? "Confirm: create duplicate" : "Create anyway"}
              </button>
              {forceConfirmed && (
                <button
                  type="button"
                  onClick={() => setForceConfirmed(false)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            disabled={isCreating}
          >
            Cancel
          </button>
          {!duplicates.length && (
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isCreating}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
