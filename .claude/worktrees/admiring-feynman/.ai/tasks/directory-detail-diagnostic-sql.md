# SQL Diagnostic Queries for Directory Detail Page Issues
**Priority:** INFO  
**Type:** Diagnostic  
**Assigned to:** CODE WRITER / DB/SCHEMA Agent  
**Status:** TODO

---

## 🔍 ЦЕЛЬ

Создать SQL-запросы для диагностики проблем с Directory Detail Page, особенно для проверки tenant isolation и существования записей.

---

## 📋 SQL ЗАПРОСЫ ДЛЯ ДИАГНОСТИКИ

### 1. Проверка существования записи

```sql
-- Проверка: существует ли запись?
SELECT 
    'EXISTS CHECK' as test,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ EXISTS'
        ELSE '❌ NOT FOUND'
    END as result,
    COUNT(*) as count
FROM public.party
WHERE id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';
```

### 2. Получение всех данных party

```sql
-- Все данные party (как API запрашивает)
SELECT 
    'PARTY DATA' as test,
    id,
    display_name,
    party_type,
    status,
    company_id,
    email,
    phone,
    created_at,
    updated_at
FROM public.party
WHERE id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';
```

### 3. Проверка tenant isolation

```sql
-- TENANT ISOLATION CHECK
-- Проверка: какой company_id у записи и у пользователей
SELECT 
    'TENANT CHECK' as test,
    p.id,
    p.display_name,
    p.company_id as party_company_id,
    c.name as party_company_name,
    -- Список всех пользователей и их company_id
    (SELECT json_agg(json_build_object(
        'user_id', user_id,
        'company_id', company_id,
        'company_name', (SELECT name FROM public.companies WHERE id = profiles.company_id)
    )) FROM public.profiles) as all_user_companies
FROM public.party p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE p.id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';
```

### 4. Проверка всех связанных данных

```sql
-- party_company
SELECT 
    'PARTY_COMPANY' as test,
    party_id,
    company_name,
    reg_number,
    legal_address,
    actual_address,
    bank_details
FROM public.party_company
WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';

-- client_party
SELECT 
    'CLIENT_PARTY' as test,
    id,
    party_id,
    client_type
FROM public.client_party
WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';

-- partner_party (supplier)
SELECT 
    'PARTNER_PARTY' as test,
    id,
    party_id,
    partner_role,
    business_category
FROM public.partner_party
WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';

-- subagents
SELECT 
    'SUBAGENTS' as test,
    id,
    party_id,
    commission_scheme
FROM public.subagents
WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089';
```

### 5. Имитация запроса API

```sql
-- Имитация запроса API (как API собирает данные)
WITH party_data AS (
    SELECT * FROM public.party WHERE id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089'
),
person_data AS (
    SELECT * FROM public.party_person WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089'
),
company_data AS (
    SELECT * FROM public.party_company WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089'
),
client_data AS (
    SELECT party_id FROM public.client_party WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089'
),
supplier_data AS (
    SELECT * FROM public.partner_party WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089'
),
subagent_data AS (
    SELECT * FROM public.subagents WHERE party_id = '7cb4e2ac-ecce-4d3d-916e-3a1e90f1e089'
)
SELECT 
    'API SIMULATION' as test,
    json_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'party_type', p.party_type,
        'status', p.status,
        'company_id', p.company_id,
        'email', p.email,
        'phone', p.phone,
        -- Company fields
        'company_name', cd.company_name,
        'reg_number', cd.reg_number,
        'legal_address', cd.legal_address,
        'actual_address', cd.actual_address,
        -- Roles (boolean flags)
        'is_client', CASE WHEN cl.party_id IS NOT NULL THEN true ELSE false END,
        'is_supplier', CASE WHEN sd.party_id IS NOT NULL THEN true ELSE false END,
        'is_subagent', CASE WHEN sa.party_id IS NOT NULL THEN true ELSE false END
    ) as api_response_data
FROM party_data p
LEFT JOIN person_data pd ON true
LEFT JOIN company_data cd ON true
LEFT JOIN client_data cl ON true
LEFT JOIN supplier_data sd ON true
LEFT JOIN subagent_data sa ON true;
```

---

## 📊 ИНТЕРПРЕТАЦИЯ РЕЗУЛЬТАТОВ

### Если запись НЕ существует:
- ❌ Запись действительно не найдена в базе данных
- Решение: Проверить, была ли запись удалена или ID неверный

### Если запись существует, но company_id не совпадает:
- ⚠️ Проблема tenant isolation
- Решение: 
  1. Исправить company_id записи на правильный
  2. Или изменить логику tenant isolation в API

### Если запись существует и company_id совпадает:
- ✅ Запись должна быть доступна
- Проблема может быть в:
  1. Авторизации (токен не отправляется)
  2. Логике запроса в API
  3. Ошибке в `.single()` вызове

---

## 🔧 ИСПОЛЬЗОВАНИЕ

1. Запустить все запросы для проблемного ID
2. Проверить результаты
3. Сравнить `party_company_id` с `company_id` текущего пользователя
4. Если не совпадают - это проблема tenant isolation
5. Если совпадают - проблема в логике API

---

**Created by:** QA Agent  
**Date:** 2025-12-25  
**Related:** directory-detail-page-not-opening.md

