"use client";

import Link from "next/link";
import { useFontScale, SCALE_PRESETS, FONT_PRESETS } from "@/hooks/useFontScale";

const SETTINGS_SECTIONS = [
  { name: "Company", href: "/settings/company", icon: "🏢", description: "Company profile, licenses, banking, regional settings" },
  { name: "Users", href: "/settings/users", icon: "👥", description: "User management and roles" },
  { name: "Billing", href: "/settings/billing", icon: "💳", description: "Subscription, upgrade plan, manage billing" },
  { name: "Profile", href: "/settings/profile", icon: "👤", description: "Your personal settings" },
  { name: "Travel Services", href: "/settings/travel-services", icon: "✈️", description: "Manage travel service categories and VAT rates" },
  { name: "Accessibility", href: "/settings/accessibility", icon: "🔤", description: "Customize font size and font family" },
];

export default function SettingsPage() {
  return (
    <div className="bg-gray-50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        </div>

        {/* Settings Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SETTINGS_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">{section.icon}</span>
              <div>
                <h3 className="font-medium text-gray-900">{section.name}</h3>
                <p className="text-sm text-gray-500">{section.description}</p>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
