-- ============================================
-- order_communications — лог коммуникаций по заказам
-- ============================================
-- Логирует отправленные/полученные сообщения (email, etc.) по заказу или сервису.
-- Используется для вкладки Log на странице заказа и для "Send to Hotel".
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.order_services(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('to_supplier', 'from_supplier', 'to_client', 'from_client', 'other')),
  recipient_email text,
  subject text,
  body text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id),
  email_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Индексы для запросов
CREATE INDEX IF NOT EXISTS idx_order_communications_order_id ON public.order_communications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_communications_service_id ON public.order_communications(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_communications_company_id ON public.order_communications(company_id);
CREATE INDEX IF NOT EXISTS idx_order_communications_sent_at ON public.order_communications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_communications_type ON public.order_communications(type);

-- RLS
ALTER TABLE public.order_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company communications" ON public.order_communications;
DROP POLICY IF EXISTS "Users can insert company communications" ON public.order_communications;

-- Политика: пользователи видят коммуникации своей компании
CREATE POLICY "Users can view company communications"
  ON public.order_communications
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Политика: пользователи могут создавать коммуникации для своей компании
CREATE POLICY "Users can insert company communications"
  ON public.order_communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Комментарии
COMMENT ON TABLE public.order_communications IS 'Log of outbound/inbound communications (email, etc.) per order or service. Used for Log tab and Send to Hotel.';
COMMENT ON COLUMN public.order_communications.type IS 'Direction: to_supplier, from_supplier, to_client, from_client, other';
COMMENT ON COLUMN public.order_communications.service_id IS 'Optional: link to specific service (e.g. hotel) for Send to Hotel';
COMMENT ON COLUMN public.order_communications.email_sent IS 'Whether email was successfully sent';
