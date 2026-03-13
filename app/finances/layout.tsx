"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { t } from "@/lib/i18n";

const allTabs = [
  { nameKey: "invoices.title", href: "/finances/invoices" },
  { nameKey: "invoices.suppliersInvoices", href: "/finances/suppliers-invoices" },
  { nameKey: "payments.title", href: "/finances/payments" },
  { nameKey: "cashflow.title", href: "/finances/cashflow" },
  { nameKey: "iata.title", href: "/finances/iata" },
  { nameKey: "reconciliation.title", href: "/finances/reconciliation" },
];

const subagentTabs = new Set(["/finances/invoices", "/finances/suppliers-invoices"]);

export default function FinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const currentRole = useCurrentUserRole();
  const tabs = currentRole === "subagent"
    ? allTabs.filter((tab) => subagentTabs.has(tab.href))
    : allTabs;

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-6 pt-4">
        <nav className="flex gap-1" aria-label="Finances navigation">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname?.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm rounded-t-md transition-colors ${
                  isActive
                    ? "font-bold text-gray-900 border-b-2 border-blue-600 bg-gray-100"
                    : "font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {t(lang, tab.nameKey)}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
