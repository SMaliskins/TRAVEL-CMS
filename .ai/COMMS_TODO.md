---
# COMMS_TODO (isolated channel)
This file is the ONLY source of truth for Runner ↔ Code Writer tasks.
Do NOT use/modify other TODO files in .ai.

## How to use
- Runner: writes tasks as "TASK CARDS" below.
- Code Writer: takes the TOP card with Status=READY, sets Status=IN_PROGRESS, works, then sets Status=DONE and writes notes to COMMS_LOG.md.
- One task = one commit. No refactors unless explicitly stated in card.

## TASK CARDS
### T0001 — Bootstrap COMMS channel
Status: DONE
Owner: Code Writer
Scope:
- Create COMMS_TODO.md, COMMS_LOG.md, COMMS_STATE.json
Acceptance:
- Files exist
- No existing agent files were edited
Commit: feat(ai): add isolated COMMS todo/log/state
---

