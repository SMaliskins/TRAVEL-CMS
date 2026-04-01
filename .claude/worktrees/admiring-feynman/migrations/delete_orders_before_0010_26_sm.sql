-- Migration: Delete all orders before 0010/26-SM
-- Run in Supabase SQL Editor. Adjust company_id if needed.
-- order_code format: "0010/26-SM" (seq/year-initials)
--
-- Must delete in order: invoice_items references order_services (ON DELETE RESTRICT).
-- Deleting invoices CASCADE-deletes invoice_items, breaking that FK chain.

-- 1. Delete invoices first (CASCADE deletes invoice_items, freeing order_services)
DELETE FROM public.invoices
WHERE order_id IN (SELECT id FROM public.orders WHERE order_code < '0010/26-SM');

-- 2. Delete orders (CASCADE: order_services, order_access, payments, etc.)
DELETE FROM public.orders
WHERE order_code < '0010/26-SM';
