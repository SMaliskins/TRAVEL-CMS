"use client";

export interface HotelSuggestion {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface HotelSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  onHotelSelected?: (hotel: HotelSuggestion) => void;
  placeholder?: string;
}

export default function HotelSuggestInput({
  value,
  onChange,
  onHotelSelected,
  placeholder = "Search hotel by name...",
}: HotelSuggestInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    onHotelSelected?.({ name: v });
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
    />
  );
}
