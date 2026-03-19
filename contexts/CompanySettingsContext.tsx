"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DateFormatPattern, setGlobalDateFormat } from "@/utils/dateFormat";

interface CompanySettings {
  dateFormat: DateFormatPattern;
  logoUrl: string | null;
}

const DEFAULT: CompanySettings = { dateFormat: "dd.mm.yyyy", logoUrl: null };

const CompanySettingsContext = createContext<CompanySettings>(DEFAULT);

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      try {
        const res = await fetch("/api/company", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const fmt = json.company?.date_format as DateFormatPattern | undefined;
        const logo = json.company?.logo_url as string | undefined;
        const next: CompanySettings = {
          dateFormat: fmt || DEFAULT.dateFormat,
          logoUrl: logo || null,
        };
        setSettings(next);
        if (fmt) setGlobalDateFormat(fmt);
      } catch {
        // keep defaults
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <CompanySettingsContext.Provider value={settings}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useDateFormat(): DateFormatPattern {
  return useContext(CompanySettingsContext).dateFormat;
}

export function useCompanyLogo(): string | null {
  return useContext(CompanySettingsContext).logoUrl;
}
