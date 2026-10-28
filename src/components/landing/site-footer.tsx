// Footer — meniru footer nextjs.org: latar abu-abu muda, grid 12 kolom (4 kolom tautan + spasi + form
// berlangganan), lalu baris bawah berisi logo (kiri) dan pemilih tema (kanan).
// Data dari BRAND & FOOTER (content.ts).
import Image from "next/image"
import Link from "next/link"

import { FooterBerlangganan } from "@/components/landing/footer-berlangganan"
import { FooterTema } from "@/components/landing/footer-tema"
import { BRAND, FOOTER, type TautanFooter } from "@/lib/landing/content"

// Style satu tautan footer: abu-abu, jadi hitam saat hover; fokus keyboard memakai cincin 2px + 4px
const kelasTautan =
  "w-fit rounded-sm text-sm text-muted-foreground no-underline transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"

/*
  TAHAP 1 — Satu tautan.
  - internal  → <Link>
  - eksternal → <a target="_blank" rel="noopener noreferrer">
  - belum tersedia → <span> (teks biasa, tanpa hover) agar tidak ada halaman 404 selama pengembangan
*/
function Tautan({ label, href, eksternal, tersedia }: TautanFooter) {
  if (!tersedia) {
    return (
      <span title="Segera hadir" className="w-fit cursor-default text-sm text-muted-foreground">
        {label}
      </span>
    )
  }
  if (eksternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={kelasTautan}>
        {label}
      </a>
    )
  }
  return (
    <Link href={href} className={kelasTautan}>
      {label}
    </Link>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-muted">
      {/* Lebar & padding mengikuti section lain di beranda (max-w-362, px-4 / lg:px-6) */}
      <div className="mx-auto w-full max-w-362 px-4 py-10 lg:px-6">
        {/* TAHAP 2 — Grid 12 kolom, tinggi minimal 400px (sama seperti aslinya) */}
        <div className="grid min-h-100 grid-cols-12 gap-x-6 gap-y-8">
          {/* Empat kolom tautan: 1 per baris di mobile, 2 per baris di md, 2/12 kolom di lg */}
          {FOOTER.kolom.map((k) => (
            <section key={k.judul} className="col-span-12 flex flex-col items-start md:col-span-6 lg:col-span-2">
              <h2 className="mb-4 text-sm font-medium text-foreground">{k.judul}</h2>
              <div className="flex flex-col items-start gap-3">
                {k.tautan.map((t) => (
                  <Tautan key={t.label} {...t} />
                ))}
              </div>
            </section>
          ))}

          {/* Spasi 1 kolom, hanya ada di lg */}
          <div aria-hidden="true" className="hidden lg:col-span-1 lg:block" />

          {/* TAHAP 3 — Form berlangganan: lebar maksimal 312px, 3/12 kolom di lg */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3">
            <section className="flex w-full max-w-78 flex-col items-start">
              <h4 className="flex items-center text-sm font-medium text-foreground">{FOOTER.berlangganan.judul}</h4>
              <FooterBerlangganan
                labelEmail={FOOTER.berlangganan.labelEmail}
                placeholder={FOOTER.berlangganan.placeholder}
                tombol={FOOTER.berlangganan.tombol}
              />
              <p className="m-0 mt-4 text-sm text-muted-foreground">{FOOTER.berlangganan.deskripsi}</p>
            </section>
          </div>
        </div>

        {/*
          TAHAP 4 — Baris bawah: logo di kiri, pemilih tema di kanan.
          Hak cipta kubiarkan di samping logo karena wajib ada di situs perusahaan (tidak ada di footer Next.js).
        */}
        <div className="mt-12 flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3 text-foreground">
            <Image src={BRAND.logo} alt={BRAND.nama} width={28} height={28} priority unoptimized className="size-7 shrink-0 object-contain" />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {FOOTER.hakCipta}
            </p>
          </div>
          <div className="shrink-0">
            <FooterTema />
          </div>
        </div>
      </div>
    </footer>
  )
}