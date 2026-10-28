// Section "Semua yang Anda butuhkan" — meniru section fitur di nextjs.org:
// judul besar, lalu grid 12 kolom (3 kartu berilustrasi, 7 kartu teks, 1 kartu biru besar di kanan).
import type { ComponentType } from "react"
import Link from "next/link"

import { SectionHeading, SectionShell } from "@/components/landing/section-heading"
import { VisualJaringan, VisualStatus, VisualTagihan } from "@/components/landing/fitur-visual"
import { FITUR, type Fitur } from "@/lib/landing/content"

// Peta nama visual (dari content.ts) ke komponen ilustrasinya
const VISUAL: Record<NonNullable<Fitur["visual"]>, ComponentType> = {
  tagihan: VisualTagihan,
  status: VisualStatus,
  jaringan: VisualJaringan,
}

/*
  TAHAP 1 — Blok teks kartu (dipakai semua kartu).
  Baris judul: judul tebal + panah "→" yang bergeser ke kanan saat kartu di-hover
  (-translate-x-1 → translate-x-0). Deskripsi: abu-abu yang menguat saat hover.
  Kartu "Segera hadir" tidak punya panah dan tidak bereaksi terhadap hover.
*/
function TeksFitur({ judul, deskripsi, tersedia }: Fitur) {
  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-3 text-pretty text-base text-muted-foreground">
        <strong className="font-medium text-foreground">{judul}</strong>
        {tersedia ? (
          <span
            aria-hidden="true"
            className="inline-block -translate-x-1 font-medium text-foreground transition-transform group-hover:translate-x-0"
          >
            →
          </span>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">Segera hadir</span>
        )}
      </span>
      <span className="max-w-94 text-pretty text-base text-muted-foreground transition-colors group-hover:text-foreground">
        {deskripsi}
      </span>
    </div>
  )
}

/*
  TAHAP 2 — Satu kartu fitur.
  - Dengan visual : anchor "flex flex-col gap-6" → kotak ilustrasi (rasio 5:4, border) lalu teks.
  - Tanpa visual  : anchor "block" → hanya teks.
  - Belum tersedia: pakai <div> (bukan tautan) supaya tidak ada halaman 404.
*/
function KartuFitur(f: Fitur) {
  const Visual = f.visual ? VISUAL[f.visual] : null
  const kelas = `${Visual ? "flex flex-col gap-6" : "block"} ${f.tersedia ? "group" : "cursor-default"}`

  const isi = (
    <>
      {Visual ? (
        <div aria-hidden="true" className="aspect-5/4 overflow-hidden rounded-xs border border-solid border-border">
          <Visual />
        </div>
      ) : null}
      <TeksFitur {...f} />
    </>
  )

  return f.tersedia ? (
    <Link href={f.href} className={kelas}>
      {isi}
    </Link>
  ) : (
    <div aria-disabled="true" className={kelas}>
      {isi}
    </div>
  )
}

export function FiturSection() {
  // FITUR memakai "as const"; dipetakan ke tipe Fitur[] agar properti opsional (visual) bisa dibaca
  const daftar: readonly Fitur[] = FITUR.item

  return (
    <SectionShell>
      {/* Jarak judul ke daftar: gap-12 / md:gap-16 / lg:gap-18 (sama seperti Next.js) */}
      <div className="flex flex-col gap-12 md:gap-16 lg:gap-18">
        {/* TAHAP 3 — Judul, lebar maksimal 218 (≈54,5rem) */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          <SectionHeading className="col-span-full max-w-218">{FITUR.judul}</SectionHeading>
        </div>

        {/* TAHAP 4 — Grid 12 kolom: tiap kartu 4 kolom di layar lg (3 kartu per baris) */}
        <ul className="grid list-none grid-cols-12 gap-x-6 gap-y-12 p-0 md:gap-y-24">
          {daftar.map((f) => (
            <li key={f.judul} className="col-span-full flex flex-col gap-8 lg:col-span-4">
              <KartuFitur {...f} />
            </li>
          ))}

          {/*
            TAHAP 5 — Kartu biru besar (Pengaduan).
            Di lg ditempatkan manual: kolom 9–12, mulai baris 3, tinggi 2 baris (row-span-2).
            Warna: biru tetap (--biru, sama dengan --info tema terang) dan teks putih, jadi
            tampilannya SAMA di tema terang dan gelap (tidak mengikuti token tema).
            Hover/fokus: latar jadi biru sangat tipis, teks dan border tetap biru; panah bergeser
            ke kanan. motion-reduce mematikan transisi.
          */}
          <li className="col-span-full lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-3">
            <Link
              href={FITUR.rilis.href}
              aria-label={FITUR.rilis.label}
              className="group flex min-h-60 flex-col justify-between rounded border-2 border-(--biru) bg-(--biru) px-6 py-4 text-white no-underline transition-colors duration-200 [--biru:oklch(0.5761_0.2508_258.23)] hover:bg-(--biru)/10 hover:text-(--biru) focus-visible:bg-(--biru)/10 focus-visible:text-(--biru) focus-visible:outline-offset-4 motion-reduce:transition-none lg:h-full"
            >
              <span className="flex flex-col justify-between gap-4 lg:h-full">
                <span className="flex items-start gap-4 text-[40px] leading-12 font-semibold tracking-tight">
                  {FITUR.rilis.judul}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none"
                  >
                    →
                  </span>
                </span>
                {/* whitespace-pre-line: "\n" di content.ts menjadi pindah baris */}
                <span className="whitespace-pre-line text-base">{FITUR.rilis.deskripsi}</span>
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </SectionShell>
  )
}