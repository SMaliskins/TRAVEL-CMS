"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { Download } from "lucide-react";

interface UploadedDoc {
  id: string;
  file_name: string;
  order_code: string | null;
  created_at: string;
  download_url: string | null;
}

export default function SuppliersInvoicesPage() {
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("currentMonth");
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  };

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/finances/uploaded-documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUploadedDocs(data.documents || []);
      } else {
        setUploadedDocs([]);
      }
    } catch (error) {
      console.error("Error loading supplier invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, router]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div />
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          dropdownAlign="right"
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
      ) : uploadedDocs.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-500">
          No supplier invoices found
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">{t(lang, "invoices.file")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">{t(lang, "invoices.order")}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">{t(lang, "invoices.uploaded")}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">{t(lang, "invoices.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {uploadedDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-1.5 font-medium text-gray-900">{doc.file_name}</td>
                  <td className="px-4 py-1.5 text-gray-600">
                    {doc.order_code ? (
                      <button
                        onClick={() => router.push(`/orders/${orderCodeToSlug(doc.order_code!)}`)}
                        className="text-blue-600 hover:underline"
                      >
                        {doc.order_code}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-gray-600">{formatDateDDMMYYYY(doc.created_at)}</td>
                  <td className="px-4 py-1.5 text-right">
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        <Download size={14} />
                        {t(lang, "invoices.download")}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
