-- Tour: commission name, rate, amount, agent discount on order_services
ALTER TABLE public.order_services
  ADD COLUMN IF NOT EXISTS commission_name text,
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS agent_discount_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS agent_discount_type text CHECK (agent_discount_type IN ('%', '€'));
