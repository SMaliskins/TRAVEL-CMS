/** Short human-readable label from User-Agent (best effort, English). */
export function deviceLabelFromUserAgent(ua: string | null | undefined): string {
  if (!ua || !ua.trim()) return "Unknown device";
  const s = ua.trim();
  let os = "";
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(s)) os = "macOS";
  else if (/iPhone|iPad|iPod/i.test(s)) os = /iPad/i.test(s) ? "iPadOS" : "iOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = "Safari";
  else if (/Chromium/i.test(s)) browser = "Chromium";

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" · ") : s.slice(0, 80);
}
