import { existsSync } from "fs";

const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];

function findLocalChrome(): string | null {
  for (const p of LOCAL_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Generate PDF buffer from HTML using Puppeteer.
 * Tries @sparticuz/chromium (serverless), falls back to local system Chrome.
 */
export async function generatePDFFromHTML(html: string): Promise<Buffer | null> {
  const puppeteer = await import("puppeteer-core");

  // Try serverless Chromium first (Vercel/AWS Lambda)
  let browser;
  try {
    const chromium = await import("@sparticuz/chromium");
    browser = await puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  } catch {
    // Fallback to local system Chrome
    const localPath = findLocalChrome();
    if (!localPath) {
      console.warn("No Chrome/Chromium found for PDF generation");
      return null;
    }
    browser = await puppeteer.default.launch({
      executablePath: localPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 10000,
    });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      printBackground: true,
    });
    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error("PDF generation failed:", err);
    await browser.close().catch(() => {});
    return null;
  }
}
