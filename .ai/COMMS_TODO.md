---
# COMMS_TODO (isolated channel)
This file is the ONLY source of truth for Runner ↔ Code Writer tasks.
Do NOT use/modify other TODO files in .ai.

## How to use
- Runner: writes tasks as "TASK CARDS" below.
- Code Writer: **READ THIS FILE DIRECTLY** (don't rely only on watch script). Takes the TOP card with Status=READY, sets Status=IN_PROGRESS, works, then sets Status=DONE and writes notes to COMMS_LOG.md.
- One task = one commit. No refactors unless explicitly stated in card.
- **IMPORTANT**: If watch script shows a task but you don't see it, read this file directly - tasks are listed below.

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

### T0002 — Make Orders button green
Status: DONE
Owner: Code Writer
Scope:
- Change Orders button color to green in Sidebar component
- Apply green color in all sidebar modes (expanded, collapsed, hover, mobile)
- Ensure green color works for both active and inactive states
Acceptance:
- Orders button displays green color in all sidebar modes
- Green color is visible and consistent (use Tailwind green classes, e.g., bg-green-500, text-green-600, etc.)
- No other navigation items are affected
- Visual change is clear and obvious
Expected files:
- components/Sidebar.tsx
Commit: style(ui): make Orders button green
---

