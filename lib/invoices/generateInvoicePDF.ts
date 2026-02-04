/**
 * Generate PDF buffer from HTML using Puppeteer + @sparticuz/chromium.
 * Works on Vercel/serverless. Returns null when Chromium is unavailable (e.g. local macOS).
 */
export async function generatePDFFromHTML(html: string): Promise<Buffer | null> {
  try {
    const chromium = await import("@sparticuz/chromium");
    const puppeteer = await import("puppeteer-core");

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });

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
  } catch {
    return null;
  }
}
