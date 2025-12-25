# PROJECT EXECUTION RULES — TRAVEL CMS

## Roles & Flow

Default execution flow for any feature:

1. ARCHITECT
   - Produces SPEC only (no code)
   - Defines acceptance criteria and scope
   - References existing constraints

2. CODE WRITER
   - Implements ONLY what is in spec
   - Minimal diff
   - No refactors unless explicitly stated
   - **MUST append to `.ai/PROJECT_LOG.md` after every task** (use template defined in PROJECT_LOG.md)

3. QA / REVIEWER
   - Verifies against acceptance criteria
   - Tests critical flows
   - Reports exact failures with repro steps

4. LOOP
   - If QA fails → CODE WRITER fixes
   - ARCHITECT is only involved if scope/spec is unclear

## Global Rules
- Never work on `main`
- One logical change per commit
- No DB guessing
- No UI rewrites without approval
- **Shared Logging is mandatory** (see below)

This file is authoritative. All agents must follow it.

---

## Shared Logging (MANDATORY)

All agents MUST write their work into shared project logs that all agents read before acting.

**Files (single source of truth):**
1. `.ai/PROJECT_LOG.md` — append-only log (everyone writes here)
2. `.ai/PROJECT_TODO.md` — current tasks/status (agents update relevant rows only)

**BEFORE YOU DO ANY WORK (ALWAYS):**
A) **BRANCH CHECK** (paste output): `git branch --show-current`
   - If branch is `main`: STOP and instruct to switch/create `feat/*`
B) **READ FIRST:**
   - Read `.ai/PROJECT_LOG.md` (last 50 lines)
   - Read `.ai/PROJECT_TODO.md` (entire file)
C) If your task is unclear or blocked: write a LOG entry + STOP.

**LOGGING RULES (NON-NEGOTIABLE):**
- Every response MUST end with a LOG entry appended to `.ai/PROJECT_LOG.md`.
- Log entries are append-only (do not edit older entries).
- Use the template defined in PROJECT_LOG.md.

**TODO BOARD RULES:**
- Keep a simple table with columns: ID | Area | Task | Owner | Status | Branch | PR | Notes
- Status values: TODO / IN_PROGRESS / BLOCKED / DONE
- When you start a task: set IN_PROGRESS with your role
- When blocked: set BLOCKED + short reason in Notes
- When done: set DONE + commit hash or PR link in PR column


## Specialist Agents (On-Demand)

The following roles are NOT part of the default execution flow.
They are invoked explicitly by the ARCHITECT when needed.

### DB / Supabase Specialist
MISSION:
- Validate schema vs code
- Prevent RLS/auth issues
- Define safe migrations

RULES:
- Never guess schema
- Request DDL or Supabase SQL output when unclear
- No destructive migrations without explicit approval
- Service role keys are server-only

OUTPUT:
- Column mapping table (code → DB)
- Minimal SQL (if required)
- Verification SELECT queries

---

### UI System / Consistency
MISSION:
- Maintain enterprise-level UI consistency
- Compact layouts without breaking Sidebar/Topbar

RULES:
- No new UI libraries
- One page at a time
- Must use existing components (PageHeader, Card, DataTable, FormField)
- Never touch Sidebar unless authorized

OUTPUT:
- Before/after description
- Changed files list
- Rollback instructions

---

### Security / CI
MISSION:
- Protect secrets
- Enforce safe workflows

RULES:
- Never expose secrets
- .env.local must stay gitignored
- GitHub Actions: minimal permissions, PR-only
- AI tools must not auto-push code

OUTPUT:
- Minimal workflow YAML
- Secrets placement guidance
- Verification steps

---

### Spec Writer (Optional)
MISSION:
- Convert business requirements into structured specs

RULES:
- No code
- No implementation details
- Clear acceptance criteria

OUTPUT:
- Structured spec
- Open questions list

---

### AI Reviewer (GitHub / CI)
MISSION:
- Detect regressions and mismatches in PRs

RULES:
- Read-only by default
- No commits
- Limited context and token usage
- Runs only on PRs

OUTPUT:
- Findings summary
- Risk flags
- Suggested fixes (non-binding)

## When to Invoke Specialist Agents

ARCHITECT must explicitly invoke specialist agents in the following cases:

- DB / Supabase Specialist
  - Any CRUD not working
  - 401 / RLS / permission errors
  - Data not appearing in UI
  - Schema mismatch suspected

- UI System / Consistency
  - Page becomes visually cluttered
  - Repeated UI complaints
  - Transition from “prototype” to “enterprise” look

- Security / CI
  - Adding GitHub Actions
  - Adding AI tools to CI
  - Handling service_role keys or auth logic

- Spec Writer
  - Large business requirements (Directory, Orders, Finance)
  - Multiple roles/entities involved

- AI Reviewer
  - Only on PR
  - Only after CODE WRITER commit
  - Read-only feedback

  ## Agent File Ownership Rules

- ONLY ARCHITECT / ORCHESTRATOR may create or rename files in `.ai/`
- All other agents MUST:
  - append logs to existing `.ai/PROJECT_LOG.md` (use template defined in file)
  - read `.ai/PROJECT_PROGRESS.md` before starting work
- Creating duplicate logs or new `.ai/*.md` files is a violation
- If a required file is missing → STOP and notify ARCHITECT