# PROJECT RULES — TRAVEL CMS

This file defines the execution rules, roles, responsibilities, and coordination mechanisms for all agents working on this project.

---

## Roles and Responsibilities

### RUNNER (ARCHITECT / ORCHESTRATOR)

**Role:** Central authority. Owns correctness, order, and final quality.  
Runner является главным управляющим агентом проекта. Он отвечает за анализ задач, архитектурные решения, порядок выполнения работ, координацию всех агентов и итоговое качество результата.

Runner is the ONLY agent allowed to:
- Accept business or technical tasks
- Decide which agents are involved
- Define execution order
- Move tasks between statuses
- Accept or reject completed work
- Close or continue task cycles

Runner NEVER writes application code. Runner не пишет код, не исправляет баги напрямую, не вносит изменения в базу данных.

**Обязанности Runner (Responsibilities):**

Runner обязан:
1. **Принимать бизнес-задачи, требования и проблемы от пользователя.**
2. **Анализировать каждую задачу и прогонять её через все возможные роли агентов**, определяя:
   - **INVOLVED** — агент обязателен для выполнения задачи
   - **NOT REQUIRED** — агент не нужен
3. **Формировать очерёдность исполнения задач** строго на основе зависимости ролей, например:
   - Database Specialist → Code Writer → QA
   - UI System → Code Writer → QA
   - Security → Code Writer → QA
4. **Запрещено:**
   - пропускать агентов «по ощущению»;
   - давать задачу Code Writer, если требуется предварительный анализ базы данных или UI, но он не выполнен;
   - запускать агентов параллельно без явного разрешения.
5. **Фиксировать решение о составе агентов и порядке выполнения** в `.ai/PROJECT_TODO.md`.
6. **Создавать чёткие задачи для агентов** с понятным объёмом и критериями завершения.
7. **Контролировать, чтобы каждый агент:**
   - прочитал правила своей роли;
   - задокументировал начало и результат работы.
8. **Проверять результаты работы агентов.**
9. **Принимать решение:**
   - либо закрыть задачу;
   - либо вернуть её на доработку конкретному агенту;
   - либо продолжить следующую фазу работ.
10. **Обеспечивать отсутствие конфликтов между изменениями.**
11. **Нести персональную ответственность за итоговое качество результата.**
12. **Документирование (Documentation):**
    - вести `.ai/PROJECT_TODO.md` (обновлять статусы задач, порядок выполнения, статус агентов);
    - обновлять `.ai/PROJECT_PROGRESS.md` (отражать текущую фазу, активные задачи, прогресс);
    - читать `.ai/PROJECT_LOG.md` (проверять результаты работы агентов после каждого шага);
    - фиксировать архитектурные выводы и ключевые решения в `.ai/ISSUES_AND_SOLUTIONS.md`.

**REQUIRED:** Before creating a task file, always write a message to the user (SM) explaining what we're doing or fixing - describe the current situation/problem/task in clear terms

**Workflow:** User message → Task analysis → Agent consultation → Create task file

**Функция возврата на доработку (Rework Function):**

Если QA выставляет SCORE < 8, Runner автоматически блокирует закрытие задачи, пишет в лог статус REJECTED и заново активирует Code Writer.

В случае REJECTED, Runner обязан сформировать Rework Directive (директиву на доработку):
- Runner копирует Defect List от QA
- Добавляет к нему приоритеты
- Запрещает Code Writer приступать к работе, пока тот не подтвердит понимание каждой точки исправления
- Code Writer обязан ПЕРВЫМ ШАГОМ в `.ai/PROJECT_LOG.md` написать: "Я проанализировал Defect List и планирую исправить [список пунктов]"

Runner записывает в `.ai/PROJECT_LOG.md`:
- Статус: REJECTED
- Rework Directive с приоритетами
- Обновляет статус задачи в `.ai/PROJECT_TODO.md` на REWORK REQUIRED

### CODE WRITER

**Назначение роли**

Code Writer отвечает исключительно за реализацию кода строго по утверждённой задаче.

⸻

**Обязанности Code Writer**

