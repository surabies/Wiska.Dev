// components/layout/navigation/sidebar/PrimaryNav.tsx
// Tiga menu utama di atas daftar grup: Dashboard, Analytics, Report.
// Datanya dari `primaryNav` di config/Navigasi.ts.

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { primaryNav } from "@/config/Navigasi"
import { getPrimaryIcon } from "./types/Icons"
import { NavRowContent } from "./NavRow"
import { navRowClass } from "./types/Styles"
import { isPrimaryActive } from "./types/Utilitas"

export function PrimaryNav() {
  const pathname = usePathname()

  return (
    <ul className="flex flex-col gap-0.5">
      {primaryNav.map((item) => {
        const isActive = isPrimaryActive(pathname, item.href)

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={navRowClass(isActive)}
            >
              <NavRowContent icon={getPrimaryIcon(item.href)}>
                {item.title}
              </NavRowContent>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
