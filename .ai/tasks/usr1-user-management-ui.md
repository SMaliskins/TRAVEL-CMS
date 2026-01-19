# USR1 — User Management UI

**Date:** 2026-01-19  
**Agent:** Code Writer  
**Priority:** 🔴 CRITICAL  
**Complexity:** 🟠 Medium  
**Pipeline:** CW→QA  

---

## 📋 ЗАДАЧА

Создать UI для управления пользователями. Supervisor может:
- Видеть список всех пользователей компании
- Добавлять новых пользователей
- Редактировать роль/статус пользователя
- Деактивировать пользователя

---

## 🗄️ БАЗА ДАННЫХ (уже готова)

Таблицы созданы в USR2:
- `roles` — 5 ролей (subagent, agent, accountant, director, supervisor)
- `user_profiles` — профили пользователей с role_id
- `role_permissions` — права для ролей

---

## 🔌 API ENDPOINTS

### 1. `app/api/users/route.ts`

```typescript
// GET /api/users — Список пользователей (Supervisor/Director)
// POST /api/users — Создание пользователя (Supervisor only)
```

**GET Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+371...",
    "role": {
      "id": "uuid",
      "name": "agent",
      "display_name": "Агент",
      "level": 2,
      "color": "#3B82F6"
    },
    "is_active": true,
    "created_at": "2026-01-19T...",
    "last_login_at": "2026-01-19T..."
  }
]
```

**POST Body:**
```json
{
  "email": "new@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+371...",
  "roleId": "uuid"
}
```

**POST Logic:**
1. Проверить что текущий user — Supervisor
2. Создать auth user через `supabaseAdmin.auth.admin.createUser()`
3. Создать user_profile с role_id
4. Вернуть созданного пользователя

**Временный пароль:** Генерировать случайный (12 символов)
- Показать в UI после создания (один раз)
- В будущем (USR3) — отправка email

---

### 2. `app/api/users/[userId]/route.ts`

```typescript
// GET /api/users/:userId — Детали пользователя
// PATCH /api/users/:userId — Обновление (role, is_active, name, phone)
// DELETE /api/users/:userId — Soft delete (is_active = false)
```

**PATCH Body:**
```json
{
  "roleId": "uuid",
  "firstName": "Updated",
  "lastName": "Name",
  "phone": "+371...",
  "isActive": false
}
```

**Security Rules:**
- Supervisor не может деактивировать себя
- Supervisor не может понизить свою роль
- Должен остаться хотя бы 1 активный Supervisor

---

## 🖥️ UI COMPONENTS

### 1. Page: `app/settings/users/page.tsx`

```tsx
// Layout:
// +------------------------------------------+
// | User Management              [+ Add User] |
// +------------------------------------------+
// | Search: [___________]                    |
// +------------------------------------------+
// | Name          | Email    | Role | Status | Actions |
// | John Doe      | j@...    | Agent| Active | Edit ⋮  |
// | Jane Smith    | j@...    | Dir. | Active | Edit ⋮  |
// +------------------------------------------+
```

**Требования:**
- Заголовок "User Management"
- Кнопка "+ Add User" (только для Supervisor)
- Поиск по имени/email
- Таблица с пользователями
- Доступ: только Supervisor и Director (Director — read only)

---

### 2. Component: `components/users/UserList.tsx`

**Колонки:**
| Column | Description |
|--------|-------------|
| Name | first_name + last_name |
| Email | email |
| Role | RoleBadge компонент |
| Status | Active/Inactive badge |
| Last Login | Относительная дата или "Never" |
| Actions | Edit, Deactivate (для Supervisor) |

---

### 3. Component: `components/users/AddUserModal.tsx`

**Поля:**
- Email* (required, validation)
- First Name*
- Last Name*
- Phone (optional)
- Role* (dropdown из /api/roles, exclude 'subagent' для простоты)

**После успешного создания:**
- Показать модал с временным паролем
- "User created! Temporary password: XXXXXX"
- Кнопка "Copy Password"
- Предупреждение: "Save this password. It will not be shown again."

---

### 4. Component: `components/users/EditUserModal.tsx`

**Поля:**
- First Name
- Last Name
- Phone
- Role (dropdown)
- Status (Active/Inactive toggle)

**Email:** показать, но disabled (нельзя менять)

---

### 5. Component: `components/users/RoleBadge.tsx`

```tsx
// Цветной badge с названием роли
// Использовать role.color из БД
// Пример: [Агент] синий, [Супервайзер] красный
```

---

## 🧭 NAVIGATION

Добавить в Sidebar (только для Supervisor/Director):
```
Settings
├── Preferences (существующий /settings)
└── Users (/settings/users) — NEW
```

Или в TopBar dropdown menu.

---

## 🔒 SECURITY

1. **API Authorization:**
   - GET /api/users — Supervisor или Director
   - POST/PATCH/DELETE — только Supervisor

2. **Проверка текущего пользователя:**
```typescript
// Получить текущего user из session
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user?.id;

// Получить роль
const { data: profile } = await supabaseAdmin
  .from('user_profiles')
  .select('*, role:roles(*)')
  .eq('id', userId)
  .single();

if (profile?.role?.name !== 'supervisor') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## 📁 FILE STRUCTURE

```
app/
├── settings/
│   └── users/
│       └── page.tsx           # Users management page
├── api/
│   └── users/
│       ├── route.ts           # GET, POST
│       └── [userId]/
│           └── route.ts       # GET, PATCH, DELETE

components/
└── users/
    ├── UserList.tsx
    ├── AddUserModal.tsx
    ├── EditUserModal.tsx
    └── RoleBadge.tsx
```

---

## 🧪 TESTING CHECKLIST

- [ ] Supervisor видит список пользователей
- [ ] Supervisor может добавить пользователя
- [ ] Временный пароль показывается после создания
- [ ] Supervisor может изменить роль пользователя
- [ ] Supervisor может деактивировать пользователя
- [ ] Supervisor НЕ может деактивировать себя
- [ ] Director видит список (read-only)
- [ ] Agent/Accountant получают 403 на /settings/users
- [ ] Поиск работает
- [ ] Role badges отображаются с правильными цветами

---

## 🎨 UI STYLE

Использовать существующий стиль проекта:
- Tailwind CSS
- Модальные окна как в EditServiceModal
- Таблица как в OrdersTable
- Buttons, inputs из существующих компонентов

---

**Created by:** Runner  
**Next Agent:** Code Writer
