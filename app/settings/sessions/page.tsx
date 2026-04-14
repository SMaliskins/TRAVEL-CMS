"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { ROLES } from "@/lib/auth/roles";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

type SessionRow = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  deviceLabel: string;
  ipAddress: string | null;
  lastSeenAt: string;
  active: boolean;
};

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const date = formatDateDDMMYYYY(iso.slice(0, 10));
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

export default function StaffSessionsPage() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const meRes = await fetch("/api/users/me", { headers });
      if (!meRes.ok) {
        setError(t(lang, "sessions.loadError"));
        setLoading(false);
        return;
      }
      const me = await meRes.json();
      const r = String(me.role ?? "").toLowerCase();
      setRole(r);
      if (r !== ROLES.SUPERVISOR) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/auth/company-sessions", { headers });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j.error as string) || t(lang, "sessions.loadError"));
        setLoading(false);
        return;
      }
      const j = await res.json();
      setSessions(j.sessions || []);
    } catch {
      setError(t(lang, "sessions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeAllForUser = async (userId: string) => {
    if (!confirm(t(lang, "sessions.revokeConfirm"))) return;
    setRevoking(userId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/auth/revoke-user-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j.error as string) || t(lang, "sessions.revokeError"));
        return;
      }
      await load();
    } catch {
      setError(t(lang, "sessions.revokeError"));
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 p-6">
        <p className="text-gray-600">{t(lang, "sessions.loading")}</p>
      </div>
    );
  }

  if (role !== ROLES.SUPERVISOR) {
    return (
      <div className="bg-gray-50 p-6">
        <p className="text-red-600">{t(lang, "sessions.forbidden")}</p>
        <Link href="/settings" className="mt-4 inline-block text-blue-600 hover:underline">
          {t(lang, "profile.backToSettings")}
        </Link>
      </div>
    );
  }

  const seenUser = new Set<string>();

  return (
    <div className="bg-gray-50 p-6">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-blue-600 hover:underline">
          {t(lang, "profile.backToSettings")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">{t(lang, "sessions.title")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t(lang, "sessions.intro")}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t(lang, "sessions.empty")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{t(lang, "sessions.colUser")}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{t(lang, "sessions.colDevice")}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{t(lang, "sessions.colIp")}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{t(lang, "sessions.colLastSeen")}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{t(lang, "sessions.colStatus")}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">{t(lang, "sessions.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => {
                  const firstForUser = !seenUser.has(s.userId);
                  if (firstForUser) seenUser.add(s.userId);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 text-gray-900">
                        <div className="font-medium">{s.userName}</div>
                        <div className="text-xs text-gray-500">{s.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-800">{s.deviceLabel}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.ipAddress || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-800">{formatLastSeen(s.lastSeenAt)}</td>
                      <td className="px-4 py-3">
                        {s.active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            {t(lang, "sessions.statusActive")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {t(lang, "sessions.statusAway")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {firstForUser && (
                          <button
                            type="button"
                            disabled={revoking === s.userId}
                            onClick={() => void revokeAllForUser(s.userId)}
                            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {revoking === s.userId ? "…" : t(lang, "sessions.revokeAll")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
