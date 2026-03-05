"use client";

import Link from "next/link";
import { Building2, UsersRound, CreditCard, UserCircle, Plane, Type } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";

const SETTINGS_SECTIONS = [
  { nameKey: "settings.company", descKey: "settings.companyDesc", href: "/settings/company", icon: Building2 },
  { nameKey: "settings.users", descKey: "settings.usersDesc", href: "/settings/users", icon: UsersRound },
  { nameKey: "settings.billing", descKey: "settings.billingDesc", href: "/settings/billing", icon: CreditCard },
  { nameKey: "settings.profileLink", descKey: "settings.profileDesc", href: "/settings/profile", icon: UserCircle },
  { nameKey: "settings.travelServices", descKey: "settings.travelServicesDesc", href: "/settings/travel-services", icon: Plane },
  { nameKey: "settings.accessibility", descKey: "settings.accessibilityDesc", href: "/settings/accessibility", icon: Type },
];

export default function SettingsPage() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;

  return (
    <div className="bg-gray-50 p-6">
      <div className="space-y-6">
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">{t(lang, "settings.title")}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SETTINGS_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-gray-600">
                <section.icon size={24} strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="font-medium text-gray-900">{t(lang, section.nameKey)}</h3>
                <p className="text-sm text-gray-500">{t(lang, section.descKey)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
