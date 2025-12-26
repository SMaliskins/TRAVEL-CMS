# COMMS Watchers

Two separate watchers monitor `.ai/COMMS_TODO.md` for READY tasks assigned to different roles.

## Watchers

### Code Writer Watcher
- **Script**: `scripts/watch-comms-code-writer.js`
- **Filters**: Tasks with `Status=READY` AND `Owner` contains "Code Writer"
- **Run**: `npm run watch:comms:cw`

### Runner Watcher
- **Script**: `scripts/watch-comms-runner.js`
- **Filters**: Tasks with `Status=READY` AND `Owner` matches:
  - "Runner"
  - "Architect"
  - "Architect/Orchestrator"
- **Run**: `npm run watch:comms:runner`

## How to Run

Run both watchers in separate terminals:

**Terminal 1 (Code Writer):**
```bash
npm run watch:comms:cw
```

**Terminal 2 (Runner):**
```bash
npm run watch:comms:runner
```

## Behavior

- **Polling interval**: 20 seconds
- **De-duplication**: Only prints when the set of READY task IDs changes
- **Silent mode**: No output when no matching tasks found
- **Output format**: Shows task ID, title, owner, and scope items

## Quick Test

1. Open `.ai/COMMS_TODO.md`
2. Find or create a task card with:
   - `Status: READY`
   - `Owner: Code Writer` (or `Owner: Runner`)
3. Save the file
4. Within 20 seconds, the corresponding watcher should print the task details once
5. If you don't change the task status, the watcher will not print again (de-duplication)

## Notes

- Watchers are **notification-only**; they do not modify any files
- Watchers read `.ai/COMMS_TODO.md` from the repository root
- Press `Ctrl+C` to stop a watcher
