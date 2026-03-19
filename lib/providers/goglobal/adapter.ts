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
import { normalizeMealPlan, normalizeRoomType } from '@/lib/providers/normalizer';
import { GoGlobalClient } from '@/lib/goglobal/client';
import type {
  GoGlobalSearchResponse,
  GoGlobalHotel,
  GoGlobalOffer,
} from '@/lib/goglobal/types';

function computeNights(checkIn: string, checkOut: string): number {
  const msPerDay = 86400000;
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay));
}

function determineCancellationType(
  offer: GoGlobalOffer
): 'free' | 'partial' | 'non_refundable' {
  if (offer.NonRef === true) return 'non_refundable';
  if (offer.CxlDeadLine) return 'free';
  return 'partial';
}

function parseCancellationPolicies(offer: GoGlobalOffer): CancellationPolicy[] {
  if (!Array.isArray(offer.CancellationPolicies)) return [];
  return offer.CancellationPolicies.map((cp) => ({
    from: cp.Starting || '',
    amount: cp.Value || '100',
    currency: offer.Currency || 'EUR',
    isPercentage: cp.Mode === 'PCT',
  }));
}

function mapOfferToRate(
  offer: GoGlobalOffer,
  nights: number
): NormalizedRate {
  const totalPrice = typeof offer.TotalPrice === 'number' ? offer.TotalPrice : parseFloat(String(offer.TotalPrice || '0'));
  const roomDescription = Array.isArray(offer.Rooms) ? offer.Rooms.join(', ') : '';

  return {
    provider: 'goglobal',
    rateId: offer.HotelSearchCode,
    roomName: roomDescription,
    roomType: normalizeRoomType(roomDescription),
    beddingType: null,
    mealPlan: normalizeMealPlan('goglobal', offer.RoomBasis || ''),
    mealPlanOriginal: offer.RoomBasis || '',
    maxOccupancy: 2,
    totalPrice,
    pricePerNight: nights > 0 ? Math.round((totalPrice / nights) * 100) / 100 : totalPrice,
    currency: offer.Currency || 'EUR',
    cancellationType: determineCancellationType(offer),
    freeCancellationBefore: offer.CxlDeadLine ?? null,
    cancellationPolicies: parseCancellationPolicies(offer),
    requiresValuation: true,
    providerMetadata: {
      hotelSearchCode: offer.HotelSearchCode,
      remark: offer.Remark,
      special: offer.Special,
      category: offer.Category,
    },
  };
}

function mapGoGlobalHotel(
  hotel: GoGlobalHotel,
  nights: number
): NormalizedHotel {
  const images: string[] = [];
  if (hotel.HotelImage) images.push(hotel.HotelImage);
  if (hotel.Thumbnail && hotel.Thumbnail !== hotel.HotelImage) {
    images.push(hotel.Thumbnail);
  }

  const offers: GoGlobalOffer[] = Array.isArray(hotel.Offers)
    ? hotel.Offers
    : hotel.Offers
      ? [hotel.Offers]
      : [];

  const starRating = offers.length > 0 ? parseInt(offers[0].Category || '0', 10) || 0 : 0;

  return {
    provider: 'goglobal',
    providerHotelId: String(hotel.HotelCode),
    name: hotel.HotelName || '',
    address: hotel.Location || '',
    city: '',
    country: '',
    countryCode: '',
    latitude: typeof hotel.Latitude === 'number' ? hotel.Latitude : parseFloat(String(hotel.Latitude || '0')) || 0,
    longitude: typeof hotel.Longitude === 'number' ? hotel.Longitude : parseFloat(String(hotel.Longitude || '0')) || 0,
    starRating,
    reviewScore: null,
    reviewCount: null,
    images,
    amenities: Array.isArray(hotel.HotelFacilities) ? hotel.HotelFacilities : [],
    rates: offers.map((offer) => mapOfferToRate(offer, nights)),
  };
}

