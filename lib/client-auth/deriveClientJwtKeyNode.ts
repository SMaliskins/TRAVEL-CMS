import crypto from 'crypto'
import { CLIENT_JWT_PURPOSE, type ClientJwtPurpose } from './clientJwtPurpose'

/** Same bytes as Edge Web Crypto HMAC in refresh-verify.ts */
export function deriveClientJwtKeyNode(purpose: ClientJwtPurpose, serviceRole: string): Uint8Array {
  const buf = crypto.createHmac('sha256', serviceRole).update(CLIENT_JWT_PURPOSE[purpose]).digest()
  return new Uint8Array(buf)
}
