# Проверка плана счетов (invoices-system-improvement-plan.md) по коду

**Дата:** 2026-01-30  
**Цель:** Сверить каждый пункт с галочкой ✅ с реальным кодом (git мог быть потерян).

---

## ✅ Подтверждено в коде (реально есть)

| Пункт | Где проверено | Результат |
|-------|----------------|-----------|
| **Client — все клиенты** | `OrderServicesBlock.tsx`: при Issue Invoice `client` = имена из `orderTravellers` по `assignedTravellerIds` (через запятую). | ✅ Есть |
| **Аннулирование с переносом на депозит** | `invoices/[invoiceId]/route.ts`: при cancelled — `amount_paid` только если status was paid; `paymentMovedToDeposit` в ответе. `InvoiceList.tsx`: разный confirm/success для paid. | ✅ Есть |
| **Finances PDF URL** | `app/finances/invoices/page.tsx`: `handleExportPDF(invoiceId, invoice.order_code)`, fetch с `orderCode`. | ✅ Есть |
| **Колонка Service = s.name** | PDF и items используют `service_name`; в блоке сервисов передаётся `s.name` / `editableName`. | ✅ Есть |
| **Дублирование даты убрано** | `lib/invoices/generateInvoiceHTML.ts`: одна строка "Date:" с `formatDate(invoice.invoice_date)`. | ✅ Есть |
| **Status Issued (миграция)** | Файл `migrations/add_invoice_statuses_issued.sql` есть, CHECK включает issued, issued_sent. | ✅ Миграция есть (приложение по-прежнему создаёт draft — см. ниже) |
| **Payment Terms в форме** | `InvoiceCreator.tsx`: поле Payment Terms есть, подсказка из сервисов не проверялась детально. | ✅ Поле есть |

---

## ❌ В плане помечено как сделанное — в коде НЕТ

| Пункт | Ожидание | Факт в коде |
|-------|----------|-------------|
| **Notes — убрать** | Нет поля Notes в форме и блока в PDF. | В `InvoiceCreator.tsx` есть поле Notes (строки ~806, 1131). В `app/api/.../pdf/route.ts` есть блок `invoice.notes` (строки 221–226). Notes не убраны. |
| **Email — реальная отправка + форма** | Resend, PDF вложение, форма вместо prompt. | `email/route.ts`: только `return NextResponse.json({ success: true })`, TODO в комментарии, sendEmail не вызывается. В `InvoiceList.tsx` — `prompt()` для to, subject, message. SendInvoiceModal нет. |
| **PDF — серверная генерация, attachment** | Puppeteer, Content-Disposition attachment, .pdf. | PDF route возвращает HTML (`Content-Type: text/html`). `lib/invoices/generateInvoicePDF.ts` есть, но в route не используется. Нет выдачи PDF и attachment. |
| **Номер счёта 001626-SM-0132** | Формат: 6 цифр компании, SM, 4 цифры. | В `invoices/route.ts` формат `INV-${orderNumber}-${currentYear}-${userInitials}-${nextNum}` (например INV-0014-26-SM-219157). Желаемый формат не реализован. |
| **Логотип без рамки, INVOICE справа сверху** | В PDF: лого без border, INVOICE крупно справа сверху. | В `pdf/route.ts` своя inline `generateInvoiceHTML`: лого с `border`, `border-radius`; INVOICE слева рядом с лого. Отдельно `lib/invoices/generateInvoiceHTML.ts` без рамки и с INVOICE справа — но PDF route его не использует, используется только локальная копия в route. |
| **Toast вместо alert** | Toast для "Invoice created successfully". | В `InvoiceCreator.tsx` по-прежнему `alert('✅ Invoice created successfully!')`. Toast/библиотека не подключены. |

---

## ⚠️ Частично или требует уточнения

| Пункт | Замечание |
|-------|-----------|
| **Status = Issued после создания** | Миграция добавляет статусы issued/issued_sent. При создании счёта в API и в InvoiceCreator передаётся `status: 'draft'`. То есть «после создания — Issued» в UI/API не сделано: новые счета создаются как draft. |
| **Deposit Date — сегодня/завтра/послезавтра** | В форме только `type="date"` и state `depositDate`; кнопок быстрого выбора (сегодня/завтра/послезавтра) в коде не найдено. |
| **Final Payment Date — варианты (1 мес + 2 дня и т.д.)** | Варианты с расчётом даты и рабочими днями в коде не искались детально; быстрых кнопок нет. |
| **Full Payment при 100% без депозита** | Не проверялось. |

---

## Рекомендация

В файле `invoices-system-improvement-plan.md` снять галочки ✅ с пунктов, отмеченных выше как «в коде НЕТ», и при необходимости скорректировать блок «Уже сделано» и приоритеты, чтобы план соответствовал реальному состоянию репозитория.
