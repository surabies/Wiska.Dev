"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

interface AutoHideHeaderProps {
  children: ReactNode
}

export function AutoHideHeader({ children }: AutoHideHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hidden, setHidden] = useState(false)

  const revealHeader = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setHidden(false)
  }, [])

  useEffect(() => {
    let previousScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const menuOpen = headerRef.current?.querySelector('[data-open="true"]')

      if (currentScrollY <= 0 || currentScrollY < previousScrollY || menuOpen) {
        revealHeader()
      } else if (
        currentScrollY > previousScrollY &&
        hideTimeoutRef.current === null
      ) {
        hideTimeoutRef.current = setTimeout(() => setHidden(true), 250)
      }

      previousScrollY = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [revealHeader])

  return (
    <header
      ref={headerRef}
      onFocusCapture={revealHeader}
      className={`fixed inset-x-0 top-0 z-40 bg-white/85 text-black backdrop-blur-[6px] transition-transform duration-300 ease-in-out motion-reduce:transition-none has-data-[open=true]:max-md:bg-transparent has-data-[open=true]:max-md:backdrop-blur-none md:bg-white/80 md:backdrop-blur-sm ${
        hidden ? "pointer-events-none -translate-y-full" : ""
      }`}
    >
      {children}
    </header>
  )
}
