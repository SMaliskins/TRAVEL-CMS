"use client";

import Link from "next/link";
import { Building2, UsersRound, CreditCard, UserCircle, Plane, Type, Brain, Mail } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/contexts/CurrentUserContext";
import { t } from "@/lib/i18n";

const SETTINGS_SECTIONS = [
  { nameKey: "settings.company", descKey: "settings.companyDesc", href: "/settings/company", icon: Building2, minRole: "manager" },
  { nameKey: "settings.users", descKey: "settings.usersDesc", href: "/settings/users", icon: UsersRound, minRole: "supervisor" },
  { nameKey: "settings.database", descKey: "settings.databaseDesc", href: "/settings/database", icon: CreditCard, minRole: "supervisor" },
  { nameKey: "settings.profileLink", descKey: "settings.profileDesc", href: "/settings/profile", icon: UserCircle },
  { nameKey: "settings.travelServices", descKey: "settings.travelServicesDesc", href: "/settings/travel-services", icon: Plane, minRole: "agent" },
  { nameKey: "settings.accessibility", descKey: "settings.accessibilityDesc", href: "/settings/accessibility", icon: Type },
  { nameKey: "settings.emailTemplates", descKey: "settings.emailTemplatesDesc", href: "/settings/email-templates", icon: Mail, minRole: "manager" },
  { nameKey: "settings.aiParsing", descKey: "settings.aiParsingDesc", href: "/settings/ai-parsing", icon: Brain, minRole: "supervisor" },
];

const ROLE_LEVEL: Record<string, number> = { subagent: 1, agent: 2, finance: 3, manager: 4, supervisor: 5 };

export default function SettingsPage() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const userRole = useCurrentUserRole();
  const userLevel = ROLE_LEVEL[(userRole || "").toLowerCase()] || 0;

  return (
    <div className="bg-gray-50 p-6">
      <div className="space-y-6">
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">{t(lang, "settings.title")}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SETTINGS_SECTIONS.filter((s) => {
            if (!s.minRole) return true;
            if (userRole === null) return true;
            return userLevel >= (ROLE_LEVEL[s.minRole] || 0);
          }).map((section) => (
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
