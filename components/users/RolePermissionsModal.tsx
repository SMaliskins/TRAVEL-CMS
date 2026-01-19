"use client";

import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { getRoleDisplayName } from "@/lib/auth/roles";

interface RolePermissionsModalProps {
  onClose: () => void;
}

// Permission matrix
const PERMISSIONS = [
  { key: "contacts", label: { en: "Contacts", ru: "Контакты" } },
  { key: "orders.view", label: { en: "View orders", ru: "Просмотр заказов" } },
  { key: "orders.create", label: { en: "Create orders", ru: "Создание заказов" } },
  { key: "orders.edit", label: { en: "Edit orders", ru: "Редактирование заказов" } },
  { key: "orders.delete", label: { en: "Delete orders", ru: "Удаление заказов" } },
  { key: "services.manage", label: { en: "Manage services", ru: "Управление сервисами" } },
  { key: "invoices.create", label: { en: "Create invoices", ru: "Создание счетов" } },
  { key: "payments.record", label: { en: "Record payments", ru: "Учёт платежей" } },
  { key: "reports.view", label: { en: "View reports", ru: "Просмотр отчётов" } },
  { key: "users.view", label: { en: "View users", ru: "Просмотр пользователей" } },
  { key: "users.manage", label: { en: "Manage users", ru: "Управление пользователями" } },
  { key: "settings.company", label: { en: "Company settings", ru: "Настройки компании" } },
];

// Role permissions (true = allowed, "own" = only own data, false = denied)
const ROLE_PERMISSIONS: Record<string, Record<string, boolean | "own">> = {
  subagent: {
    "contacts": "own",
    "orders.view": "own",
    "orders.create": true,
    "orders.edit": "own",
    "orders.delete": false,
    "services.manage": "own",
    "invoices.create": "own",
    "payments.record": "own",
    "reports.view": false,
    "users.view": false,
    "users.manage": false,
    "settings.company": false,
  },
  agent: {
    "contacts": true,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": false,
    "services.manage": true,
    "invoices.create": true,
    "payments.record": true,
    "reports.view": false,
    "users.view": false,
    "users.manage": false,
    "settings.company": false,
  },
  finance: {
    "contacts": true,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": false,
    "services.manage": true,
    "invoices.create": false,
    "payments.record": true,
    "reports.view": true,
    "users.view": false,
    "users.manage": false,
    "settings.company": false,
  },
  manager: {
    "contacts": true,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": true,
    "services.manage": true,
    "invoices.create": true,
    "payments.record": true,
    "reports.view": true,
    "users.view": true,
    "users.manage": false,
    "settings.company": true,
  },
  supervisor: {
    "contacts": true,
    "orders.view": true,
    "orders.create": true,
    "orders.edit": true,
    "orders.delete": true,
    "services.manage": true,
    "invoices.create": true,
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

  const renderPermission = (value: boolean | "own") => {
    if (value === true) {
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600">
          ✓
        </span>
      );
    }
    if (value === "own") {
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-[10px] font-bold">
          Own
        </span>
      );
    }
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        –
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
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

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pr-4 text-left font-medium text-gray-500">
                    {lang === "ru" ? "Разрешение" : "Permission"}
                  </th>
                  {ROLES.map((role) => (
                    <th key={role} className="px-2 pb-3 text-center font-medium text-gray-900">
                      {getRoleDisplayName(role, prefs.language)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm, idx) => (
                  <tr
                    key={perm.key}
                    className={idx % 2 === 0 ? "bg-gray-50" : ""}
                  >
                    <td className="py-2 pr-4 text-gray-700">
                      {perm.label[lang]}
                    </td>
                    {ROLES.map((role) => (
                      <td key={role} className="px-2 py-2 text-center">
                        {renderPermission(ROLE_PERMISSIONS[role][perm.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600 text-[10px]">✓</span>
              <span>{lang === "ru" ? "Разрешено" : "Allowed"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-[8px] font-bold">Own</span>
              <span>{lang === "ru" ? "Только свои" : "Own data only"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-400">–</span>
              <span>{lang === "ru" ? "Запрещено" : "Denied"}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {lang === "ru" ? "Закрыть" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
