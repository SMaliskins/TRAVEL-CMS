import type {
  HotelProvider,
  HotelSearchParams,
  NormalizedHotel,
  NormalizedRate,
  ValuationResult,
  BookingParams,
  BookingResult,
  CancelResult,
  BookingStatusResult,
  CancellationPolicy,
} from '@/lib/providers/types';
import { normalizeMealPlan } from '@/lib/providers/normalizer';
import { normalizeRoomType } from '@/lib/providers/normalizer';
import {
  searchHotelsByRegion,
  getHotelContentsBatch,
  prebookFromSerp,
  createBookingForm,
  startBooking,
  checkBookingStatus,
  type RateHawkSerpHotel,
  type RateHawkHotelContent,
} from '@/lib/ratehawk/client';

function getCredentials() {
  const keyId = process.env.RATEHAWK_KEY_ID;
  const apiKey = process.env.RATEHAWK_API_KEY;
  if (!keyId || !apiKey) {
    throw new Error('RATEHAWK_KEY_ID and RATEHAWK_API_KEY must be set');
  }
  return { keyId, apiKey };
}

function determineCancellationType(
  cancellationInfo?: RateHawkSerpHotel['rates'][number]['cancellation_info']
): 'free' | 'partial' | 'non_refundable' {
  if (!cancellationInfo) return 'non_refundable';

  const deadline = cancellationInfo.free_cancellation_before;
  if (!deadline) return 'non_refundable';

  const deadlineDate = new Date(deadline);
  if (deadlineDate > new Date()) return 'free';

  return 'partial';
}

function extractCancellationPolicies(
  cancellationInfo?: RateHawkSerpHotel['rates'][number]['cancellation_info']
): CancellationPolicy[] {
  if (!cancellationInfo?.penalties) return [];

  return Object.entries(cancellationInfo.penalties).map(([from, penalty]) => ({
    from,
    amount: penalty.amount ?? '0',
    currency: penalty.currency_code ?? 'EUR',
    isPercentage: false,
  }));
}

function mapRateHawkRate(
  rate: RateHawkSerpHotel['rates'][number],
  nights: number
): NormalizedRate {
  const payment = rate.payment_options?.payment_types?.[0];
  const totalPrice = payment?.show_amount ?? payment?.amount ?? 0;
  const currency = payment?.show_currency_code ?? payment?.currency_code ?? 'EUR';
  const mealRaw = rate.meal_data?.value ?? rate.meal ?? '';

  return {
    provider: 'ratehawk',
    rateId: rate.match_hash || rate.book_hash || '',
    roomName: rate.room_data_trans?.main_name || rate.room_name || '',
    roomType: normalizeRoomType(rate.room_data_trans?.main_name || rate.room_name || ''),
    beddingType: rate.room_data_trans?.bedding_type ?? null,
    mealPlan: normalizeMealPlan('ratehawk', mealRaw),
    mealPlanOriginal: mealRaw,
    maxOccupancy: 2,
    totalPrice,
    pricePerNight: nights > 0 ? Math.round((totalPrice / nights) * 100) / 100 : totalPrice,
    currency,
    cancellationType: determineCancellationType(rate.cancellation_info),
    freeCancellationBefore: rate.cancellation_info?.free_cancellation_before ?? null,
    cancellationPolicies: extractCancellationPolicies(rate.cancellation_info),
    requiresValuation: false,
    providerMetadata: {
      matchHash: rate.match_hash,
      bookHash: rate.book_hash,
    },
  };
}

function mapSerpHotelToNormalized(
  serpHotel: RateHawkSerpHotel,
  content: RateHawkHotelContent | undefined,
  nights: number
): NormalizedHotel {
  const amenities: string[] = [];
  if (content?.amenity_groups) {
    for (const group of content.amenity_groups) {
      amenities.push(...group.amenities);
    }
  } else if (content?.facts) {
    amenities.push(...content.facts);
  }

  return {
    provider: 'ratehawk',
    providerHotelId: String(serpHotel.hid),
    name: content?.name || serpHotel.name || '',
    address: content?.address || serpHotel.address || '',
    city: content?.region?.name || '',
    country: '',
    countryCode: content?.region?.country_code || '',
    latitude: content?.latitude ?? 0,
    longitude: content?.longitude ?? 0,
    starRating: content?.star_rating ?? serpHotel.star_rating ?? 0,
    reviewScore: content?.review_score ?? null,
    reviewCount: content?.number_of_reviews ?? null,
    images: content?.images ?? [],
    amenities,
    rates: serpHotel.rates.map((r) => mapRateHawkRate(r, nights)),
  };
}

