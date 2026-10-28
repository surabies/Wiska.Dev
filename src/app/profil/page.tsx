import type { Metadata } from "next"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"
import { BRAND } from "@/lib/landing/content"

export const metadata: Metadata = { title: "Profil Perusahaan" }

// TODO: isi dengan visi, misi, dan sejarah resmi perusahaan.
const MISI = ["Contoh: menyediakan air bersih yang layak bagi seluruh pelanggan", "Contoh: meningkatkan kualitas pelayanan"]

export default function Page() {
  return (
    <HalamanInfo
      judul="Profil Perusahaan"
      deskripsi={`Mengenal ${BRAND.nama}, perusahaan air minum milik ${BRAND.wilayah}.`}
    >
      <KontenContoh>Isi halaman ini masih contoh. Ganti dengan profil resmi perusahaan.</KontenContoh>

      <Bagian judul="Tentang kami">
        <p className="text-muted-foreground">
          Tulis ringkasan singkat tentang perusahaan, wilayah layanan, dan peran {BRAND.nama} bagi warga {BRAND.wilayah}.
        </p>
      </Bagian>

      <Bagian judul="Visi">
        <p className="text-muted-foreground">Isi visi perusahaan.</p>
      </Bagian>

      <Bagian judul="Misi">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {MISI.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Bagian>

      <Bagian judul="Sejarah singkat">
        <p className="text-muted-foreground">Isi sejarah berdirinya perusahaan.</p>
      </Bagian>
    </HalamanInfo>
  )
}