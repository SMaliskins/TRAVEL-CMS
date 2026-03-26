-- Add processor and processing_fee columns to payments table (card payments)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'payments'
        AND column_name = 'processor'
    ) THEN
        ALTER TABLE public.payments
        ADD COLUMN processor text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'payments'
        AND column_name = 'processing_fee'
    ) THEN
        ALTER TABLE public.payments
        ADD COLUMN processing_fee numeric(12,2) NOT NULL DEFAULT 0;
    END IF;
END $$;
