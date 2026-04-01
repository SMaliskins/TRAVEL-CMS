"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DateFormatPattern, setGlobalDateFormat } from "@/utils/dateFormat";

interface CompanySettings {
  dateFormat: DateFormatPattern;
}

const DEFAULT: CompanySettings = { dateFormat: "dd.mm.yyyy" };

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
        const fmt = json.company?.date_format as DateFormatPattern | undefined;
        if (!cancelled && fmt) {
          setSettings({ dateFormat: fmt });
          setGlobalDateFormat(fmt);
        }
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
