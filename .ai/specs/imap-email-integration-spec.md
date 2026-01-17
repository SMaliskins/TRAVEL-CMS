# TITLE: IMAP Email Integration for Travel CMS

## 1. PURPOSE

Базовое подключение почты через IMAP для получения и просмотра входящих писем. Система должна:
- Подключаться к почтовому ящику агента через IMAP
- Получать входящие письма по расписанию или вручную
- Отображать письма в UI
- Позволять просматривать содержимое писем

**AI-обработка (классификация, парсинг бронирований) — будет добавлена позже.**

## 2. CURRENT STATE ANALYSIS

### Что уже есть:
- ✅ Форма добавления сервисов (`AddServiceModal.tsx`)
- ✅ AI-модуль (для будущего использования)

### Что отсутствует:
- ❌ IMAP-клиент для подключения к почте
- ❌ Хранение учётных данных почты (шифрование)
- ❌ UI для настройки почтового подключения
- ❌ Синхронизация писем
- ❌ UI для просмотра входящих писем

## 3. IN SCOPE (Phase 1 — Базовое подключение)

### Core Features:
- Подключение к IMAP-серверу (Gmail, Outlook, любой IMAP)
- Безопасное хранение учётных данных (шифрование)
- Синхронизация писем (polling)
- UI для настройки почтового подключения
- UI для просмотра входящих писем

### NOT in Phase 1 (будет позже):
- ❌ AI-классификация писем
- ❌ AI-парсинг бронирований
- ❌ Автоматическое создание сервисов
- ❌ Real-time синхронизация (IMAP IDLE)

### Supported Providers:
- Gmail (с App Password)
- Outlook/Office365 (логин/пароль или OAuth)
- Yandex Mail (App Password)
- Любой IMAP-сервер (логин/пароль)

## 4. OUT OF SCOPE

- AI-классификация и парсинг (Phase 2)
- Отправка email (SMTP) — отдельная фича
- Массовые рассылки
- Email-маркетинг
- Интеграция с Calendar
- Автоматическое создание заказов
- Real-time синхронизация (IMAP IDLE)

## 5. ACTORS & PERMISSIONS

**Actor: Travel Agent**
- Может настроить своё почтовое подключение
- Может просматривать свои письма
- Видит только свои письма (изоляция по user_id)

**Actor: Admin**
- Может видеть статус подключений (без паролей)
- Может отключить проблемные подключения
- Может настроить лимиты синхронизации

**Permissions:**
- Только авторизованные пользователи
- Почтовые данные привязаны к user_id
- Пароли хранятся зашифрованными
- OAuth токены обновляются автоматически

## 6. UX / SCREENS

### Screen 1: Settings → Email Integration

**Entry Point:**
- Settings page → "Email Integration" tab

**UI States:**

**Not Connected State:**
- "Connect your email" heading
- Provider selector: Gmail, Outlook, Yandex, Other IMAP
- Benefits list: "View all your emails in one place", "Stay organized", etc.
- "Connect" button

**Connected State:**
- Email address displayed
- Connection status (Active, Syncing, Error)
- Last sync time
- Stats: X emails synced
- Actions: "Sync now", "Disconnect", "Settings"

**Connection Form (Gmail):**
- Email input
- App Password input (with link to Google instructions)
- "Test Connection" button
- "Save & Connect" button

**Connection Form (OAuth - Gmail/Outlook):**
- "Sign in with Google" / "Sign in with Microsoft" button
- Redirect to OAuth flow
- Return with success/error

**Connection Form (Other IMAP):**
- IMAP Server input (e.g., imap.mail.ru)
- Port input (default: 993)
- Use SSL checkbox (default: checked)
- Email input
- Password input
- "Test Connection" button
- "Save & Connect" button

**Settings Panel:**
- Sync frequency: Every 5 min / Every 15 min / Manual
- Folders to sync: INBOX, Sent, All (checkboxes)
- Date range: Last 30 days / Last 90 days / All

### Screen 2: Inbox View

**Entry Point:**
- Main menu → "Inbox" or Dashboard widget

**UI Layout:**
- Left panel: Folder list (INBOX, Sent, etc.)
- Center panel: Email list (date, subject, from, preview)
- Right panel: Email detail (full content)

