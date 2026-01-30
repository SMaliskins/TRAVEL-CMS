import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Roboto, Open_Sans, Lato, Nunito, Poppins, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import LayoutClientWrapper from "./layout-client-wrapper";
import ClientLayout from "@/components/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Additional fonts for user selection
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["300", "400", "500", "700"],
  subsets: ["latin", "cyrillic"],
});

const openSans = Open_Sans({
  variable: "--font-opensans",
  subsets: ["latin", "cyrillic"],
});

const lato = Lato({
  variable: "--font-lato",
  weight: ["300", "400", "700"],
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-sourcesans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Travel CMS",
  description: "Travel CMS - Order Management System",
};

// Inline script to apply font settings before React hydration (prevents flash)
const fontSettingsScript = `
(function() {
  try {
    var scale = localStorage.getItem('ui-font-scale');
    var font = localStorage.getItem('ui-font-family');
    
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
        'inter': "var(--font-inter), -apple-system, sans-serif",
        'roboto': "var(--font-roboto), -apple-system, sans-serif",
        'opensans': "var(--font-opensans), -apple-system, sans-serif",
        'lato': "var(--font-lato), -apple-system, sans-serif",
        'nunito': "var(--font-nunito), -apple-system, sans-serif",
        'poppins': "var(--font-poppins), -apple-system, sans-serif",
        'sourcesans': "var(--font-sourcesans), -apple-system, sans-serif"
      };
      if (fonts[font]) {
        document.documentElement.style.setProperty('--font-family', fonts[font]);
      }
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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${roboto.variable} ${openSans.variable} ${lato.variable} ${nunito.variable} ${poppins.variable} ${sourceSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <LayoutClientWrapper>
          <ClientLayout>
            {children}
          </ClientLayout>
        </LayoutClientWrapper>
      </body>
    </html>
  );
}
