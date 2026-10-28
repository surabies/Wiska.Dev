// app/(auth)/layout.tsx — kerangka bersama untuk semua halaman autentikasi
// (login, dan nanti mis. /verify atau /unauthorized).
//
// `(auth)` adalah ROUTE GROUP: tanda kurung membuat folder ini TIDAK menjadi
// segmen URL — halaman di dalamnya tetap /login, bukan /auth/login. Gunanya
// murni mengelompokkan halaman yang berbagi layout & karakter yang sama.
// Pola yang sama nanti dipakai untuk `app/(dashboard)/` yang punya sidebar
// dan header sendiri, tanpa mengubah URL-nya.
import type { Metadata } from "next"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  // Halaman auth tidak boleh diindeks mesin pencari.
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="w-full max-w-sm">{children}</main>

      <footer className="mt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} PERUMDA Tirtawening Kota Bandung
      </footer>
    </div>
  )
}