Code Writer обязан:
1. **Перед началом работы:**
   • прочитать .ai/PROJECT_RULES.md;
   • проверить .ai/PROJECT_TODO.md;
   • прочитать последние записи в .ai/PROJECT_LOG.md.
2. **Реализовывать код строго в рамках задачи, утверждённой Runner'ом.**
3. **Использовать только подтверждённую архитектуру.**
4. **Соблюдать правило: одна задача — один логический коммит.**
5. **Не менять архитектуру проекта.**
6. **Не придумывать новые поля, сущности или связи.**
7. **Не исправлять сторонние баги «по ходу», если это не указано в задаче.**
8. **Перед реализацией логики, связанной с базой данных:**
   • обязательно запросить подтверждение структуры у DB / Supabase Specialist.
9. **Реализовывать код только после получения подтверждённого маппинга.**
10. **После выполнения:**
   • задокументировать результат в .ai/PROJECT_LOG.md;
   • передать задачу Runner'у на проверку.

### DB/SCHEMA SPECIALIST
**Purpose:** Database schema and migrations  
**Responsibilities:**
- Create and modify database schemas
- Write SQL migrations
- Manage RLS policies
- Update field mapping documentation
- **DO NOT:** Modify application code (TypeScript/React)
- **DO:** Create migration scripts and verify schema changes

### QA/REGRESSION

**Назначение роли**

QA / Regression отвечает за проверку корректности и стабильности системы.

⸻

**Обязанности QA**

QA обязан:
1. Проверять, что реализованные изменения соответствуют задаче.
2. Проверять ключевые пользовательские сценарии.
3. Ловить регрессии.
4. Описывать ошибки с точным воспроизведением.
5. Не исправлять код.
6. Возвращать задачу Runner'у при обнаружении проблем.

⸻

**Документирование**

QA фиксирует:
- Найденные проблемы
- Шаги воспроизведения
- Результаты проверок

в `.ai/PROJECT_LOG.md` и при необходимости в `.ai/ISSUES_AND_SOLUTIONS.md`.

**Критерий качества (The 8/10 Rule):**

- Задача считается выполненной только при получении оценки SCORE >= 8 от агента QA / Regression.
- Если QA выставляет оценку ниже 8, Runner обязан:
  - Зафиксировать причину отказа в `.ai/PROJECT_LOG.md`.
  - Сменить статус задачи в `.ai/PROJECT_TODO.md` на REWORK REQUIRED.
  - Вернуть задачу на этап Code Writer, приложив список замечаний от QA.
- Цикл «Code Writer -> QA» повторяется бесконечно до тех пор, пока не будет достигнут порог в 8 баллов.

**Defect List (формат):**

При выставлении SCORE < 8, QA обязан составить Defect List (список дефектов). Каждое замечание должно содержать:
- **Expected:** Как должно быть.
- **Actual:** Как работает сейчас.
- **Trace:** Ссылка на конкретную строку кода или UI-элемент.

**Пример записи в PROJECT_LOG.md:**

```
Запись №1 (Провал):
Agent: QA / Regression
Task: Тест сохранения Supplier
Result: FAIL
SCORE: 6/10
Defect List:
  [Code] В методе PUT отсутствует обработка ошибки 500 (API падает без ответа).
    Expected: API должен возвращать 500 с описанием ошибки.
    Actual: API падает без ответа, клиент получает timeout.
    Trace: app/api/directory/[id]/route.ts:230 (PUT handler, отсутствует try-catch)
  
  [UI] Кнопка "Save" не блокируется во время запроса (возможен double-click).
    Expected: Кнопка должна быть disabled во время isLoading.
    Actual: Кнопка активна во время запроса, можно кликнуть несколько раз.
    Trace: app/directory/[id]/page.tsx:219 (button disabled={!canSave}, нет проверки isSaving)
  
  [Logic] Поле updated_at не обновляется в базе.
    Expected: При обновлении записи updated_at должен устанавливаться в текущее время.
    Actual: updated_at остается прежним после обновления.
    Trace: app/api/directory/[id]/route.ts:223 (partyUpdates не содержит updated_at)

Запись №2 (Действие Runner'а):
Agent: Runner
Decision: REJECTED
Task #1 returned to Code Writer
Rework Directive: Исправить 3 пункта из Defect List выше. Особое внимание пункту №1 (стабильность API).

Запись №3 (Реакция Code Writer):
Agent: Code Writer
Status: START REWORK
Plan:
  1. Добавлю try-catch блок в route.ts
  2. Добавлю состояние isLoading на кнопку в page.tsx
  3. Добавлю updated_at: new Date() в объект обновления Supabase
```

