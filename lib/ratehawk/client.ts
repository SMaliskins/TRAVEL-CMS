/**
 * RateHawk (Emerging Travel Group) API client
 * Docs: https://docs.emergingtravel.com/
 *
 * Endpoints:
 * - Suggest hotel and region: /api/b2b/v3/search/multicomplete/
 * - Retrieve hotel content: /api/b2b/v3/hotel/info/ (B2B/Affiliate API)
 */

const RATEHAWK_BASE = "https://api.worldota.net";
const RATEHAWK_SANDBOX = "https://api-sandbox.worldota.net";

export interface RateHawkHotelSuggestion {
  hid: number;
  id?: string;
  name: string;
  region_id: number;
}

export interface RateHawkRegionSuggestion {
  id: number | string;
  name: string;
  type: string;
  country_code: string;
}

export interface RateHawkSuggestResponse {
  hotels: RateHawkHotelSuggestion[];
  regions: RateHawkRegionSuggestion[] | null;
}

export interface RateHawkAmenityGroup {
  group_name: string;
  amenities: string[];
}

export interface RateHawkRoomGroup {
  name: string;
  name_struct?: { main_name?: string; bathroom?: string; bedding_type?: string };
  room_amenities?: string[];
  /** Room class: suite, studio, villa, apartment, room, etc. */
  room_class?: string;
  images?: string[];
}

export interface RateHawkHotelContent {
  hid: number;
  id?: string;
  name: string;
  star_rating?: number;
  review_score?: number;
  number_of_reviews?: number;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  postal_code?: string;
  region?: {
    name?: string;
    country_code?: string;
    type?: string;
  };
  /** Hotel type: Hotel, Resort, Apartment, Hostel, Villa, etc. */
  kind?: string;
  hotel_chain?: string;
  year_built?: number;
  year_renovated?: number;
  rooms_number?: number;
  floors_number?: number;
  distance_center?: number;
  room_groups?: RateHawkRoomGroup[];
  meal_types?: string[];
  /** Amenities grouped by category */
  amenity_groups?: RateHawkAmenityGroup[];
  /** Flat list of key amenity names (legacy) */
  facts?: string[];
  check_in_time?: string;
  check_out_time?: string;
  /** Main hotel images (up to 5 URLs) */
  images?: string[];
}

export interface RateHawkHotelReviewSummary {
  hid: number;
  reviewScore: number | null;
  reviewCount: number;
}

function getAuthHeader(keyId: string, apiKey: string): string {
  const credentials = Buffer.from(`${keyId}:${apiKey}`).toString("base64");
  return `Basic ${credentials}`;
}

function getBaseUrl(): string {
  return process.env.RATEHAWK_USE_SANDBOX === "true" ? RATEHAWK_SANDBOX : RATEHAWK_BASE;
}

/**
 * Suggest hotels and regions by query (autocomplete)
 * POST /api/b2b/v3/search/multicomplete/
 */
