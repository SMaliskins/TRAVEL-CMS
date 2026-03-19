export type ProviderName = 'ratehawk' | 'goglobal' | 'booking';

export interface HotelSearchParams {
  cityName?: string;
  cityCode?: string | number;
  regionId?: number;
  hotelId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges?: number[];
  rooms?: number;
  currency?: string;
  nationality?: string;
  maxResults?: number;
}

export interface NormalizedHotel {
  provider: ProviderName;
  providerHotelId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  starRating: number;
  reviewScore: number | null;
  reviewCount: number | null;
  images: string[];
  amenities: string[];
  rates: NormalizedRate[];
}

export interface NormalizedRate {
  provider: ProviderName;
  rateId: string;
  roomName: string;
  roomType: string;
  beddingType: string | null;
  mealPlan: MealPlanType;
  mealPlanOriginal: string;
  maxOccupancy: number;
  totalPrice: number;
  pricePerNight: number;
  currency: string;
  cancellationType: 'free' | 'partial' | 'non_refundable';
  freeCancellationBefore: string | null;
  cancellationPolicies: CancellationPolicy[];
  requiresValuation: boolean;
  providerMetadata?: Record<string, unknown>;
}

export type MealPlanType =
  | 'room_only'
  | 'breakfast'
  | 'half_board'
  | 'full_board'
  | 'all_inclusive'
  | 'other';

export interface CancellationPolicy {
  from: string;
  amount: string;
  currency: string;
  isPercentage: boolean;
}

export interface ValuationResult {
  available: boolean;
  totalPrice: number;
  currency: string;
  cancellationDeadline: string | null;
  remarks: string[];
  rateDetails: Record<string, unknown>;
}

export interface BookingParams {
  rateId: string;
  provider: ProviderName;
  checkIn: string;
  checkOut: string;
  rooms: BookingRoom[];
  nationality: string;
  agentReference?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface BookingRoom {
  adults: { firstName: string; lastName: string; title?: string }[];
  children?: { firstName: string; lastName: string; age: number }[];
}

export interface BookingResult {
  success: boolean;
  provider: ProviderName;
  bookingCode: string;
  providerBookingCode: string;
  status: 'confirmed' | 'pending' | 'failed';
  totalPrice: number;
  currency: string;
  hotelConfirmation?: string;
  errorMessage?: string;
}

export interface CancelResult {
  success: boolean;
  bookingCode: string;
  status: string;
  penalty?: { amount: number; currency: string };
  errorMessage?: string;
}

export interface BookingStatusResult {
  status: 'confirmed' | 'pending' | 'cancelled' | 'failed';
  bookingCode: string;
  confirmationNumber?: string;
  errorMessage?: string;
}

export interface HotelProvider {
  name: ProviderName;
  search(params: HotelSearchParams): Promise<NormalizedHotel[]>;
  valuate(rateId: string, checkIn: string): Promise<ValuationResult>;
  book(params: BookingParams): Promise<BookingResult>;
  cancel(bookingCode: string): Promise<CancelResult>;
  checkStatus(bookingCode: string): Promise<BookingStatusResult>;
}

export interface AggregatedHotel {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  starRating: number;
  reviewScore: number | null;
  reviewCount: number | null;
  images: string[];
  amenities: string[];
  providers: ProviderName[];
  rates: NormalizedRate[];
  bestPrice: number;
  bestPriceProvider: ProviderName;
  currency: string;
}
