import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import LayoutClientWrapper from "./layout-client-wrapper";
import ClientLayout from "@/components/ClientLayout";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Travel CMS",
  description: "Travel CMS - Order Management System",
};

// Inline script to apply font + theme settings before React hydration (prevents flash)
const fontSettingsScript = `
(function() {
  try {
    var scale = localStorage.getItem('ui-font-scale');
    var font = localStorage.getItem('ui-font-family');
    var theme = localStorage.getItem('ui-color-scheme');
    
    if (scale) {
      var s = parseFloat(scale);
      if (!isNaN(s) && s >= 0.8 && s <= 1.2) {
        document.documentElement.style.setProperty('--font-scale', s);
        document.documentElement.style.fontSize = (s * 100) + '%';
      }
    }
    
    if (font) {
      var fonts = {
        'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        'geist': "var(--font-geist-sans), -apple-system, sans-serif",
        'inter': "var(--font-inter), -apple-system, sans-serif"
      };
      if (fonts[font]) {
        document.documentElement.style.setProperty('--font-family', fonts[font]);
      }
    }
    
    var validThemes = ['pastel','soft','natural','ocean','classic','corporate'];
    if (theme && validThemes.indexOf(theme) >= 0) {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'classic');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontSettingsScript }} />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/css/flag-icons.min.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <LayoutClientWrapper>
          <ClientLayout>
            {children}
          </ClientLayout>
        </LayoutClientWrapper>
        <Analytics />
      </body>
    </html>
  );
}