export async function suggestHotels(
  query: string,
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkSuggestResponse> {
  if (!query || query.trim().length < 2) {
    return { hotels: [], regions: null };
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/search/multicomplete/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({ query: query.trim(), language }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk suggest failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk suggest error");
  }

  return {
    hotels: json.data?.hotels || [],
    regions: json.data?.regions || null,
  };
}

/**
 * Retrieve hotel content (address, phone, email, coordinates)
 * POST /api/b2b/v3/hotel/info/ — B2B/Affiliate API (one hotel per request)
 */
export async function getHotelContent(
  hotelIds: number[],
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkHotelContent[]> {
  if (!hotelIds.length) return [];

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/hotel/info/`;
  const hid = hotelIds[0];
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
      "User-Agent": "TravelCMS/1.0",
      "X-Partner-Name": "TravelCMS",
      "X-Client-Version": "1.0",
    },
    body: JSON.stringify({ hid, language }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk hotel content failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk hotel content error");
  }

  const raw = json.data;
  if (!raw) return [];

  const IMG_SIZE = "640x400";
  function resolveImageUrl(url: string): string {
    return url.replace("{size}", IMG_SIZE);
  }

  // --- Room groups ---
  const roomClassMap: Record<number, string> = {
    0: "run of house", 1: "dorm", 2: "capsule", 3: "room", 4: "junior suite",
    5: "suite", 6: "apartment", 7: "studio", 8: "villa", 9: "cottage",
    17: "bungalow", 18: "chalet", 19: "camping", 20: "tent",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomGroups: RateHawkRoomGroup[] = Array.isArray(raw.room_groups)
    ? raw.room_groups.slice(0, 10).map((rg: any) => {
        const roomImages: string[] = [];
        if (Array.isArray(rg.images_ext)) {
          for (const img of rg.images_ext.slice(0, 2)) {
            if (img?.url) roomImages.push(resolveImageUrl(img.url));
          }
        } else if (Array.isArray(rg.images)) {
          for (const url of rg.images.slice(0, 2)) {
            if (typeof url === "string") roomImages.push(resolveImageUrl(url));
          }
        }

        return {
          name: (rg.name_struct?.main_name || rg.name || "").trim(),
          name_struct: rg.name_struct
            ? { main_name: rg.name_struct.main_name, bathroom: rg.name_struct.bathroom, bedding_type: rg.name_struct.bedding_type }
            : undefined,
          room_amenities: Array.isArray(rg.room_amenities) ? rg.room_amenities.slice(0, 15) : undefined,
          room_class: rg.rg_ext?.class != null ? roomClassMap[rg.rg_ext.class] : undefined,
          images: roomImages.length ? roomImages : undefined,
        };
      })
    : [];

  // --- Meal types ---
  const mealTypes: string[] = [];
  const mp = raw.metapolicy_struct;
  if (mp?.meal && Array.isArray(mp.meal)) {
    for (const m of mp.meal) {
      const mt = m?.meal_type;
      if (mt && typeof mt === "string" && mt !== "unspecified" && !mealTypes.includes(mt)) {
        mealTypes.push(mt);
      }
    }
  }

  // --- Description ---
  let description: string | undefined;
  const ds = raw.description_struct;
  if (ds) {
    if (Array.isArray(ds)) {
      const paragraphs = ds.map((p: { paragraphs?: string[]; title?: string }) =>
        Array.isArray(p.paragraphs) ? p.paragraphs.join(" ") : ""
      ).filter(Boolean);
      description = paragraphs.join("\n").slice(0, 800);
    } else {
      description = (ds.en || ds.description || Object.values(ds).find((v) => typeof v === "string" && (v as string).length > 20)) as string | undefined;
      if (description) description = description.slice(0, 800);
    }
  }

  // --- Amenity groups ---
  const amenityGroups: RateHawkAmenityGroup[] = [];
  if (Array.isArray(raw.amenity_groups)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ag of raw.amenity_groups.slice(0, 10) as any[]) {
      const groupName = ag.group_name;
      const amenities = Array.isArray(ag.amenities) ? ag.amenities.filter((a: unknown) => typeof a === "string").slice(0, 15) as string[] : [];
      if (groupName && amenities.length) {
        amenityGroups.push({ group_name: groupName, amenities });
      }
    }
  }

  // --- Flat facts (legacy) ---
  const facts: string[] = [];
  if (Array.isArray(raw.facts)) {
    for (const f of raw.facts) {
      const name = f?.name ?? f;
      if (typeof name === "string" && name.length > 0) facts.push(name);
    }
  }

  // --- Building info ---
  const factsObj = typeof raw.facts === "object" && !Array.isArray(raw.facts) ? raw.facts : null;
  const yearBuilt = factsObj?.year_built ?? raw.year_built ?? undefined;
  const yearRenovated = factsObj?.year_renovated ?? raw.year_renovated ?? undefined;
  const roomsNumber = factsObj?.rooms_number ?? raw.rooms_number ?? undefined;
  const floorsNumber = factsObj?.floors_number ?? raw.floors_number ?? undefined;

  // --- Review score ---
  const reviewScore = typeof raw.rating === "number" && raw.rating > 0
    ? raw.rating
    : typeof raw.review_score === "number" && raw.review_score > 0
      ? raw.review_score
      : undefined;
  const numberOfReviews = typeof raw.number_of_reviews === "number"
    ? raw.number_of_reviews
    : typeof raw.reviews_count === "number"
      ? raw.reviews_count
      : undefined;

  // --- Hotel images ---
  const hotelImages: string[] = [];
  if (Array.isArray(raw.images_ext)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const img of raw.images_ext.slice(0, 5) as any[]) {
      if (img?.url) hotelImages.push(resolveImageUrl(img.url));
    }
  } else if (Array.isArray(raw.images)) {
    for (const url of raw.images.slice(0, 5)) {
      if (typeof url === "string") hotelImages.push(resolveImageUrl(url));
    }
  }

  const hotel: RateHawkHotelContent = {
    hid: raw.hid ?? hid,
    id: raw.id,
    name: raw.name ?? "",
    star_rating: raw.star_rating ?? raw.star_certificate ?? undefined,
    review_score: reviewScore,
    number_of_reviews: numberOfReviews,
    kind: raw.kind ?? undefined,
    hotel_chain: raw.hotel_chain ?? undefined,
    year_built: typeof yearBuilt === "number" ? yearBuilt : undefined,
    year_renovated: typeof yearRenovated === "number" ? yearRenovated : undefined,
    rooms_number: typeof roomsNumber === "number" ? roomsNumber : undefined,
    floors_number: typeof floorsNumber === "number" ? floorsNumber : undefined,
    distance_center: typeof raw.distance_center === "number" ? raw.distance_center : undefined,
    description: description || undefined,
    address: raw.address,
    latitude: raw.latitude,
    longitude: raw.longitude,
    phone: raw.phone,
    email: raw.email,
    postal_code: raw.postal_code,
    region: raw.region,
    room_groups: roomGroups.length ? roomGroups : undefined,
    meal_types: mealTypes.length ? mealTypes : undefined,
    amenity_groups: amenityGroups.length ? amenityGroups : undefined,
    facts: facts.length ? facts.slice(0, 15) : undefined,
    check_in_time: raw.check_in_time ?? undefined,
    check_out_time: raw.check_out_time ?? undefined,
    images: hotelImages.length ? hotelImages : undefined,
  };
  return [hotel];
}

/**
 * Search hotel rates to extract available meal types.
 * POST /api/b2b/v3/search/hp/
 * Returns unique meal codes (e.g. "nomeal", "breakfast", "half-board", "full-board", "all-inclusive").
 */
export async function getHotelMealTypes(
  hid: number,
  checkin: string,
  checkout: string,
  language: string,
  keyId: string,
  apiKey: string,
  currency = "EUR"
): Promise<string[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/search/hp/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({
      hid,
      checkin,
      checkout,
      residency: "gb",
      language,
      guests: [{ adults: 2, children: [] }],
      currency,
      timeout: 8,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk hotelpage failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk hotelpage error");
  }

  const meals = new Set<string>();
  const hotels = json.data?.hotels;
  if (Array.isArray(hotels)) {
    for (const hotel of hotels) {
      if (!Array.isArray(hotel.rates)) continue;
      for (const rate of hotel.rates) {
        const m = rate.meal_data?.value ?? rate.meal;
        if (m && typeof m === "string") meals.add(m);
      }
    }
  }

  return [...meals];
}

export interface RateHawkSerpHotel {
  hid: number;
  name: string;
  star_rating: number;
  address: string;
  rates: {
    daily_prices: string[];
    meal: string;
    room_name: string;
    match_hash?: string;
    book_hash?: string;
    payment_options: {
      payment_types: {
        show_amount: number;
        show_currency_code: string;
        amount: number;
        currency_code: string;
      }[];
    };
  }[];
}

/**
 * Search hotels by region with availability & pricing
 * POST /api/b2b/v3/search/serp/region/
 */
export async function searchHotelsByRegion(
  regionId: number,
  checkin: string,
  checkout: string,
  guests: number,
  keyId: string,
  apiKey: string,
  currency = "EUR",
  limit = 5
): Promise<RateHawkSerpHotel[]> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/search/serp/region/`;

  const guestsArr = [];
  for (let i = 0; i < Math.ceil(guests / 2); i++) {
    const adults = Math.min(2, guests - i * 2);
    guestsArr.push({ adults, children: [] });
  }
  if (guestsArr.length === 0) guestsArr.push({ adults: 2, children: [] });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({
      checkin,
      checkout,
      residency: "lv",
      language: "en",
      guests: guestsArr,
      region_id: regionId,
      currency,
      hotels_limit: limit,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk SERP failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk SERP error");
  }

  return json.data?.hotels ?? [];
}

/**
 * Fetch hotel content for multiple hotels in parallel (ETG API: one hotel per request).
 * Limit to 5 hotels to respect rate limits (30/min).
 */
export async function getHotelContentsBatch(
  hotelIds: number[],
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkHotelContent[]> {
  const ids = hotelIds.slice(0, 5);
  const results = await Promise.all(
    ids.map((hid) => getHotelContent([hid], language, keyId, apiKey))
  );
  return results.flat();
}

/**
 * Fetch hotel review summaries via Content API.
 * POST /api/content/v1/hotel_reviews_by_ids/
 * Computes average score from detailed_review sub-scores (0-10 scale).
 */
export async function getHotelReviewsSummary(
  hotelIds: number[],
  language: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkHotelReviewSummary[]> {
  if (!hotelIds.length) return [];

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/content/v1/hotel_reviews_by_ids/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(keyId, apiKey),
      },
      body: JSON.stringify({ hids: hotelIds.slice(0, 20), language }),
    });

    if (!response.ok) return [];

    const json = await response.json();
    if (json.status !== "ok" || !Array.isArray(json.data)) return [];

    return json.data.map((entry: { hid: number; reviews?: Array<{ detailed_review?: { cleanness?: number; location?: number; price?: number; services?: number; room?: number; meal?: number } }> }) => {
      const reviews = entry.reviews ?? [];
      if (reviews.length === 0) {
        return { hid: entry.hid, reviewScore: null, reviewCount: 0 };
      }

      let totalScore = 0;
      let scoredReviews = 0;

      for (const review of reviews) {
        const dr = review.detailed_review;
        if (!dr) continue;
        const scores = [dr.cleanness, dr.location, dr.price, dr.services, dr.room, dr.meal].filter(
          (v): v is number => typeof v === "number" && v > 0
        );
        if (scores.length > 0) {
          totalScore += scores.reduce((a, b) => a + b, 0) / scores.length;
          scoredReviews++;
        }
      }

      return {
        hid: entry.hid,
        reviewScore: scoredReviews > 0 ? Math.round((totalScore / scoredReviews) * 10) / 10 : null,
        reviewCount: reviews.length,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================
// BOOKING API
// ============================================================

export interface RateHawkPrebookResult {
  available: boolean;
  book_hash?: string;
  match_hash?: string;
  amount?: number;
  currency?: string;
  room_name?: string;
  meal?: string;
}

/**
 * Prebook a rate from SERP results to verify availability and get book_hash.
 * POST /api/b2b/v3/serp/prebook/
 */
export async function prebookFromSerp(
  searchHash: string,
  keyId: string,
  apiKey: string,
  priceIncreasePercent = 5
): Promise<RateHawkPrebookResult> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/serp/prebook/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({
      hash: searchHash,
      price_increase_percent: priceIncreasePercent,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk prebook failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk prebook error");
  }

  const hotels = json.data?.hotels;
  if (!Array.isArray(hotels) || hotels.length === 0) {
    return { available: false };
  }

  const hotel = hotels[0];
  const rates = hotel.rates;
  if (!Array.isArray(rates) || rates.length === 0) {
    return { available: false };
  }

  const rate = rates[0];
  const payment = rate.payment_options?.payment_types?.[0];

  return {
    available: true,
    book_hash: rate.book_hash,
    match_hash: rate.match_hash,
    amount: payment?.show_amount ?? payment?.amount,
    currency: payment?.show_currency_code ?? payment?.currency_code,
    room_name: rate.room_name,
    meal: rate.meal,
  };
}

export interface RateHawkBookingFormResult {
  orderId: number;
  partnerOrderId: string;
  itemId: number;
  paymentType: string;
  amount: string;
  currencyCode: string;
  isNeedCreditCard: boolean;
}

/**
 * Create booking process (form).
 * POST /api/b2b/v3/hotel/order/booking/form/
 */
export async function createBookingForm(
  bookHash: string,
  partnerOrderId: string,
  userIp: string,
  keyId: string,
  apiKey: string,
  language = "en"
): Promise<RateHawkBookingFormResult> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/hotel/order/booking/form/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({
      partner_order_id: partnerOrderId,
      book_hash: bookHash,
      language,
      user_ip: userIp,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk booking form failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk booking form error");
  }

  const d = json.data;
  const pt = d.payment_types?.[0];

  return {
    orderId: d.order_id,
    partnerOrderId: d.partner_order_id,
    itemId: d.item_id,
    paymentType: pt?.type ?? "deposit",
    amount: pt?.amount ?? "0",
    currencyCode: pt?.currency_code ?? "EUR",
    isNeedCreditCard: pt?.is_need_credit_card_data ?? false,
  };
}

export interface RateHawkStartBookingParams {
  partnerOrderId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  paymentType: string;
  paymentAmount: string;
  paymentCurrency: string;
  language?: string;
}

/**
 * Start (finish) the booking process — sends guest details and confirms.
 * POST /api/b2b/v3/hotel/order/booking/finish/
 */
export async function startBooking(
  params: RateHawkStartBookingParams,
  keyId: string,
  apiKey: string
): Promise<void> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/hotel/order/booking/finish/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({
      partner: {
        partner_order_id: params.partnerOrderId,
      },
      language: params.language ?? "en",
      rooms: [
        {
          guests: [
            {
              first_name: params.guestFirstName,
              last_name: params.guestLastName,
            },
          ],
        },
      ],
      user: {
        email: params.guestEmail,
        phone: params.guestPhone,
      },
      payment_type: {
        type: params.paymentType,
        amount: params.paymentAmount,
        currency_code: params.paymentCurrency,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk start booking failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.status !== "ok" || json.error) {
    throw new Error(json.error || "RateHawk start booking error");
  }
}

export interface RateHawkBookingStatus {
  status: "ok" | "pending" | "error";
  orderId?: number;
  partnerOrderId?: string;
  confirmationNumber?: string;
  errorMessage?: string;
}

/**
 * Check booking process status (poll until ok or error).
 * POST /api/b2b/v3/hotel/order/booking/status/
 */
export async function checkBookingStatus(
  partnerOrderId: string,
  keyId: string,
  apiKey: string
): Promise<RateHawkBookingStatus> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/b2b/v3/hotel/order/booking/status/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(keyId, apiKey),
    },
    body: JSON.stringify({ partner_order_id: partnerOrderId }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`RateHawk booking status failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  if (json.error) {
    return {
      status: "error",
      errorMessage: json.error,
    };
  }

  const d = json.data;
  const bookingStatus = d?.status;

  if (bookingStatus === "ok") {
    return {
      status: "ok",
      orderId: d.order_id,
      partnerOrderId: d.partner_order_id,
      confirmationNumber: d.hotel_order_id ?? d.confirmation_number ?? undefined,
    };
  }

  if (bookingStatus === "pending") {
    return { status: "pending", partnerOrderId: d.partner_order_id };
  }

  return {
    status: "error",
    partnerOrderId: d?.partner_order_id,
    errorMessage: d?.error ?? "Unknown booking error",
  };
}
