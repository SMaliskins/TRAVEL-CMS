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

  const handleActionClick = (link: string) => {
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
      
      <div className="space-y-2">
        {activeItems.map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-xs">
            <input 
              type="checkbox" 
              checked={item.resolved}
              onChange={() => toggleItem(item.id)}
              className="mt-0.5 rounded cursor-pointer"
              id={`checklist-${item.id}`}
            />
            <label 
              htmlFor={`checklist-${item.id}`}
              className="flex-1 text-gray-700 cursor-pointer"
            >
              {item.message}
            </label>
            {item.actionLink && (
              <button
                onClick={() => handleActionClick(item.actionLink!)}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                Add
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