**Email List Item:**
- Checkbox for bulk actions
- Read/Unread indicator
- Date
- From (sender name or email)
- Subject (truncated)
- Preview (first line, truncated)
- Star/Flag button

**Email Detail Panel:**
- Header: Subject, From, To, Date
- Full email content (HTML rendered or plain text)
- Attachments list (with download/view actions)
- Actions: Archive, Delete

**Filters:**
- Search box
- Status: All / Unread
- Date range picker

### Screen 3: Dashboard Widget

**Entry Point:**
- Dashboard page

**Widget Content:**
- "Inbox" widget showing:
  - Unread count
  - Recent emails (last 3)
  - "View all" link

## 7. DATA MODEL (LOGICAL)

### Email Connection Entity
```
email_connections
- id: uuid (PK)
- user_id: uuid (FK → auth.users)
- company_id: uuid (FK → companies)
- provider: enum (gmail, outlook, yandex, custom)
- email: string
- imap_host: string (nullable, for custom)
- imap_port: int (default: 993)
- use_ssl: boolean (default: true)
- credentials_encrypted: jsonb (encrypted password or OAuth tokens)
- sync_frequency: enum (realtime, 5min, 15min, manual)
- folders_to_sync: text[] (default: ['INBOX'])
- last_sync_at: timestamp
- last_sync_status: enum (success, error, syncing)
- last_sync_error: text (nullable)
- is_active: boolean (default: true)
- created_at: timestamp
- updated_at: timestamp
```

### Synced Email Entity
```
synced_emails
- id: uuid (PK)
- connection_id: uuid (FK → email_connections)
- user_id: uuid (FK → auth.users)
- company_id: uuid (FK → companies)
- message_id: string (IMAP message ID, unique per connection)
- uid: int (IMAP UID для fetch body)
- folder: string
- from_email: string
- from_name: string (nullable)
- to_email: string
- subject: string
- preview: string (first 200 chars)
- received_at: timestamp
- is_read: boolean (default: false)
- is_starred: boolean (default: false)
- is_archived: boolean (default: false)
- has_attachments: boolean (default: false)
- created_at: timestamp
```
**Body НЕ хранится в БД** — читается с IMAP при открытии письма.
Это экономит ~99% storage (1 KB vs 100 KB на письмо).
**Поля для Phase 2 (AI):**
- classification: enum — будет добавлено позже
- parsed_data: jsonb — будет добавлено позже
- linked_order_id, linked_service_id — будет добавлено позже

### Email Attachment Entity
**НЕ ИСПОЛЬЗУЕТСЯ в Phase 1** — вложения читаются с IMAP по требованию.
Phase 2: можно добавить кэширование вложений в Supabase Storage.

## 8. BUSINESS RULES

### Connection Rules:
- One email connection per user (can be extended to multiple)
- Passwords must be encrypted before storage (AES-256)
- OAuth tokens must be refreshed before expiry
- Connection test required before saving

### Sync Rules:
- Real-time sync using IMAP IDLE (if supported)
- Fallback to polling (5-15 min intervals)
- Sync only configured folders
- Sync only emails from last N days (configurable)
- Skip already synced emails (by message_id)
- Rate limiting: max 100 emails per sync batch

### Security Rules:
- Never log or expose passwords
- Encrypt credentials at rest
- Use secure connection (SSL/TLS)
- Rate limit connection attempts
- Lock account after 5 failed attempts

### Retention Rules:
- Keep emails for 1 year (configurable)
- Archive old emails to cold storage
- Delete on user request (GDPR)

## 9. FLOWS

### Flow 1: Connect Gmail (App Password)

1. User goes to Settings → Email Integration
2. User selects "Gmail"
3. System shows instructions:
   - Enable 2FA in Google Account
   - Go to Security → App passwords
   - Generate App password for "Mail"
4. User enters:
   - Email: user@gmail.com
   - App Password: xxxx xxxx xxxx xxxx
5. User clicks "Test Connection"
6. System:
   - Attempts IMAP connection (imap.gmail.com:993)
   - Lists folders
   - Returns success/error
7. User clicks "Save & Connect"
8. System:
   - Encrypts password
   - Saves connection
   - Starts initial sync
9. User sees "Connected" status with sync progress

### Flow 2: Sync Emails (только метаданные)

