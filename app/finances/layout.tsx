"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/contexts/CurrentUserContext";
import { t } from "@/lib/i18n";

const allTabs = [
  { nameKey: "invoices.title", href: "/finances/invoices" },
  { nameKey: "invoices.suppliersInvoices", href: "/finances/suppliers-invoices" },
  { nameKey: "payments.title", href: "/finances/payments" },
  { nameKey: "cashflow.title", href: "/finances/cashflow" },
  { nameKey: "companyExpenses.title", href: "/finances/company-expenses", supervisorOrFinanceOnly: true },
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
  const isSupervisorOrFinance = currentRole === "supervisor" || currentRole === "finance" || currentRole === "admin";
  const tabs = currentRole === "subagent"
    ? allTabs.filter((tab) => subagentTabs.has(tab.href))
    : allTabs.filter((tab) => !("supervisorOrFinanceOnly" in tab && tab.supervisorOrFinanceOnly) || isSupervisorOrFinance);

  return (
    <div>
      <div className="border-b border-gray-200 theme-card-bg px-3 sm:px-6 pt-3 sm:pt-4">
        <nav className="flex gap-1 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0" aria-label="Finances navigation">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname?.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-shrink-0 px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-t-md transition-colors whitespace-nowrap ${
                  isActive
                    ? "font-bold border-b-2 border-blue-600 theme-panel-bg text-[var(--foreground)]"
                    : "font-medium text-[var(--theme-fg-muted)] hover:text-[var(--foreground)] hover:bg-[var(--theme-btn-bg)]"
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
