# Add Service & Edit Service — синхронизация

**Правило:** Add Service и Edit Service — это по сути одна функция с теми же принципами.

- При изменении **AddServiceModal** — внести те же изменения в **EditServiceModalNew**
- При изменении **EditServiceModalNew** — внести те же изменения в **AddServiceModal**

## Общие принципы

1. **Flight parsing** — одинаковый UX: drop PDF/TXT/EML, Ctrl+V для вставки файла, paste text
2. **Tour parsing** — одинаковый UX: drop PDF/image, Ctrl+V для вставки файла, paste text
3. **Drag & drop** — `dropEffect = "copy"`, `onDragEnter`/`onDragLeave` для визуальной обратной связи
4. **Ctrl+V** — `onPaste` на drop zone и в textarea для вставки файлов
5. **Доступность** — `tabIndex`, `role="region"`, `aria-label` для фокуса и paste