1. Sync triggered (scheduled or manual)
2. System:
   - Decrypts credentials
   - Connects to IMAP
   - Selects folder (INBOX)
   - Searches for new emails (SINCE last_sync_at)
3. For each new email:
   - Fetch headers only (from, to, subject, date, UID)
   - Fetch preview (first 200 chars of body)
   - Check has_attachments flag
   - Save to synced_emails table
   - **Body НЕ сохраняется** — читается при открытии
4. Update last_sync_at and status
5. If error: log error, set status to "error"

### Flow 2.1: View Email Body (on demand)

1. User clicks on email in list
2. Frontend calls GET /api/email/:id/body
3. Backend:
   - Gets email UID from synced_emails
   - Connects to IMAP
   - Fetches body by UID
   - Returns bodyText + bodyHtml + attachments
4. Frontend renders email content
5. Mark email as read (is_read = true)

### Flow 3: OAuth Flow (Gmail/Outlook)

1. User clicks "Sign in with Google"
2. System redirects to Google OAuth consent screen
3. User grants permissions (read email)
4. Google redirects back with authorization code
5. System:
   - Exchanges code for access_token and refresh_token
   - Encrypts and stores tokens
   - Starts initial sync
6. User sees "Connected" status

### Flow 4: Token Refresh (OAuth)

1. Scheduled job checks token expiry
2. If expiring soon (< 1 hour):
   - Use refresh_token to get new access_token
   - Update stored tokens
3. If refresh fails:
   - Mark connection as "error"
   - Notify user to re-authenticate

## 10. API CONTRACTS

### POST /api/email/connect
```typescript
// Request
{
  provider: "gmail" | "outlook" | "yandex" | "custom",
  email: string,
  // For password auth:
  password?: string,
  // For custom IMAP:
  imapHost?: string,
  imapPort?: number,
  useSsl?: boolean,
  // For OAuth:
  authorizationCode?: string,
}

// Response
{
  success: boolean,
  connectionId?: string,
  error?: string,
}
```

### POST /api/email/test-connection
```typescript
// Request
{
  provider: "gmail" | "outlook" | "yandex" | "custom",
  email: string,
  password?: string,
  imapHost?: string,
  imapPort?: number,
  useSsl?: boolean,
}

// Response
{
  success: boolean,
  folders?: string[],
  error?: string,
}
```

### POST /api/email/sync
```typescript
// Request (manual sync)
{
  connectionId: string,
}

// Response
{
  success: boolean,
  emailsFound: number,
  emailsNew: number,
  error?: string,
}
```

### GET /api/email/inbox
```typescript
// Query params
{
  folder?: string,
  isRead?: boolean,
  page?: number,
  limit?: number,
}

// Response
{
  emails: [{
    id: string,
    from: { email: string, name?: string },
    subject: string,
    preview: string,
    receivedAt: string,
    isRead: boolean,
    isStarred: boolean,
  }],
  pagination: { total: number, page: number, limit: number },
}
```

### GET /api/email/:id
```typescript
// Response (метаданные из БД)
{
  id: string,
  from: { email: string, name?: string },
  to: string,
  subject: string,
  preview: string,
  receivedAt: string,
  isRead: boolean,
  isStarred: boolean,
  hasAttachments: boolean,
}
```

### GET /api/email/:id/body
```typescript
// Читает body с IMAP в реальном времени
// Response
{
  bodyText: string,
  bodyHtml?: string,
  attachments: [{ filename: string, contentType: string, size: number }],
}
// Errors:
// - 503: IMAP connection failed (retry later)
// - 404: Email not found on server
```

### DELETE /api/email/disconnect
```typescript
// Response
{
  success: boolean,
}
```

## 11. TECHNICAL IMPLEMENTATION

### NPM Packages:
```json
{
  "imap": "^0.8.19",           // IMAP client
  "mailparser": "^3.6.5",       // Email parsing
  "node-forge": "^1.3.1",       // Encryption
  // Or for modern approach:
  "imapflow": "^1.0.148",       // Modern IMAP client (recommended)
}
```

### Encryption:
```typescript
// lib/encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = process.env.EMAIL_ENCRYPTION_KEY; // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, "hex"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

### IMAP Client:
```typescript
// lib/email/imapClient.ts
import { ImapFlow } from "imapflow";

