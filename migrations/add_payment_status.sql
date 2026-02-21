-- Add status column to payments table (active / cancelled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'payments'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.payments
        ADD COLUMN status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled'));
    END IF;
END $$;
