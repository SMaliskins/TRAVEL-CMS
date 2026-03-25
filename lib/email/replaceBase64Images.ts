/**
 * Replace inline base64 data-URI images in HTML with publicly hosted URLs.
 *
 * Email clients (Gmail, Outlook, etc.) strip or ignore <img src="data:...">
 * tags. This utility extracts every base64 image, uploads it to Supabase
 * Storage, and rewrites the `src` to a public URL so images render correctly.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DATA_URI_RE = /(<img\b[^>]*?\bsrc\s*=\s*")data:image\/([\w+.-]+);base64,([^"]+)(")/gi;

const BUCKET = "email-images";

function mimeExtension(subtype: string): string {
  const map: Record<string, string> = {
    jpeg: "jpg", png: "png", gif: "gif", webp: "webp", svg: "svg",
    "svg+xml": "svg", bmp: "bmp", tiff: "tiff",
  };
  return map[subtype.toLowerCase()] || "png";
}

export async function replaceBase64Images(html: string): Promise<string> {
  const matches = [...html.matchAll(DATA_URI_RE)];
  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const [fullMatch, prefix, subtype, base64Data, suffix] = match;
    try {
      const buffer = Buffer.from(base64Data, "base64");
      const ext = mimeExtension(subtype);
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const contentType = `image/${subtype}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filename, buffer, { contentType, upsert: false });

      if (uploadError) {
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("does not exist")) {
          await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
          const { error: retryError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(filename, buffer, { contentType, upsert: false });
          if (retryError) {
            console.error("[replaceBase64Images] Upload retry failed:", retryError);
            continue;
          }
        } else {
          console.error("[replaceBase64Images] Upload failed:", uploadError);
          continue;
        }
      }

      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename);
      if (urlData?.publicUrl) {
        result = result.replace(fullMatch, `${prefix}${urlData.publicUrl}${suffix}`);
      }
    } catch (err) {
      console.error("[replaceBase64Images] Error processing image:", err);
    }
  }

  return result;
}
