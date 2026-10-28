// components/layout/navbar/Navbar.tsx
// Tugas: HANYA merakit komponen-komponen kecil menjadi satu navbar.
import { NavbarBrand } from "./NavbarBrand"
import { NavbarLinks } from "./NavbarLinks"
import { NavbarPlus } from "./NavbarPlus"
import { NavbarMobileBar } from "./NavbarMobileBar"
import { MobileMenu } from "./MobileMenu"
import { UserMenu } from "./user-menu"

export function Navbar({
  user,
  onKeluar,
}: {
  user: {
    name: string | null
    email: string
    image: string | null
    role: string
  }
  onKeluar: () => Promise<void>
}) {
  return (
    // Tanpa border-b dan satu warna dengan sidebar (bg-muted) supaya menyatu.
    // Tingginya harus sama dengan --navbar-h di DashboardShell.
    <header className="fixed inset-x-0 top-0 z-10 bg-muted">
      {/* ===== Bar utama (tampil di semua ukuran layar) ===== */}
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Kiri: logo + dropdown versi */}
        <NavbarBrand />

        {/* Kanan: isinya berbeda untuk mobile dan desktop */}
        <div className="flex items-center gap-1 lg:gap-6">
          {/* MOBILE SAJA: ikon titik 3 -> membuka menu layar penuh */}
          <div className="lg:hidden">
            <MobileMenu />
          </div>

          {/* DESKTOP SAJA: link menu dan kotak sorot "Bantuan" */}
          <div className="flex items-center gap-6 max-lg:hidden">
            <NavbarLinks />
            <NavbarPlus />
          </div>

          <UserMenu
            nama={user.name}
            email={user.email}
            image={user.image}
            role={user.role}
            onKeluar={onKeluar}
          />
        </div>
      </div>

      {/* ===== Bar kedua: hamburger + breadcrumb (khusus mobile) ===== */}
      <NavbarMobileBar />
    </header>
  )
}