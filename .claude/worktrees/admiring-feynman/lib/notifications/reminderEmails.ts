/**
 * Email HTML builders for cron-based reminder notifications.
 * Each function returns { subject, html, text } ready for sendEmail().
 */

export function buildCheckinEmail(params: {
  flightNumber: string;
  clientName: string;
  bookingRef: string;
  departureTime: string;
  checkinUrl: string;
  type: "reminder" | "open";
}) {
  const { flightNumber, clientName, bookingRef, departureTime, checkinUrl, type } = params;
  const depFormatted = new Date(departureTime).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isOpen = type === "open";
  const headline = isOpen
    ? `Check-in is NOW OPEN for ${flightNumber}`
    : `Check-in opens soon for ${flightNumber}`;

  const subject = `${isOpen ? "✈️" : "⏰"} ${headline} — ${clientName}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <h2 style="color:#1e40af">${isOpen ? "✈️" : "⏰"} ${headline}</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;width:140px">Flight</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${flightNumber}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">Departure</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${depFormatted}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">Passenger</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${clientName}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">PNR</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:16px">${bookingRef}</td></tr>
  </table>
  ${isOpen ? `<div style="text-align:center;margin:24px 0"><a href="${checkinUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Check-in Online Now</a></div>` : ""}
  <p style="color:#6b7280;font-size:13px">Check-in link: <a href="${checkinUrl}">${checkinUrl}</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#9ca3af;font-size:11px">Automated reminder from Travel CMS</p>
</div>`.trim();

  const text = `${headline}\nFlight: ${flightNumber}\nDeparture: ${depFormatted}\nPassenger: ${clientName}\nPNR: ${bookingRef}\nCheck-in: ${checkinUrl}`;

  return { subject, html, text };
}

export function buildPassportExpiryEmail(params: {
  clientName: string;
  expiryDate: string;
  tripDate: string;
  orderCode: string;
}) {
  const { clientName, expiryDate, tripDate, orderCode } = params;

  const fmtExpiry = new Date(expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTrip = new Date(tripDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const subject = `⚠️ Passport expiry alert — ${clientName} (${orderCode})`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <h2 style="color:#b45309">⚠️ Passport Expiry Warning</h2>
  <p>The passport of <strong>${clientName}</strong> expires on <strong>${fmtExpiry}</strong>, which is less than 6 months before the trip on <strong>${fmtTrip}</strong> (order ${orderCode}).</p>
  <p>Please contact the client to renew their passport.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#9ca3af;font-size:11px">Automated reminder from Travel CMS</p>
</div>`.trim();

  const text = `Passport expiry alert — ${clientName}\nExpiry: ${fmtExpiry}\nTrip: ${fmtTrip} (order ${orderCode})\nPlease contact the client to renew their passport.`;

  return { subject, html, text };
}

export function buildOverduePaymentEmail(params: {
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  orderCode: string;
  clientName: string;
}) {
  const { invoiceNumber, amount, currency, dueDate, orderCode, clientName } = params;

  const fmtDue = new Date(dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const fmtAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "EUR" }).format(amount);

  const subject = `🔴 Overdue payment ${fmtAmount} — ${clientName} (${orderCode})`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <h2 style="color:#dc2626">🔴 Overdue Payment</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;width:140px">Invoice</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${invoiceNumber}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">Client</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${clientName}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">Amount Due</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#dc2626">${fmtAmount}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">Due Date</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${fmtDue}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">Order</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${orderCode}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#9ca3af;font-size:11px">Automated reminder from Travel CMS</p>
</div>`.trim();

  const text = `Overdue payment — ${clientName}\nInvoice: ${invoiceNumber}\nAmount: ${fmtAmount}\nDue: ${fmtDue}\nOrder: ${orderCode}`;

  return { subject, html, text };
}
