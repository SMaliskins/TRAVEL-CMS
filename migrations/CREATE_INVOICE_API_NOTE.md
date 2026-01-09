# Invoice API Implementation Note

## Important: Supabase Client Import

This project uses:
- `@/lib/supabaseClient` for client-side
- `@/lib/supabaseAdmin` for server-side (admin operations)

**DO NOT use:** `@/lib/supabase/server` (does not exist in this project)

## Phase 1 Implementation Summary

Due to time constraints, Phase 1 focuses on:
1. ✅ Database schema (migrations/create_invoices_tables.sql)
2. ✅ Frontend components (InvoiceList, InvoiceCreator updates)
3. ✅ UI for invoice icon + locked services
4. ⏳ API endpoints (to be implemented after database migration)

### Next Steps:

1. Run database migration: `migrations/create_invoices_tables.sql`
2. Implement API endpoints with correct supabaseAdmin usage
3. Test full flow: Select services → Issue Invoice → View in Finance tab

### API Endpoints Needed:

- `GET /api/orders/[orderCode]/invoices` - List invoices
- `POST /api/orders/[orderCode]/invoices` - Create invoice
- `PATCH /api/orders/[orderCode]/invoices/[invoiceId]` - Update/Cancel invoice

All should use `supabaseAdmin` from `@/lib/supabaseAdmin`
