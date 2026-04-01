# Invoice System Database Migration

## ⚠️ IMPORTANT: Run this migration before using Invoice features!

### Step 1: Run Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the entire content of `create_invoices_tables.sql`
3. Click **Run**

### What this migration does:

✅ Creates `invoices` table with fields:
- invoice_number, order_id, company_id
- client info (name, address, email)
- dates (invoice_date, due_date)
- amounts (subtotal, tax, total)
- status (draft/sent/paid/cancelled/overdue)

✅ Creates `invoice_items` table (line items for services)

✅ Adds `invoice_id` column to `order_services` (prevents double-invoicing)

✅ Sets up RLS policies (tenant isolation)

✅ Creates indexes for performance

### Verification:

After running the migration, verify with:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoices', 'invoice_items');

-- Should return 2 rows
```

### Rollback (if needed):

```sql
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
ALTER TABLE public.order_services DROP COLUMN IF EXISTS invoice_id;
```

---

**Ready to use Invoice System after migration!** 🚀
