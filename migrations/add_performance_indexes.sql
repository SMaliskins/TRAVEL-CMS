-- Performance indexes for frequently queried columns
-- These tables were missing indexes on tenant/FK columns causing full table scans

-- orders: tenant filter + sort by created_at (used on /orders, dashboard, finances)
CREATE INDEX IF NOT EXISTS idx_orders_company_created ON public.orders(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_company_status ON public.orders(company_id, status);

-- order_services: FK lookups (used in /api/orders, dashboard stats, invoice generation)
CREATE INDEX IF NOT EXISTS idx_order_services_order_id ON public.order_services(order_id);
CREATE INDEX IF NOT EXISTS idx_order_services_company_id ON public.order_services(company_id);

-- profiles: used in RLS policies and getCompanyId/getApiUser auth lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- payments: FK lookup by invoice (used in dashboard stats, receipt generation)
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
