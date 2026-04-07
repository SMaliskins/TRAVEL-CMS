/** Labels for HMAC derivation — must stay in sync between Node (jwt) and Edge (middleware refresh verify). */
export const CLIENT_JWT_PURPOSE = {
  access: 'travel-cms:client-portal:access-v1',
  refresh: 'travel-cms:client-portal:refresh-v1',
  invitation: 'travel-cms:client-portal:invitation-v1',
} as const

export type ClientJwtPurpose = keyof typeof CLIENT_JWT_PURPOSE

export const DUMMY_SERVICE_ROLE = 'dummy-key-for-build'
