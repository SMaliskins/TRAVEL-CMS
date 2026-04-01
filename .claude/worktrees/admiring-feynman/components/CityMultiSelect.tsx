"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { City, searchCities, countryCodeToFlag, loadWorldCities } from "@/lib/data/cities";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

export interface CityWithCountry {
  city: string;
  country: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}

interface ExternalCity {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  iataCode?: string;
  source: "local" | "db" | "external";
}

interface CityMultiSelectProps {
  selectedCities: CityWithCountry[];
  onChange: (cities: CityWithCountry[]) => void;
  onCountryChange?: (countries: string[]) => void;
  error?: string;
  placeholder?: string;
}

export default function CityMultiSelect({
  selectedCities,
  onChange,
  onCountryChange,
  error,
  placeholder = "Search cities...",
}: CityMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [worldCitiesLoaded, setWorldCitiesLoaded] = useState(false);
  const [apiResults, setApiResults] = useState<ExternalCity[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    loadWorldCities().then(() => setWorldCitiesLoaded(true));
  }, []);

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

  useEffect(() => {
    if (onCountryChange) {
      onCountryChange(selectedCountries);
    }
  }, [selectedCountries, onCountryChange]);

  const filteredCities = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) {
      return [];
    }
    const selectedCityNames = new Set(selectedCities.map((c) => c.city));
    return searchCities(searchQuery).filter(
      (city) => !selectedCityNames.has(city.name)
    );
  }, [searchQuery, selectedCities, worldCitiesLoaded]);

  // API fallback: when local results are insufficient, search DB + Nominatim
  const searchApi = useCallback(async (query: string) => {
    if (query.length < 3) {
      setApiResults([]);
      return;
    }
    setApiLoading(true);
    try {
      const res = await fetchWithAuth(`/api/geo/city-search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setApiResults(data.cities || []);
      }
    } catch {
      // ignore
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (filteredCities.length >= 3 || searchQuery.length < 3) {
      setApiResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchApi(searchQuery);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, filteredCities.length, searchApi]);

  // Merge local + API results, deduplicating
  const allResults = useMemo(() => {
    const selectedCityNames = new Set(selectedCities.map((c) => c.city.toLowerCase()));
    const localAsCities: (City & { source?: string })[] = filteredCities.map((c) => ({ ...c, source: "local" }));
    const seenKeys = new Set(localAsCities.map((c) => `${c.name.toLowerCase()}|${c.countryCode.toLowerCase()}`));

    const merged = [...localAsCities];
    for (const ext of apiResults) {
      const key = `${ext.name.toLowerCase()}|${ext.countryCode.toLowerCase()}`;
      if (!seenKeys.has(key) && !selectedCityNames.has(ext.name.toLowerCase())) {
        seenKeys.add(key);
        merged.push({
          name: ext.name,
          country: ext.country,
          countryCode: ext.countryCode,
          lat: ext.lat,
          lng: ext.lng,
          iataCode: ext.iataCode,
          source: ext.source,
        });
      }
    }
    return merged;
  }, [filteredCities, apiResults, selectedCities]);

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

  const handleSelectCity = (city: City & { source?: string }) => {
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

    // Auto-save external cities to DB for future use
    if (city.source === "external" || city.source === "db") {
      fetchWithAuth("/api/geo/city-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: city.name,
          country: city.country,
          countryCode: city.countryCode,
          lat: city.lat,
          lng: city.lng,
          iataCode: city.iataCode,
        }),
      }).catch(() => {});
    }

    setSearchQuery("");
    setApiResults([]);
    inputRef.current?.focus();
  };

  const handleRemoveCity = (cityName: string) => {
    onChange(selectedCities.filter((item) => item.city !== cityName));
  };

  return (
    <div ref={containerRef} className="space-y-2">
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
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-black focus:ring-black"
          }`}
        />
        {isOpen && (allResults.length > 0 || apiLoading) && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
            {allResults.map((city) => (
              <button
                key={`${city.name}-${city.countryCode}-${city.source}`}
                type="button"
                onClick={() => handleSelectCity(city)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    <span className="mr-1.5">{countryCodeToFlag(city.countryCode)}</span>
                    {city.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {city.country}
                    {city.source === "external" && (
                      <span className="ml-1 text-blue-500" title="Found via search, will be saved">+</span>
                    )}
                  </span>
                </div>
              </button>
            ))}
            {apiLoading && (
              <div className="px-3 py-2 text-xs text-gray-400 text-center">
                Searching...
              </div>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

