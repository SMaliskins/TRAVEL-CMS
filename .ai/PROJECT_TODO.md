# PROJECT TODO — TRAVEL CMS

Current tasks and their status. Agents update relevant rows when starting, blocking, or completing tasks.

**Status values:** TODO / IN_PROGRESS / BLOCKED / DONE

**When starting:** Set Status to IN_PROGRESS and set Owner to your role.
**When blocked:** Set Status to BLOCKED and add reason in Notes.
**When done:** Set Status to DONE and add commit hash or PR link in PR column.

---

| ID | Area | Task | Owner | Status | Branch | PR | Notes |
|----|------|------|-------|--------|--------|----|----| 
| 1 | Directory | Fix /directory/new page - implement API endpoint | CODE WRITER | DONE | - | - | API endpoint implemented. Issue: created records don't appear in list |
| 2 | Directory | Implement directory list loading on /directory page | CODE WRITER | TODO | - | - | QA identified issue. Tasks: .ai/tasks/directory-list-not-loading-data.md (QA, detailed) or .ai/tasks/code-writer-directory-list-loading.md (ARCHITECT, store-based) |
| 3 | Directory | Fix edit navigation, remove Status/View, instant search | CODE WRITER | TODO | - | - | 3 issues: edit page TODO, remove Status/View columns, remove search debounce. Prompt: .ai/tasks/code-writer-directory-ui-fixes.md |
| 4 | Directory | Fix duplicate search, record not found, missing Save buttons | CODE WRITER | TODO | - | - | 3 issues: remove duplicate search (only TopBar), fix record loading, restore Save buttons. Prompt: .ai/tasks/code-writer-directory-issues-fix.md |
| 5 | Directory | Fix inconsistent field labels (Type vs Client type, Person/Company vs Physical person/Legal entity) | CODE WRITER | TODO | - | - | Labels should be consistent. Prompt: .ai/tasks/code-writer-directory-form-label-consistency.md |
| 6 | Directory | Fix Company details mapping and investigate records not opening | CODE WRITER | BLOCKED | - | - | Records 4642eea4-38ed-464d-866c-3d2bea38235e and 5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6 don't open. BLOCKED: Waiting for DB/SCHEMA to verify DIRECTORY_FORM_DB_MAPPING.md. Prompt: .ai/tasks/code-writer-directory-company-mapping-fix.md |
| 7 | Directory | Verify database schema and update DIRECTORY_FORM_DB_MAPPING.md | DB/SCHEMA | DONE | - | - | Schema verified. Report: .ai/DB_SCHEMA_VERIFICATION_REPORT.md. DIRECTORY_FORM_DB_MAPPING.md updated |
| 8 | Directory | Fix Supplier role mapping - "Record not found" when selecting Supplier | CODE WRITER | TODO | - | - | Missing business_category mapping in CREATE endpoint. Prompt: .ai/tasks/code-writer-fix-supplier-mapping.md |
| 9 | Directory | CRITICAL: Fix "Record not found" for records with supplier+subagent roles | CODE WRITER | DONE | - | - | FIXED: Spread operator в LIST endpoint исправлен (строки 235-247 app/api/directory/route.ts) - исключается id из supplier/subagent. Также добавлена резолюция ID в PUT endpoint (строки 277-314) |
| 10 | Directory | Check company_id for records that create but don't open (from server logs) | DB/SCHEMA | TODO | - | - | Records b0eb268e... and 51fc094f... create successfully but GET returns 0 rows. Check if records exist, what company_id they have, if it matches user's company_id. Prompt: .ai/tasks/db-schema-check-recent-records-company-id.md |
| 11 | Directory | HIGH: Fix PUT endpoint "Party not found or update failed" | CODE WRITER | DONE | - | - | FIXED: Добавлена резолюция ID из partner_party/subagents в party_id в PUT endpoint (строки 277-314 app/api/directory/[id]/route.ts) |
| 12 | Directory | CRITICAL: Fix clientType initialization - Type switching when adding Client role | CODE WRITER | TODO | - | - | При добавлении Client к записи с Type=Company, Type переключается на Person. Проблема: clientType инициализируется как "person", useEffect вызывает setBaseType(clientType). Fix: инициализировать clientType из record.type, в useEffect устанавливать clientType = baseType. Task: .ai/tasks/code-writer-fix-clienttype-initialization.md |
| 13 | Directory | Fix Directory search - include company_name from party_company | CODE WRITER | TODO | - | - | Поиск "tez" не находит "TEZ TOUR". Проблема: поиск только по party.display_name/email/phone, не включает party_company.company_name. Task: .ai/tasks/code-writer-fix-directory-search-company-name.md |
| 4 | Directory | Verify directory pages functionality | - | TODO | - | - | Test /directory, /directory/new, /directory/[id] pages after fixes |
| 5 | System | Establish logging structure | ARCHITECT | DONE | - | - | Logging files restored |
