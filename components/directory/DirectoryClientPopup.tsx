"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DirectoryRecord } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { formatPhoneForDisplay } from "@/utils/phone";
import { resolvePublicMediaUrl } from "@/lib/resolvePublicMediaUrl";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";

const DEFAULT_W = 440;
const DEFAULT_H = 400;
const MIN_W = 280;
const MIN_H = 220;
const RESIZE_HANDLE = 16;

const roleColors: Record<string, string> = {
  client: "bg-blue-100 text-blue-800",
  supplier: "bg-green-100 text-green-800",
  subagent: "bg-purple-100 text-purple-800",
};

type DragState =
  | { kind: "move"; startX: number; startY: number; origX: number; origY: number }
  | {
      kind: "resize";
      startX: number;
      startY: number;
      origW: number;
      origH: number;
      posX: number;
      posY: number;
    };

interface DirectoryClientPopupProps {
  recordId: string | null;
  onClose: () => void;
  /** Hide email/phone in body (subagent list) */
  hideContactFields?: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function DirectoryClientPopup({
  recordId,
  onClose,
  hideContactFields = false,
}: DirectoryClientPopupProps) {
  const open = Boolean(recordId);
  useModalOverlay(open);
  useEscapeKey(onClose, open);

  const [record, setRecord] = useState<DirectoryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const dragRef = useRef<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const layoutOnOpen = useCallback(() => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isNarrow = vw < 640;
    const w = clamp(isNarrow ? vw - 16 : DEFAULT_W, MIN_W, vw - 16);
    const h = clamp(isNarrow ? Math.min(DEFAULT_H, vh * 0.75) : DEFAULT_H, MIN_H, vh - 24);
    setSize({ w, h });
    setPos({
      x: clamp((vw - w) / 2, 8, vw - w - 8),
      y: clamp(isNarrow ? vh - h - 8 : (vh - h) / 2, 8, vh - h - 8),
    });
  }, []);

  useEffect(() => {
    if (!recordId) {
      setRecord(null);
      setError(null);
      return;
    }
    layoutOnOpen();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setRecord(null);
      try {
        const res = await fetchWithAuth(`/api/directory/${encodeURIComponent(recordId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setError(data.error || "Failed to load");
          return;
        }
        setRecord(data.record || null);
        if (!data.record) setError("Record not found");
      } catch {
        if (!cancelled) setError("Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId, layoutOnOpen]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (d.kind === "move") {
      const nx = d.origX + e.clientX - d.startX;
      const ny = d.origY + e.clientY - d.startY;
      setPos({
        x: clamp(nx, 0, vw - 40),
        y: clamp(ny, 0, vh - 40),
      });
    } else {
      const nw = clamp(d.origW + e.clientX - d.startX, MIN_W, vw - d.posX - 8);
      const nh = clamp(d.origH + e.clientY - d.startY, MIN_H, vh - d.posY - 8);
      setSize({ w: nw, h: nh });
    }
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [onPointerMove]);

  const startMove = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      startX: e.clientX,
      startY: e.clientY,
      origW: size.w,
      origH: size.h,
      posX: pos.x,
      posY: pos.y,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  if (!open) return null;

  const displayName =
    record?.type === "person"
      ? `${record.firstName || ""} ${record.lastName || ""}`.trim() || "—"
      : record?.companyName || "—";

  const avatarSrc =
    record?.type === "person" && record.avatarUrl
      ? resolvePublicMediaUrl(record.avatarUrl, "avatars") || record.avatarUrl
      : record?.type === "company" && record.companyAvatarUrl
        ? resolvePublicMediaUrl(record.companyAvatarUrl, "avatars") || record.companyAvatarUrl
        : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[99990] bg-black/20 sm:bg-black/10"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-popup-title"
        className="fixed z-[99991] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        style={{
          left: pos.x,
          top: pos.y,
          width: size.w,
          height: size.h,
          maxWidth: "calc(100vw - 16px)",
          maxHeight: "calc(100dvh - 16px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 active:cursor-grabbing"
          onPointerDown={startMove}
        >
          <h2 id="directory-popup-title" className="min-w-0 truncate text-sm font-semibold text-gray-900">
            {loading ? "Loading…" : displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">Loading…</div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {record && !loading && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-200 text-lg font-medium text-gray-600">
                    {record.type === "person"
                      ? (record.firstName?.[0] || record.lastName?.[0] || "?").toUpperCase()
                      : (record.companyName?.[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-gray-900">{displayName}</p>
                  <p className="text-sm capitalize text-gray-500">{record.type}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {record.roles.map((role) => (
                      <span
                        key={role}
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleColors[role] || "bg-gray-100 text-gray-800"}`}
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {!hideContactFields && (
                <dl className="space-y-2 text-sm">
                  {record.email ? (
                    <div>
                      <dt className="text-xs font-medium uppercase text-gray-400">Email</dt>
                      <dd>
                        <a href={`mailto:${record.email}`} className="text-blue-600 hover:underline break-all">
                          {record.email}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {record.phone ? (
                    <div>
                      <dt className="text-xs font-medium uppercase text-gray-400">Phone</dt>
                      <dd className="text-gray-800">{formatPhoneForDisplay(record.phone) || record.phone}</dd>
                    </div>
                  ) : null}
                  {record.country ? (
                    <div>
                      <dt className="text-xs font-medium uppercase text-gray-400">Country</dt>
                      <dd className="text-gray-800">{record.country}</dd>
                    </div>
                  ) : null}
                </dl>
              )}

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                <Link
                  href={`/directory/${record.id}`}
                  onClick={() => {
                    sessionStorage.setItem("directory.scrollY", String(window.scrollY));
                    onClose();
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Open full record
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Resize panel"
          className="absolute bottom-0 right-0 z-10 flex cursor-se-resize touch-none items-end justify-end rounded-tl border border-transparent p-0 hover:bg-gray-100"
          style={{ width: RESIZE_HANDLE, height: RESIZE_HANDLE }}
          onPointerDown={startResize}
        >
          <svg
            className="pointer-events-none text-gray-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M22 22H18v-4h4v4zm0-8H18v-4h4v4zm-8 8h-4v-4h4v4zm8-16h-4V6h4v4z" />
          </svg>
        </button>
      </div>
    </>
  );
}
