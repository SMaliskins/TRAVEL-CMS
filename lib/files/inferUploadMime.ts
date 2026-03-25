/**
 * Browsers often send empty type or application/octet-stream for drag-drop / desktop files.
 * Use filename + magic bytes so passport (and similar) uploads still route to PDF vs image.
 */

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jpe": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function inferMimeFromFilename(filename: string): string | undefined {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return undefined;
  const ext = filename.slice(dot).toLowerCase();
  return EXT_TO_MIME[ext];
}

/** Works with a short prefix of the file (e.g. first 64 bytes). */
export function inferMimeFromBytes(buf: Uint8Array): string | undefined {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return undefined;
}

export function normalizeImageMime(mime: string): string {
  const t = mime.trim();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}
