// components/layout/navbar/NavbarLinks.tsx
// Tugas: daftar link teks di navbar desktop. Datanya dari config/navigation.ts.
import Link from "next/link"
import { navbarLinks } from "@/config/navigation"

export function NavbarLinks() {
  return (
    <nav className="flex items-center gap-6">
      {navbarLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
