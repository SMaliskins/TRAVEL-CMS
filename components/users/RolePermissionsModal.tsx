"use client";

import { useState } from "react";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { getRoleDisplayName } from "@/lib/auth/roles";

interface RolePermissionsModalProps {
  onClose: () => void;
}

// Role descriptions for tooltips
const ROLE_DESCRIPTIONS: Record<string, { en: string; ru: string }> = {
  subagent: {
    en: "External partner with limited access to own clients only",
    ru: "Внешний партнёр с доступом только к своим клиентам",
  },
  agent: {
    en: "Travel consultant handling bookings and client service",
    ru: "Консультант по бронированию и работе с клиентами",
  },
  finance: {
    en: "Accountant for payments and reports, no order editing",
    ru: "Бухгалтер: платежи и отчёты, без редактирования заказов",
  },
  manager: {
    en: "Team lead with full operations access",
    ru: "Руководитель отдела с полным доступом к операциям",
  },
  supervisor: {
    en: "Administrator with full system access including users",
    ru: "Администратор с полным доступом, включая управление пользователями",
  },
};

// Permission groups
const PERMISSION_GROUPS = [
  {
    group: { en: "Contacts", ru: "Контакты" },
    permissions: [
      { key: "contacts.view", label: { en: "View", ru: "Просмотр" } },
      { key: "contacts.edit", label: { en: "Create / Edit", ru: "Создание / Редактирование" } },
      { key: "contacts.delete", label: { en: "Delete", ru: "Удаление" } },
    ],
  },
  {
    group: { en: "Orders", ru: "Заказы" },
    permissions: [
      { key: "orders.view", label: { en: "View", ru: "Просмотр" } },
      { key: "orders.create", label: { en: "Create", ru: "Создание" } },
      { key: "orders.edit", label: { en: "Edit", ru: "Редактирование" } },
      { key: "orders.delete", label: { en: "Delete", ru: "Удаление" } },
      { key: "services.manage", label: { en: "Manage services", ru: "Управление сервисами" } },
    ],
  },
  {
    group: { en: "Invoices", ru: "Счета" },
    permissions: [
      { key: "invoices.view", label: { en: "View", ru: "Просмотр" } },
      { key: "invoices.create", label: { en: "Create", ru: "Создание" } },
      { key: "invoices.edit", label: { en: "Edit", ru: "Редактирование" } },
    ],
  },
  {
    group: { en: "Finance", ru: "Финансы" },
    permissions: [
      { key: "payments.record", label: { en: "Record payments", ru: "Учёт платежей" } },
      { key: "reports.view", label: { en: "View reports", ru: "Просмотр отчётов" } },
    ],
  },
  {
    group: { en: "Administration", ru: "Администрирование" },
    permissions: [
      { key: "users.view", label: { en: "View users", ru: "Просмотр пользователей" } },
      { key: "users.manage", label: { en: "Manage users", ru: "Управление пользователями" } },
      { key: "settings.company", label: { en: "Company settings", ru: "Настройки компании" } },
    ],
  },
];

// Role permissions (true = allowed, "own" = only own data, "commission" = commission only, false = denied)
const ROLE_PERMISSIONS: Record<string, Record<string, boolean | "own" | "commission">> = {
  subagent: {
    "contacts.view": "own",
    "contacts.edit": "own",
    "contacts.delete": false,
    "orders.view": "own",
    "orders.create": true,
    "orders.edit": "own",
    "orders.delete": false,
    "services.manage": "own",
    "invoices.view": "own",
    "invoices.create": "own",
    "invoices.edit": "own",
    "payments.record": "own",
    "reports.view": "commission",
    "users.view": false,
    "users.manage": false,
    "settings.company": false,
  },
  agent: {
    "contacts.view": true,
    "contacts.edit": true,
    "contacts.delete": false,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": false,
    "services.manage": true,
    "invoices.view": true,
    "invoices.create": true,
    "invoices.edit": true,
    "payments.record": true,
    "reports.view": false,
    "users.view": false,
    "users.manage": false,
    "settings.company": false,
  },
  finance: {
    "contacts.view": true,
    "contacts.edit": false,
    "contacts.delete": false,
    "orders.view": true,
    "orders.create": false,
    "orders.edit": false,
    "orders.delete": false,
    "services.manage": false,
    "invoices.view": true,
    "invoices.create": false,
    "invoices.edit": false,
    "payments.record": true,
    "reports.view": true,
    "users.view": false,
    "users.manage": false,
    "settings.company": false,
  },
  manager: {
    "contacts.view": true,
    "contacts.edit": true,
    "contacts.delete": true,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": true,
    "services.manage": true,
    "invoices.view": true,
    "invoices.create": true,
    "invoices.edit": true,
    "payments.record": true,
    "reports.view": true,
    "users.view": true,
    "users.manage": false,
    "settings.company": true,
  },
  supervisor: {
    "contacts.view": true,
    "contacts.edit": true,
    "contacts.delete": true,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": true,
    "services.manage": true,
    "invoices.view": true,
    "invoices.create": true,
    "invoices.edit": true,
    "payments.record": true,
    "reports.view": true,
    "users.view": true,
    "users.manage": true,
    "settings.company": true,
  },
};

