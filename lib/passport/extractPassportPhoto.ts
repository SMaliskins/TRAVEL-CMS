/**
 * Extract passport photo from PDF
 * 1. Try unpdf extractImages - embedded images (digital passports)
 * 2. Fallback: pdf-to-img - render page as image (scanned PDFs)
 */

import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

export async function extractAndUploadPassportPhoto(
  pdfBuffer: Buffer
): Promise<string | null> {
  try {
    // 1. Try embedded images first (digital passports)
    const embeddedUrl = await extractEmbeddedImage(pdfBuffer);
    if (embeddedUrl) return embeddedUrl;

    // 2. Fallback: render first page as image (scanned PDFs)
    return await renderPageAsImage(pdfBuffer);
  } catch (err) {
    console.error("Extract passport photo error:", err);
    return null;
  }
}

async function extractEmbeddedImage(pdfBuffer: Buffer): Promise<string | null> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const imagesData = await extractImages(pdf, 1);

  if (imagesData.length === 0) return null;

  const largest = imagesData.reduce((a, b) =>
    a.width * a.height > b.width * b.height ? a : b
  ) as { buffer: ArrayBuffer | Buffer; width: number; height: number; channels?: number };

  const rawBuffer = Buffer.isBuffer(largest.buffer)
    ? largest.buffer
    : Buffer.from(largest.buffer);
  const channels = largest.channels ?? 3;

  const jpegBuffer = await sharp(rawBuffer, {
    raw: {
      width: largest.width,
      height: largest.height,
      channels,
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  return uploadToStorage(jpegBuffer, "image/jpeg");
}

async function renderPageAsImage(pdfBuffer: Buffer): Promise<string | null> {
  try {
    const { renderFirstPageAsJpeg } = await import("./renderPdfPage");
    const jpegBuffer = await renderFirstPageAsJpeg(pdfBuffer);
    if (!jpegBuffer) return null;

    return uploadToStorage(jpegBuffer, "image/jpeg");
  } catch (err) {
    console.error("[Passport photo] renderPageAsImage failed:", err);
    return null;
  }
}

async function uploadToStorage(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const filename = `passport-${randomUUID()}.jpg`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(filename, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[Passport photo] Supabase upload failed:", uploadError.message);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from("avatars")
    .getPublicUrl(filename);

  return data.publicUrl;
}
