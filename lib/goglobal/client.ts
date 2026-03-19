import { GOGLOBAL_CONFIG } from './config';
import type {
  GoGlobalSearchRequest,
  GoGlobalSearchResponse,
  GoGlobalValuationResponse,
  GoGlobalBookingRequest,
  GoGlobalBookingResponse,
  GoGlobalCancelResponse,
  GoGlobalStatusResponse,
} from './types';
import {
  buildSearchRequest,
  buildValuationRequest,
  buildBookingRequest,
  buildCancelRequest,
  buildStatusRequest,
  buildHotelInfoRequest,
} from './xmlBuilder';
import {
  extractResultFromSoap,
  parseSearchResponse,
  parseValuationResponse,
  parseBookingResponse,
  parseCancelResponse,
  parseStatusResponse,
} from './xmlParser';

export class GoGlobalClient {
  private config: typeof GOGLOBAL_CONFIG;

  constructor(config?: Partial<typeof GOGLOBAL_CONFIG>) {
    this.config = { ...GOGLOBAL_CONFIG, ...config };
  }

  private async soapRequest(
    requestType: number,
    operationName: string,
    soapBody: string
  ): Promise<string> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'API-AgencyID': this.config.agencyId,
        'API-Operation': operationName,
      },
      body: soapBody,
      signal: AbortSignal.timeout(this.config.searchTimeout),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `GoGlobal SOAP request failed: ${response.status} ${response.statusText} — ${text}`
      );
    }

    const soapXml = await response.text();
    return extractResultFromSoap(soapXml);
  }

  async searchHotels(
    params: GoGlobalSearchRequest
  ): Promise<GoGlobalSearchResponse> {
    try {
      const body = buildSearchRequest(this.config, params);
      const result = await this.soapRequest(11, 'HOTEL_SEARCH_REQUEST', body);
      return parseSearchResponse(result);
    } catch (error) {
      console.error('GoGlobal searchHotels error:', error);
      throw error;
    }
  }

  async valuateBooking(
    hotelSearchCode: string,
    arrivalDate: string
  ): Promise<GoGlobalValuationResponse> {
    try {
      const body = buildValuationRequest(this.config, hotelSearchCode, arrivalDate);
      const result = await this.soapRequest(9, 'BOOKING_VALUATION_REQUEST', body);
      return parseValuationResponse(result);
    } catch (error) {
      console.error('GoGlobal valuateBooking error:', error);
      throw error;
    }
  }

  async createBooking(
    params: GoGlobalBookingRequest
  ): Promise<GoGlobalBookingResponse> {
    try {
      const body = buildBookingRequest(this.config, params);
      const result = await this.soapRequest(2, 'BOOKING_INSERT_REQUEST', body);
      return parseBookingResponse(result);
    } catch (error) {
      console.error('GoGlobal createBooking error:', error);
      throw error;
    }
  }

  async cancelBooking(
    goBookingCode: string
  ): Promise<GoGlobalCancelResponse> {
    try {
      const body = buildCancelRequest(this.config, goBookingCode);
      const result = await this.soapRequest(3, 'BOOKING_CANCEL_REQUEST', body);
      return parseCancelResponse(result);
    } catch (error) {
      console.error('GoGlobal cancelBooking error:', error);
      throw error;
    }
  }

  async checkBookingStatus(
    goBookingCode: string
  ): Promise<GoGlobalStatusResponse> {
    try {
      const body = buildStatusRequest(this.config, goBookingCode);
      const result = await this.soapRequest(5, 'BOOKING_STATUS_REQUEST', body);
      return parseStatusResponse(result);
    } catch (error) {
      console.error('GoGlobal checkBookingStatus error:', error);
      throw error;
    }
  }

  async getHotelInfo(hotelId: string): Promise<Record<string, unknown>> {
    try {
      const body = buildHotelInfoRequest(this.config, hotelId);
      const result = await this.soapRequest(6, 'HOTEL_INFO_REQUEST', body);
      const { XMLParser } = await import('fast-xml-parser');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        trimValues: true,
      });
      return parser.parse(result);
    } catch (error) {
      console.error('GoGlobal getHotelInfo error:', error);
      throw error;
    }
  }
}

export const goGlobalClient = new GoGlobalClient();
