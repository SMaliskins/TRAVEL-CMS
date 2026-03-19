export type GoGlobalBookingStatusCode =
  | 'C'   // confirmed
  | 'RQ'  // request/pending
  | 'X'   // cancelled
  | 'RX'  // cancelled success
  | 'XP'; // cancelled with penalty

export interface GoGlobalRoomRequest {
  Adults: number;
  ChildCount: number;
  ChildAge?: number[];
}

export interface GoGlobalSearchRequest {
  CityCode?: string;
  HotelId?: string;
  ArrivalDate: string;
  Nights: number;
  Rooms: GoGlobalRoomRequest[];
  Nationality?: string;
  FilterPriceMin?: number;
  FilterPriceMax?: number;
  Stars?: number;
  MaxResponses?: number;
  Currency?: string;
}

export interface GoGlobalCancellationPolicy {
  Id: number;
  Starting: string;
  BasedOn: string;
  Mode: string;
  Value: string;
}

export interface GoGlobalTaxFee {
  Type: string;
  Detail: string;
  Amount: number;
  Currency: string;
  Inclusive: string;
}

export interface GoGlobalOffer {
  HotelSearchCode: string;
  CxlDeadLine: string | null;
  NonRef: boolean;
  Rooms: string[];
  RoomBasis: string;
  Availability: number;
  TotalPrice: number;
  Currency: string;
  TotalTax?: number;
  RoomRate?: number;
  CommPercent?: number;
  CommValue?: number;
  Category: string;
  CancellationPolicies: GoGlobalCancellationPolicy[];
  Remark?: string;
  Special?: string;
  Preferred: boolean;
  Tax?: GoGlobalTaxFee[];
  Fee?: GoGlobalTaxFee[];
}

export interface GoGlobalHotel {
  HotelName: string;
  HotelCode: number;
  CountryId: number;
  CityId: number;
  Location: string;
  LocationCode?: string;
  Thumbnail: string;
  Longitude: number;
  Latitude: number;
  BestSellerRank: string;
  HotelImage: string;
  HotelFacilities?: string[];
  RoomFacilities?: string[];
  Offers: GoGlobalOffer[];
}

export interface GoGlobalSearchResponse {
  Header?: {
    Stats?: { HotelQty: number; ResultsQty: number };
  };
  Hotels: GoGlobalHotel[];
}

export interface GoGlobalValuationRequest {
  HotelSearchCode: string;
  ArrivalDate: string;
}

export interface GoGlobalValuationResponse {
  HotelSearchCode: string;
  ArrivalDate: string;
  Nights: number;
  HotelName: string;
  HotelCode: string;
  RoomBasis: string;
  TotalPrice: number;
  Currency: string;
  CxlDeadLine: string;
  NonRef: boolean;
  CancellationPolicies: GoGlobalCancellationPolicy[];
  Remarks?: string;
  Available?: boolean;
  ValuationCode?: string;
  CancellationPolicy?: string;
}

export interface GoGlobalGuest {
  Title: string;
  FirstName: string;
  LastName: string;
}

export interface GoGlobalRoomAllocation {
  RoomNo: number;
  GuestFirstName: string;
  GuestLastName: string;
}

export interface GoGlobalBookingRequest {
  HotelSearchCode: string;
  AgentReference: string;
  Leader: GoGlobalGuest;
  RoomAllocations: GoGlobalRoomAllocation[];
}

export interface GoGlobalBookingResponse {
  GoBookingCode: string;
  BookingStatus: GoGlobalBookingStatusCode;
  HotelName: string;
  HotelCode: string;
  ArrivalDate: string;
  Nights: number;
  TotalPrice: number;
  Currency: string;
  RoomBasis: string;
  Leader: GoGlobalGuest;
  HotelConfirmationNumber?: string;
  ErrorMessage?: string;
  Status?: string;
}

export interface GoGlobalCancelRequest {
  GoBookingCode: string;
}

export interface GoGlobalCancelResponse {
  GoBookingCode: string;
  BookingStatus: GoGlobalBookingStatusCode;
  Status?: string;
  ErrorMessage?: string;
  Penalty?: { Amount: string; Currency: string };
}

export interface GoGlobalStatusResponse {
  GoBookingCode: string;
  BookingStatus: GoGlobalBookingStatusCode;
  HotelName: string;
  ArrivalDate: string;
  Nights: number;
  TotalPrice: number;
  Currency: string;
  Status?: string;
  HotelConfirmationNumber?: string;
  ErrorMessage?: string;
}
