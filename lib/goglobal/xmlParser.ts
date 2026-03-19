import { XMLParser } from 'fast-xml-parser';
import type {
  GoGlobalSearchResponse,
  GoGlobalValuationResponse,
  GoGlobalBookingResponse,
  GoGlobalCancelResponse,
  GoGlobalStatusResponse,
  GoGlobalHotel,
  GoGlobalOffer,
  GoGlobalCancellationPolicy,
  GoGlobalBookingStatusCode,
  GoGlobalTaxFee,
} from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
});

export function extractResultFromSoap(soapXml: string): string {
  const parsed = xmlParser.parse(soapXml);

  const envelope =
    parsed['soap:Envelope'] ||
    parsed['soap12:Envelope'] ||
    parsed['Envelope'];
  if (!envelope) throw new Error('Invalid SOAP response: no Envelope');

  const body =
    envelope['soap:Body'] ||
    envelope['soap12:Body'] ||
    envelope['Body'];
  if (!body) throw new Error('Invalid SOAP response: no Body');

  const response =
    body['MakeRequestResponse'] ||
    body['m:MakeRequestResponse'];
  if (!response) throw new Error('Invalid SOAP response: no MakeRequestResponse');

  const result = response['MakeRequestResult'] || response['m:MakeRequestResult'];
  if (result === undefined || result === null) {
    throw new Error('Invalid SOAP response: no MakeRequestResult');
  }

  return String(result);
}

function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function parseCancellationPolicies(raw: unknown): GoGlobalCancellationPolicy[] {
  const items = ensureArray(raw as Record<string, unknown> | Record<string, unknown>[]);
  return items.map((p) => ({
    Id: Number(p.Id || 0),
    Starting: String(p.Starting || ''),
    BasedOn: String(p.BasedOn || ''),
    Mode: String(p.Mode || ''),
    Value: String(p.Value || ''),
  }));
}

