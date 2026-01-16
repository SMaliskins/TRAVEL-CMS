# TASK: Booking.com API Integration — Smart Pricing System

**Task ID:** BOOK1  
**Created:** 2026-01-12  
**Priority:** 🔴 HIGH  
**Complexity:** 🔴 Complex  

---

## 📋 BUSINESS REQUIREMENTS

### Цель
Создать систему сравнения цен для определения **Smart Price**:
- Сравнение цен от наших поставщиков с ценами Booking.com
- Формула: `Smart Price = max(Our Best Price, min(Booking Price, ...))`
- **Правило:** Не дороже чем на Booking.com, но не дешевле нашей лучшей цены

### Функциональность
1. **Поиск отелей** — по городу, датам, количеству гостей
2. **Получение цен** — актуальные цены на номера
3. **Доступность номеров** — какие номера свободны
4. **Детали отеля** — описание, фото, удобства (для обогащения нашей системы)
5. **Сравнение цен** — UI для отображения: наша цена vs Booking.com
6. **Расширяемость** — архитектура должна поддерживать добавление других поставщиков

### Хранение данных
- ❌ **Не нужна таблица** для хранения отелей/цен/кэша
- ✅ Данные запрашиваются в реальном времени

---

## 🔧 TECHNICAL SPECIFICATION

### 1. Booking.com API Client

**Путь:** `lib/booking/`

```
lib/booking/
  ├── client.ts           # API клиент
  ├── types.ts            # TypeScript типы
  └── config.ts           # Конфигурация
```

#### 1.1 Types (`lib/booking/types.ts`)

```typescript
// Hotel search request
export interface HotelSearchRequest {
  city: string;           // Название города или destination_id
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;       // YYYY-MM-DD
  adults: number;         // Количество взрослых
  rooms?: number;         // Количество комнат (default: 1)
  children?: number[];    // Возраст детей
  currency?: string;      // EUR, USD, etc.
}

// Hotel from search results
export interface BookingHotel {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  starRating: number;
  reviewScore: number;
  reviewCount: number;
  latitude: number;
  longitude: number;
  mainPhoto: string;
  photos: string[];
  priceFrom: number;
  currency: string;
  amenities: string[];
}

// Room availability
export interface BookingRoom {
  id: string;
  name: string;
  description: string;
  maxOccupancy: number;
  bedType: string;
  price: number;
  originalPrice?: number;  // Если есть скидка
  currency: string;
  breakfast: boolean;
  cancellation: 'free' | 'non_refundable' | 'partial';
  cancellationDeadline?: string;
  available: boolean;
  remainingRooms?: number;
}

// Full hotel details
export interface BookingHotelDetails extends BookingHotel {
  description: string;
  checkInTime: string;
  checkOutTime: string;
  facilities: BookingFacility[];
  policies: BookingPolicy[];
  rooms: BookingRoom[];
}

export interface BookingFacility {
  id: string;
  name: string;
  category: string;
}

export interface BookingPolicy {
  type: string;
  description: string;
}

// API Response wrapper
export interface BookingAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    totalResults?: number;
    page?: number;
    pageSize?: number;
  };
}
```

#### 1.2 Config (`lib/booking/config.ts`)

```typescript
export const BOOKING_CONFIG = {
  // API endpoints (Booking.com Connectivity API)
  baseUrl: process.env.BOOKING_API_URL || 'https://distribution-xml.booking.com/2.10',
  
  // Authentication (token-based as of 2026)
  username: process.env.BOOKING_API_USERNAME,
  password: process.env.BOOKING_API_PASSWORD,
  
  // Defaults
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
  
  // Rate limiting
  maxRequestsPerSecond: 10,
  timeout: 30000, // 30 seconds
};

export function getBookingAuth(): string {
  const { username, password } = BOOKING_CONFIG;
  if (!username || !password) {
    throw new Error('Booking.com API credentials not configured');
  }
  return Buffer.from(`${username}:${password}`).toString('base64');
}
```

#### 1.3 Client (`lib/booking/client.ts`)

