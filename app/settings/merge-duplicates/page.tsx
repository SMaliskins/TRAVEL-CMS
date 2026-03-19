"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import Link from "next/link";
import {
  ArrowLeft, Users, Merge, Star, Mail, Phone, Calendar, CreditCard, Loader2,
  CheckCircle2, AlertTriangle, Image as ImageIcon, ShoppingBag,
} from "lucide-react";

interface PartyInfo {
  id: string;
  displayId: number;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  hasDob: boolean;
  hasPassport: boolean;
  ordersCount: number;
}

interface DuplicateGroup {
  name: string;
  type: string;
  parties: PartyInfo[];
}

export default function MergeDuplicatesPage() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language || "en";

  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMain, setSelectedMain] = useState<Record<number, string>>({});
  const [mergingGroup, setMergingGroup] = useState<number | null>(null);
  const [mergedGroups, setMergedGroups] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/directory/duplicates", { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGroups(data.groups || []);

      const defaults: Record<number, string> = {};
      (data.groups || []).forEach((g: DuplicateGroup, idx: number) => {
        if (g.parties.length > 0) defaults[idx] = g.parties[0].id;
      });
      setSelectedMain(defaults);
    } catch {
      setError("Failed to load duplicates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const handleMerge = async (groupIdx: number) => {
    const group = groups[groupIdx];
    const mainId = selectedMain[groupIdx];
    if (!mainId || !group) return;

    const toMerge = group.parties.filter((p) => p.id !== mainId);
    if (toMerge.length === 0) return;

    setMergingGroup(groupIdx);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      for (const source of toMerge) {
        const res = await fetch("/api/directory/merge", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ sourcePartyId: source.id, targetPartyId: mainId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Merge failed for ${source.displayName}`);
        }
      }

      setMergedGroups((prev) => new Set([...prev, groupIdx]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMergingGroup(null);
    }
  };

  const labels = {
    title: { en: "Merge Duplicates", ru: "Слияние дубликатов", lv: "Apvienot dublikātus" },
    subtitle: { en: "Select the main record in each group. Others will be merged into it.", ru: "Выберите главную запись в каждой группе. Остальные будут слиты в неё.", lv: "Izvēlieties galveno ierakstu katrā grupā. Pārējie tiks apvienoti." },
    back: { en: "Settings", ru: "Настройки", lv: "Iestatījumi" },
    merge: { en: "Merge", ru: "Слить", lv: "Apvienot" },
    merged: { en: "Merged", ru: "Слито", lv: "Apvienots" },
    main: { en: "MAIN", ru: "ГЛАВНЫЙ", lv: "GALVENAIS" },
    willMerge: { en: "will merge into main", ru: "будет слит в главного", lv: "tiks apvienots" },
    noDuplicates: { en: "No duplicates found — your directory is clean!", ru: "Дубликатов не найдено — справочник чист!", lv: "Dublikāti nav atrasti!" },
    orders: { en: "orders", ru: "заказов", lv: "pasūtījumi" },
    loading: { en: "Scanning directory...", ru: "Сканирование справочника...", lv: "Skenē direktoriju..." },
    merging: { en: "Merging...", ru: "Слияние...", lv: "Apvieno..." },
  };

  const l = (key: keyof typeof labels) => labels[key][lang as "en" | "ru" | "lv"] || labels[key].en;

  const pendingGroups = groups.filter((_, idx) => !mergedGroups.has(idx));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> {l("back")}
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Merge size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{l("title")}</h1>
              <p className="text-sm text-gray-500">{l("subtitle")}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={14} className="inline mr-1" /> {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <Loader2 size={32} className="mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-500">{l("loading")}</p>
          </div>
        ) : pendingGroups.length === 0 && mergedGroups.size === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-green-400" />
            <p className="text-sm text-gray-500">{l("noDuplicates")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group, gIdx) => {
              const isMerged = mergedGroups.has(gIdx);
              const isMerging = mergingGroup === gIdx;
              const mainId = selectedMain[gIdx];

              if (isMerged) {
                return (
                  <div key={gIdx} className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      {group.name} — {l("merged")} ✓
                    </span>
                  </div>
                );
              }

              return (
                <div key={gIdx} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">{group.name}</span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        {group.parties.length} {group.type === "person" ? "persons" : "records"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleMerge(gIdx)}
                      disabled={isMerging || !mainId}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isMerging ? (
                        <><Loader2 size={14} className="animate-spin" /> {l("merging")}</>
                      ) : (
                        <><Merge size={14} /> {l("merge")}</>
                      )}
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {group.parties.map((party) => {
                      const isMain = party.id === mainId;
                      const initials = party.displayName.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join("");
                      return (
                        <button
                          key={party.id}
                          onClick={() => setSelectedMain((prev) => ({ ...prev, [gIdx]: party.id }))}
                          className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                            isMain
                              ? "bg-blue-50 border-l-4 border-l-blue-500"
                              : "hover:bg-gray-50 border-l-4 border-l-transparent"
                          }`}
                        >
                          {party.avatarUrl ? (
                            <img src={party.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0 border border-gray-200" />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-500 shrink-0">
                              {initials}
                            </span>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isMain ? "text-blue-900" : "text-gray-900"}`}>
                                {party.displayName}
                              </span>
                              <span className="text-[10px] text-gray-400">#{party.displayId}</span>
                              {isMain && (
                                <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {l("main")}
                                </span>
                              )}
                              {!isMain && (
                                <span className="text-[10px] text-gray-400 italic">{l("willMerge")}</span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                              {party.ordersCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <ShoppingBag size={11} /> {party.ordersCount} {l("orders")}
                                </span>
                              )}
                              {party.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail size={11} /> {party.email}
                                </span>
                              )}
                              {party.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone size={11} /> {party.phone}
                                </span>
                              )}
                              {party.avatarUrl && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <ImageIcon size={11} /> Photo
                                </span>
                              )}
                              {party.hasDob && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Calendar size={11} /> DOB
                                </span>
                              )}
                              {party.hasPassport && (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CreditCard size={11} /> Passport
                                </span>
                              )}
                            </div>
                          </div>

                          {isMain && <Star size={18} className="text-blue-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
