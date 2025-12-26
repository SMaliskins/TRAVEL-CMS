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

### T0003 — Make Directory button blue
Status: BLOCKED
Owner: Code Writer
Scope:
- Change Directory button color to blue in Sidebar component
- Apply blue color in all sidebar modes (expanded, collapsed, hover, mobile)
- Ensure blue color works for both active and inactive states
- Directory has children items - ensure parent and children use blue color consistently
Acceptance:
- Directory button displays blue color in all sidebar modes
- Blue color is visible and consistent (use Tailwind blue classes, e.g., bg-blue-500, text-blue-600, etc.)
- Directory children items (if any) also use blue color
- No other navigation items are affected (Orders stays green)
- Visual change is clear and obvious
Expected files:
- components/Sidebar.tsx
Commit: style(ui): make Directory button blue
Blocked: Sidebar edits require explicit user authorization.

### T0004 — Revert Orders and Directory text to black
Status: DONE
Owner: Code Writer
Scope:
- Remove green color styling from Orders button (revert to default black/gray)
- Ensure Directory button text is black/gray (default color)
- Remove any special color logic for Orders (isOrders conditional)
- Apply default text colors: text-gray-900 for active, text-gray-700 for inactive
- Ensure changes work in all sidebar modes (expanded, collapsed, hover, mobile)
Acceptance:
- Orders button text is black/gray (not green) in all sidebar modes
- Directory button text is black/gray (not blue) in all sidebar modes
- Both buttons use standard colors: text-gray-900 (active), text-gray-700 (inactive)
- No special color conditionals remain for Orders or Directory
- Visual change is clear - both buttons return to default black text
Expected files:
- components/Sidebar.tsx
Commit: style(ui): revert Orders and Directory text to black

### T0005 — Make time text bold in TopBar
Status: BLOCKED
Owner: Code Writer
Scope:
- Add font-bold class to the time/date text in TopBar component
- Time is displayed in the right side of TopBar (Date + City section)
- Apply bold styling to the date text (weekday, day, month format)
- Ensure bold styling works in all states (when time is loaded and when loading)
Acceptance:
- Time/date text in TopBar is displayed in bold (font-bold class applied)
- Bold styling is visible and consistent
- No other TopBar elements are affected
- Visual change is clear - time text appears bold
Expected files:
- components/TopBar.tsx
Commit: style(ui): make time text bold in TopBar
Blocked: Task requires reading components/TopBar.tsx, but Code Writer is restricted to reading only COMMS files.
---