```typescript
import { BOOKING_CONFIG, getBookingAuth } from './config';
import type {
  HotelSearchRequest,
  BookingHotel,
  BookingHotelDetails,
  BookingRoom,
  BookingAPIResponse,
} from './types';

/**
 * Booking.com API Client
 */
export class BookingClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = BOOKING_CONFIG.baseUrl;
    this.timeout = BOOKING_CONFIG.timeout;
  }

  /**
   * Make authenticated request to Booking.com API
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string | number>
  ): Promise<BookingAPIResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${getBookingAuth()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Booking.com API error:', errorData);
        return {
          success: false,
          error: errorData.message || `API error: ${response.status}`,
        };
      }

      const data = await response.json();
      return { success: true, data };

    } catch (err) {
      console.error('Booking.com request error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Request failed',
      };
    }
  }

  /**
   * Search hotels by city and dates
   */
  async searchHotels(request: HotelSearchRequest): Promise<BookingAPIResponse<BookingHotel[]>> {
    // Implementation will depend on exact Booking.com API structure
    return this.request('/json/hotels', {
      city: request.city,
      checkin: request.checkIn,
      checkout: request.checkOut,
      guest_qty: request.adults,
      room_qty: request.rooms || 1,
      currency: request.currency || BOOKING_CONFIG.defaultCurrency,
    });
  }

  /**
   * Get hotel details with rooms and prices
   */
  async getHotelDetails(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    adults: number
  ): Promise<BookingAPIResponse<BookingHotelDetails>> {
    return this.request(`/json/hotels/${hotelId}`, {
      checkin: checkIn,
      checkout: checkOut,
      guest_qty: adults,
    });
  }

  /**
   * Get room availability and prices for specific hotel
   */
  async getRoomAvailability(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    adults: number
  ): Promise<BookingAPIResponse<BookingRoom[]>> {
    return this.request(`/json/hotelAvailability`, {
      hotel_ids: hotelId,
      checkin: checkIn,
      checkout: checkOut,
      guest_qty: adults,
    });
  }
}

// Singleton instance
export const bookingClient = new BookingClient();
```

---

### 2. Smart Pricing Logic

**Путь:** `lib/pricing/smartPrice.ts`

```typescript
export interface PriceSource {
  provider: string;        // 'booking.com', 'our_supplier', 'expedia', etc.
  price: number;
  currency: string;
  isAvailable: boolean;
  roomType?: string;
  breakfast?: boolean;
}

export interface SmartPriceResult {
  recommendedPrice: number;      // Smart Price
  ourBestPrice: number;          // Наша лучшая цена
  bookingPrice: number | null;   // Цена Booking.com
  margin: number;                // Маржа в %
  priceAdvice: 'optimal' | 'too_high' | 'too_low';
  allPrices: PriceSource[];
}

/**
 * Calculate Smart Price
 * 
 * Правило: Не дороже Booking.com, но не дешевле нашей лучшей цены
 */
export function calculateSmartPrice(
  ourBestPrice: number,
  competitorPrices: PriceSource[]
): SmartPriceResult {
  const bookingSource = competitorPrices.find(p => p.provider === 'booking.com');
  const bookingPrice = bookingSource?.price || null;
  
  // Находим минимальную цену конкурентов
  const minCompetitorPrice = competitorPrices
    .filter(p => p.isAvailable && p.price > 0)
    .reduce((min, p) => Math.min(min, p.price), Infinity);
  
  // Smart Price = max(наша лучшая, min(конкуренты))
  let recommendedPrice: number;
  let priceAdvice: 'optimal' | 'too_high' | 'too_low';
  
  if (minCompetitorPrice === Infinity) {
    // Нет данных от конкурентов — используем нашу цену
    recommendedPrice = ourBestPrice;
    priceAdvice = 'optimal';
  } else if (ourBestPrice >= minCompetitorPrice) {
    // Наша цена выше или равна конкурентам — продаём по нашей
    recommendedPrice = ourBestPrice;
    priceAdvice = 'too_high'; // Предупреждение: цена выше рынка
  } else {
    // Наша цена ниже — можем поднять до уровня конкурентов
    recommendedPrice = minCompetitorPrice;
    priceAdvice = 'optimal';
  }
  
  // Если цена выше Booking — предупреждаем
  if (bookingPrice && recommendedPrice > bookingPrice) {
    recommendedPrice = bookingPrice;
    priceAdvice = 'optimal'; // Выровняли по Booking
  }
  
  // Вычисляем маржу
  const margin = ourBestPrice > 0 
    ? ((recommendedPrice - ourBestPrice) / ourBestPrice) * 100 
    : 0;
  
  return {
    recommendedPrice,
    ourBestPrice,
    bookingPrice,
    margin: Math.round(margin * 100) / 100,
    priceAdvice,
    allPrices: [
      { provider: 'our_best', price: ourBestPrice, currency: 'EUR', isAvailable: true },
      ...competitorPrices,
    ],
  };
}
```

---

### 3. API Routes

**Путь:** `app/api/booking/`

