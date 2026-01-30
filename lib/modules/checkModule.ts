import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ModuleCode =
  | "core"
  | "ai_parsing"
  | "reports_basic"
  | "reports_advanced"
  | "accounting"
  | "notifications"
  | "ai_agent";

/**
 * Check if a company has access to a specific module
 * 
 * Logic:
 * 1. Check manual override in company_modules
 * 2. Check subscription plan's included_modules
 * 3. Default: only 'core' module is available
 */
export async function hasModule(companyId: string, moduleCode: ModuleCode): Promise<boolean> {
  // Use the database function for consistency
  const { data, error } = await supabaseAdmin.rpc("company_has_module", {
    p_company_id: companyId,
    p_module_code: moduleCode,
  });

  if (error) {
    console.error("[hasModule] Error checking module access:", error);
    // Fallback: allow core, deny others
    return moduleCode === "core";
  }

  return data === true;
}

/**
 * Get all enabled modules for a company
 */
export async function getCompanyModules(companyId: string): Promise<ModuleCode[]> {
  // Get subscription plan modules
  const { data: subscription } = await supabaseAdmin
    .from("company_subscriptions")
    .select(`
      plan_id,
      status,
      subscription_plans (
        included_modules
      )
    `)
    .eq("company_id", companyId)
    .in("status", ["active", "trialing"])
    .single();

  const planModules: string[] = 
    (subscription?.subscription_plans as { included_modules?: string[] } | null)?.included_modules || ["core"];

  // Get manual overrides
  const { data: overrides } = await supabaseAdmin
    .from("company_modules")
    .select(`
      is_enabled,
      modules (
        code
      )
    `)
    .eq("company_id", companyId);

  const moduleSet = new Set<string>(planModules);

  // Apply overrides
  for (const override of overrides || []) {
    const code = (override.modules as { code?: string } | null)?.code;
    if (code) {
      if (override.is_enabled) {
        moduleSet.add(code);
      } else {
        moduleSet.delete(code);
      }
    }
  }

  return Array.from(moduleSet) as ModuleCode[];
}

/**
 * Check if company is in demo mode and not expired
 */
export async function isCompanyDemoValid(companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("companies")
    .select("is_demo, demo_expires_at")
    .eq("id", companyId)
    .single();

  if (!data?.is_demo) {
    return true; // Not a demo company, always valid
  }

  if (!data.demo_expires_at) {
    return true; // No expiry set
  }

  return new Date(data.demo_expires_at) > new Date();
}

/**
 * Check if company has active subscription (not expired, not demo)
 */
export async function hasActiveSubscription(companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("company_subscriptions")
    .select("status, current_period_end")
    .eq("company_id", companyId)
    .single();

  if (!data) {
    // Check if demo
    return await isCompanyDemoValid(companyId);
  }

  if (data.status === "active" || data.status === "trialing") {
    return true;
  }

  // Check period end for grace period
  if (data.current_period_end) {
    const endDate = new Date(data.current_period_end);
    const gracePeriod = new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days grace
    return new Date() < gracePeriod;
  }

  return false;
}

/**
 * Middleware helper: require module access
 * Returns error response if module not available
 */
export async function requireModule(
  companyId: string,
  moduleCode: ModuleCode
): Promise<{ error: string; status: number } | null> {
  // First check if subscription is active
  const isActive = await hasActiveSubscription(companyId);
  if (!isActive) {
    return {
      error: "Subscription expired or demo period ended. Please upgrade your plan.",
      status: 402, // Payment Required
    };
  }

  // Then check module access
  const hasAccess = await hasModule(companyId, moduleCode);
  if (!hasAccess) {
    return {
      error: `This feature requires the "${moduleCode}" module. Please upgrade your plan.`,
      status: 403,
    };
  }

  return null;
}
