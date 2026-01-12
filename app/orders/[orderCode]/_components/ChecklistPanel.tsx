'use client';

import { useState } from 'react';

interface ChecklistItem {
  id: string;
  message: string;
  resolved: boolean;
  actionLink?: string; // Link to fix the issue
}

export default function ChecklistPanel() {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: 'missing-tickets',
      message: 'Ticket Nr not entered (2 flights)',
      resolved: false,
      actionLink: '#services'
    },
    {
      id: 'payment-pending',
      message: 'Payment pending: €434',
      resolved: false,
      actionLink: '#payment'
    }
  ]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, resolved: !item.resolved } : item
    ));
  };

  const handleActionClick = (link: string, e: React.MouseEvent) => {
    e.preventDefault();
    // Scroll to the relevant section
    const element = document.querySelector(link);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Filter out resolved items - автоматически скрываем решенные
  const activeItems = items.filter(item => !item.resolved);

  if (activeItems.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
        <span>⚠️</span>
        <span>Attention Required</span>
        <span className="ml-auto text-xs font-normal text-amber-700">
          ({activeItems.length})
        </span>
      </h3>
      
      <div className="space-y-1">
        {activeItems.map((item) => (
          <a
            key={item.id}
            href={item.actionLink || '#'}
            onClick={(e) => item.actionLink && handleActionClick(item.actionLink, e)}
            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-amber-100 transition-colors group cursor-pointer"
          >
            <input 
              type="checkbox" 
              checked={item.resolved}
              onChange={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded cursor-pointer flex-shrink-0"
              id={`checklist-${item.id}`}
            />
            <span className="flex-1 text-gray-700 group-hover:text-blue-600 transition-colors">
              {item.message}
            </span>
            <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
              →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
