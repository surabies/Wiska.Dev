import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { siteConfig } from "@/config/site";
import { fontBody, fontDisplay } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.title,
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    site: "@dicefm",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fontBody.variable} ${fontDisplay.variable}`}>
      <body className="bg-white font-body leading-[1.4] text-black antialiased">
        <SiteHeader />
        {/* Section putih berurutan menyatu: tidak ada padding-top ganda. */}
        <main className="flex flex-col pt-22 [&_.section-white+.section-white]:pt-0">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