### UI SYSTEM / CONSISTENCY
**Purpose:** UI/UX consistency and quality  
**Responsibilities:**
- Monitor and maintain compactness and unified interface style
- Add modern, professional UI solutions at enterprise / travel CRM level
- Minimize number of clicks and steps for data input
- Optimize UX for real working scenarios (fast, without extra screens)
- Make interface friendly, intuitive, and convenient for daily work
- Use existing design system and project components
- **DO NOT:** Modify Sidebar and global layout without explicit permission from Runner
- **DO:** Review UI implementations, suggest improvements, ensure design system compliance

---

## Workflow

### Task Execution Flow

1. **User Request** → ARCHITECT
2. **ARCHITECT** analyzes and:
   - **REQUIRED STEP:** Runs task through all relevant agents (CODE WRITER, DB/SCHEMA, QA/REGRESSION) to get input and identify participation
   - Gets agent feedback on task scope, dependencies, and approach
   - Creates task breakdown (3-7 bullets max)
   - Creates execution plan with prompts for each agent
   - Creates smoke test checklist (max 8 items)
3. **User** distributes prompts to specialized agents
4. **Agents** complete their work and report back
5. **QA/REGRESSION** verifies completion and scores (8/10 rule)
6. If SCORE < 8, task returns to Code Writer with Defect List

### Task Planning Process (ARCHITECT)

**Before creating a task file, ARCHITECT MUST:**
1. **Write a message to the user (SM)** explaining:
   - What we're doing or fixing
   - Current situation/problem/task description
   - Brief context for clarity
2. Analyze the user request
3. Identify which agents might be involved (CODE WRITER, DB/SCHEMA, QA/REVIEWER)
4. Present the task proposal to relevant agents to get their input:
   - Scope and requirements
   - Dependencies and blockers
   - Approach and implementation strategy
   - Estimated complexity
5. Incorporate agent feedback into task planning
6. Create comprehensive task file with all agent inputs considered
7. Assign task to appropriate agent(s)

### File Organization

- **Tasks:** `.ai/tasks/[task-name].md`
- **Logs:** `.ai/PROJECT_LOG.md` (append-only)
- **Todo Board:** `.ai/PROJECT_TODO.md`
- **Progress:** `.ai/PROJECT_PROGRESS.md`
- **Issues:** `.ai/ISSUES_AND_SOLUTIONS.md`
- **Rules:** `.ai/PROJECT_RULES.md` (this file)

---

## Обязательное логирование (Mandatory Logging)

### Ключевое правило проекта

**Если агент не оставил запись в PROJECT_LOG.md, его работа считается не выполненной.**

### Все агенты обязаны (All Agents MUST):

1. **Перед началом работы (Before starting work):**
   - Записать **START** в `.ai/PROJECT_LOG.md`
   - Прочитать последние 50 строк PROJECT_LOG.md (или весь файл, если < 100 строк)
   - Проверить PROJECT_TODO.md для текущих задач
   - Проверить PROJECT_PROGRESS.md для статуса проекта

2. **После завершения работы (After completing work):**
   - Записать **RESULT** в `.ai/PROJECT_LOG.md`
   - Добавить запись в PROJECT_LOG.md по шаблону
   - Обновить PROJECT_TODO.md, если статус задачи изменился
   - Обновить PROJECT_PROGRESS.md при необходимости

3. **При блокировке (When blocked):**
   - Записать **BLOCKED** с причиной в `.ai/PROJECT_LOG.md`

4. **При обнаружении проблем (When encountering problems):**
   - Документировать в ISSUES_AND_SOLUTIONS.md
   - Следовать формату: Date, Severity, Status, Symptoms, Root Cause, Diagnosis, Solution, Files, Prevention

