/**
 * Role System Constants and Helpers
 */

// Role names (match database)
export const ROLES = {
  SUBAGENT: "subagent",
  AGENT: "agent",
  FINANCE: "finance",
  MANAGER: "manager",
  SUPERVISOR: "supervisor",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Role levels for hierarchy comparison
export const ROLE_LEVELS: Record<RoleName, number> = {
  subagent: 1,
  agent: 2,
  finance: 3,
  manager: 4,
  supervisor: 5,
};

// Role display names (localized)
export const ROLE_DISPLAY_NAMES: Record<string, Record<RoleName, string>> = {
  en: {
    subagent: "Subagent",
    agent: "Agent",
    finance: "Finance",
    manager: "Manager",
    supervisor: "Supervisor",
  },
  ru: {
    subagent: "Субагент",
    agent: "Агент",
    finance: "Финансы",
    manager: "Менеджер",
    supervisor: "Супервайзер",
  },
  lv: {
    subagent: "Subagents",
    agent: "Aģents",
    finance: "Finanses",
    manager: "Vadītājs",
    supervisor: "Supervizors",
  },
};

// Role colors (Tailwind classes)
export const ROLE_COLORS: Record<RoleName, string> = {
  subagent: "bg-gray-100 text-gray-700",
  agent: "bg-blue-100 text-blue-700",
  finance: "bg-green-100 text-green-700",
  manager: "bg-purple-100 text-purple-700",
  supervisor: "bg-red-100 text-red-700",
};

// Role badge colors (hex)
export const ROLE_HEX_COLORS: Record<RoleName, string> = {
  subagent: "#9CA3AF",
  agent: "#3B82F6",
  finance: "#10B981",
  manager: "#8B5CF6",
  supervisor: "#EF4444",
};

/**
 * Check if role A has higher or equal level than role B
 */
export function hasHigherOrEqualRole(
  roleA: RoleName | string,
  roleB: RoleName | string
): boolean {
  const levelA = ROLE_LEVELS[roleA as RoleName] || 0;
  const levelB = ROLE_LEVELS[roleB as RoleName] || 0;
  return levelA >= levelB;
}

/**
 * Check if user has minimum required role level
 */
export function hasMinimumRole(
  userRole: RoleName | string,
  minRole: RoleName
): boolean {
  return hasHigherOrEqualRole(userRole, minRole);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: RoleName | string, language: string = "en"): string {
  const langNames = ROLE_DISPLAY_NAMES[language] || ROLE_DISPLAY_NAMES.en;
  return langNames[role as RoleName] || role;
}

/**
 * Get role color classes
 */
export function getRoleColorClasses(role: RoleName | string): string {
  return ROLE_COLORS[role as RoleName] || "bg-gray-100 text-gray-700";
}

/**
 * Check if role can manage users
 */
export function canManageUsers(role: RoleName | string): boolean {
  return role === ROLES.SUPERVISOR;
}

/**
 * Check if role can view financial reports
 */
export function canViewReports(role: RoleName | string): boolean {
  const level = ROLE_LEVELS[role as RoleName] || 0;
  return level >= ROLE_LEVELS.finance;
}

/**
 * Check if role can delete orders
 */
export function canDeleteOrders(role: RoleName | string): boolean {
  const level = ROLE_LEVELS[role as RoleName] || 0;
  return level >= ROLE_LEVELS.manager;
}

/**
 * Get scope for role ('own' or 'all')
 */
export function getRoleScope(role: RoleName | string): "own" | "all" {
  return role === ROLES.SUBAGENT ? "own" : "all";
}
