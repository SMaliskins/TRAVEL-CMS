'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface DirectoryItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  roles: string[];
}

interface DirectoryComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  filter?: (item: DirectoryItem) => boolean;
  allowEmpty?: boolean;
  required?: boolean;
  className?: string;
}

export default function DirectoryCombobox({
  value,
  onChange,
  placeholder = 'Select contact...',
  filter,
  allowEmpty = false,
  required = false,
  className = ''
}: DirectoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [directoryItems, setDirectoryItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch directory on mount
  useState(() => {
    const fetchDirectory = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/directory');
        if (response.ok) {
          const data = await response.json();
          setDirectoryItems(data);
        }
      } catch (error) {
        console.error('Failed to fetch directory:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDirectory();
  });

  const filteredItems = useMemo(() => {
    let items = directoryItems || [];

    // Apply role filter
    if (filter) {
      items = items.filter(filter);
    }

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.email?.toLowerCase().includes(searchLower)
      );
    }

    return items;
  }, [directoryItems, filter, search]);

  const selectedItem = directoryItems?.find((item) => item.id === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
          !value && 'text-gray-400'
        }`}
      >
        <span className="truncate">
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] flex flex-col">
            {/* Search input */}
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No results found.
                </div>
              ) : (
                <>
                  {allowEmpty && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(null);
                        setOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm text-gray-400"
                    >
                      — Not selected —
                    </button>
                  )}
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2"
                    >
                      <Check
                        className={`h-4 w-4 flex-shrink-0 ${
                          value === item.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item.name}
                        </div>
                        {item.email && (
                          <div className="text-xs text-gray-500 truncate">
                            {item.email}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
