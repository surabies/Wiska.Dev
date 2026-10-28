// features/beranda/components/site-header.tsx — header bersama seluruh
// permukaan publik (landing + cek-tagihan/lapor-meter/pengaduan), supaya
// warga merasakan satu situs, bukan kumpulan halaman lepas.
//
// Server component; satu-satunya bagian interaktif (menu mobile) diisolasi
// di MobileNav. `sesiPetugas` dihitung pemanggil (layout/page yang membaca
// auth()) — header sendiri tidak menyentuh sesi supaya tetap murni tampilan.
//
// Menggunakan token tema global agar tampil konsisten di semua halaman dan
// mengikuti pilihan tema terang/gelap pengguna.
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { TombolPasang } from "@/components/pwa/tombol-pasang";
import { NAV_LAYANAN } from "./nav-links";
import { MobileNav } from "./mobile-nav";

export function SiteHeader({
  sesiPetugas = false,
}: {
  sesiPetugas?: boolean;
}) {
  const cta = sesiPetugas
    ? { href: "/dashboard", label: "Buka Dasbor" }
    : { href: "/login", label: "Masuk Petugas" };
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5 md:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="Beranda PERUMDA Tirtawening"
        >
          <AppLogo className="size-7 group-hover:animate-bounce-subtle" />

          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              PERUMDA Tirtawening
            </span>
            <span
              className="mt-0.5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase"
            >
              Kota Bandung
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_LAYANAN.map((item) =>
            item.nonaktif ? (
              <span
                key={item.href}
                aria-disabled="true"
                title="Sementara tidak tersedia"
                className="cursor-not-allowed px-3 py-2 text-sm font-medium text-muted-foreground/50"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Menyembunyikan diri sendiri bila aplikasi sudah terpasang. */}
          <TombolPasang />
          <ThemeToggle />
          <div aria-hidden="true" className="hidden h-5 w-px bg-border md:block" />
          <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
          <MobileNav ctaHref={cta.href} ctaLabel={cta.label} />
        </div>
      </div>
    </header>
  );
}
