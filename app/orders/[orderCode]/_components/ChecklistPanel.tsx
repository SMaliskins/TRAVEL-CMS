'use client';

import { useState } from 'react';

interface ChecklistItem {
  id: string;
  message: string;
  resolved: boolean;
}

export default function ChecklistPanel() {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: 'missing-tickets',
      message: 'Ticket Nr not entered (2 flights)',
      resolved: false
    },
    {
      id: 'payment-pending',
      message: 'Payment pending: €434',
      resolved: false
    }
  ]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, resolved: !item.resolved } : item
    ));
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
        <span>⚠️</span>
        <span>Attention Required</span>
      </h3>
      
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-xs cursor-pointer">
            <input 
              type="checkbox" 
              checked={item.resolved}
              onChange={() => toggleItem(item.id)}
              className="mt-0.5 rounded"
            />
            <span className={item.resolved ? "line-through text-gray-500" : "text-gray-700"}>
              {item.message}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
