export const GOGLOBAL_CONFIG = {
  endpoint:
    process.env.GOGLOBAL_ENDPOINT ||
    'https://gulliversia.xml.goglobal.travel/xmlwebservice.asmx',
  agencyId: process.env.GOGLOBAL_AGENCY_ID || '',
  username: process.env.GOGLOBAL_USERNAME || '',
  password: process.env.GOGLOBAL_PASSWORD || '',
  useSandbox: process.env.GOGLOBAL_USE_SANDBOX === 'true',
  searchTimeout: 20000,
  maxRequestsPerMinute: 10,
  apiVersion: '2.4',
};