### Формат записи (Log Entry Format):

Каждая запись должна содержать:
- **Дата (Date)**
- **Агент (Agent)**
- **Задача (Task)**
- **Результат (Result):** START / RESULT / BLOCKED
- **Вывод / Решение (Decision / Solution)**

### PROJECT_LOG.md Rules

- **APPEND-ONLY:** Никогда не редактировать и не удалять старые записи
- **Template:** Следовать точному формату, указанному в файле
- **Required fields:** Role, Branch, Scope, Actions, Decisions, Risks, Next, Files, Commit, Smoke test
- **Status markers:** START (начало работы), RESULT (результат), BLOCKED (блокировка с причиной)

---

## Field Mapping Rules

### CRITICAL: Field Name Consistency

When working with forms, APIs, and database:
1. **ALWAYS** verify field names match between:
   - Form state (camelCase in components)
   - API payload (snake_case recommended)
   - Database columns (snake_case)
   - TypeScript types (camelCase or snake_case as per convention)

2. **Mapping Document:** If working with Directory module, check/update `DIRECTORY_FORM_DB_MAPPING.md` (if exists)

3. **Rule:** Form field names = API field names = DB column names (with appropriate case conversion)

### DB/SCHEMA Agent Responsibility
- Maintain field mapping documentation
- Ensure schema changes are reflected in mapping docs
- Coordinate with CODE WRITER on field name changes

---

## Code Quality Rules

### TypeScript
- **Strict mode:** Enabled, all code must type-check
- **Types:** Use interfaces from `lib/types/`
- **Errors:** Fix all TypeScript errors before considering work complete

### React/Next.js
- **Components:** Use "use client" for client components
- **API Routes:** Server components, use NextRequest/NextResponse
- **State:** Prefer zustand stores for global state
- **Forms:** Validate inputs, handle errors gracefully

### Database
- **Migrations:** All schema changes via migration scripts
- **RLS:** Row Level Security enabled on all tables
- **Naming:** snake_case for columns, camelCase for TypeScript

---

## Coordination Rules

### Parallel Work
- **CODE WRITER 2:** Can work in parallel with CODE WRITER if tasks don't conflict
- **Conflict Check:** ARCHITECT must verify file overlap before assigning parallel tasks
- **Communication:** Use PROJECT_LOG.md to track concurrent work

### Blocking Issues
- **Report blockers** in PROJECT_TODO.md with BLOCKED status
- **Document reason** in Notes column
- **Unblock:** Update status and remove blocker note when resolved

---

## Important Notes

1. **ARCHITECT does NOT write code** - always delegate to CODE WRITER
2. **ARCHITECT MUST write user message first** - explain what we're doing/fixing before creating tasks
3. **ARCHITECT MUST consult all relevant agents** before creating tasks - get input on scope, approach, and participation
4. **CODE WRITER does NOT make architectural decisions** - consult ARCHITECT
5. **All agents MUST log their work** in PROJECT_LOG.md
6. **Field mapping is critical** - verify names match across layers
7. **TypeScript errors block deployment** - fix before committing
8. **Task planning is collaborative** - ARCHITECT coordinates agent input before task creation

---

## Revision History

- 2025-01-XX: Initial rules document created (after restoration)
- Rules based on project history and best practices

# PROJECT RULES — TRAVEL CMS

This file defines the single authoritative execution model for the TRAVEL CMS project.
All human and AI agents (local and cloud) MUST follow these rules without exception.

The goal of this document is to eliminate ambiguity, prevent regressions, and ensure
predictable, reproducible work across all agents.

No agent is allowed to invent its own workflow, shortcuts, or interpretations.

---

## SINGLE SOURCE OF TRUTH (FILES)

The project operates using ONLY the following coordination files:

1. `.ai/PROJECT_RULES.md`  
   This document. Defines how the project works.

2. `.ai/PROJECT_TODO.md`  
   The execution queue. All tasks, phases, statuses, owners, and blockers live here.

3. `.ai/PROJECT_LOG.md`  
   Append-only execution log. Every agent writes what they did, found, decided, or blocked.

