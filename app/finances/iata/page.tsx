"use client";

import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";

export default function IATAPage() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center mt-4">
        <div className="text-4xl mb-4">✈️</div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">{t(lang, "iata.comingSoon")}</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          {t(lang, "iata.description")}
        </p>
      </div>
    </div>
  );
}
