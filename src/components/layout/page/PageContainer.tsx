// components/layout/page/PageContainer.tsx
// Tugas: pembungkus isi tiap halaman: breadcrumb desktop, aksi, lalu konten.
//
// `penuh`: konten (mis. tabel/grid) menempel ke tepi card utama tanpa padding
// dan tanpa celah, gaya Neon. Hanya baris breadcrumb yang tetap berpadding.
// Tanpa `penuh`, perilakunya sama persis seperti sebelumnya.
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type Crumb = { label: string; href?: string }

export function PageContainer({
  breadcrumbs,
  actions,
  className,
  penuh = false,
  children,
}: {
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  className?: string
  /** Konten menyatu dengan layout: tanpa padding di sekitar children. */
  penuh?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0",
        !penuh && "px-3 pt-4 pb-2.5 sm:px-5 sm:pt-5 sm:pb-3 lg:px-8",
        className,
      )}
    >
      <header
        className={cn(
          "mb-2 flex shrink-0 min-h-7 items-center justify-between gap-3 sm:mb-2.5",
          // Mode penuh: padding pindah ke header, garis bawah memisahkan dari tabel.
          // px-4 (16px) disengaja: sama dengan tepi kiri checkbox di kolom
          // seleksi DataGrid (lebar 48px, checkbox 16px di tengah) dan dengan
          // padding toolbar DataGrid, jadi breadcrumb, checkbox, dan kotak
          // cari berada pada satu garis vertikal di semua ukuran layar.
          penuh && "mb-0  px-4 pt-4 pb-3 sm:mb-0 sm:pt-5",
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden shrink-0 sm:block">
            <ol className="flex flex-wrap items-center justify-start gap-1.5 text-sm/5 font-medium text-muted-foreground">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <li key={crumb.label} className="flex items-center gap-1.5">
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        aria-current={isLast ? "page" : undefined}
                        className={isLast ? "text-foreground" : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground"
                      >
                        /
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {children}
    </div>
  )
}