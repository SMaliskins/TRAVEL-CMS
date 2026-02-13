# Issues and Solutions

**Last Updated:** 2026-01-03

---

## Issue: PUT endpoint "Party not found or update failed"

**Date:** 2026-01-03  
**Status:** RESOLVED

**Problem:**
- Запись открывается успешно (GET endpoint работает)
- При сохранении изменений (PUT endpoint) получаем ошибку "Party not found or update failed"
- `.update().select()` не находит запись для обновления

**Root Cause:**
- PUT endpoint получал ID из partner_party/subagents, а не из party
- Нужно было резолвить ID в party_id перед обновлением

**Solution:**
- Добавлена резолюция ID в PUT endpoint (строки 277-314 в app/api/directory/[id]/route.ts)
- Если ID из partner_party/subagents, он резолвится в party_id
- Затем обновление происходит по правильному party_id

**File:** `app/api/directory/[id]/route.ts`

---

## Issue: Spread Operator ID Overwrite

**Date:** 2026-01-03  
**Status:** RESOLVED

**Problem:**
- Записи с supplier/subagent ролями создаются, но не открываются
- GET endpoint возвращает 404 "Record not found"
- URL содержит ID из partner_party, а не из party

**Root Cause:**
- Spread operator `...supplier` и `...subagent` перезаписывал `party.id`
- Frontend получал неправильный ID и использовал его для навигации

**Solution:**
- Исключается `id` из `supplier` и `subagent` перед spread (строки 235-247)
- Используется деструктуризация: `const { id: _supplierId, ...supplierData } = supplier || {};`
- `party.id` больше не перезаписывается

**File:** `app/api/directory/route.ts`

---

## Issue: clientType Initialization - Type Switching When Adding Client Role

**Date:** 2026-01-03  
**Status:** PENDING

**Problem:**
- При добавлении роли Client к записи с Type = Company и Roles = Supplier/Subagent
- Type автоматически переключается на Person
- Это приводит к потере данных и неожиданному поведению UI

**Root Cause:**
1. `clientType` инициализируется как "person" по умолчанию (строка 76-80 в DirectoryForm.tsx)
2. `useEffect` вызывает `setBaseType(clientType)` при добавлении Client роли (строка 127)
3. Это переключает Type на Person, даже если запись была Company

**Solution:**
1. Инициализировать `clientType` из `record.type` (если record существует), а не из "person"
2. В `useEffect` устанавливать `clientType = baseType` (а не наоборот), когда добавляется Client роль
3. Это сохраняет существующий Type при добавлении Client роли

**File:** `components/DirectoryForm.tsx`

**Task:** `.ai/tasks/code-writer-fix-clienttype-initialization.md`

---

---

### ⚠️ OrderServicesBlock: "Element type is invalid... got: object"

- **Дата:** 2026-02-13
- **Симптомы:** React error "Element type is invalid: expected a string or a class/function but got: object" in OrderServicesBlock
- **Решение:** Add defensive ESM/CJS interop for modal imports; use `typeof X === "function" ? X : X?.default`
- **Предотвращение:** When importing default exports that may be namespace objects, add interop extraction

---

**Created by:** ARCHITECT  
**Last Updated:** 2026-02-13
