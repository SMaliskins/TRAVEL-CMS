"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { City, searchCities, countryCodeToFlag } from "@/lib/data/cities";

export interface CityWithCountry {
  city: string;
  country: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}

interface CityMultiSelectProps {
  selectedCities: CityWithCountry[]; // Array of city+country objects
  onChange: (cities: CityWithCountry[]) => void;
  onCountryChange?: (countries: string[]) => void; // Array of unique countries
  error?: string;
}

export default function CityMultiSelect({
  selectedCities,
  onChange,
  onCountryChange,
  error,
}: CityMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get unique countries from selected cities (preserving order of first appearance)
  const selectedCountries = useMemo(() => {
    const countries: string[] = [];
    const seen = new Set<string>();
    selectedCities.forEach((item) => {
      if (!seen.has(item.country)) {
        seen.add(item.country);
        countries.push(item.country);
      }
    });
    return countries;
  }, [selectedCities]);

  // Notify parent about country change
  useEffect(() => {
    if (onCountryChange) {
      onCountryChange(selectedCountries);
    }
  }, [selectedCountries, onCountryChange]);

  // Filter cities based on search (exclude already selected)
  const filteredCities = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) {
      return [];
    }
    const selectedCityNames = new Set(selectedCities.map((c) => c.city));
    return searchCities(searchQuery).filter(
      (city) => !selectedCityNames.has(city.name)
    );
  }, [searchQuery, selectedCities]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelectCity = (city: City) => {
    const cityWithCountry: CityWithCountry = {
      city: city.name,
      country: city.country,
      countryCode: city.countryCode,
      lat: city.lat,
      lng: city.lng,
    };
    const alreadySelected = selectedCities.some((c) => c.city === city.name);
    if (!alreadySelected) {
      onChange([...selectedCities, cityWithCountry]);
    }
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const handleRemoveCity = (cityName: string) => {
    onChange(selectedCities.filter((item) => item.city !== cityName));
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Selected cities as chips with flags */}
      {selectedCities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCities.map((item) => (
            <span
              key={item.city}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
            >
              {item.countryCode && (
                <span className="mr-0.5">{countryCodeToFlag(item.countryCode)}</span>
              )}
              {item.city}
              <button
                type="button"
                onClick={() => handleRemoveCity(item.city)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input with dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen && e.target.value.length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (searchQuery.length >= 2) setIsOpen(true);
          }}
          placeholder="Search cities..."
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-black focus:ring-black"
          }`}
        />
        {isOpen && filteredCities.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
            {filteredCities.map((city) => (
              <button
                key={`${city.name}-${city.country}`}
                type="button"
                onClick={() => handleSelectCity(city)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    <span className="mr-1.5">{countryCodeToFlag(city.countryCode)}</span>
                    {city.name}
                  </span>
                  <span className="text-xs text-gray-500">{city.country}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

