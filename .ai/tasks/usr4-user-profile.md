# USR4 — User Profile & Password Change

**Date:** 2026-01-19  
**Agent:** Code Writer  
**Priority:** 🟡 Medium  
**Complexity:** 🟡 Simple  
**Pipeline:** CW→QA  

---

## 📋 ЗАДАЧА

Создать страницу профиля пользователя где он может:
- Видеть свои данные (email, role, company)
- Редактировать имя, телефон
- Менять пароль

---

## 🔌 API ENDPOINTS

### 1. `app/api/profile/route.ts`

```typescript
// GET /api/profile — Получить свой профиль
// PATCH /api/profile — Обновить профиль (name, phone)
```

**GET Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+371...",
  "avatar_url": null,
  "role": {
    "name": "agent",
    "display_name": "Агент",
    "level": 2
  },
  "company": {
    "id": "uuid",
    "name": "Travel Agency XYZ"
  },
  "created_at": "2026-01-01T...",
  "last_login_at": "2026-01-19T..."
}
```

**PATCH Body:**
```json
{
  "firstName": "Updated",
  "lastName": "Name",
  "phone": "+371 12345678"
}
```

---

### 2. `app/api/profile/password/route.ts`

```typescript
// POST /api/profile/password — Сменить пароль
```

**Request Body:**
```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456"
}
```

**Logic:**
1. Получить текущего пользователя из session
2. Проверить текущий пароль (sign in attempt)
3. Обновить пароль через `supabaseAdmin.auth.admin.updateUserById()`
4. Вернуть success

**Validation:**
- newPassword минимум 8 символов
- newPassword != currentPassword

---

## 🖥️ UI

### Page: `app/settings/profile/page.tsx`

```
+------------------------------------------+
| My Profile                               |
+------------------------------------------+
| Profile Picture                          |
| [Avatar placeholder]                     |
|                                          |
| Email: user@example.com (readonly)       |
| Role: [Agent badge] (readonly)           |
| Company: Travel Agency XYZ (readonly)    |
|                                          |
| ────────────────────────────────────     |
| Personal Information                     |
| First Name: [__John__________]           |
| Last Name:  [__Doe___________]           |
| Phone:      [__+371..._______]           |
|                                [Save]    |
|                                          |
| ────────────────────────────────────     |
| Change Password                          |
| Current Password: [______________]       |
| New Password:     [______________]       |
| Confirm Password: [______________]       |
|                       [Change Password]  |
+------------------------------------------+
```

---

## 📁 FILE STRUCTURE

```
app/
├── settings/
│   ├── page.tsx              # Existing (Localization/Accessibility)
│   └── profile/
│       └── page.tsx          # NEW: User profile
├── api/
│   └── profile/
│       ├── route.ts          # GET, PATCH profile
│       └── password/
│           └── route.ts      # POST change password
```

---

## 🧭 NAVIGATION

Добавить ссылку на профиль:

**Option 1:** В Sidebar под Settings
```
Settings
├── Preferences (/settings)
├── Profile (/settings/profile) — NEW
└── Users (/settings/users) — USR1
```

**Option 2:** В TopBar user dropdown
```
[User Avatar ▼]
├── My Profile → /settings/profile
├── Settings → /settings
└── Logout
```

Выбрать Option 2 если есть user dropdown, иначе Option 1.

---

## 🔒 SECURITY

1. Пользователь может редактировать только СВОЙ профиль
2. Нельзя менять email (readonly)
3. Нельзя менять role (только Supervisor через USR1)
4. Password validation:
   - Минимум 8 символов
   - Показать strength indicator (optional)

---

## 🧪 TESTING CHECKLIST

- [ ] Пользователь видит свой профиль
- [ ] Email и Role показаны как readonly
- [ ] Можно изменить First Name, Last Name, Phone
- [ ] Save сохраняет изменения
- [ ] Change Password работает с правильным текущим паролем
- [ ] Change Password отклоняет неверный текущий пароль
- [ ] Validation на минимальную длину нового пароля
- [ ] Confirm Password совпадает с New Password
- [ ] Success/Error сообщения показываются

---

## 🎨 UI STYLE

Использовать стиль существующей `/settings` страницы:
- Секции с заголовками
- Белые карточки с тенью
- Tailwind CSS классы

---

**Created by:** Runner  
**Next Agent:** Code Writer
