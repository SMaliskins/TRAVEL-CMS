'use client';

import { useEffect, useState, useMemo } from 'react';

interface Service {
  id: string;
  name: string;
  category: string;
  ticket_nr?: string | null;
}

interface ChecklistPanelProps {
  orderCode: string;
}

interface ChecklistItem {
  id: string;
  message: string;
  serviceId?: string;
  fieldName?: 'ticket_nr' | 'ref_nr';
}

export default function ChecklistPanel({ orderCode }: ChecklistPanelProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderCode)}/services`
        );
        if (response.ok) {
          const data = await response.json();
          setServices(data.services || []);
        }
      } catch (error) {
        console.error('Failed to fetch services for checklist:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [orderCode]);

  // Динамически генерируем список проблем из реальных данных
  const issues = useMemo(() => {
    const items: ChecklistItem[] = [];

    // Проверяем отсутствие Ticket Nr для флайтов
    const missingTickets = services.filter(
      (s) => s.category === 'Flight' && !s.ticket_nr
    );

    if (missingTickets.length > 0) {
      items.push({
        id: 'missing-tickets',
        message: `Ticket Nr not entered (${missingTickets.length} flight${missingTickets.length > 1 ? 's' : ''})`,
        serviceId: missingTickets[0].id, // First service with issue
        fieldName: 'ticket_nr',
      });
    }

    // TODO: Добавить другие проверки (Payment pending, etc.)

    return items;
  }, [services]);

  const handleActionClick = (item: ChecklistItem, e: React.MouseEvent) => {
    e.preventDefault();

    if (item.serviceId && item.fieldName) {
      // Находим строку сервиса в таблице
      const serviceRow = document.querySelector(
        `[data-service-id="${item.serviceId}"]`
      );

      if (serviceRow) {
        // Открываем Edit Modal через double-click
        const clickEvent = new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        serviceRow.dispatchEvent(clickEvent);

        // После открытия модала, фокусируем нужное поле
        setTimeout(() => {
          const fieldInput = document.querySelector<HTMLInputElement>(
            `input[name="${item.fieldName}"], input[placeholder*="Ticket"]`
          );
          if (fieldInput) {
            fieldInput.focus();
            fieldInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300); // Даем время на открытие модала
      }
    }
  };

  // Если нет проблем или загрузка — панель не отображается
  if (loading || issues.length === 0) return null;

  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
        <span>⚠️</span>
        <span>Attention Required</span>
        <span className="ml-auto text-xs font-normal text-amber-700">
          ({issues.length})
        </span>
      </h3>

      <div className="space-y-1">
        {issues.map((item) => (
          <a
            key={item.id}
            href="#"
            onClick={(e) => handleActionClick(item, e)}
            className="block text-xs px-2 py-1.5 rounded hover:bg-amber-100 transition-colors text-gray-700 hover:text-blue-600 cursor-pointer"
          >
            {item.message}
          </a>
        ))}
      </div>
    </div>
  );
}