#### 3.1 Search Hotels (`app/api/booking/search/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { bookingClient } from '@/lib/booking/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { city, checkIn, checkOut, adults, rooms, currency } = body;

    // Validation
    if (!city || !checkIn || !checkOut || !adults) {
      return NextResponse.json(
        { error: 'Missing required fields: city, checkIn, checkOut, adults' },
        { status: 400 }
      );
    }

    const result = await bookingClient.searchHotels({
      city,
      checkIn,
      checkOut,
      adults,
      rooms,
      currency,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ hotels: result.data });

  } catch (err) {
    console.error('Booking search error:', err);
    return NextResponse.json(
      { error: 'Failed to search hotels' },
      { status: 500 }
    );
  }
}
```

#### 3.2 Hotel Details (`app/api/booking/hotel/[hotelId]/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { bookingClient } from '@/lib/booking/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { hotelId: string } }
) {
  const { hotelId } = params;
  const { searchParams } = new URL(request.url);
  
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const adults = parseInt(searchParams.get('adults') || '2');

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { error: 'Missing required: checkIn, checkOut' },
      { status: 400 }
    );
  }

  const result = await bookingClient.getHotelDetails(
    hotelId,
    checkIn,
    checkOut,
    adults
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ hotel: result.data });
}
```

#### 3.3 Price Comparison (`app/api/booking/compare/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { bookingClient } from '@/lib/booking/client';
import { calculateSmartPrice, PriceSource } from '@/lib/pricing/smartPrice';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hotelId, checkIn, checkOut, adults, ourBestPrice } = body;

    // Get Booking.com prices
    const result = await bookingClient.getRoomAvailability(
      hotelId,
      checkIn,
      checkOut,
      adults
    );

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Find cheapest available room
    const cheapestRoom = result.data
      .filter(r => r.available)
      .sort((a, b) => a.price - b.price)[0];

    const competitorPrices: PriceSource[] = [];
    
    if (cheapestRoom) {
      competitorPrices.push({
        provider: 'booking.com',
        price: cheapestRoom.price,
        currency: cheapestRoom.currency,
        isAvailable: true,
        roomType: cheapestRoom.name,
        breakfast: cheapestRoom.breakfast,
      });
    }

    // Calculate Smart Price
    const smartPrice = calculateSmartPrice(ourBestPrice, competitorPrices);

    return NextResponse.json({
      smartPrice,
      bookingRooms: result.data,
    });

  } catch (err) {
    console.error('Price comparison error:', err);
    return NextResponse.json(
      { error: 'Failed to compare prices' },
      { status: 500 }
    );
  }
}
```

---

### 4. UI Components

**Путь:** `components/HotelCompare/`

#### 4.1 Component Structure

```
components/HotelCompare/
  ├── HotelSearchForm.tsx      # Форма поиска отелей
  ├── HotelCard.tsx            # Карточка отеля
  ├── RoomCard.tsx             # Карточка номера
  ├── PriceComparison.tsx      # Панель сравнения цен
  ├── SmartPriceTag.tsx        # Badge с Smart Price
  └── index.ts                 # Exports
```

#### 4.2 PriceComparison Component

```tsx
// Компонент отображает сравнение цен:
// [Наша цена: €150] [Booking.com: €180] [Smart Price: €175 ✓]
```

#### 4.3 SmartPriceTag Component

```tsx
// Цветовая индикация:
// 🟢 optimal — Smart Price в норме
// 🟡 too_high — Наша цена выше рынка (предупреждение)
// 🔴 too_low — Продаём себе в убыток
```

---

### 5. Environment Variables

Добавить в `.env`:

```env
# Booking.com API Credentials
BOOKING_API_URL=https://distribution-xml.booking.com/2.10
BOOKING_API_USERNAME=your_username
BOOKING_API_PASSWORD=your_password
```

---

## 📁 FILES TO CREATE

```
lib/
  booking/
    client.ts              ← NEW
    types.ts               ← NEW
    config.ts              ← NEW
  pricing/
    smartPrice.ts          ← NEW

app/api/
  booking/
    search/
      route.ts             ← NEW
    hotel/
      [hotelId]/
        route.ts           ← NEW
        availability/
          route.ts         ← NEW
    compare/
      route.ts             ← NEW

components/
  HotelCompare/
    HotelSearchForm.tsx    ← NEW
    HotelCard.tsx          ← NEW
    RoomCard.tsx           ← NEW
    PriceComparison.tsx    ← NEW
    SmartPriceTag.tsx      ← NEW
    index.ts               ← NEW
```

---

## 🔒 SECURITY CONSIDERATIONS

1. **API Credentials** — хранить ТОЛЬКО в `.env`, никогда в коде
2. **Rate Limiting** — Booking.com имеет лимиты, нужен throttling
3. **Error Handling** — не показывать детали ошибок API клиенту
4. **Token Refresh** — с 2026 года используется token-based auth

---

## 📊 PIPELINE

```
SEC → CW → QA
```

1. **SEC (Security):** Проверка безопасного хранения credentials
2. **CW (Code Writer):** Реализация по этой спецификации
3. **QA:** Тестирование интеграции

---

## ✅ ACCEPTANCE CRITERIA

1. [ ] Поиск отелей по городу и датам работает
2. [ ] Получение цен на номера работает
3. [ ] Smart Price вычисляется корректно
4. [ ] UI отображает сравнение цен
5. [ ] Credentials безопасно хранятся в .env
6. [ ] Ошибки API корректно обрабатываются
7. [ ] Архитектура готова для добавления других поставщиков

---

**Last Updated:** 2026-01-12
