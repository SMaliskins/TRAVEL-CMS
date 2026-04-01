/**
 * Check-in Notification Service
 * 
 * Handles desktop notifications and email alerts for flight check-in
 */

import { getAirlineCheckinInfo, getCheckinUrl } from "@/lib/flights/airlineCheckin";

export interface CheckinNotificationData {
  flightNumber: string;
  departureDateTime: string;
  bookingRef: string;
  clientName: string;
  clientEmail?: string;
  agentEmail: string;
  checkinUrl: string;
}

/**
 * Request permission for desktop notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

/**
 * Show desktop notification for check-in
 */
export function showCheckinNotification(data: {
  flightNumber: string;
  clientName: string;
  bookingRef: string;
  checkinUrl: string;
  type: "opening_soon" | "now_open";
}): void {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const title = data.type === "now_open" 
    ? `✈️ Check-in NOW OPEN: ${data.flightNumber}`
    : `⏰ Check-in opens soon: ${data.flightNumber}`;
  
  const body = `${data.clientName}\nPNR: ${data.bookingRef}`;

  const notification = new Notification(title, {
    body,
    icon: "/plane-icon.png",
    tag: `checkin-${data.bookingRef}-${data.flightNumber}`,
    requireInteraction: data.type === "now_open",
  });

  notification.onclick = () => {
    notification.close();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-url-in-modal", {
          detail: { url: data.checkinUrl, title: "Check-in" },
        })
      );
    }
  };
}

/**
 * Calculate time until check-in opens
 */
export function getTimeUntilCheckin(flightNumber: string, departureDateTime: string): {
  status: "upcoming" | "opening_soon" | "open" | "closing_soon" | "closed" | "past";
  msUntilOpen?: number;
  msUntilClose?: number;
  opensAt?: Date;
  closesAt?: Date;
} {
  const airlineCode = flightNumber.match(/^([A-Z]{2})/i)?.[1]?.toUpperCase() || "";
  const airlineInfo = getAirlineCheckinInfo(airlineCode);
  
  if (!airlineInfo) {
    return { status: "upcoming" };
  }

  const depTime = new Date(departureDateTime).getTime();
  const now = Date.now();
  
  const checkinOpensAt = new Date(depTime - (airlineInfo.checkinHoursBefore * 60 * 60 * 1000));
  const checkinClosesAt = new Date(depTime - (airlineInfo.checkinHoursClose * 60 * 60 * 1000));
  
  // Already departed
  if (now > depTime) {
    return { status: "past" };
  }
  
  // Check-in closed
  if (now >= checkinClosesAt.getTime()) {
    return { status: "closed", closesAt: checkinClosesAt };
  }
  
  // Check-in is open
  if (now >= checkinOpensAt.getTime()) {
    const msUntilClose = checkinClosesAt.getTime() - now;
    // Closing soon (< 2 hours)
    if (msUntilClose < 2 * 60 * 60 * 1000) {
      return { 
        status: "closing_soon", 
        msUntilClose,
        opensAt: checkinOpensAt,
        closesAt: checkinClosesAt,
      };
    }
    return { 
      status: "open", 
      msUntilClose,
      opensAt: checkinOpensAt,
      closesAt: checkinClosesAt,
    };
  }
  
  // Check-in not yet open
  const msUntilOpen = checkinOpensAt.getTime() - now;
  
  // Opening soon (< 1 hour before check-in opens)
  if (msUntilOpen < 60 * 60 * 1000) {
    return { 
      status: "opening_soon", 
      msUntilOpen,
      opensAt: checkinOpensAt,
      closesAt: checkinClosesAt,
    };
  }
  
  return { 
    status: "upcoming", 
    msUntilOpen,
    opensAt: checkinOpensAt,
    closesAt: checkinClosesAt,
  };
}

// Email translations
type Locale = "en" | "ru" | "lv";

const emailTranslations: Record<Locale, {
  subject: string;
  title: string;
  flight: string;
  departure: string;
  passenger: string;
  pnr: string;
  buttonText: string;
  linkLabel: string;
  footer: string;
}> = {
  en: {
    subject: "Check-in Now Open",
    title: "Online Check-in is Now Open",
    flight: "Flight",
    departure: "Departure",
    passenger: "Passenger",
    pnr: "PNR / Booking Ref",
    buttonText: "Check-in Online Now",
    linkLabel: "Check-in link",
    footer: "This is an automated notification from Travel CMS.",
  },
  ru: {
    subject: "Регистрация на рейс открыта",
    title: "Онлайн-регистрация открыта",
    flight: "Рейс",
    departure: "Вылет",
    passenger: "Пассажир",
    pnr: "Код бронирования",
    buttonText: "Зарегистрироваться онлайн",
    linkLabel: "Ссылка на регистрацию",
    footer: "Это автоматическое уведомление от Travel CMS.",
  },
  lv: {
    subject: "Reģistrācija lidojumam ir atvērta",
    title: "Tiešsaistes reģistrācija ir atvērta",
    flight: "Reiss",
    departure: "Izlidošana",
    passenger: "Pasažieris",
    pnr: "Rezervācijas kods",
    buttonText: "Reģistrēties tiešsaistē",
    linkLabel: "Reģistrācijas saite",
    footer: "Šis ir automātisks paziņojums no Travel CMS.",
  },
};

/**
 * Format notification data for email
 */
export function formatCheckinEmailData(data: CheckinNotificationData & { locale?: Locale }) {
  const locale = data.locale || "en";
  const t = emailTranslations[locale] || emailTranslations.en;
  
  // Format date based on locale
  const dateLocaleMap: Record<Locale, string> = {
    en: "en-GB",
    ru: "ru-RU",
    lv: "lv-LV",
  };
  const formattedDate = new Date(data.departureDateTime).toLocaleString(dateLocaleMap[locale], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    subject: `✈️ ${t.subject}: ${data.flightNumber} - ${data.clientName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">✈️ ${t.title}</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 140px;">${t.flight}:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.flightNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${t.departure}:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${t.passenger}:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.clientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${t.pnr}:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 16px;">${data.bookingRef}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.checkinUrl}" 
             style="display: inline-block; background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            ✈️ ${t.buttonText}
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          ${t.linkLabel}: <a href="${data.checkinUrl}">${data.checkinUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          ${t.footer}
        </p>
      </div>
    `,
    text: `
${t.subject}: ${data.flightNumber}

${t.flight}: ${data.flightNumber}
${t.departure}: ${formattedDate}
${t.passenger}: ${data.clientName}
${t.pnr}: ${data.bookingRef}

${t.linkLabel}: ${data.checkinUrl}
    `,
  };
}