function createGoGlobalAdapter(): HotelProvider {
  const client = new GoGlobalClient();

  return {
    name: 'goglobal',

    async search(params: HotelSearchParams): Promise<NormalizedHotel[]> {
      const nights = computeNights(params.checkIn, params.checkOut);

      const searchRequest = {
        CityCode: params.cityCode ? String(params.cityCode) : undefined,
        HotelId: params.hotelId ? String(params.hotelId) : undefined,
        ArrivalDate: params.checkIn,
        Nights: nights,
        Rooms: [{
          Adults: params.adults,
          ChildCount: params.childrenAges?.length || 0,
          ChildAge: params.childrenAges,
        }],
        Nationality: params.nationality || 'LV',
        Currency: params.currency || 'EUR',
        MaxResponses: params.maxResults,
      };

      if (!searchRequest.CityCode && !searchRequest.HotelId) {
        return [];
      }

      const response: GoGlobalSearchResponse = await client.searchHotels(searchRequest);

      const hotels: GoGlobalHotel[] = Array.isArray(response.Hotels)
        ? response.Hotels
        : response.Hotels
          ? [response.Hotels]
          : [];

      return hotels.map((h) => mapGoGlobalHotel(h, nights));
    },

    async valuate(rateId: string, checkIn: string): Promise<ValuationResult> {
      const response = await client.valuateBooking(rateId, checkIn);

      return {
        available: response.Available !== false,
        totalPrice: typeof response.TotalPrice === 'number' ? response.TotalPrice : parseFloat(String(response.TotalPrice || '0')),
        currency: response.Currency || 'EUR',
        cancellationDeadline: response.CxlDeadLine ?? null,
        remarks: response.Remarks ? [response.Remarks] : [],
        rateDetails: {
          hotelSearchCode: rateId,
          valuationCode: response.ValuationCode,
        },
      };
    },

    async book(params: BookingParams): Promise<BookingResult> {
      const leadGuest = params.rooms[0]?.adults[0];
      if (!leadGuest) {
        throw new Error('At least one guest is required');
      }

      const response = await client.createBooking({
        HotelSearchCode: (params.providerMetadata?.hotelSearchCode as string) || params.rateId,
        AgentReference: params.agentReference || `CMS-${Date.now()}`,
        Leader: {
          Title: leadGuest.title || 'Mr',
          FirstName: leadGuest.firstName,
          LastName: leadGuest.lastName,
        },
        RoomAllocations: params.rooms.map((room, i) => ({
          RoomNo: i + 1,
          GuestFirstName: room.adults[0]?.firstName || '',
          GuestLastName: room.adults[0]?.lastName || '',
        })),
      });

      const status = response.BookingStatus;
      const isConfirmed = status === 'C';
      const isPending = status === 'RQ';

      return {
        success: isConfirmed || isPending,
        provider: 'goglobal',
        bookingCode: response.GoBookingCode || '',
        providerBookingCode: response.GoBookingCode || '',
        status: isConfirmed ? 'confirmed' : isPending ? 'pending' : 'failed',
        totalPrice: typeof response.TotalPrice === 'number' ? response.TotalPrice : 0,
        currency: response.Currency || 'EUR',
        hotelConfirmation: response.HotelConfirmationNumber,
        errorMessage: response.ErrorMessage,
      };
    },

    async cancel(bookingCode: string): Promise<CancelResult> {
      const response = await client.cancelBooking(bookingCode);
      const status = response.BookingStatus;
      const isCancelled = status === 'X' || status === 'RX' || status === 'XP';

      return {
        success: isCancelled,
        bookingCode,
        status: status || 'unknown',
        penalty: response.Penalty
          ? { amount: parseFloat(response.Penalty.Amount || '0'), currency: response.Penalty.Currency || 'EUR' }
          : undefined,
        errorMessage: response.ErrorMessage,
      };
    },

    async checkStatus(bookingCode: string): Promise<BookingStatusResult> {
      const response = await client.checkBookingStatus(bookingCode);
      const status = response.BookingStatus;

      const statusMap: Record<string, BookingStatusResult['status']> = {
        C: 'confirmed',
        RQ: 'pending',
        X: 'cancelled',
        RX: 'cancelled',
        XP: 'cancelled',
      };

      return {
        status: statusMap[status] ?? 'pending',
        bookingCode,
        confirmationNumber: response.HotelConfirmationNumber,
        errorMessage: response.ErrorMessage,
      };
    },
  };
}

export { createGoGlobalAdapter as createGoGlobalProvider };
