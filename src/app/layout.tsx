import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { themeScript } from "@/components/theme-toggle";
import { personalizationScript } from "@/lib/personalization";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
// Manrope is the primary UI typeface (per the personalized-dashboard design).
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lab — Herramientas para dev",
  description:
    "Panel personal de herramientas y automatizaciones: correos, utilidades de dev, scraping, calendario y tareas programadas.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: personalizationScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
