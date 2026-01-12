'use client';

import { useState } from 'react';

interface ChecklistItem {
  id: string;
  message: string;
  actionLink?: string; // Link to fix the issue
}

export default function ChecklistPanel() {
  const [items] = useState<ChecklistItem[]>([
    {
      id: 'missing-tickets',
      message: 'Ticket Nr not entered (2 flights)',
      actionLink: '#services'
    },
    {
      id: 'payment-pending',
      message: 'Payment pending: €434',
      actionLink: '#payment'
    }
  ]);

  const handleActionClick = (link: string, e: React.MouseEvent) => {
    e.preventDefault();
    // Scroll to the relevant section
    const element = document.querySelector(link);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
        <span>⚠️</span>
        <span>Attention Required</span>
        <span className="ml-auto text-xs font-normal text-amber-700">
          ({items.length})
        </span>
      </h3>
      
      <div className="space-y-1">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.actionLink || '#'}
            onClick={(e) => item.actionLink && handleActionClick(item.actionLink, e)}
            className="block text-xs px-2 py-1.5 rounded hover:bg-amber-100 transition-colors text-gray-700 hover:text-blue-600 cursor-pointer"
          >
            {item.message}
          </a>
        ))}
      </div>
    </div>
  );
}
