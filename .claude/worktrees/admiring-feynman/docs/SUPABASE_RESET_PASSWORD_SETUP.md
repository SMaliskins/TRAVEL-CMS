# Настройка Reset Password в Supabase

Если при нажатии на ссылку в письме открывается страница Supabase вместо вашего приложения — проверьте настройки в Supabase Dashboard.

## Шаги настройки

### 1. Откройте Supabase Dashboard

Перейдите в ваш проект → **Authentication** → **URL Configuration**.

### 2. Site URL

**Site URL** должен указывать на ваше приложение:

- **Локальная разработка:** `http://localhost:3000`
- **Production:** `https://yourdomain.com`

Если здесь указан другой URL (например, supabase.com) — ссылка в письме будет вести не туда.

### 3. Redirect URLs

В **Redirect URLs** добавьте:

- `http://localhost:3000/reset-password` (для dev)
- `https://yourdomain.com/reset-password` (для production)

Можно добавить оба. Supabase будет перенаправлять пользователя только на URL из этого списка.

### 4. Сохраните изменения

Нажмите **Save**.

---

## Как это работает

1. Пользователь вводит email на `/forgot-password`.
2. Supabase отправляет письмо со ссылкой вида:  
   `https://YOUR-PROJECT.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=...`
3. При переходе по ссылке Supabase проверяет токен и перенаправляет на `redirect_to`.
4. `redirect_to` берётся из `redirectTo` в коде и должен совпадать с одним из **Redirect URLs**.
5. **Site URL** используется Supabase для формирования ссылок и проверок.

---

## Проверка

После настройки:

1. Откройте `/forgot-password`.
2. Введите email.
3. Проверьте почту и перейдите по ссылке.
4. Должна открыться страница `/reset-password` вашего приложения.
