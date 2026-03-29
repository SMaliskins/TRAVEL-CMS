"use client";

import React from "react";

interface ItineraryDay {
  day: number;
  title: string;
  date: string;
  color: string;
  description: string;
  places: {
    name: string;
    image: string;
    activities: string[];
  }[];
}

const ITINERARY: ItineraryDay[] = [
  {
    day: 1,
    title: "Arrival in Lisbon",
    date: "Thu, Apr 3",
    color: "#6366f1",
    description: "Прилёт в 15:30. Заселение в отель, вечерняя прогулка по историческому центру. Ужин с видом на город.",
    places: [
      {
        name: "Baixa & Chiado",
        image: "https://images.unsplash.com/photo-1524928872228-9b284de342b3?w=600&q=80",
        activities: ["Rua Augusta", "Praca do Comercio", "Elevador de Santa Justa"],
      },
      {
        name: "MAAT — Museum of Art & Technology",
        image: "https://images.unsplash.com/photo-1574958269340-fa927503f3dd?w=600&q=80",
        activities: ["Contemporary art", "Architecture by AL_A", "Free rooftop walk"],
      },
    ],
  },
  {
    day: 2,
    title: "Belem & Alfama",
    date: "Fri, Apr 4",
    color: "#3b82f6",
    description: "Утро в Белене — главные достопримечательности Лиссабона. Вечер в Алфаме — старейший район, фаду и смотровые площадки. Опционально: музеи искусства.",
    places: [
      {
        name: "Torre de Belem",
        image: "https://images.unsplash.com/photo-1578742738196-23802b351ae7?w=600&q=80",
        activities: ["UNESCO tower", "Mosteiro dos Jeronimos", "Pasteis de Belem"],
      },
      {
        name: "Alfama & Tram 28",
        image: "https://images.unsplash.com/photo-1521194341482-ac6075ae5f7c?w=600&q=80",
        activities: ["Tram 28 ride", "Miradouros", "Fado restaurant"],
      },
      {
        name: "Museu Nacional de Arte Antiga",
        image: "https://images.unsplash.com/photo-1578301978693-85fa9fd0c499?w=600&q=80",
        activities: ["Old Masters collection", "Bosch triptych", "Japanese screens", "Garden cafe"],
      },
      {
        name: "Museu Berardo (Belem)",
        image: "https://images.unsplash.com/photo-1564399263809-d2e6f6f06b76?w=600&q=80",
        activities: ["Warhol, Picasso, Dali", "Modern & contemporary art", "Free entry"],
      },
    ],
  },
  {
    day: 3,
    title: "Sintra & Cascais",
    date: "Sat, Apr 5",
    color: "#8b5cf6",
    description: "Дейтрип на электричке (40 мин). Сказочные дворцы Синтры, затем пляжный городок Кашкайш на обратном пути.",
    places: [
      {
        name: "Palacio da Pena",
        image: "https://images.unsplash.com/photo-1562195168-c82fea0f0953?w=600&q=80",
        activities: ["Pena Palace", "Castelo dos Mouros", "Quinta da Regaleira"],
      },
      {
        name: "Cascais",
        image: "https://images.unsplash.com/photo-1615672337780-6e19a28a5b39?w=600&q=80",
        activities: ["Beach promenade", "Boca do Inferno", "Seafood dinner"],
      },
    ],
  },
  {
    day: 4,
    title: "Transfer to Algarve",
    date: "Sun, Apr 6",
    color: "#06b6d4",
    description: "Утро — Time Out Market и последний взгляд на Лиссабон. Опция: Museu Nacional do Azulejo (плитка!). После обеда — переезд на юг в Алгарве (~3 часа на машине).",
    places: [
      {
        name: "Lisbon → Algarve",
        image: "https://images.unsplash.com/photo-1524928872228-9b284de342b3?w=600&q=80",
        activities: ["Time Out Market", "Drive south via A2", "Check into Lagos"],
      },
      {
        name: "Museu Nacional do Azulejo",
        image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80",
        activities: ["Portuguese tile art", "16th century monastery", "Unique in Europe"],
      },
    ],
  },
  {
    day: 5,
    title: "Lagos & Ponta da Piedade",
    date: "Mon-Wed, Apr 7-9",
    color: "#f59e0b",
    description: "База в Лагуше. Невероятные скалы Понта-да-Пьедаде, старый город, лодочные туры. Лучшие пляжи Европы.",
    places: [
      {
        name: "Lagos",
        image: "https://images.unsplash.com/photo-1608649944716-228404a0a8bb?w=600&q=80",
        activities: ["Praia do Camilo", "Old town", "Seafood restaurants"],
      },
      {
        name: "Ponta da Piedade",
        image: "https://images.unsplash.com/photo-1608649944716-228404a0a8bb?w=600&q=80",
        activities: ["Cliff formations", "Boat tour", "Sunset views"],
      },
    ],
  },
  {
    day: 6,
    title: "Marinha & Benagil",
    date: "Mon-Wed, Apr 7-9",
    color: "#f59e0b",
    description: "Пляжный день: Прайя-да-Маринья (топ-10 пляжей мира) и морская пещера Бенагил — визитная карточка Алгарве.",
    places: [
      {
        name: "Praia da Marinha",
        image: "https://images.unsplash.com/photo-1591264786838-6acdff391890?w=600&q=80",
        activities: ["Beach day", "Seven Hanging Valleys trail", "Cliff views"],
      },
      {
        name: "Benagil Cave",
        image: "https://images.unsplash.com/photo-1676637184625-340d3c11c4f0?w=600&q=80",
        activities: ["Boat tour to sea cave", "Kayak option", "Beach swim"],
      },
    ],
  },
  {
    day: 8,
    title: "Return & Departure",
    date: "Thu, Apr 10",
    color: "#ef4444",
    description: "Утром выезд из Алгарве обратно в Лиссабон (~3ч). Вылет BT 676 в 16:15, прилёт в Ригу 22:30.",
    places: [
      {
        name: "Drive to Lisbon",
        image: "https://images.unsplash.com/photo-1524928872228-9b284de342b3?w=600&q=80",
        activities: ["Check out", "Drive via A2", "Flight BT 676 at 16:15"],
      },
    ],
  },
];

export default function Itinerary() {
  return (
    <div style={{ padding: "24px 16px 48px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
        Portugal — Apr 3-10, 2026
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>
        RIX → LIS &middot; BT 675/676 &middot; 4 pax &middot; 7 nights
      </p>

      {ITINERARY.map((day) => (
        <div
          key={day.day}
          style={{
            marginBottom: 32,
            borderLeft: `4px solid ${day.color}`,
            paddingLeft: 20,
          }}
        >
          {/* Day header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: day.color,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {day.day <= 4 ? day.day : day.day <= 7 ? "5+" : "8"}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{day.title}</div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>{day.date}</div>
            </div>
          </div>

          {/* Description */}
          <p style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
            {day.description}
          </p>

          {/* Photo cards grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: day.places.length === 1 ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            {day.places.map((place) => (
              <div
                key={place.name}
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <img
                  src={place.image}
                  alt={place.name}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                    {place.name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {place.activities.map((a) => (
                      <span
                        key={a}
                        style={{
                          fontSize: 11,
                          background: "#f3f4f6",
                          color: "#6b7280",
                          padding: "2px 8px",
                          borderRadius: 99,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
