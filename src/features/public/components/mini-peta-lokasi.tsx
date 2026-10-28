"use client"

// features/public/components/mini-peta-lokasi.tsx — pratinjau lokasi di
// form pengaduan. Pakai batas wilayah ASLI yang sama dengan peta cakupan
// beranda (features/beranda/lib/peta.ts) — bukan gambar peta generik —
// supaya warga bisa lihat sendiri titik yang barusan dideteksi browser-nya
// benar-benar jatuh di wilayah cakupan, bukan meleset.
//
// Data `peta` di-fetch SEKALI di server (pengaduan/page.tsx) dan dioper
// turun sebagai prop — komponen ini TIDAK query database, cuma
// menggambar ulang path yang sudah diproyeksikan + memplot satu titik
// tambahan (koordinat dari navigator.geolocation, baru ada saat runtime)
// lewat proyeksikanTitik() dari file yang sama.
import { proyeksikanTitik, type PetaCakupan } from "../../beranda/lib/peta-tipe"

export function MiniPetaLokasi({
  peta,
  koordinat,
}: {
  peta: PetaCakupan | null
  koordinat: { lat: number; lng: number } | null
}) {
  if (!peta || peta.kelurahan.length === 0) return null

  const titik = koordinat ? proyeksikanTitik(peta.proyeksi, koordinat.lng, koordinat.lat) : null

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
      <svg viewBox={`0 0 ${peta.lebar} ${peta.tinggi}`} className="h-auto max-h-40 w-full" role="img" aria-hidden="true">
        <g>
          {peta.kelurahan.map((k) => (
            <path key={k.id} d={k.d} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          ))}
        </g>
        <g>
          {peta.kecamatan.map((k) => (
            <path key={k.id} d={k.d} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          ))}
        </g>
        {titik && (
          <g>
            {/* Cincin berdenyut di sekitar pin — bukan CSS animate (SVG
               statis dikirim server), cukup dua lingkaran bertumpuk untuk
               kesan "titik ditandai", tanpa perlu JS animasi tambahan. */}
            <circle cx={titik[0]} cy={titik[1]} r={10} fill="rgba(52,211,153,0.18)" />
            <circle cx={titik[0]} cy={titik[1]} r={4} fill="#34d399" stroke="#020617" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        {titik ? "Titik lokasi Anda, di atas batas wilayah cakupan PERUMDA Tirtawening." : "Peta wilayah cakupan — tekan “Deteksi lokasi saya” untuk menandai titik."}
      </p>
    </div>
  )
}
