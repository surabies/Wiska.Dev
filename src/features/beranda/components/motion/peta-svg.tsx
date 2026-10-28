"use client"

// features/beranda/components/motion/peta-svg.tsx — bagian interaktif peta
// cakupan (hover kelurahan menyorot bentuknya + menampilkan nama). Server
// component pemanggil (peta-cakupan.tsx) yang menghitung proyeksi SVG dari
// data PostGIS asli (features/beranda/lib/peta.ts) — file ini murni
// menggambar & menangani hover, tidak menyentuh database.
import { useState } from "react"
import type { PetaCakupan } from "../../lib/peta"

// Tiga warna kelurahan bersebelahan (lihat warnaPerKelurahan di peta.ts) —
// SEMUANYA dari rumpun aqua yang sudah dikunci di globals.css (cyan +
// emerald), ditambah SATU aksen "sky" khusus untuk kebutuhan pembeda-
// wilayah seperti ini (didaftarkan resmi di dokumentasi palet). Warnanya
// TIDAK MENGKODEKAN APA-APA — cuma memisahkan bidang dari tetangganya,
// makanya legenda di bawah menjelaskan itu terus terang, bukan berpura-pura
// tiap warna berarti sesuatu.
const PALET_KELURAHAN = [
  { fill: "rgba(34,211,238,0.14)", fillSorot: "rgba(34,211,238,0.28)", garis: "rgba(34,211,238,0.4)" },
  { fill: "rgba(52,211,153,0.14)", fillSorot: "rgba(52,211,153,0.28)", garis: "rgba(52,211,153,0.4)" },
  { fill: "rgba(56,189,248,0.14)", fillSorot: "rgba(56,189,248,0.28)", garis: "rgba(56,189,248,0.4)" },
  // Slot ke-4 NETRAL — dipakai warnaPerKelurahan (peta.ts) HANYA kalau tiga
  // warna di atas sudah dipakai SEMUA tetangga kelurahan itu (jarang, tapi
  // mungkin). BUKAN warna baru yang menuntut dibedakan artinya, sekadar
  // abu-abu supaya tidak crash membaca index di luar array. Bug ini pernah
  // benar-benar terjadi (TypeError reading 'fill' of undefined) sebelum
  // slot ini ditambahkan — jangan dihapus.
  { fill: "rgba(255,255,255,0.06)", fillSorot: "rgba(255,255,255,0.14)", garis: "rgba(255,255,255,0.3)" },
]

export function PetaSvg({ data }: { data: PetaCakupan }) {
  const [disorot, setDisorot] = useState<string | null>(null)
  const namaDisorot = data.kelurahan.find((k) => k.id === disorot)?.nama ?? null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${data.lebar} ${data.tinggi}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Peta cakupan layanan: ${data.kelurahan.length} kelurahan di ${data.kecamatan.length} kecamatan Kota Bandung`}
      >
        {/* Kelurahan — bidang bisa disorot per-hover, warna gantian 3-tona
           supaya wilayah bersebelahan kebaca batasnya. */}
        <g>
          {data.kelurahan.map((k) => {
            const warna = PALET_KELURAHAN[k.warna ?? 0]!
            const aktif = disorot === k.id
            return (
              <path
                key={k.id}
                d={k.d}
                onMouseEnter={() => setDisorot(k.id)}
                onMouseLeave={() => setDisorot((cur) => (cur === k.id ? null : cur))}
                className="cursor-default transition-colors duration-200"
                fill={aktif ? warna.fillSorot : warna.fill}
                stroke={aktif ? warna.garis : "var(--border)"}
                strokeWidth={aktif ? 1.5 : 1}
              />
            )
          })}
        </g>

        {/* Kecamatan — garis luar lebih tebal di atas bidang kelurahan,
           murni penanda batas administratif lebih besar. strokeWidth
           dinaikkan dari 2 ke 2.5 — di layar sempit (viewBox 800 lebar
           diperkecil ke ~400px lebar nyata di HP), garis 2 nyaris jadi
           1px dan gampang kebaca "hilang". */}
        <g aria-hidden="true">
          {data.kecamatan.map((k) => (
            <path key={k.id} d={k.d} fill="none" stroke="var(--muted-foreground)" strokeWidth={2.5} />
          ))}
        </g>

        {/* Titik sambungan pelanggan — anonim (cuma koordinat, lihat
           peta.ts), sekadar menunjukkan kepadatan cakupan nyata. Radius
           dinaikkan dari 1.4 ke 2 — di HP (svg dirender ~400-460px lebar
           utk viewBox 800), 1.4 jadi <1.5px nyata, nyaris tak kasat mata
           walau titiknya ratusan. */}
        <g aria-hidden="true">
          {data.titikPelanggan.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2} fill="rgba(52,211,153,0.75)" />
          ))}
        </g>
      </svg>

      {/* Label kelurahan yang di-hover — posisi statis (bukan tooltip
         mengikuti kursor) supaya tidak pernah terpotong di tepi SVG. */}
      <div className="pointer-events-none mt-3 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-panel sm:absolute sm:bottom-3 sm:left-3 sm:mt-0">
        {namaDisorot ?? "Arahkan kursor ke peta untuk lihat nama kelurahan"}
      </div>

      {/* Legenda berada di alur normal pada layar sempit supaya tidak
        menutupi wilayah peta. Pada desktop ia kembali menjadi overlay. */}
      <div className="pointer-events-none mt-3 rounded-md border border-border bg-card px-3 py-2.5 text-[11px] text-muted-foreground shadow-panel sm:absolute sm:top-3 sm:right-3 sm:mt-0">
        <p className="mb-1.5 font-semibold tracking-wide text-foreground uppercase">Keterangan</p>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 shrink-0 bg-muted-foreground/60" />
          <span>Batas kecamatan</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-info/40 bg-info/20" />
          <span>Batas kelurahan (warna cuma pembeda wilayah bersebelahan)</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-success" />
          <span>Titik sambungan pelanggan (anonim)</span>
        </div>
      </div>
    </div>
  )
}
