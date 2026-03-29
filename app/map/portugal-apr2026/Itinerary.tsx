"use client";

import React, { useState } from "react";

// --- Types ---

interface Place {
  name: string;
  images: string[];
  activities: string[];
  mapsUrl: string;
}

interface Restaurant {
  name: string;
  type: string;
  price: string;
  mapsUrl: string;
}

interface Museum {
  name: string;
  note: string;
  mapsUrl: string;
}

interface Hotel {
  name: string;
  note: string;
  price: string;
  mapsUrl: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  date: string;
  color: string;
  description: string;
  places: Place[];
  restaurants?: Restaurant[];
  museums?: Museum[];
}

// --- Gallery Component ---

function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  const hasMultiple = images.length > 1;

  return (
    <div style={{ position: "relative", width: "100%", height: 200, overflow: "hidden" }}>
      <img
        src={images[idx]}
        alt={`${alt} ${idx + 1}`}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {hasMultiple && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + images.length) % images.length); }}
            style={{
              position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
              width: 28, height: 28, borderRadius: "50%", border: "none",
              background: "rgba(0,0,0,0.45)", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}
            aria-label="Previous"
          >
            &#8249;
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % images.length); }}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              width: 28, height: 28, borderRadius: "50%", border: "none",
              background: "rgba(0,0,0,0.45)", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}
            aria-label="Next"
          >
            &#8250;
          </button>
          <div style={{
            position: "absolute", bottom: 6, right: 8,
            background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 11,
            padding: "1px 7px", borderRadius: 10,
          }}>
            {idx + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

// --- Link icon ---

function MapLink({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      <span style={{ fontSize: 13 }}>&#x1F4CD;</span> {label || "Maps"}
    </a>
  );
}

// --- Data ---

// Unsplash source API — always returns a relevant photo by keyword
function img(query: string, idx = 0): string {
  return `https://source.unsplash.com/800x500/?${encodeURIComponent(query)}&sig=${idx}`;
}

const LISBON_HOTELS: Hotel[] = [
  { name: "Four Seasons Ritz Lisbon", note: "Legendary luxury, art collection, Michelin CURA restaurant, Parque Eduardo VII views", price: "~900-1300 EUR/night", mapsUrl: "https://maps.google.com/?q=Four+Seasons+Hotel+Ritz+Lisbon" },
  { name: "Pestana Palace Lisboa", note: "19th-century palace, rococo ceilings, 2 pools, gardens — National Monument. Belem area", price: "~250-400 EUR/night", mapsUrl: "https://maps.google.com/?q=Pestana+Palace+Lisboa" },
  { name: "Olissippo Lapa Palace", note: "Hilltop palace overlooking Tagus, subtropical gardens, indoor+outdoor pools", price: "~300-500 EUR/night", mapsUrl: "https://maps.google.com/?q=Olissippo+Lapa+Palace+Lisbon" },
  { name: "Bairro Alto Hotel", note: "Boutique 5*, rooftop BAHR bar, Chiado location, Tagus views", price: "~350-500 EUR/night", mapsUrl: "https://maps.google.com/?q=Bairro+Alto+Hotel+Lisbon" },
  { name: "Valverde Lisboa", note: "Relais & Chateaux on Av. da Liberdade, intimate garden courtyard", price: "~300-450 EUR/night", mapsUrl: "https://maps.google.com/?q=Valverde+Hotel+Lisbon" },
];

const ALGARVE_HOTELS: Hotel[] = [
  { name: "Cascade Wellness Resort", note: "Clifftop near Ponta da Piedade, spa, 3 restaurants, ocean pool", price: "~150-320 EUR/night", mapsUrl: "https://maps.google.com/?q=Cascade+Wellness+Resort+Lagos" },
  { name: "Palmares Beach House Hotel", note: "Adults-only boutique, 20 rooms, 180° Atlantic views, golf", price: "~200-350 EUR/night", mapsUrl: "https://maps.google.com/?q=Palmares+Beach+House+Hotel+Lagos" },
  { name: "Casa Mae Lagos", note: "Restored 19th-c manor in Old Town, farm-to-table restaurant, rooftop pool", price: "~200-350 EUR/night", mapsUrl: "https://maps.google.com/?q=Casa+Mae+Lagos+Portugal" },
  { name: "Iberostar Selection Lagos", note: "Beachfront Meia Praia, 4 pools, panoramic spa, suites with private pools", price: "~180-300 EUR/night", mapsUrl: "https://maps.google.com/?q=Iberostar+Selection+Lagos+Algarve" },
];

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
        images: [
          img("lisbon baixa praca comercio", 1),
          img("lisbon chiado street", 2),
          img("lisbon rua augusta arch", 3),
        ],
        activities: ["Rua Augusta", "Praca do Comercio", "Elevador de Santa Justa"],
        mapsUrl: "https://maps.google.com/?q=Praca+do+Comercio+Lisbon",
      },
      {
        name: "MAAT — Museum of Art & Technology",
        images: [
          img("MAAT museum lisbon", 1),
          img("MAAT lisbon architecture", 2),
        ],
        activities: ["Contemporary art", "Architecture by AL_A", "Free rooftop walk"],
        mapsUrl: "https://maps.google.com/?q=MAAT+Museum+Lisbon",
      },
    ],
    restaurants: [
      { name: "Taberna da Rua das Flores", type: "Tapas tasca, chalkboard menu", price: "€", mapsUrl: "https://maps.google.com/?q=Taberna+da+Rua+das+Flores+103+Lisbon" },
      { name: "O Velho Eurico", type: "Neo-tasca, elevated Portuguese", price: "€€", mapsUrl: "https://maps.google.com/?q=O+Velho+Eurico+Lisbon" },
      { name: "Belcanto", type: "2 Michelin stars, Chef Jose Avillez", price: "€€€", mapsUrl: "https://maps.google.com/?q=Belcanto+Lisbon" },
    ],
    museums: [
      { name: "MUDE — Museu do Design e da Moda", note: "500+ design/fashion pieces, Dior to Philippe Starck", mapsUrl: "https://maps.google.com/?q=MUDE+Museu+do+Design+e+da+Moda+Lisbon" },
      { name: "MNAC — Museu Nacional de Arte Contemporanea", note: "Portuguese Romanticism & Modernism, Chiado", mapsUrl: "https://maps.google.com/?q=MNAC+Museu+Nacional+Arte+Contemporanea+Chiado+Lisbon" },
    ],
  },
  {
    day: 2,
    title: "Belem & Alfama",
    date: "Fri, Apr 4",
    color: "#3b82f6",
    description: "Утро в Белене — главные достопримечательности Лиссабона. Вечер в Алфаме — старейший район, фаду и смотровые площадки.",
    places: [
      {
        name: "Torre de Belem & Jeronimos",
        images: [
          img("torre belem lisbon", 1),
          img("jeronimos monastery lisbon", 2),
          img("pasteis belem lisbon", 3),
        ],
        activities: ["UNESCO tower", "Mosteiro dos Jeronimos", "Pasteis de Belem"],
        mapsUrl: "https://maps.google.com/?q=Torre+de+Belem+Lisbon",
      },
      {
        name: "Alfama & Tram 28",
        images: [
          img("lisbon tram 28 alfama", 1),
          img("alfama lisbon rooftops", 2),
        ],
        activities: ["Tram 28 ride", "Miradouros", "Fado restaurant"],
        mapsUrl: "https://maps.google.com/?q=Alfama+Lisbon",
      },
    ],
    restaurants: [
      { name: "Cervejaria Ramiro", type: "Legendary seafood hall since 1950s, tiger prawns", price: "€€", mapsUrl: "https://maps.google.com/?q=Cervejaria+Ramiro+Lisbon" },
      { name: "Alma (Henrique Sa Pessoa)", type: "2 Michelin stars, Portuguese-Asian fusion", price: "€€€", mapsUrl: "https://maps.google.com/?q=Alma+restaurant+Lisbon+Chiado" },
      { name: "Frade dos Mares", type: "Stylish seafood, generous portions", price: "€€", mapsUrl: "https://maps.google.com/?q=Frade+dos+Mares+Lisbon" },
    ],
    museums: [
      { name: "Museu Nacional de Arte Antiga", note: "Old Masters, Bosch triptych, Japanese screens", mapsUrl: "https://maps.google.com/?q=Museu+Nacional+de+Arte+Antiga+Lisbon" },
      { name: "Museu Berardo (Belem)", note: "Warhol, Picasso, Dali — free entry!", mapsUrl: "https://maps.google.com/?q=Museu+Berardo+Belem+Lisbon" },
      { name: "MACAM — Museu de Arte Contemporanea", note: "Museum-hotel, 600+ works, Abramovic & Eliasson", mapsUrl: "https://maps.google.com/?q=MACAM+Rua+da+Junqueira+66+Lisbon" },
      { name: "Atelier-Museu Julio Pomar", note: "Intimate museum designed by Alvaro Siza Vieira", mapsUrl: "https://maps.google.com/?q=Atelier+Museu+Julio+Pomar+Lisbon" },
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
        images: [
          img("pena palace sintra", 1),
          img("sintra palace colorful", 2),
          img("quinta regaleira sintra", 3),
        ],
        activities: ["Pena Palace", "Castelo dos Mouros", "Quinta da Regaleira"],
        mapsUrl: "https://maps.google.com/?q=Palacio+da+Pena+Sintra",
      },
      {
        name: "Cascais",
        images: [
          img("cascais portugal beach", 1),
          img("cascais harbor portugal", 2),
        ],
        activities: ["Beach promenade", "Boca do Inferno", "Seafood dinner"],
        mapsUrl: "https://maps.google.com/?q=Cascais+Portugal",
      },
    ],
  },
  {
    day: 4,
    title: "Transfer to Algarve",
    date: "Sun, Apr 6",
    color: "#06b6d4",
    description: "Утро — Time Out Market и музеи. После обеда — переезд на юг в Алгарве (~3 часа на машине).",
    places: [
      {
        name: "Lisbon last morning",
        images: [
          img("time out market lisbon", 1),
        ],
        activities: ["Time Out Market", "Drive south via A2", "Check into Lagos"],
        mapsUrl: "https://maps.google.com/?q=Time+Out+Market+Lisbon",
      },
    ],
    restaurants: [
      { name: "SEM", type: "Nordic-inspired, zero-waste 7-course tasting", price: "€€", mapsUrl: "https://maps.google.com/?q=SEM+restaurant+Lisbon" },
      { name: "Arkhe", type: "Fine-dining vegetarian, seasonal tasting menus", price: "€€", mapsUrl: "https://maps.google.com/?q=Arkhe+restaurant+Lisbon" },
    ],
    museums: [
      { name: "Museu Nacional do Azulejo", note: "Portuguese tile art, 16th-c monastery — unique in Europe", mapsUrl: "https://maps.google.com/?q=Museu+Nacional+do+Azulejo+Lisbon" },
      { name: "Gulbenkian — Great Works exhibition", note: "200 masterpieces (April-Sep 2026), modern art center", mapsUrl: "https://maps.google.com/?q=Museu+Calouste+Gulbenkian+Lisbon" },
      { name: "Culturgest", note: "1,800 works: painting, sculpture, photography, video — less touristy", mapsUrl: "https://maps.google.com/?q=Culturgest+Lisbon" },
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
        images: [
          img("lagos portugal beach", 1),
          img("lagos algarve old town", 2),
        ],
        activities: ["Praia do Camilo", "Old town", "Meia Praia beach"],
        mapsUrl: "https://maps.google.com/?q=Lagos+Portugal",
      },
      {
        name: "Ponta da Piedade",
        images: [
          img("ponta da piedade cliffs", 1),
          img("ponta piedade lagos boat", 2),
        ],
        activities: ["Cliff formations", "Boat tour", "Sunset views"],
        mapsUrl: "https://maps.google.com/?q=Ponta+da+Piedade+Lagos",
      },
    ],
    restaurants: [
      { name: "Al Sud", type: "1 Michelin star, 10-course tasting, Lagos Bay views", price: "€€€", mapsUrl: "https://maps.google.com/?q=Al+Sud+Palmares+Lagos+Portugal" },
      { name: "Restaurante dos Artistas", type: "Fine dining in 250-year-old building", price: "€€€", mapsUrl: "https://maps.google.com/?q=Restaurante+dos+Artistas+Lagos" },
      { name: "Don Sebastiao", type: "Traditional Portuguese since 1979, grilled fish", price: "€€", mapsUrl: "https://maps.google.com/?q=Don+Sebastiao+Lagos" },
      { name: "Casinha do Petisco", type: "Legendary cataplana (seafood stew), family-run", price: "€€", mapsUrl: "https://maps.google.com/?q=Casinha+do+Petisco+Lagos" },
      { name: "A Petisqueira", type: "Wine bar, gourmet tapas, smoked codfish", price: "€", mapsUrl: "https://maps.google.com/?q=A+Petisqueira+Lagos" },
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
        images: [
          img("praia da marinha algarve", 1),
          img("marinha beach cliffs portugal", 2),
        ],
        activities: ["Beach day", "Seven Hanging Valleys trail", "Cliff views"],
        mapsUrl: "https://maps.google.com/?q=Praia+da+Marinha+Algarve",
      },
      {
        name: "Benagil Cave",
        images: [
          img("benagil cave algarve", 1),
          img("benagil sea cave portugal", 2),
        ],
        activities: ["Boat tour to sea cave", "Kayak option", "Beach swim"],
        mapsUrl: "https://maps.google.com/?q=Benagil+Cave+Algarve",
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
        images: [img("lisbon airport departure", 1)],
        activities: ["Check out", "Drive via A2", "Flight BT 676 at 16:15"],
        mapsUrl: "https://maps.google.com/?q=Lisbon+Airport",
      },
    ],
  },
];

