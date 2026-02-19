import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

// Boarding passes are stored as JSONB in order_services.boarding_passes.
// Each entry: { id, fileName, fileUrl, clientId, clientName, flightNumber, uploadedAt, fileSize, mimeType }
// fileUrl is a Supabase Storage signed URL (bucket: boarding-passes), issued with 1-year TTL.
// We cannot regenerate signed URLs without storing the file path separately,
// so we return a fresh short-lived signed URL when the path can be inferred from the signed URL,
// falling back to the original fileUrl.

const BUCKET = 'boarding-passes'
const SIGNED_URL_TTL = 900 // 15 minutes

interface BoardingPassRecord {
  id: string
  fileName: string
  fileUrl: string
  clientId: string
  clientName: string
  flightNumber: string
  uploadedAt: string
  fileSize: number
  mimeType: string
}

function extractStoragePath(signedUrl: string): string | null {
  // Supabase signed URL format:
  // https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
  try {
    const url = new URL(signedUrl)
    const match = url.pathname.match(/\/storage\/v1\/object\/sign\/[^/]+\/(.+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await getAuthenticatedClient(req)
    const { id } = await params

    // Verify ownership
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('client_party_id', client.crmClientId)
      .single()

    if (orderError || !order) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    // Fetch all services that have boarding passes
    const { data: services, error } = await supabaseAdmin
      .from('order_services')
      .select('id, service_name, boarding_passes')
      .eq('order_id', id)
      .not('boarding_passes', 'is', null)

    if (error) {
      console.error('[client/bookings/documents] fetch error:', error.message)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    const documents: Array<{
      id: string
      serviceId: string
      serviceName: string
      fileName: string
      downloadUrl: string
      clientId: string
      clientName: string
      flightNumber: string
      uploadedAt: string
      fileSize: number
      mimeType: string
    }> = []

    for (const svc of services ?? []) {
      const passes = (svc.boarding_passes as BoardingPassRecord[]) ?? []
      for (const bp of passes) {
        let downloadUrl = bp.fileUrl

        // Try to re-sign for a fresh 15-min URL
        const storagePath = extractStoragePath(bp.fileUrl)
        if (storagePath) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, SIGNED_URL_TTL)
          if (signed?.signedUrl) {
            downloadUrl = signed.signedUrl
          }
        }

        documents.push({
          id: bp.id,
          serviceId: svc.id,
          serviceName: svc.service_name ?? '',
          fileName: bp.fileName,
          downloadUrl,
          clientId: bp.clientId,
          clientName: bp.clientName,
          flightNumber: bp.flightNumber,
          uploadedAt: bp.uploadedAt,
          fileSize: bp.fileSize,
          mimeType: bp.mimeType,
        })
      }
    }

    return Response.json({ data: documents, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
