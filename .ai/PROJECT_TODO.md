# PROJECT TODO — TRAVEL CMS

Current tasks and their status. Agents update relevant rows when starting, blocking, or completing tasks.

**Status values:** TODO / IN_PROGRESS / BLOCKED / DONE

**When starting:** Set Status to IN_PROGRESS and set Owner to your role.
**When blocked:** Set Status to BLOCKED and add reason in Notes.
**When done:** Set Status to DONE and add commit hash or PR link in PR column.

---

## Completed Tasks (from COMMS channel)

| ID | Area | Task | Owner | Status | Branch | Commit | Notes |
|----|------|------|-------|--------|--------|--------|-------|
| T0001 | AI | Bootstrap COMMS channel | CODE_WRITER | DONE | feat/directory-create | - | Created COMMS_TODO.md, COMMS_LOG.md, COMMS_STATE.json |
| T0002 | UI | Make Orders button green | CODE_WRITER | DONE | feat/directory-create | 47a2f9d | Applied green color to Orders button in Sidebar |
| T0003 | UI | Make Directory button blue | CODE_WRITER | BLOCKED | - | - | Sidebar edits require explicit user authorization |
| T0004 | UI | Revert Orders and Directory text to black | CODE_WRITER | DONE | feat/directory-create | 319abe9 | Removed green/blue colors, back to default black |
| T0005 | UI | Make time text bold in TopBar | CODE_WRITER | DONE | cursor/TRA-5-topbar-time-style-7d25 | a8dbcb8 | Added font-bold to time display |
| T0006 | UI | Make TopBar time bold + italic | CODE_WRITER | DONE | cursor/TRA-5-topbar-time-style-7d25 | a8dbcb8 | Added bold + italic, also added time (HH:MM) display |

---

## Active Tasks

| ID | Area | Task | Owner | Status | Branch | PR | Notes |
|----|------|------|-------|--------|--------|----|-------|
| T0007 | Directory | Diagnose Directory create not working | DB_AGENT | READY | cursor/TRA-5-topbar-time-style-7d25 | - | See task details below |
| 1 | Orders | DB-backed list + create flow | - | TODO | - | - | Replace mockOrders with real DB queries |
| 2 | Directory | Phase 6: Detail/Card page | - | TODO | feat/directory-create | - | See .ai/tasks/directory-v1-implementation-steps.md Step 6 |
| 3 | Supabase | Schema mapping + RLS sanity | - | TODO | - | - | Verify column mappings and RLS policies |

---

## T0007 — Diagnose Directory create not working

**Status:** READY  
**Owner:** DB_AGENT (DB / Supabase Specialist)  
**Branch:** cursor/TRA-5-topbar-time-style-7d25

### Task
Diagnose why new Directory records are not being created

### Inputs
- `app/api/directory/create/route.ts` — API endpoint
- `app/directory/new/page.tsx` — create page
- Supabase tables: `party`, `party_person`, `party_company`, `client_party`, `partner_party`, `subagents`

### Constraints
- Do NOT write business logic
- Diagnosis and field mapping only
- Check RLS policies

### Expected Output in PROJECT_LOG.md
1. What data is received by API (request body structure)
2. What data reaches DB (or errors)
3. RLS policy status for each table
4. Field mapping: code → DB columns
5. Root cause hypothesis

### Next Step
- Set Status to IN_PROGRESS when starting
- Write report in `.ai/PROJECT_LOG.md`
- Set Status to DONE
- ARCHITECT will review and create task for CODE_WRITER

### Execution Chain
```
DB_AGENT → CODE_WRITER → QA_AGENT
```

---

## Directory v1 Implementation Progress

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | DB Schema migrations | DONE | migrations/directory_schema_migration.sql |
| 2 | TypeScript types | DONE | lib/types/directory.ts |
| 3 | UI design proposals | DONE | .ai/tasks/directory-v1-ui-design-proposals.md |
| 4 | API endpoints (7 total) | DONE | app/api/directory/* |
| 5 | Directory list page | DONE | app/directory/page.tsx |
| 6 | Directory detail/card page | TODO | Next step |
| 7 | Duplicate detection UI | TODO | - |
| 8 | Statistics dashboard | TODO | - |
| 9 | Security review | TODO | - |
| 10 | QA testing | TODO | - |

---

## Task Files Reference

| File | Description |
|------|-------------|
| .ai/tasks/directory-v1-full-architecture.md | Complete specification |
| .ai/tasks/directory-v1-implementation-steps.md | Step-by-step commands |
| .ai/tasks/directory-v1-ui-design-proposals.md | UI design proposals |
| .ai/tasks/directory-fix-save-issues.md | API save issues (DONE) |
| .ai/tasks/directory-fix-partner-role.md | partner_role fix (DONE) |
| .ai/tasks/directory-add-subagents-columns.md | subagents columns (DONE) |
