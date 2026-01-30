/**
 * Render PDF first page as image - isolated module to avoid pdfjs version conflict with unpdf.
 * Uses pdf-to-img only (no unpdf imports).
 */

import sharp from "sharp";

export async function renderFirstPageAsPng(pdfBuffer: Buffer): Promise<Buffer | null> {
  const { pdf } = await import("pdf-to-img");
  const doc = await pdf(pdfBuffer, { scale: 2 });
  let firstPage: Buffer | null = null;

  for await (const image of doc) {
    firstPage = Buffer.from(image);
    break;
  }

  return firstPage && firstPage.length > 0 ? firstPage : null;
}

export async function renderFirstPageAsJpeg(pdfBuffer: Buffer): Promise<Buffer | null> {
  const png = await renderFirstPageAsPng(pdfBuffer);
  if (!png) return null;

  return sharp(png)
    .jpeg({ quality: 90 })
    .toBuffer();
}
