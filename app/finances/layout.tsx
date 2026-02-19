"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Invoices", href: "/finances/invoices" },
  { name: "Payments", href: "/finances/payments" },
  { name: "Cash Flow", href: "/finances/cashflow" },
  { name: "IATA", href: "/finances/iata" },
  { name: "Reconciliation", href: "/finances/reconciliation" },
];

export default function FinancesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
