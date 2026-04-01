# Как запустить диагностический SQL скрипт

## Вариант 1: Supabase Dashboard (рекомендуется)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor** (левое меню)
4. Создайте новый запрос (New Query)
5. Скопируйте содержимое файла `migrations/DIAGNOSTIC_BOTH_RECORDS.sql`
6. Вставьте в SQL Editor
7. Нажмите **Run** или `Ctrl+Enter` / `Cmd+Enter`

## Вариант 2: Отдельные скрипты

Если хотите проверить каждую запись отдельно:

### Для записи 1 (Gulliver Travel):
```bash
migrations/test_api_mapping_and_tenant.sql
```
**Record ID:** `4642eea4-38ed-464d-866c-3d2bea38235e`

### Для записи 2:
```bash
migrations/test_record_5bbdd5f0.sql
```
**Record ID:** `5bbdd5f0-2d4f-4e7b-86d1-13940e95fde6`

## Что проверить в результатах

### 1. EXISTS CHECK
- ✅ `EXISTS` - запись существует
- ❌ `NOT FOUND` - запись не найдена (это и есть проблема!)

### 2. TENANT CHECK
**Важно!** Проверьте:
- `party_company_id` - какой `company_id` у записи
- `all_user_companies` - список всех пользователей и их `company_id`

**Проблема tenant isolation:**
- Если `party.company_id` ≠ `profiles.company_id` текущего пользователя
- То API вернет 404 "Party not found"
- Решение: обновить `company_id` записи или проверить, почему она создана с неправильным `company_id`

### 3. PARTY_COMPANY / PARTY_PERSON
- Проверьте, что все поля заполнены
- Особенно важно для Company: `company_name`, `reg_number`, `legal_address`, `actual_address`

### 4. Роли (CLIENT_PARTY, PARTNER_PARTY, SUBAGENTS)
- Проверьте, что роли созданы правильно
- Если роли отсутствуют, это может быть причиной проблем

## После получения результатов

**Если запись не найдена (NOT FOUND):**
- Запись была удалена или никогда не создавалась
- Нужно проверить процесс создания
- Возможно, произошла ошибка при создании, но пользователь не увидел её

**Если запись найдена, но не открывается:**
- Скорее всего проблема в **tenant isolation**
- `party.company_id` не совпадает с `profiles.company_id` текущего пользователя
- Решение: обновить `company_id` записи или выяснить, почему она создана с другим `company_id`

## Пример исправления tenant isolation

Если запись существует, но `company_id` не совпадает:

```sql
-- Проверить текущий пользователь и его company_id
SELECT 
    user_id,
    company_id,
    (SELECT name FROM public.companies WHERE id = profiles.company_id) as company_name
FROM public.profiles
WHERE user_id = auth.uid();

-- Если нужно обновить company_id записи (ТОЛЬКО ЕСЛИ ЭТО ПРАВИЛЬНО!)
UPDATE public.party 
SET company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
WHERE id = '4642eea4-38ed-464d-866c-3d2bea38235e';
```

**⚠️ ВНИМАНИЕ:** Обновляйте `company_id` только если уверены, что запись должна принадлежать текущему пользователю!

