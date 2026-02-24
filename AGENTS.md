# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Travel CMS — a Next.js 16 + React 19 travel agency CRM. Uses Supabase (cloud-hosted PostgreSQL + Auth + Storage) as the backend. Has a separate React Native / Expo mobile client app in `Client/`.

### Running the dev server
```
npm run dev          # starts Next.js on http://localhost:3000
```
The app starts even without real Supabase credentials (uses placeholder values) but all data operations will fail. See `.env.example` for required environment variables.

### Lint / Type-check / Build
```
npm run lint         # ESLint (pre-existing warnings/errors in codebase)
npx tsc --noEmit     # TypeScript type-check
npm run build        # production build (uses webpack flag)
```

### Key caveats
- **No test framework**: There are no unit/integration tests. The only automated check is `npm run lint`.
- **Supabase is cloud-hosted**: No local DB setup. All data access requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
- **`invoice_items` FK constraint**: The `invoice_items` table uses `ON DELETE RESTRICT` on `service_id → order_services(id)`. Any operation that deletes an `order_service` with invoiced items must first reassign or remove the `invoice_items` rows.
- **Client app** (`Client/`): Separate npm project with Expo. Not required for CRM dev. Run `cd Client && npm install && npx expo start` if needed.
- **Date format rule**: All user-facing dates must use `formatDateDDMMYYYY()` from `@/utils/dateFormat` — never `toLocaleDateString()`.
- **Project rules**: The `.ai/NEW_PROJECT_RULES.md` file governs the development workflow (pipeline, agents, logging). Read the `.cursor/rules/cursorrules.mdc` for the full protocol.
