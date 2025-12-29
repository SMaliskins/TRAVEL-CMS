# Task Template

This template is used by ARCHITECT/DISPATCHER to structure tasks for agent execution.

---

## Task: [Short Description]

### Context
[Why is this task needed? What problem does it solve? What is the current state?]

### Constraints
- [ ] Do not touch `Sidebar.tsx` or `hooks/useSidebar.ts` (unless explicitly authorized)
- [ ] Do not work on `main` branch
- [ ] [Any other specific constraints]

### Acceptance Criteria
- [ ] [Criterion 1 - specific and testable]
- [ ] [Criterion 2 - specific and testable]
- [ ] [Criterion 3 - specific and testable]

### Smoke Test Steps
1. [Step 1 - how to verify the change works]
2. [Step 2 - how to verify no regressions]
3. [Step 3 - how to verify edge cases]

---

## EXECUTION PACK

### [Agent Type 1] Prompt
```
[Copy-ready prompt for agent. Single block, complete instructions.]
```

### [Agent Type 2] Prompt
```
[Copy-ready prompt for agent. Single block, complete instructions.]
```

### [Agent Type 3] Prompt
```
[Copy-ready prompt for agent. Single block, complete instructions.]
```

---

## Files Expected to Change
- `path/to/file1.ts` - [What will change]
- `path/to/file2.tsx` - [What will change]

## Suggested Commit Message
```
[feat/fix/refactor]: [short description]
```

## Rollback Instructions
```bash
git checkout path/to/file1.ts path/to/file2.tsx
# OR if committed:
git revert HEAD
```

