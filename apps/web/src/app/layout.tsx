import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/PenyediaTema"
import { Toaster } from "@/components/ui/sonner"
import { fontBody, fontDisplay } from "@/lib/fonts"
import "./globals.css"
import { LandingShell } from "@/components/layout/LandingShell"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "monospace",
  ],
})

export const metadata: Metadata = {
  title: {
    default: "PERUMDA Tirtawening Kota Bandung",
    template: "%s | PERUMDA Tirtawening",
  },
  description:
    "Cek tagihan, lapor angka meter, dan sampaikan gangguan air tanpa antre di PERUMDA Tirtawening Kota Bandung.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${fontBody.variable} ${fontDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LandingShell>{children}</LandingShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
