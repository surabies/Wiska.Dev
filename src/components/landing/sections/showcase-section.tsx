// Showcase "Melayani Kota Bandung": judul menempel di kiri, di kanan kartu angka bergaya bento.
// Palet merek (biru, hijau, abu-abu, merah) dipakai sebagai aksen kecil, satu warna per kartu,
// sementara latar kartu tetap netral supaya tampilan sederhana dan elegan ala Vercel.
// Ilustrasi kecil menyala saat masuk layar dan bereaksi saat di-hover. Angka menghitung naik
// dari 0. Data dari SHOWCASE (content.ts).
import { HugeiconsIcon } from "@hugeicons/react"
import { DropletIcon, Invoice01Icon } from "@hugeicons/core-free-icons"
import type { CSSProperties, ReactNode } from "react"

import { KartuStat } from "@/components/landing/showcase-kartu"
import { SectionHeading, SectionShell } from "@/components/landing/section-heading"
import { SHOWCASE, type ItemShowcase } from "@/lib/landing/content"

// Satu warna per kartu. Semuanya token dari globals.css, jadi otomatis ikut tema terang dan gelap.
// Ganti di sini bila ingin menukar warna kartu.
const WARNA = {
  pelanggan: "var(--info)", // biru
  kelurahan: "var(--success)", // hijau
  kecamatan: "var(--muted-foreground)", // abu-abu
  rekening: "var(--destructive)", // merah
}

// Kotak ikon: latar dan garis tepi diturunkan dari --aksen kartu.
function KotakIkon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
      style={{
        color: "var(--aksen)",
        backgroundColor: "color-mix(in oklab, var(--aksen) 10%, transparent)",
        borderColor: "color-mix(in oklab, var(--aksen) 28%, transparent)",
      }}
    >
      {children}
    </span>
  )
}

/*
  TAHAP 1: latar kartu utama.
  Garis tren (tergambar saat masuk layar) + dua lapis gelombang air. Gelombang naik saat
  kartu di-hover. Semuanya memakai warna aksen kartu dan dekoratif, bukan data asli.
*/
const GELOMBANG = "M0 60C100 20 200 20 300 60S500 100 600 60S800 20 900 60S1100 100 1200 60V120H0Z"
const GARIS = "M0 96C30 92 50 80 80 84S130 60 160 58S220 40 250 30S300 14 320 8"
const AREA = `${GARIS}V120H0Z`

function LatarPelanggan() {
  return (
    <>
      <style>{`
        @keyframes sc-geser { to { transform: translateX(-50%) } }
        .sc-g1 { animation: sc-geser 14s linear infinite }
        .sc-g2 { animation: sc-geser 20s linear infinite reverse }
        @media (prefers-reduced-motion: reduce) { .sc-g1, .sc-g2 { animation: none } }
      `}</style>

      {/* Garis tren di kanan atas (disembunyikan di layar kecil) */}
      <div className="absolute top-6 right-6 hidden h-32 w-[46%] sm:block">
        <svg viewBox="0 0 320 120" fill="none" preserveAspectRatio="none" className="size-full overflow-visible">
          <defs>
            <linearGradient id="sc-g-garis" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" style={{ stopColor: "var(--aksen)", stopOpacity: 0.2 }} />
              <stop offset="1" style={{ stopColor: "var(--aksen)", stopOpacity: 0.95 }} />
            </linearGradient>
            <linearGradient id="sc-g-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--aksen)", stopOpacity: 0.16 }} />
              <stop offset="1" style={{ stopColor: "var(--aksen)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path
            d={AREA}
            fill="url(#sc-g-area)"
            className="opacity-0 transition-opacity delay-700 duration-1000 group-data-terlihat:opacity-100"
          />
          <path
            d={GARIS}
            stroke="url(#sc-g-garis)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="1"
            className="[stroke-dashoffset:1] transition-[stroke-dashoffset] duration-1800 ease-out group-data-terlihat:[stroke-dashoffset:0] motion-reduce:transition-none"
          />
        </svg>
        {/* Titik di ujung garis, berdenyut pelan */}
        <span className="absolute top-[6.7%] -right-1 -translate-y-1/2 opacity-0 transition-opacity delay-1000 duration-500 group-data-terlihat:opacity-100">
          <span className="absolute inline-flex size-2.5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-(--aksen) opacity-50 motion-reduce:hidden" />
          <span className="absolute inline-flex size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--aksen) ring-4 ring-card" />
        </span>
      </div>

      {/* Gelombang air: naik saat hover, bergerak berlawanan arah */}
      <div className="absolute inset-x-0 bottom-0 h-28 translate-y-6 transition-transform duration-700 ease-out group-hover:translate-y-0 motion-reduce:transition-none">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="sc-g2 absolute bottom-0 h-full w-[200%]">
          <path d={GELOMBANG} fill="var(--aksen)" fillOpacity="0.07" />
        </svg>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="sc-g1 absolute bottom-0 h-[85%] w-[200%]">
          <path d={GELOMBANG} fill="var(--aksen)" fillOpacity="0.1" />
        </svg>
      </div>
    </>
  )
}

/*
  TAHAP 2: ilustrasi kecil di kartu lain.
  Penundaan hanya dipasang pada properti warna/tinggi, supaya reaksi hover tetap instan.
*/

