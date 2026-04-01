# PROMPT FOR CODE WRITER AGENT

**Task:** Fix inconsistent field labels in DirectoryForm - "Type" vs "Client type", "Person/Company" vs "Physical person/Legal entity"

---

## Problem

DirectoryForm shows different labels for the same field depending on context:

1. **When Client role is selected:** Shows "Client type" with options "Physical person" and "Legal entity"
2. **When Client role is NOT selected (create mode):** Shows "Type" with options "Person" and "Company"

User requirement: Labels should be consistent - use the same naming everywhere.

---

## Current Code

**File:** `components/DirectoryForm.tsx`

**Location 1 (lines 415-444):** Type selection when NOT client role (create mode)
```tsx
{mode === "create" && !isClient && (
  <div>
    <label className="mb-2 block text-sm font-medium text-gray-700">
      Type <span className="text-red-500">*</span>
    </label>
    <div className="flex gap-4">
      <label className="flex cursor-pointer items-center space-x-2">
        <input ... />
        <span className="text-sm text-gray-700">Person</span>
      </label>
      <label className="flex cursor-pointer items-center space-x-2">
        <input ... />
        <span className="text-sm text-gray-700">Company</span>
      </label>
    </div>
  </div>
)}
```

**Location 2 (lines 447-477):** Client type selection when Client role IS selected
```tsx
{isClient && (
  <div>
    <label className="mb-2 block text-sm font-medium text-gray-700">
      Client type <span className="text-red-500">*</span>
    </label>
    <div className="flex gap-4">
      <label className="flex cursor-pointer items-center space-x-2">
        <input ... />
        <span className="text-sm text-gray-700">Physical person</span>
      </label>
      <label className="flex cursor-pointer items-center space-x-2">
        <input ... />
        <span className="text-sm text-gray-700">Legal entity</span>
      </label>
    </div>
  </div>
)}
```

---

## Decision Required

**Which naming convention to use?**

Option 1: Use "Type" with "Person"/"Company" everywhere
- Label: "Type"
- Options: "Person" and "Company"
- Pros: Shorter, simpler
- Cons: Less specific when Client role is selected

Option 2: Use "Client type" with "Physical person"/"Legal entity" everywhere
- Label: "Client type" (or "Type" if more generic)
- Options: "Physical person" and "Legal entity"
- Pros: More descriptive, legal terminology
- Cons: Longer text

**Recommendation:** Use Option 1 ("Type" with "Person"/"Company") because:
- Simpler and more concise
- Consistent with common UI patterns
- Works for all roles (not just Client)
- Less verbose

---

## Implementation

**File:** `components/DirectoryForm.tsx`

**Change Location 2 (lines 447-477):**

Replace:
```tsx
<label className="mb-2 block text-sm font-medium text-gray-700">
  Client type <span className="text-red-500">*</span>
</label>
...
<span className="text-sm text-gray-700">Physical person</span>
...
<span className="text-sm text-gray-700">Legal entity</span>
```

With:
```tsx
<label className="mb-2 block text-sm font-medium text-gray-700">
  Type <span className="text-red-500">*</span>
</label>
...
<span className="text-sm text-gray-700">Person</span>
...
<span className="text-sm text-gray-700">Company</span>
```

---

## Files to Modify

1. **`components/DirectoryForm.tsx`** - Update Client type section (lines 447-477) to match Type section naming

---

## Acceptance Criteria

- [ ] Both sections show "Type" as label (not "Client type")
- [ ] Both sections show "Person" and "Company" as options (not "Physical person" and "Legal entity")
- [ ] Labels are consistent across all contexts
- [ ] TypeScript compiles without errors
- [ ] UI looks correct in both scenarios

---

## Testing Steps

1. Go to `/directory/new`
2. Don't select Client role → Verify "Type" field shows "Person" and "Company"
3. Select Client role → Verify field label changes to "Type" (not "Client type") and options are "Person" and "Company" (not "Physical person" and "Legal entity")
4. Verify consistency - same labels everywhere

---

## Notes

- This is a UI consistency fix - functionality remains the same
- Only the display labels change, not the underlying data values
- Both fields map to the same database columns (`party_type`)
- The logic and behavior remain unchanged

---

**Complete this task and report back with:**
1. Which naming convention you used
2. What you changed
3. Testing results