function createRateHawkAdapter(): HotelProvider {
  return {
    name: 'ratehawk',

    async search(params: HotelSearchParams): Promise<NormalizedHotel[]> {
      const { keyId, apiKey } = getCredentials();

      if (!params.regionId) {
        throw new Error('RateHawk search requires regionId');
      }

      const serpHotels = await searchHotelsByRegion(
        params.regionId,
        params.checkIn,
        params.checkOut,
        params.adults,
        keyId,
        apiKey,
        params.currency ?? 'EUR',
        params.maxResults ?? 5,
        params.childrenAges ?? []
      );

      if (!serpHotels.length) return [];

      const hotelIds = serpHotels.map((h) => h.hid);
      const contents = await getHotelContentsBatch(hotelIds, 'en', keyId, apiKey);
      const contentMap = new Map(contents.map((c) => [c.hid, c]));

      const checkInDate = new Date(params.checkIn);
      const checkOutDate = new Date(params.checkOut);
      const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000));

      return serpHotels.map((serpHotel) =>
        mapSerpHotelToNormalized(serpHotel, contentMap.get(serpHotel.hid), nights)
      );
    },

    async valuate(rateId: string): Promise<ValuationResult> {
      const { keyId, apiKey } = getCredentials();

      const result = await prebookFromSerp(rateId, keyId, apiKey);

      return {
        available: result.available,
        totalPrice: result.amount ?? 0,
        currency: result.currency ?? 'EUR',
        cancellationDeadline: null,
        remarks: result.room_name ? [`Room: ${result.room_name}`] : [],
        rateDetails: {
          bookHash: result.book_hash,
          matchHash: result.match_hash,
          meal: result.meal,
        },
      };
    },

    async book(params: BookingParams): Promise<BookingResult> {
      const { keyId, apiKey } = getCredentials();

      const bookHash = (params.providerMetadata?.bookHash as string) || params.rateId;
      const partnerOrderId = params.agentReference || `TCM-${Date.now()}`;

      const formResult = await createBookingForm(
        bookHash,
        partnerOrderId,
        '127.0.0.1',
        keyId,
        apiKey
      );

      const leadGuest = params.rooms[0]?.adults[0];
      if (!leadGuest) {
        throw new Error('At least one guest is required');
      }

      await startBooking(
        {
          partnerOrderId,
          guestFirstName: leadGuest.firstName,
          guestLastName: leadGuest.lastName,
          guestEmail: '',
          guestPhone: '',
          paymentType: formResult.paymentType,
          paymentAmount: formResult.amount,
          paymentCurrency: formResult.currencyCode,
        },
        keyId,
        apiKey
      );

      return {
        success: true,
        provider: 'ratehawk',
        bookingCode: partnerOrderId,
        providerBookingCode: String(formResult.orderId),
        status: 'pending',
        totalPrice: parseFloat(formResult.amount) || 0,
        currency: formResult.currencyCode,
      };
    },

    async cancel(bookingCode: string): Promise<CancelResult> {
      return {
        success: false,
        bookingCode,
        status: 'not_supported',
        errorMessage: 'RateHawk cancellation is not supported via this adapter. Use the RateHawk portal.',
      };
    },

    async checkStatus(bookingCode: string): Promise<BookingStatusResult> {
      const { keyId, apiKey } = getCredentials();

      const result = await checkBookingStatus(bookingCode, keyId, apiKey);

      const statusMap: Record<string, BookingStatusResult['status']> = {
        ok: 'confirmed',
        pending: 'pending',
        error: 'failed',
      };

      return {
        status: statusMap[result.status] ?? 'failed',
        bookingCode,
        confirmationNumber: result.confirmationNumber,
        errorMessage: result.errorMessage,
      };
    },
  };
}

export { createRateHawkAdapter as createRateHawkProvider };
