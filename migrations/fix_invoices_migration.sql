-- Fix: Remove problematic index on invoice_date
-- The column name might be different or might not need index

-- Drop the problematic index if it exists
DROP INDEX IF EXISTS idx_invoices_invoice_date;

-- Check current invoices table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;