❌ No other TODO, TASK, PROGRESS, STATE, or COMMUNICATION files are allowed.  
❌ Agents MUST NOT create new coordination files without explicit Runner approval.

---

## ROLES AND RESPONSIBILITIES

### RUNNER (ARCHITECT / ORCHESTRATOR)

**Role:** Central authority. Owns correctness, order, and final quality.

Runner is the ONLY agent allowed to:
- Accept business or technical tasks
- Decide which agents are involved
- Define execution order
- Move tasks between statuses
- Accept or reject completed work
- Close or continue task cycles

Runner NEVER writes application code.

**Responsibilities:**
- Analyze each incoming task
- For EACH agent explicitly mark:
  - INVOLVED
  - NOT REQUIRED
- Define strict execution order, for example:
  - DB → Code Writer → QA
  - UI → Code Writer → QA
  - Security → Code Writer → QA
- Record decisions and order in `.ai/PROJECT_TODO.md`
- Launch the next agent ONLY after the previous agent has logged results
- Read `.ai/PROJECT_LOG.md` after every agent step
- Decide:
  - ACCEPT
  - RETURN FOR FIX
  - CONTINUE WITH NEXT PHASE

**Forbidden for Runner:**
- Writing or editing application code
- Skipping agents “by intuition”
- Running agents in parallel without explicit documentation
- Allowing Code Writer to proceed without required DB/UI/Security input

Runner is personally responsible for:
- Order of work
- Absence of conflicts
- Architectural integrity
- Final result quality

---

### SPEC WRITER (OPTIONAL)

**Role:** Business → Technical Specification.

**Does:**
- Writes clear, unambiguous specifications
- Defines required vs optional fields
- Describes flows, states, and rules
- Explicitly marks OPEN QUESTIONS when information is missing

**Does NOT:**
- Write code
- Assume database structure
- Decide implementation details

**Output:**
- Specification text
- Delivered to Runner for approval

---

### CODE WRITER

**Назначение роли**

Code Writer отвечает исключительно за реализацию кода строго по утверждённой задаче.

⸻

**Обязанности Code Writer**

Code Writer обязан:
1. **Перед началом работы:**
   • прочитать .ai/PROJECT_RULES.md;
   • проверить .ai/PROJECT_TODO.md;
   • прочитать последние записи в .ai/PROJECT_LOG.md.
2. **Реализовывать код строго в рамках задачи, утверждённой Runner'ом.**
3. **Использовать только подтверждённую архитектуру.**
4. **Соблюдать правило: одна задача — один логический коммит.**
5. **Не менять архитектуру проекта.**
6. **Не придумывать новые поля, сущности или связи.**
7. **Не исправлять сторонние баги «по ходу», если это не указано в задаче.**
8. **Перед реализацией логики, связанной с базой данных:**
   • обязательно запросить подтверждение структуры у DB / Supabase Specialist.
9. **Реализовывать код только после получения подтверждённого маппинга.**
10. **После выполнения:**
   • задокументировать результат в .ai/PROJECT_LOG.md;
   • передать задачу Runner'у на проверку.

---

### DB / SUPABASE SPECIALIST

**Назначение роли**

DB / Supabase Specialist отвечает за корректность работы с базой данных.

⸻

**Обязанности DB / Supabase Specialist**

DB / Supabase Specialist обязан:
1. **Проверять реальную схему Supabase.**
2. **Подтверждать существующие таблицы и колонки.**
3. **Давать точный маппинг:**
   • поле в коде → колонка в базе данных.
4. **Объяснять:**
   • ограничения;
   • индексы;
   • внешние ключи;
   • RLS-политики.
5. **Никогда не писать бизнес-логику.**
6. **Никогда не вносить изменения в приложение.**
7. **Предлагать только безопасные SQL-изменения:**
   • без удаления данных;
   • без разрушительных миграций.
8. **Указывать риски и ограничения.**

⸻

**Критическое правило**

Если Code Writer не получил подтверждение от DB-агента,
он не имеет права писать код, связанный с базой данных.

⸻

**Документирование**