const ROLES = ["subagent", "agent", "finance", "manager", "supervisor"];

export default function RolePermissionsModal({ onClose }: RolePermissionsModalProps) {
  useEscapeKey(onClose, true);
  const { prefs } = useUserPreferences();
  const lang = prefs.language === "ru" ? "ru" : "en";

  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const showTooltip = (e: React.MouseEvent, text: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  const hideTooltip = () => setTooltip(null);

  const renderPermission = (value: boolean | "own" | "commission") => {
    const tooltipText = value === true
      ? (lang === "ru" ? "Полный доступ" : "Full access")
      : value === "own"
        ? (lang === "ru" ? "Только свои данные" : "Own data only")
        : value === "commission"
          ? (lang === "ru" ? "Только комиссия" : "Commission only")
          : (lang === "ru" ? "Нет доступа" : "No access");

    if (value === true) {
      return (
        <span
          className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-green-100 text-green-600"
          onMouseEnter={(e) => showTooltip(e, tooltipText)}
          onMouseLeave={hideTooltip}
        >
          ✓
        </span>
      );
    }
    if (value === "own") {
      return (
        <span
          className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-[10px] font-bold"
          onMouseEnter={(e) => showTooltip(e, tooltipText)}
          onMouseLeave={hideTooltip}
        >
          Own
        </span>
      );
    }
    if (value === "commission") {
      return (
        <span
          className="inline-flex h-auto px-1 cursor-help items-center justify-center rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold"
          onMouseEnter={(e) => showTooltip(e, tooltipText)}
          onMouseLeave={hideTooltip}
        >
          Com
        </span>
      );
    }
    return (
      <span
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-gray-100 text-gray-400"
        onMouseEnter={(e) => showTooltip(e, tooltipText)}
        onMouseLeave={hideTooltip}
      >
        –
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {lang === "ru" ? "Права ролей" : "Role Permissions"}
            </h3>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Legend - sticky */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600 text-[10px]">✓</span>
              <span>{lang === "ru" ? "Разрешено" : "Allowed"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-[8px] font-bold">Own</span>
              <span>{lang === "ru" ? "Только свои" : "Own data only"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 px-1 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-[8px] font-bold">Com</span>
              <span>{lang === "ru" ? "Только комиссия" : "Commission only"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-400">–</span>
              <span>{lang === "ru" ? "Запрещено" : "Denied"}</span>
            </div>
          </div>
        </div>

        <div className="p-6">

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">
                    {lang === "ru" ? "Разрешение" : "Permission"}
                  </th>
                  {ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-2 pb-3 text-center font-medium text-gray-900"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{getRoleDisplayName(role, prefs.language)}</span>
                        <span
                          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500"
                          onMouseEnter={(e) => showTooltip(e, ROLE_DESCRIPTIONS[role]?.[lang] || "")}
                          onMouseLeave={hideTooltip}
                        >
                          ?
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <>
                    {/* Group header */}
                    <tr key={`group-${group.group.en}`} className="bg-gray-100">
                      <td
                        colSpan={ROLES.length + 1}
                        className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        {group.group[lang]}
                      </td>
                    </tr>
                    {/* Group permissions */}
                    {group.permissions.map((perm, idx) => (
                      <tr
                        key={perm.key}
                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="py-2 pl-4 pr-4 text-gray-700">
                          {perm.label[lang]}
                        </td>
                        {ROLES.map((role) => (
                          <td key={role} className="px-2 py-2 text-center">
                            {renderPermission(ROLE_PERMISSIONS[role][perm.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {lang === "ru" ? "Закрыть" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