function parseTaxFees(raw: unknown): GoGlobalTaxFee[] {
  const items = ensureArray(raw as Record<string, unknown> | Record<string, unknown>[]);
  return items.map((t) => ({
    Type: String(t.Type || ''),
    Detail: String(t.Detail || ''),
    Amount: Number(t.Amount || 0),
    Currency: String(t.Currency || ''),
    Inclusive: String(t.Inclusive || ''),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOffer(raw: any): GoGlobalOffer {
  return {
    HotelSearchCode: String(raw.HotelSearchCode || ''),
    CxlDeadLine: raw.CxlDeadLine || raw.CxlDeadline || null,
    NonRef: raw.NonRef === true || raw.NonRef === 'true' || raw.NonRef === 1,
    Rooms: ensureArray(raw.Rooms).map(String),
    RoomBasis: String(raw.RoomBasis || ''),
    Availability: Number(raw.Availability ?? 0),
    TotalPrice: Number(raw.TotalPrice || 0),
    Currency: String(raw.Currency || ''),
    TotalTax: raw.TotalTax !== undefined ? Number(raw.TotalTax) : undefined,
    RoomRate: raw.RoomRate !== undefined ? Number(raw.RoomRate) : undefined,
    CommPercent: raw.CommPercent !== undefined ? Number(raw.CommPercent) : undefined,
    CommValue: raw.CommValue !== undefined ? Number(raw.CommValue) : undefined,
    Category: String(raw.Category || ''),
    CancellationPolicies: parseCancellationPolicies(raw.CancellationPolicies),
    Remark: raw.Remark || undefined,
    Special: raw.Special || undefined,
    Preferred: raw.Preferred === true,
    Tax: raw.Tax ? parseTaxFees(raw.Tax) : undefined,
    Fee: raw.Fee ? parseTaxFees(raw.Fee) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHotel(raw: any): GoGlobalHotel {
  const facilities = raw.HotelFacilities;
  let facilityList: string[] = [];
  if (typeof facilities === 'string') {
    facilityList = facilities.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (Array.isArray(facilities)) {
    facilityList = facilities.map(String);
  }

  const rawOffers = ensureArray(raw.Offers);

  return {
    HotelName: String(raw.HotelName || ''),
    HotelCode: Number(raw.HotelCode || 0),
    CountryId: Number(raw.CountryId || 0),
    CityId: Number(raw.CityId || 0),
    Location: String(raw.Location || ''),
    LocationCode: raw.LocationCode || undefined,
    Thumbnail: String(raw.Thumbnail || ''),
    Longitude: Number(raw.Longitude || 0),
    Latitude: Number(raw.Latitude || 0),
    BestSellerRank: String(raw.BestSellerRank || '0'),
    HotelImage: String(raw.HotelImage || ''),
    HotelFacilities: facilityList,
    RoomFacilities: raw.RoomFacilities ? ensureArray(raw.RoomFacilities).map(String) : undefined,
    Offers: rawOffers.map(mapOffer),
  };
}

export function parseSearchResponse(jsonStr: string): GoGlobalSearchResponse {
  const data = JSON.parse(jsonStr);

  if (data.Main?.Error) {
    throw new Error(
      `GoGlobal error ${data.Main.Error.Code}: ${data.Main.Error.Message}` +
      (data.Main.DebugError?.Message ? ` — ${data.Main.DebugError.Message}` : '')
    );
  }

  const rawHotels = ensureArray(data.Hotels);

  return {
    Header: data.Header ? {
      Stats: data.Header.Stats || { HotelQty: rawHotels.length, ResultsQty: rawHotels.length },
    } : undefined,
    Hotels: rawHotels.map(mapHotel),
  };
}

export function parseValuationResponse(xmlStr: string): GoGlobalValuationResponse {
  let main: Record<string, unknown>;

  try {
    const data = JSON.parse(xmlStr);
    main = data.Main || data;
  } catch {
    const parsed = xmlParser.parse(xmlStr);
    main = parsed.Root?.Main || parsed.Main || parsed;
  }

  if ((main as Record<string, unknown>).Error) {
    const err = (main as Record<string, unknown>).Error as Record<string, string>;
    throw new Error(`GoGlobal valuation error: ${err.Message || 'Unknown error'}`);
  }

  return {
    HotelSearchCode: String(main.HotelSearchCode || ''),
    ArrivalDate: String(main.ArrivalDate || ''),
    Nights: Number(main.Nights || 0),
    HotelName: String(main.HotelName || ''),
    HotelCode: String(main.HotelCode || ''),
    RoomBasis: String(main.RoomBasis || ''),
    TotalPrice: Number(main.TotalPrice || 0),
    Currency: String(main.Currency || main['@_currency'] || ''),
    CxlDeadLine: String(main.CxlDeadLine || main.CxlDeadline || main.CancellationDeadline || ''),
    NonRef: main.NonRef === true || main.NonRef === 'true' || main.NonRef === 1,
    CancellationPolicies: parseCancellationPolicies(
      (main.CancellationPolicies as Record<string, unknown>)?.CancelPolicy ||
      main.CancellationPolicies
    ),
    Remarks: String(main.Remarks || main.Remark || ''),
    Available: main.Available !== false,
  };
}

export function parseBookingResponse(xmlStr: string): GoGlobalBookingResponse {
  let main: Record<string, unknown>;

  try {
    const data = JSON.parse(xmlStr);
    main = data.Main || data;
  } catch {
    const parsed = xmlParser.parse(xmlStr);
    main = parsed.Root?.Main || parsed.Main || parsed;
  }

  return {
    GoBookingCode: String(main.GoBookingCode || ''),
    BookingStatus: String(main.BookingStatus || '') as GoGlobalBookingStatusCode,
    HotelName: String(main.HotelName || ''),
    HotelCode: String(main.HotelCode || ''),
    ArrivalDate: String(main.ArrivalDate || ''),
    Nights: Number(main.Nights || 0),
    TotalPrice: Number(main.TotalPrice || 0),
    Currency: String(main.Currency || ''),
    RoomBasis: String(main.RoomBasis || ''),
    Leader: {
      Title: String((main.Leader as Record<string, unknown>)?.Title || ''),
      FirstName: String((main.Leader as Record<string, unknown>)?.FirstName || ''),
      LastName: String((main.Leader as Record<string, unknown>)?.LastName || ''),
    },
    HotelConfirmationNumber: main.HotelConfirmation ? String(main.HotelConfirmation) : undefined,
    ErrorMessage: main.ErrorMessage ? String(main.ErrorMessage) : undefined,
  };
}

export function parseCancelResponse(xmlStr: string): GoGlobalCancelResponse {
  let main: Record<string, unknown>;

  try {
    const data = JSON.parse(xmlStr);
    main = data.Main || data;
  } catch {
    const parsed = xmlParser.parse(xmlStr);
    main = parsed.Root?.Main || parsed.Main || parsed;
  }

  return {
    GoBookingCode: String(main.GoBookingCode || ''),
    BookingStatus: String(main.BookingStatus || '') as GoGlobalBookingStatusCode,
    ErrorMessage: main.ErrorMessage ? String(main.ErrorMessage) : undefined,
    Penalty: main.Penalty ? {
      Amount: String((main.Penalty as Record<string, unknown>).Amount || '0'),
      Currency: String((main.Penalty as Record<string, unknown>).Currency || 'EUR'),
    } : undefined,
  };
}

export function parseStatusResponse(xmlStr: string): GoGlobalStatusResponse {
  let main: Record<string, unknown>;

  try {
    const data = JSON.parse(xmlStr);
    main = data.Main || data;
  } catch {
    const parsed = xmlParser.parse(xmlStr);
    main = parsed.Root?.Main || parsed.Main || parsed;
  }

  return {
    GoBookingCode: String(main.GoBookingCode || ''),
    BookingStatus: String(main.BookingStatus || '') as GoGlobalBookingStatusCode,
    HotelName: String(main.HotelName || ''),
    ArrivalDate: String(main.ArrivalDate || ''),
    Nights: Number(main.Nights || 0),
    TotalPrice: Number(main.TotalPrice || 0),
    Currency: String(main.Currency || ''),
    HotelConfirmationNumber: main.HotelConfirmation ? String(main.HotelConfirmation) : undefined,
    ErrorMessage: main.ErrorMessage ? String(main.ErrorMessage) : undefined,
  };
}