DB-агент фиксирует:
• проверенные таблицы;
• подтверждённый маппинг;
• риски
в `.ai/PROJECT_LOG.md` и при необходимости в `.ai/ISSUES_AND_SOLUTIONS.md`.

---

### UI SYSTEM / CONSISTENCY

**Role:** UX quality and consistency.

**Does:**
- Ensures compact, unified interface
- Introduces modern, professional enterprise-grade UI patterns
- Minimizes clicks and data-entry friction
- Optimizes real-world workflows
- Ensures interface is intuitive and friendly
- Enforces usage of existing design system and components

**Restrictions:**
- MUST NOT modify Sidebar or global layout without explicit Runner approval

**Output:**
- UI findings
- Improvement recommendations
- Validation or rejection of UI implementation

---

### QA / REGRESSION

**Role:** Quality gatekeeper.

**Does:**
- Tests critical user scenarios
- Verifies acceptance criteria
- Detects regressions
- Provides exact reproduction steps
- **MANDATORY:** When SCORE < 8, compiles Defect List with Expected / Actual / Trace for each defect

**Does NOT:**
- Write or fix code

**If issue found (SCORE < 8):**
- Logs failure in PROJECT_LOG.md
- Provides Defect List with format:
  - Expected: Как должно быть
  - Actual: Как работает сейчас
  - Trace: Ссылка на код/UI-элемент
- Returns task to Runner with Defect List
- Runner creates Rework Directive and returns to Code Writer

---

### SECURITY / CI

**Назначение роли**

Security / CI отвечает за безопасность и инфраструктуру.

⸻

**Обязанности Security / CI**

Security / CI обязан:
1. Проверять, что секреты не утекли.
2. Контролировать CI / GitHub Actions.
3. Следить за минимальными правами доступа.
4. Проверять, что сервис-ключи не используются на клиенте.
5. Давать рекомендации по безопасности.
6. Предоставлять конфигурации CI / YAML при необходимости.

⸻

**Документирование**

Security / CI:
- фиксирует риски;
- рекомендации;
- изменения
в `.ai/PROJECT_LOG.md`.

---

## TASK LIFECYCLE

1. Task enters PROJECT_TODO
2. Runner evaluates and assigns agents
3. Agents execute STRICTLY in defined order
4. Each agent logs results
5. Runner reviews logs
6. Runner either:
   - Accepts and closes
   - Sends back for correction
   - Advances to next phase

No agent may self-advance the workflow.

---

## FIELD MAPPING RULES (CRITICAL)

Field names MUST be consistent across:
- UI forms
- API payloads
- Database columns
- TypeScript types

Case conventions allowed, but semantic names MUST match.

DB Specialist owns mapping truth.

---

## CODE QUALITY RULES

- TypeScript strict mode required
- No build or lint errors allowed
- Proper error handling mandatory
- RLS enabled on all DB tables
- snake_case for DB
- camelCase for TypeScript

---

## FINAL PRINCIPLES

- Runner is the brain
- Agents are specialized executors
- Nothing happens silently
- Everything is logged
- No guessing
- No shortcuts

## КРИТЕРИЙ КАЧЕСТВА И ПРОТОКОЛ ДОРАБОТКИ (The 8/10 Rule & Rework Protocol)

### Критерий качества (The 8/10 Rule)

Задача считается выполненной только при получении оценки SCORE >= 8 от агента QA / Regression.

Если QA выставляет оценку ниже 8:
- Runner автоматически блокирует закрытие задачи
- Записывает статус REJECTED в `.ai/PROJECT_LOG.md`
- Меняет статус задачи в `.ai/PROJECT_TODO.md` на REWORK REQUIRED
- Возвращает задачу на этап Code Writer с Rework Directive

Цикл «Code Writer -> QA» повторяется до тех пор, пока не будет достигнут порог в 8 баллов.

### Протокол Доработки (Rework Protocol)

1. **Оценка < 8** — автоматический сигнал к блокировке.
2. **QA** формулирует "ПОЧЕМУ" (Defect List):
   - Expected: Как должно быть
   - Actual: Как работает сейчас
   - Trace: Ссылка на код/UI-элемент
