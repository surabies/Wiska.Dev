"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

// Filter peringatan false-positive React 19 / Next.js saat next-themes menginjeksi script anti-flicker di development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return
    }
    originalConsoleError.apply(console, args)
  }
}

export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>
) {
  return <NextThemesProvider {...props} />
}
