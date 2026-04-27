# RELEASE LOG — пресс-релизы и описание возможностей

> Лог для формулировок, готовых к использованию в пресс-релизах, описании продукта и маркетинговых материалах.  
> Заполняется **после завершения** значимых фич (SUCCESS в PROJECT_LOG).

**Правило:** при закрытии задачи с пользовательской ценностью записать сюда краткое описание результата в формате «что получил пользователь» и готовую формулировку для внешних описаний.

---

## [2026-04-27] Release news language selector

**Возможность (для описания продукта):** Users can choose the language for release news separately from the interface language. For example, the system can stay in English while release updates are read in Russian.

**Для пресс-релиза / маркетинг:** Release updates are now easier to read in multilingual teams, with a dedicated news language selector directly in system update messages.

**Технически:** Notifications — release news language selector in mandatory update modal and `/notifications` release details.

---

## [2026-04-27] Invoice language remembered from invoice creation

**Возможность (для описания продукта):** When a manager selects an invoice language while creating an invoice, the system remembers that language on the payer/client card and uses it as the default next time.

**Для пресс-релиза / маркетинг:** Invoice creation now learns the client's preferred invoice language directly from the manager's selection.

**Технически:** Invoices / Directory — invoice language preference sync from `InvoiceCreator` to Directory.

---

## [2026-04-27] Supplier invoice matching and accounting workflow

**Возможность (для описания продукта):** Agents can match uploaded supplier invoices to real order services, mark periodic or not-required services, and see supplier invoice completeness directly in services and orders. Accountants can process supplier invoices with clear attention states when a processed invoice is changed or deleted.

**Для пресс-релиза / маркетинг:** Supplier invoice control is now connected from order services to accounting, giving teams a clear view of missing, matched, periodic, and attention-required supplier invoices.

**Технически:** Finance / Orders — supplier invoice document-service links, accounting states, services controls, `/orders` supplier invoice preview.

---

## [2026-04-25] Mandatory system update acknowledgements

**Возможность (для описания продукта):** Important system updates are shown to every manager as a required pop-up with an “I have read this” acknowledgement. Once a manager confirms the update, it will not be shown again to that same manager.

**Для пресс-релиза / маркетинг:** System release notes are now delivered as mandatory, per-user acknowledgements so every manager sees critical changes.

**Технически:** Notifications — staff_notifications system_update, release_views per-user read tracking, TopBar modal.

---

## Формат записи

```markdown
## [YYYY-MM-DD] Краткое название фичи

**Возможность (для описания продукта):** 1–2 предложения, что умеет система / что может пользователь.

**Для пресс-релиза / маркетинг:** опционально 1 предложение в стиле релиза.

**Технически:** опционально одна строка — область (Invoices, Directory, …), без деталей реализации.
```

---

## [2026-01-30] Отдельные условия оплаты при массовой выписке счетов

**Возможность (для описания продукта):** При создании нескольких счетов по одному заказу (несколько плательщиков) у каждого счета могут быть свои условия оплаты: свой депозит (в % или суммой), даты депозита и финальной оплаты. Пользователь переключается между плательщиками в форме, настраивает условия для каждого и одной кнопкой создаёт все счета с разными условиями.

**Для пресс-релиза / маркетинг:** Массовая выписка счетов с индивидуальными условиями оплаты для каждого плательщика — без дублирования действий и без потери гибкости.

**Технически:** Invoices — bulk create, payment terms per payer (InvoiceCreator).

---

## [2026-03-20] Restore to Original для отменённых услуг

**Возможность (для описания продукта):** Для услуг типа «Cancellation» нельзя повторно отменить — доступна только кнопка «Restore to Original», которая восстанавливает исходную услугу и удаляет запись об отмене.

**Для пресс-релиза / маркетинг:** Логика отмены услуг стала яснее: отменённую услугу можно только восстановить, а не отменить снова.

**Технически:** Orders — EditServiceModalNew, OrderServicesBlock, onRestoreToOriginal.

---

## [2026-03-20] Company expenses (Finance)

**Возможность (для описания продукта):** Вкладка Finance «Company expenses» для учёта расходов компании (коммунальные, страховые и т.п.), не связанных с заказами. Загрузка PDF/изображений и AI-извлечение данных, фильтры по периоду, поставщику, сумме. Только для ролей Supervisor и Finance.

**Для пресс-релиза / маркетинг:** Учёт расходов компании в одном месте — с загрузкой документов и умным распознаванием.

**Технически:** Finance — company_expense_invoices, /api/finances/company-expenses, parse endpoint.

---

## [2026-03-20] Directory: merge preview и bulk merge

**Возможность (для описания продукта):** При слиянии контактов — превью обеих карточек, чекбокс подтверждения, предупреждение о необратимости. Массовое слияние: выбор нескольких контактов чекбоксами и слияние в целевой одним действием.

**Для пресс-релиза / маркетинг:** Слияние контактов стало безопаснее — превью перед подтверждением и массовое слияние за один клик.

**Технически:** Directory — MergeContactPreview, MergeSelectedIntoModal, checkbox column.

---

## [2026-03-20] Credit invoice & refund: суммы, платёжки, Total

**Возможность (для описания продукта):** Кредитные счета (0242-C) отображают сумму как отрицательную (-€110). Платёжки возврата сохраняются с минусом; в таблице Payments возврат показывается красным. Заголовок заказа при переплате после отмены показывает «Refund due» вместо «remaining». Total (active services) учитывает отменённые с формальным кредитом: 665+(-110)+110=665. Debt для кредитного счёта корректно 0 при полном возврате.

**Для пресс-релиза / маркетинг:** Полная поддержка кредит-счетов и возвратов — суммы, платёжки и статусы отображаются корректно.

**Технически:** Invoices, Payments, Order header — negative amounts, refund due, credit invoice debt.

---

## [2026-03-20] Bulk ops на услугах в счёте

**Возможность (для описания продукта):** Массовые операции (Change Supplier, Change Payer, Change Client, Status) доступны и для услуг, уже выставленных в счёт. Чекбокс и Select All включают invoiced услуги; Create Invoice по-прежнему только для услуг без счёта.

**Для пресс-релиза / маркетинг:** Mass-edit услуг в заказе — можно менять поставщика и плательщика даже у уже выставленных в счёт услуг.

**Технически:** OrderServicesBlock — bulk ops на invoiced services, visibleServicesForBulk.
