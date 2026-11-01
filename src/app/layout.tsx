import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/PenyediaTema"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { LandingShell } from "@/components/landing/KerangkaBeranda"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
