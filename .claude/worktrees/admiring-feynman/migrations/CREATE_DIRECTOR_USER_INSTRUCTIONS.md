# Создание пользователя Director - Vera Laskova

## Метод 1: Через Supabase SQL Editor (рекомендуется)

1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте и выполните скрипт из `migrations/create_director_user.sql`
3. Проверьте результат в конце (verification query)

## Метод 2: Через Supabase Auth UI + SQL

### Шаг 1: Создать пользователя в Auth
1. Supabase Dashboard → Authentication → Users
2. Нажмите "Add user"
3. Email: `vera.laskova@gtr.lv`
4. Password: `Gull26rix!`
5. Auto-confirm user: ✅ (включить)
6. Нажмите "Create user"

### Шаг 2: Обновить CHECK constraint (если нужно)
```sql
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('agent', 'supervisor', 'director', 'admin'));
```

### Шаг 3: Установить роль director
```sql
-- Найти user_id
SELECT id, email FROM auth.users WHERE email = 'vera.laskova@gtr.lv';

-- Установить роль director (замените USER_ID на фактический ID)
UPDATE public.profiles 
SET 
    role = 'director',
    display_name = 'Vera Laskova'
WHERE user_id = 'USER_ID';
```

### Шаг 4: Проверка
```sql
SELECT 
    u.email,
    p.role,
    p.display_name,
    p.company_id,
    c.name as company_name
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
JOIN public.companies c ON p.company_id = c.id
WHERE u.email = 'vera.laskova@gtr.lv';
```

## Ожидаемый результат
- Email: `vera.laskova@gtr.lv`
- Password: `Gull26rix!`
- Role: `director`
- Company: (первая компания в БД)

## Права Director
С ролью `director` пользователь получает:
- Полный доступ ко всем данным компании
- Возможность управлять dashboard targets
- Доступ ко всем заказам и сервисам
- Возможность управлять пользователями (если реализовано в UI)
