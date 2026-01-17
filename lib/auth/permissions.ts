/**
 * Permission System
 * 
 * Permissions follow the pattern: resource.action
 * Examples: orders.view, orders.create, services.price.view
 */

// All available permissions
export const PERMISSIONS = {
  // Orders
  ORDERS_VIEW: "orders.view",
  ORDERS_CREATE: "orders.create",
  ORDERS_EDIT: "orders.edit",
  ORDERS_DELETE: "orders.delete",
  
  // Services
  SERVICES_VIEW: "services.view",
  SERVICES_CREATE: "services.create",
  SERVICES_EDIT: "services.edit",
  SERVICES_DELETE: "services.delete",
  SERVICES_PRICE_VIEW: "services.price.view",
  SERVICES_MARGIN_VIEW: "services.margin.view",
  
  // Invoices
  INVOICES_VIEW: "invoices.view",
  INVOICES_CREATE: "invoices.create",
  INVOICES_EDIT: "invoices.edit",
  INVOICES_SEND: "invoices.send",
  
  // Payments
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_CREATE: "payments.create",
  PAYMENTS_EDIT: "payments.edit",
  
  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
  
  // Directory
  DIRECTORY_VIEW: "directory.view",
  DIRECTORY_CREATE: "directory.create",
  DIRECTORY_EDIT: "directory.edit",
  DIRECTORY_DELETE: "directory.delete",
  
  // Users
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",
  
  // Settings
  SETTINGS_COMPANY: "settings.company",
  SETTINGS_SYSTEM: "settings.system",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * User with role and permissions
 */
export interface UserWithPermissions {
  id: string;
  role: string;
  roleLevel: number;
  scope: "own" | "all";
  permissions: Array<{
    permission: string;
    scope: "own" | "all";
  }>;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  user: UserWithPermissions,
  permission: Permission | string
): boolean {
  return user.permissions.some((p) => p.permission === permission);
}

/**
 * Check if user has permission with required scope
 * Returns the effective scope ('own' | 'all' | null if no permission)
 */
export function getPermissionScope(
  user: UserWithPermissions,
  permission: Permission | string
): "own" | "all" | null {
  const perm = user.permissions.find((p) => p.permission === permission);
  if (!perm) return null;
  return perm.scope;
}

/**
 * Check if user can access a resource owned by another user
 */
export function canAccessResource(
  user: UserWithPermissions,
  permission: Permission | string,
  resourceOwnerId: string
): boolean {
  const scope = getPermissionScope(user, permission);
  if (!scope) return false;
  if (scope === "all") return true;
  return user.id === resourceOwnerId;
}

/**
 * Get all permissions for a resource
 */
export function getResourcePermissions(resource: string): Permission[] {
  return Object.values(PERMISSIONS).filter((p) =>
    p.startsWith(`${resource}.`)
  );
}

/**
 * Permission display names (for UI)
 */
export const PERMISSION_LABELS: Record<string, string> = {
  "orders.view": "Просмотр заказов",
  "orders.create": "Создание заказов",
  "orders.edit": "Редактирование заказов",
  "orders.delete": "Удаление заказов",
  "services.view": "Просмотр сервисов",
  "services.create": "Добавление сервисов",
  "services.edit": "Редактирование сервисов",
  "services.delete": "Удаление сервисов",
  "services.price.view": "Просмотр закупочной цены",
  "services.margin.view": "Просмотр маржи",
  "invoices.view": "Просмотр счетов",
  "invoices.create": "Создание счетов",
  "invoices.edit": "Редактирование счетов",
  "invoices.send": "Отправка счетов",
  "payments.view": "Просмотр платежей",
  "payments.create": "Добавление платежей",
  "payments.edit": "Редактирование платежей",
  "reports.view": "Просмотр отчётов",
  "reports.export": "Экспорт отчётов",
  "directory.view": "Просмотр справочника",
  "directory.create": "Добавление контактов",
  "directory.edit": "Редактирование контактов",
  "directory.delete": "Удаление контактов",
  "users.view": "Просмотр пользователей",
  "users.create": "Добавление пользователей",
  "users.edit": "Редактирование пользователей",
  "users.delete": "Удаление пользователей",
  "settings.company": "Настройки компании",
  "settings.system": "Системные настройки",
};

/**
 * Get permission label
 */
export function getPermissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] || permission;
}
