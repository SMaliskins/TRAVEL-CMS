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

/**
 * Role-Permission Matrix
 * Defines what each role can do and with what scope
 */
export const ROLE_PERMISSIONS: Record<string, Record<string, "all" | "own" | "commission" | false>> = {
  supervisor: {
    "reports.view": "all",
    "reports.export": "all",
    "orders.view": "all",
    "orders.create": "all",
    "orders.edit": "all",
    "orders.delete": "all",
    "services.view": "all",
    "services.create": "all",
    "services.edit": "all",
    "services.delete": "all",
    "services.price.view": "all",
    "services.margin.view": "all",
    "invoices.view": "all",
    "invoices.create": "all",
    "invoices.edit": "all",
    "invoices.send": "all",
    "payments.view": "all",
    "payments.create": "all",
    "payments.edit": "all",
    "directory.view": "all",
    "directory.create": "all",
    "directory.edit": "all",
    "directory.delete": "all",
    "users.view": "all",
    "users.create": "all",
    "users.edit": "all",
    "users.delete": "all",
    "settings.company": "all",
    "settings.system": "all",
  },
  manager: {
    "reports.view": "all",
    "reports.export": "all",
    "orders.view": "all",
    "orders.create": "all",
    "orders.edit": "all",
    "orders.delete": "all",
    "services.view": "all",
    "services.create": "all",
    "services.edit": "all",
    "services.delete": "all",
    "services.price.view": "all",
    "services.margin.view": "all",
    "invoices.view": "all",
    "invoices.create": "all",
    "invoices.edit": "all",
    "invoices.send": "all",
    "payments.view": "all",
    "payments.create": "all",
    "payments.edit": "all",
    "directory.view": "all",
    "directory.create": "all",
    "directory.edit": "all",
    "directory.delete": "all",
    "users.view": false,
    "users.create": false,
    "users.edit": false,
    "users.delete": false,
    "settings.company": false,
    "settings.system": false,
  },
  finance: {
    "reports.view": "all",
    "reports.export": "all",
    "orders.view": "all",
    "orders.create": false,
    "orders.edit": false,
    "orders.delete": false,
    "services.view": "all",
    "services.create": false,
    "services.edit": false,
    "services.delete": false,
    "services.price.view": "all",
    "services.margin.view": "all",
    "invoices.view": "all",
    "invoices.create": "all",
    "invoices.edit": "all",
    "invoices.send": "all",
    "payments.view": "all",
    "payments.create": "all",
    "payments.edit": "all",
    "directory.view": "all",
    "directory.create": false,
    "directory.edit": false,
    "directory.delete": false,
    "users.view": false,
    "users.create": false,
    "users.edit": false,
    "users.delete": false,
    "settings.company": false,
    "settings.system": false,
  },
  agent: {
    "reports.view": "own",
    "reports.export": false,
    "orders.view": "all",
    "orders.create": "all",
    "orders.edit": "own",
    "orders.delete": false,
    "services.view": "all",
    "services.create": "all",
    "services.edit": "own",
    "services.delete": "own",
    "services.price.view": false,
    "services.margin.view": false,
    "invoices.view": "own",
    "invoices.create": false,
    "invoices.edit": false,
    "invoices.send": false,
    "payments.view": "own",
    "payments.create": false,
    "payments.edit": false,
    "directory.view": "all",
    "directory.create": "all",
    "directory.edit": "own",
    "directory.delete": false,
    "users.view": false,
    "users.create": false,
    "users.edit": false,
    "users.delete": false,
    "settings.company": false,
    "settings.system": false,
  },
  subagent: {
    "reports.view": "commission",
    "reports.export": false,
    "orders.view": "own",
    "orders.create": "own",
    "orders.edit": "own",
    "orders.delete": false,
    "services.view": "own",
    "services.create": "own",
    "services.edit": "own",
    "services.delete": false,
    "services.price.view": false,
    "services.margin.view": false,
    "invoices.view": false,
    "invoices.create": false,
    "invoices.edit": false,
    "invoices.send": false,
    "payments.view": false,
    "payments.create": false,
    "payments.edit": false,
    "directory.view": "own",
    "directory.create": "own",
    "directory.edit": "own",
    "directory.delete": false,
    "users.view": false,
    "users.create": false,
    "users.edit": false,
    "users.delete": false,
    "settings.company": false,
    "settings.system": false,
  },
};

/**
 * Get permission scope for a role
 */
export function getRolePermission(
  role: string,
  permission: string
): "all" | "own" | "commission" | false {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  return rolePerms[permission] ?? false;
}

/**
 * Check if role has permission (any scope)
 */
export function roleHasPermission(role: string, permission: string): boolean {
  return getRolePermission(role, permission) !== false;
}

/**
 * Check if role can access all records (not just own)
 */
export function roleCanAccessAll(role: string, permission: string): boolean {
  return getRolePermission(role, permission) === "all";
}