// 21 titik (7 x 3) untuk kartu kelurahan: menyala bergiliran dari redup ke terang.
// Titik yang di-hover membesar, dua tetangganya ikut membesar lebih kecil.
function TitikKelurahan({ jumlah }: { jumlah: number }) {
  return (
    <div aria-hidden className="grid w-fit grid-cols-7 gap-2.5">
      <style>{`
        .sc-dot { cursor: default }
        .sc-dot:hover { transform: scale(1.8) }
        .sc-dot:hover + .sc-dot, .sc-dot:has(+ .sc-dot:hover) { transform: scale(1.3) }
        @media (prefers-reduced-motion: reduce) { .sc-dot:hover, .sc-dot:hover + .sc-dot, .sc-dot:has(+ .sc-dot:hover) { transform: none } }
      `}</style>
      {Array.from({ length: jumlah }, (_, i) => {
        const persen = jumlah > 1 ? Math.round(40 + (i / (jumlah - 1)) * 60) : 100
        return (
          <span
            key={i}
            className="sc-dot size-2 rounded-full bg-border group-data-terlihat:bg-(--c)"
            style={
              {
                "--c": `color-mix(in oklab, var(--aksen) ${persen}%, transparent)`,
                transitionProperty: "background-color, transform",
                transitionDuration: "500ms, 200ms",
                transitionDelay: `${i * 60}ms, 0ms`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

// Batang satu warna untuk kartu kecamatan: tumbuh bergiliran, menjadi penuh saat di-hover.
function BatangKecamatan({ jumlah }: { jumlah: number }) {
  return (
    <div aria-hidden className="flex h-20 w-full max-w-44 items-end gap-1.5">
      {Array.from({ length: jumlah }, (_, i) => {
        const tinggi = 35 + ((i * 37) % 60)
        return (
          <span
            key={i}
            className="h-(--a) flex-1 rounded-sm bg-border group-data-terlihat:h-(--b) group-data-terlihat:bg-(--c) group-data-terlihat:hover:bg-(--aksen)"
            style={
              {
                "--a": "14%",
                "--b": `${tinggi}%`,
                "--c": `color-mix(in oklab, var(--aksen) ${Math.round(30 + tinggi * 0.6)}%, transparent)`,
                transitionProperty: "height, background-color",
                transitionDuration: "700ms, 300ms",
                transitionDelay: `${i * 110}ms, 0ms`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

export function ShowcaseSection() {
  // SHOWCASE memakai "as const"; dipetakan ke tipe ItemShowcase[] agar properti opsional (catatan) bisa dibaca
  const daftar: readonly ItemShowcase[] = SHOWCASE.item

  return (
    <SectionShell>
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 lg:grid-cols-12">
        {/* Judul menempel di kiri saat kartu di kanan di-scroll (layar lg) */}
        <SectionHeading className="lg:sticky lg:top-24 lg:col-span-4 lg:self-start">{SHOWCASE.judul}</SectionHeading>

        {/*
          TAHAP 3: grid bento di kanan.
          lg: 3 kolom, kartu utama selebar penuh, 3 kartu kecil di bawahnya.
          sm: 2 kolom, kartu "rekening" (terakhir) selebar penuh agar tidak sendirian.
        */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {daftar.map((s, urutan) => {
            switch (s.jenis) {
              case "pelanggan":
                return (
                  <KartuStat
                    key={s.jenis}
                    besar
                    urutan={urutan}
                    aksen={WARNA.pelanggan}
                    nilai={s.nilai}
                    label={s.label}
                    className="min-h-72 sm:col-span-2 lg:col-span-3"
                    latar={<LatarPelanggan />}
                    atas={
                      <KotakIkon>
                        <HugeiconsIcon icon={DropletIcon} size={22} strokeWidth={1.6} aria-hidden />
                      </KotakIkon>
                    }
                  />
                )
              case "kelurahan":
                return (
                  <KartuStat
                    key={s.jenis}
                    urutan={urutan}
                    aksen={WARNA.kelurahan}
                    nilai={s.nilai}
                    label={s.label}
                    className="min-h-60"
                    atas={<TitikKelurahan jumlah={s.nilai} />}
                  />
                )
              case "kecamatan":
                return (
                  <KartuStat
                    key={s.jenis}
                    urutan={urutan}
                    aksen={WARNA.kecamatan}
                    nilai={s.nilai}
                    label={s.label}
                    className="min-h-60"
                    atas={<BatangKecamatan jumlah={s.nilai} />}
                  />
                )
              case "rekening":
                return (
                  <KartuStat
                    key={s.jenis}
                    urutan={urutan}
                    aksen={WARNA.rekening}
                    nilai={s.nilai}
                    label={s.label}
                    className="min-h-60 sm:col-span-2 lg:col-span-1"
                    atas={
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <KotakIkon>
                            <HugeiconsIcon icon={Invoice01Icon} size={22} strokeWidth={1.6} aria-hidden />
                          </KotakIkon>
                          {s.catatan ? (
                            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                              {s.catatan}
                            </span>
                          ) : null}
                        </div>
                        {/* Bilah progres dekoratif yang terisi saat kartu terlihat */}
                        <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full w-0 rounded-full transition-[width] delay-300 duration-1400 ease-out group-data-terlihat:w-full motion-reduce:transition-none"
                            style={{
                              background:
                                "linear-gradient(90deg, color-mix(in oklab, var(--aksen) 25%, transparent), var(--aksen))",
                            }}
                          />
                        </div>
                      </>
                    }
                  />
                )
            }
          })}
        </div>
      </div>
    </SectionShell>
  )
}