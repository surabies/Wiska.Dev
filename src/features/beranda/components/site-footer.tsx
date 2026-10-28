// features/beranda/components/site-footer.tsx — footer bersama seluruh
// permukaan publik. Hanya memuat tautan yang benar-benar ada (tidak ada
// kolom "Karier/Blog/Press" palsu) dan kontak yang bisa dipertanggung-
// jawabkan: alamat kantor pusat PERUMDA Tirtawening.
//
// Menggunakan token global agar serasi dengan tema dan seluruh halaman.
import Link from "next/link"
import { AppLogo } from "@/components/app-logo"
import { TombolPasang } from "@/components/pwa/tombol-pasang"
import { NAV_LAYANAN } from "./nav-links"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 md:grid-cols-12 md:px-8">
        <div className="col-span-2 flex flex-col gap-4 md:col-span-5">
          <div className="flex items-center gap-2.5">
            <AppLogo className="size-7" />
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
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Perusahaan Umum Daerah Air Minum Kota Bandung. Layanan digital ini terbuka 24 jam
            untuk seluruh warga — pelanggan maupun bukan.
          </p>
        </div>

        <nav aria-label="Tautan layanan" className="md:col-span-3">
          <h2
            className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Layanan
          </h2>
          <ul className="mt-4 space-y-2.5">
            {NAV_LAYANAN.map((item) => (
              <li key={item.href}>
                {item.nonaktif ? (
                  <span
                    aria-disabled="true"
                    title="Sementara tidak tersedia"
                    className="cursor-not-allowed text-sm text-foreground/40"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-4">
          <h2
            className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Kantor Pelayanan
          </h2>
          <address className="mt-4 text-sm leading-relaxed text-muted-foreground not-italic">
            Jl. Badaksinga No. 10
            <br />
            Kota Bandung, Jawa Barat
          </address>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Loket: Senin–Jumat, jam kerja.
            <br />
            Layanan daring: 24 jam.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 md:px-8">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PERUMDA Tirtawening Kota Bandung
          </p>
          <div className="flex items-center gap-4">
            {/* Tempat orang mencari saat sudah menutup dialog ajakan dan
                melewatkan tombol di header. */}
            <TombolPasang
              bentuk="tautan"
              className="text-muted-foreground hover:text-foreground"
            />
            <Link
              href="/login"
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Masuk sebagai petugas
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