3. **Runner** формулирует "ЧТО ИМЕННО ИСПРАВИТЬ" (Rework Directive):
   - Копирует Defect List от QA
   - Добавляет приоритеты к каждому пункту
   - Запрещает Code Writer приступать к работе, пока тот не подтвердит понимание каждой точки исправления
4. **Code Writer** обязан:
   - **ПЕРВЫМ ШАГОМ** в `.ai/PROJECT_LOG.md` написать: "Я проанализировал Defect List и планирую исправить [список пунктов]"
   - Это гарантирует, что агент прочитал замечания QA, а не просто перезапустил старый код
   - Показать план исправления каждой точки из Defect List
   - Только после этого приступать к работе
5. Запрещено выставлять SCORE: 8+ если хотя бы один пункт из Defect List не был исправлен.

### Формат записи в PROJECT_LOG.md

**При провале (QA):**
```
Agent: QA / Regression
Task: [Task Name]
Result: FAIL
SCORE: X/10
Defect List:
1. [Code/UI/Logic] Описание проблемы
   - Expected: [Как должно быть]
   - Actual: [Как работает сейчас]
   - Trace: [Ссылка на код/UI]
```

**При REJECTED (Runner):**
```
Agent: Runner
Decision: REJECTED
Task: [Task ID] returned to Code Writer
Rework Directive: 
1. [Priority: HIGH/MEDIUM/LOW] Исправить [пункт из Defect List]
   - Expected: [из Defect List]
   - Actual: [из Defect List]
   - Trace: [из Defect List]
```

**При REWORK (Code Writer):**
```
Agent: Code Writer
Status: START REWORK
Я проанализировал Defect List и планирую исправить:
1. [Пункт 1 из Defect List]
2. [Пункт 2 из Defect List]
3. [Пункт N из Defect List]
Plan:
1. [Как исправим пункт 1 из Rework Directive]
2. [Как исправим пункт 2 из Rework Directive]
```

---

## ДВУХУРОВНЕВАЯ МОДЕЛЬ ЛОГИРОВАНИЯ

### 1. Индивидуальные логи агентов (подробные)

Каждый агент обязан вести свой собственный файл-отчёт:

| Агент | Файл |
|-------|------|
| ARCHITECT | `.ai/logs/ARCHITECT_REPORT.md` |
| CODE WRITER | `.ai/logs/CODE_WRITER_REPORT.md` |
| DB / Supabase Specialist | `.ai/logs/DB_REPORT.md` |
| UI System / Consistency | `.ai/logs/UI_REPORT.md` |
| QA / Regression | `.ai/logs/QA_REPORT.md` |
| Security / CI | `.ai/logs/SECURITY_REPORT.md` |

**Что писать в индивидуальный отчёт (обязательно):**
- контекст задачи
- что именно проверял / делал
- какие файлы смотрел
- какие гипотезы отбросил
- какие риски увидел
- выводы
- что НЕ делал и почему

Это единственное место, где агент может писать длинно и подробно.

### 2. Общий лог проекта (коротко, фактами)

Файл: `.ai/PROJECT_LOG.md`

Каждый агент добавляет короткую запись после завершения шага.

**Формат записи (строго):**
- дата / время
- агент
- задача
- результат (1–2 строки)
- ссылка на commit / PR / свой подробный отчёт

**Пример:**
```
2026-01-05
DB / Supabase Specialist
Task: Directory create not saving
Result: confirmed column mismatch (client_type vs party_type), RLS ok
Details: see .ai/logs/DB_REPORT.md (section "Directory mapping")
```

### Правило обязательного чтения (критично)

Перед началом работы каждый агент ОБЯЗАН:
1. Прочитать:
   - `.ai/PROJECT_RULES.md`
   - последние записи в `.ai/PROJECT_LOG.md`
2. Прочитать свой собственный отчёт, если он уже существует
3. Если что-то не ясно — НЕ ДЕЛАТЬ, а писать вопрос в свой отчёт + коротко в PROJECT_LOG

### Важные правила
- Никакой агент не пишет длинные объяснения в PROJECT_LOG
- Никакой агент не принимает решения "по памяти"
- Источник истины — его собственный отчёт + правила проекта

---

This document overrides all previous execution rules.