"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";

export type ReferralOrderRow = {
  orderId: string;
  orderCode: string;
  dateTo: string | null;
  referralCommissionConfirmed: boolean;
  tripEnded: boolean;
  plannedCommission: number;
  accruedCommission: number;
  primaryStatus: string;
  becomesAccruedWhenTripEndedAndConfirmed: boolean;
};

type DirectoryReferralOrdersListProps = {
  directoryId: string | null | undefined;
  /** When false, nothing is rendered and no request is made */
  active: boolean;
  /** Optional callback before following a link to an order (e.g. close popup, save scroll) */
  onBeforeNavigateToOrder?: () => void;
  /** Root element classes (layout chrome around the list) */
  className?: string;
};

export default function DirectoryReferralOrdersList({
  directoryId,
  active,
  onBeforeNavigateToOrder,
  className = "border-t border-gray-100 pt-4",
}: DirectoryReferralOrdersListProps) {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [orders, setOrders] = useState<ReferralOrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active || !directoryId) {
      setOrders(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/directory/${encodeURIComponent(directoryId)}/referral-orders`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setOrders([]);
          return;
        }
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, directoryId]);

  const formatMoney = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: prefs.currency || "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount),
    [prefs.currency]
  );

  if (!active || !directoryId) return null;

  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t(lang, "directory.referralOrdersSection")}
      </h3>
      {loading && (
        <p className="mt-2 text-sm text-gray-500">{t(lang, "directory.referralOrdersLoading")}</p>
      )}
      {!loading && orders && orders.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">{t(lang, "directory.referralOrdersEmpty")}</p>
      )}
      {!loading && orders && orders.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1 sm:max-h-64">
          {orders.map((o) => {
            const statusKey =
              o.primaryStatus === "accrued"
                ? "directory.referralStatusAccrued"
                : "directory.referralStatusPlanned";
            const showAccrualHint = o.plannedCommission > 0 && o.becomesAccruedWhenTripEndedAndConfirmed;
            return (
              <li
                key={o.orderId}
                className="rounded-lg border border-gray-100 bg-gray-50/80 p-2 text-sm"
              >
                <Link
                  href={`/orders/${orderCodeToSlug(o.orderCode)}`}
                  onClick={() => {
                    onBeforeNavigateToOrder?.();
                  }}
                  className="font-medium text-blue-700 hover:underline"
                >
                  {o.orderCode}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{t(lang, statusKey)}</span>
                  <span>
                    {t(lang, "directory.referralPlannedLabel")}: {formatMoney(o.plannedCommission)}
                  </span>
                  <span>
                    {t(lang, "directory.referralAccruedLabel")}: {formatMoney(o.accruedCommission)}
                  </span>
                  {o.dateTo ? (
                    <span>
                      {t(lang, "directory.referralTripEnd")}: {formatDateDDMMYYYY(o.dateTo)}
                    </span>
                  ) : null}
                </div>
                {showAccrualHint ? (
                  <p className="mt-1 text-[11px] leading-snug text-amber-900/90">
                    {t(lang, "directory.referralBecomesAccruedHint")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