// --- Component ---

function PlaceCard({ place }: { place: Place }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
      <ImageGallery images={place.images} alt={place.name} />
      <div style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{place.name}</div>
          <MapLink url={place.mapsUrl} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {place.activities.map((a) => (
            <span key={a} style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RestaurantList({ restaurants }: { restaurants: Restaurant[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Restaurants</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {restaurants.map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: "#6b7280" }}>{r.type}</span>
            <span style={{ color: "#f59e0b", fontWeight: 600, whiteSpace: "nowrap" }}>{r.price}</span>
            <MapLink url={r.mapsUrl} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MuseumList({ museums }: { museums: Museum[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Art museums</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {museums.map((m) => (
          <div key={m.name} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>{m.name}</span>
            <span style={{ color: "#6b7280" }}>{m.note}</span>
            <MapLink url={m.mapsUrl} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HotelSection({ title, hotels }: { title: string; hotels: Hotel[] }) {
  return (
    <div style={{ marginBottom: 32, paddingLeft: 20, borderLeft: "4px solid #10b981" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10b981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>
          &#9733;
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {hotels.map((h) => (
          <div key={h.name} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{h.name}</span>
              <span style={{ color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>{h.price}</span>
            </div>
            <div style={{ color: "#6b7280", marginTop: 2 }}>{h.note}</div>
            <MapLink url={h.mapsUrl} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Itinerary() {
  return (
    <div style={{ padding: "24px 16px 48px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
        Portugal — Apr 3-10, 2026
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>
        RIX &rarr; LIS &middot; BT 675/676 &middot; 4 pax &middot; 7 nights
      </p>

      {/* Hotels — Lisbon */}
      <HotelSection title="5* Hotels — Lisbon" hotels={LISBON_HOTELS} />

      {/* Itinerary days */}
      {ITINERARY.map((day) => (
        <div key={day.day} style={{ marginBottom: 32, borderLeft: `4px solid ${day.color}`, paddingLeft: 20 }}>
          {/* Day header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: day.color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>
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

          {/* Place cards with gallery */}
          <div style={{ display: "grid", gridTemplateColumns: day.places.length === 1 ? "1fr" : "1fr 1fr", gap: 12 }}>
            {day.places.map((place) => <PlaceCard key={place.name} place={place} />)}
          </div>

          {/* Museums */}
          {day.museums && day.museums.length > 0 && <MuseumList museums={day.museums} />}

          {/* Restaurants */}
          {day.restaurants && day.restaurants.length > 0 && <RestaurantList restaurants={day.restaurants} />}

          {/* Hotels hint after Day 4 for Algarve */}
          {day.day === 5 && (
            <div style={{ marginTop: 16 }}>
              <HotelSection title="5* Hotels — Lagos / Algarve" hotels={ALGARVE_HOTELS} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
