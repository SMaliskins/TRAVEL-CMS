import type { GOGLOBAL_CONFIG } from './config';
import type { GoGlobalSearchRequest, GoGlobalBookingRequest } from './types';

type Config = typeof GOGLOBAL_CONFIG;

function soapEnvelope(requestType: number, innerXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>\
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\
<soap12:Body>\
<MakeRequest xmlns="http://www.goglobal.travel/">\
<requestType>${requestType}</requestType>\
<xmlRequest><![CDATA[${innerXml}]]></xmlRequest>\
</MakeRequest>\
</soap12:Body>\
</soap12:Envelope>`;
}

function header(
  config: Config,
  operation: string
): string {
  return `<Header>\
<Agency>${config.agencyId}</Agency>\
<User>${config.username}</User>\
<Password>${config.password}</Password>\
<Operation>${operation}</Operation>\
<OperationType>Request</OperationType>\
</Header>`;
}

function buildRoomsXml(rooms: GoGlobalSearchRequest['Rooms']): string {
  return rooms
    .map((room) => {
      const childCount = room.ChildCount || 0;
      let xml = `<Room Adults="${room.Adults}" RoomCount="1" ChildCount="${childCount}"`;
      if (childCount > 0 && room.ChildAge?.length) {
        xml += `>`;
        room.ChildAge.forEach((age) => {
          xml += `<ChildAge>${age}</ChildAge>`;
        });
        xml += `</Room>`;
      } else {
        xml += ` />`;
      }
      return xml;
    })
    .join('');
}

export function buildSearchRequest(
  config: Config,
  params: GoGlobalSearchRequest
): string {
  const currency = params.Currency || 'EUR';
  let mainContent = '';

  mainContent += `<MaximumWaitTime>15</MaximumWaitTime>`;

  if (params.HotelId) {
    mainContent += `<Hotels><HotelId>${params.HotelId}</HotelId></Hotels>`;
  } else if (params.CityCode) {
    mainContent += `<CityCode>${params.CityCode}</CityCode>`;
  }

  mainContent += `<ArrivalDate>${params.ArrivalDate}</ArrivalDate>`;
  mainContent += `<Nights>${params.Nights}</Nights>`;
  mainContent += `<Rooms>${buildRoomsXml(params.Rooms)}</Rooms>`;

  if (params.Nationality) {
    mainContent += `<Nationality>${params.Nationality}</Nationality>`;
  }
  if (params.FilterPriceMin !== undefined) {
    mainContent += `<FilterPriceMin>${params.FilterPriceMin}</FilterPriceMin>`;
  }
  if (params.FilterPriceMax !== undefined) {
    mainContent += `<FilterPriceMax>${params.FilterPriceMax}</FilterPriceMax>`;
  }
  if (params.Stars !== undefined) {
    mainContent += `<Stars>${params.Stars}</Stars>`;
  }
  if (params.MaxResponses !== undefined) {
    mainContent += `<MaxResponses>${params.MaxResponses}</MaxResponses>`;
  }

  const innerXml =
    `<Root>${header(config, 'HOTEL_SEARCH_REQUEST')}` +
    `<Main Version="${config.apiVersion}" ResponseFormat="JSON" Currency="${currency}">` +
    mainContent +
    `</Main></Root>`;

  return soapEnvelope(11, innerXml);
}

export function buildValuationRequest(
  config: Config,
  hotelSearchCode: string,
  arrivalDate: string
): string {
  const innerXml =
    `<Root>${header(config, 'BOOKING_VALUATION_REQUEST')}` +
    `<Main Version="${config.apiVersion}">` +
    `<HotelSearchCode>${hotelSearchCode}</HotelSearchCode>` +
    `<ArrivalDate>${arrivalDate}</ArrivalDate>` +
    `</Main></Root>`;

  return soapEnvelope(9, innerXml);
}

export function buildBookingRequest(
  config: Config,
  params: GoGlobalBookingRequest
): string {
  let roomAllocations = '';
  params.RoomAllocations.forEach((ra) => {
    roomAllocations +=
      `<RoomAllocation>` +
      `<RoomNo>${ra.RoomNo}</RoomNo>` +
      `<GuestFirstName>${ra.GuestFirstName}</GuestFirstName>` +
      `<GuestLastName>${ra.GuestLastName}</GuestLastName>` +
      `</RoomAllocation>`;
  });

  const innerXml =
    `<Root>${header(config, 'BOOKING_INSERT_REQUEST')}` +
    `<Main Version="${config.apiVersion}">` +
    `<HotelSearchCode>${params.HotelSearchCode}</HotelSearchCode>` +
    `<AgentReference>${params.AgentReference}</AgentReference>` +
    `<NoAlternativeHotel>1</NoAlternativeHotel>` +
    `<Leader>` +
    `<Title>${params.Leader.Title}</Title>` +
    `<FirstName>${params.Leader.FirstName}</FirstName>` +
    `<LastName>${params.Leader.LastName}</LastName>` +
    `</Leader>` +
    `<RoomAllocations>${roomAllocations}</RoomAllocations>` +
    `</Main></Root>`;

  return soapEnvelope(2, innerXml);
}

export function buildCancelRequest(
  config: Config,
  goBookingCode: string
): string {
  const innerXml =
    `<Root>${header(config, 'BOOKING_CANCEL_REQUEST')}` +
    `<Main Version="${config.apiVersion}">` +
    `<GoBookingCode>${goBookingCode}</GoBookingCode>` +
    `</Main></Root>`;

  return soapEnvelope(3, innerXml);
}

export function buildStatusRequest(
  config: Config,
  goBookingCode: string
): string {
  const innerXml =
    `<Root>${header(config, 'BOOKING_STATUS_REQUEST')}` +
    `<Main Version="${config.apiVersion}">` +
    `<GoBookingCode>${goBookingCode}</GoBookingCode>` +
    `</Main></Root>`;

  return soapEnvelope(5, innerXml);
}

export function buildHotelInfoRequest(
  config: Config,
  hotelId: string
): string {
  const innerXml =
    `<Root>${header(config, 'HOTEL_INFO_REQUEST')}` +
    `<Main Version="${config.apiVersion}">` +
    `<HotelId>${hotelId}</HotelId>` +
    `</Main></Root>`;

  return soapEnvelope(6, innerXml);
}