export async function createImapClient(config: {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
  });
  await client.connect();
  return client;
}

// Sync: fetch only headers (no body)
export async function fetchNewEmails(
  client: ImapFlow,
  folder: string,
  since: Date
): Promise<EmailHeader[]> {
  await client.mailboxOpen(folder);
  const messages = [];
  for await (const msg of client.fetch(
    { since },
    { envelope: true, uid: true, bodyStructure: true }
  )) {
    messages.push({
      uid: msg.uid,
      messageId: msg.envelope.messageId,
      from: msg.envelope.from,
      to: msg.envelope.to,
      subject: msg.envelope.subject,
      date: msg.envelope.date,
      hasAttachments: hasAttachments(msg.bodyStructure),
    });
  }
  return messages;
}

// On-demand: fetch body by UID
export async function fetchEmailBody(
  client: ImapFlow,
  folder: string,
  uid: number
): Promise<EmailBody> {
  await client.mailboxOpen(folder);
  const msg = await client.fetchOne(uid, { source: true }, { uid: true });
  const parsed = await simpleParser(msg.source);
  return {
    bodyText: parsed.text || "",
    bodyHtml: parsed.html || undefined,
    attachments: parsed.attachments.map(a => ({
      filename: a.filename || "attachment",
      contentType: a.contentType,
      size: a.size,
    })),
  };
}
```

### Background Sync (Vercel Cron):
```typescript
// app/api/cron/email-sync/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get all active connections due for sync
  const connections = await getConnectionsDueForSync();
  
  for (const conn of connections) {
    await syncEmailsForConnection(conn.id);
  }

  return Response.json({ synced: connections.length });
}
```

### Vercel.json Cron Config:
```json
{
  "crons": [
    {
      "path": "/api/cron/email-sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## 12. SECURITY CONSIDERATIONS

### Credentials Storage:
- Encrypt passwords with AES-256-GCM
- Store encryption key in environment variable
- Never log or expose passwords
- Use HTTPS for all API calls

### OAuth Security:
- Store refresh tokens encrypted
- Refresh access tokens before expiry
- Use PKCE for OAuth flow
- Validate redirect URIs

### Access Control:
- Emails isolated by user_id
- Admin cannot read user emails
- RLS policies on all tables
- Rate limiting on sync endpoints

### Data Protection:
- Email content encrypted at rest (Supabase)
- Attachments stored in private bucket
- GDPR: user can request deletion
- Retention policy: 1 year default

## 13. OPEN QUESTIONS

**1. OAuth vs App Password:**
- Should we support both or just OAuth?
- OAuth is more secure but complex
- App passwords simpler for users

**2. Real-time vs Polling:**
- IMAP IDLE requires persistent connection
- Vercel serverless doesn't support long-running
- Options: polling (5-15 min) or external service (Pusher, Ably)

**3. Email Storage:**
- Store full email body or just metadata?
- Storage costs vs search capability
- Compress old emails?

**4. Attachments:**
- Store attachments or just metadata?
- Size limits?

**5. Multi-account:**
- Allow multiple email accounts per user?
- Or one per user?

**6. Spam/Security:**
- How to handle malicious emails?
- Should we scan attachments for viruses?

**7. Rate Limits:**
- Gmail: 10,000 emails/day (with OAuth)
- How to handle rate limiting?

**8. Shared Mailboxes:**
- Support for team mailboxes?
- Multiple users on same mailbox?

## 14. ACCEPTANCE CRITERIA

**AC1: Connect Email**
- Given user provides valid Gmail credentials, when user clicks "Connect", then connection is established and status shows "Connected"
- Given invalid credentials, when user clicks "Test Connection", then error message is shown

**AC2: Sync Emails**
- Given connected email, when sync runs, then new emails are fetched and stored
- Given sync error, then error is logged and status shows "Error"

**AC3: View Emails**
- Given synced emails, when user opens Inbox, then emails are displayed with subject, from, date
- Given email selected, when user clicks, then full email content is shown

**AC4: Security**
- Given stored password, when database is accessed, then password is encrypted
- Given user A's emails, when user B queries, then user B cannot see user A's emails

---

SPEC COMPLETE — READY FOR ARCHITECT REVIEW
