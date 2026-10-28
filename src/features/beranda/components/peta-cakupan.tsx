// features/beranda/components/peta-cakupan.tsx — peta cakupan layanan,
// dari batas kelurahan/kecamatan ASLI tersimpan di PostGIS (sumber sama
// dengan peta wilayah dashboard) — bukan ilustrasi peta dunia generik ala
// komponen showcase pihak ketiga. Server component: query + proyeksi ke
// SVG terjadi di features/beranda/lib/peta.ts, halaman ini cuma merangkai
// bagian statis (judul, angka) dan melempar hasilnya ke <PetaSvg> (client,
// untuk interaksi hover).
//
// Kalau database kosong (deploy baru, area belum di-seed), seksi ini
// disembunyikan total — sama aturannya dengan stats-strip.tsx: tidak ada
// peta kosong yang berpura-pura menunjukkan cakupan.
import { getPetaCakupan } from "../lib/peta"
import { Reveal } from "./motion/reveal"
import { PetaBasemap } from "./motion/peta-basemap"

export async function PetaCakupan() {
  const peta = await getPetaCakupan()
  if (peta.kelurahan.length === 0) return null

  return (
    <section aria-labelledby="peta-judul" className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 lg:py-20">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-medium text-primary">Cakupan layanan</p>
          <h2 id="peta-judul" className="mt-3 text-3xl font-semibold tracking-tight text-balance">
            Bukan cuma diklaim — batas wilayahnya nyata.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {peta.kelurahan.length} kelurahan di {peta.kecamatan.length} kecamatan, digambar langsung dari batas
            administratif yang tersimpan di sistem — bukan peta dekoratif. Titik-titik hijau menandai sambungan
            pelanggan berkoordinat (anonim, tanpa nama atau nomor langganan).
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 rounded-xl border border-border bg-card p-4 shadow-panel md:p-6">
          <PetaBasemap data={peta} />
        </Reveal>
      </div>
    </section>
  )
}
