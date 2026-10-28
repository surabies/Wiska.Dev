"use client"

import { useSyncExternalStore, type ComponentProps } from "react"
import { BorderBeamCard } from "@/components/ui/border-beam-card"

type ThemeAwareBorderBeamCardProps = ComponentProps<typeof BorderBeamCard>

function subscribeToThemeChange(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

function getThemeSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getServerThemeSnapshot(): "light" | "dark" {
  return "light"
}

export function ThemeAwareBorderBeamCard({
  children,
  ...props
}: ThemeAwareBorderBeamCardProps) {
  const theme = useSyncExternalStore(
    subscribeToThemeChange,
    getThemeSnapshot,
    getServerThemeSnapshot,
  )

  return (
    <BorderBeamCard {...props} theme={theme}>
      {children}
    </BorderBeamCard>
  )
}
