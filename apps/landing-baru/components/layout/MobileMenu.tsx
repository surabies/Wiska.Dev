"use client"

import { Menu, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { PillButton } from "@/components/shared/PillButton"
import { downloadAppLink, mainNavLinks } from "@/config/site"

/**
 * Menu layar kecil (< md): panel putih jatuh dari header dengan latar gelap.
 * Dirender di dalam <header> (fixed), sehingga panel & overlay mengikuti header.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <>
      {/* data-open dibaca header (has-[[data-open=true]]) untuk membalik warna tombol. */}
      <PillButton
        type="button"
        size="icon"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        data-open={open}
        onClick={() => setOpen((current) => !current)}
        className="ml-2 size-8 p-0 data-[open=true]:bg-white data-[open=true]:text-black md:hidden"
      >
        {open ? (
          <X size={24} aria-hidden="true" />
        ) : (
          <Menu size={24} aria-hidden="true" />
        )}
      </PillButton>

      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 -z-10 bg-black/70 md:hidden"
          />
          <div
            id="mobile-menu"
            className="absolute inset-x-3 top-full rounded-md bg-white p-3 md:hidden"
          >
            <ul>
              {mainNavLinks.map((link) => (
                <li
                  key={link.href}
                  className="border-b border-placeholder last:border-b-0"
                >
                  <Link
                    href={link.href}
                    onClick={close}
                    className="block py-3 text-[15px] leading-5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <PillButton asChild className="mt-3 h-8 w-full">
              <Link href={downloadAppLink.href} onClick={close}>
                {downloadAppLink.label}
              </Link>
            </PillButton>
          </div>
        </>
      ) : null}
    </>
  )
}
