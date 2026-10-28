import type { Metadata } from "next"
import Link from "next/link"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"
import { RUTE } from "@/lib/landing/content"

export const metadata: Metadata = { title: "Kontak & Kantor Layanan" }

// TODO: isi dengan data kontak resmi.
const KONTAK = [
  { label: "Alamat kantor pusat", isi: "Isi alamat lengkap" },
  { label: "Telepon", isi: "Isi nomor telepon resmi" },
  { label: "Email", isi: "Isi alamat email resmi" },
  { label: "Jam layanan", isi: "Isi hari dan jam layanan" },
]

export default function Page() {
  return (
    <HalamanInfo
      judul="Kontak & Kantor Layanan"
      deskripsi="Hubungi PERUMDA Tirtawening atau kunjungi kantor layanan terdekat."
    >
      <Bagian judul="Informasi kontak">
        <KontenContoh>Data kontak belum diisi. Ganti dengan data resmi sebelum dipublikasikan.</KontenContoh>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {KONTAK.map((k) => (
            <div key={k.label} className="rounded-lg border border-border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{k.label}</dt>
              <dd className="mt-1 font-medium text-foreground">{k.isi}</dd>
            </div>
          ))}
        </dl>
      </Bagian>

      <Bagian judul="Kantor layanan">
        <p className="text-muted-foreground">
          Daftarkan kantor cabang atau loket layanan di sini, lengkap dengan alamat dan jam buka.
        </p>
      </Bagian>

      <Bagian judul="Ada gangguan air?">
        <p className="text-muted-foreground">
          Untuk gangguan air, gunakan layanan pengaduan 24 jam agar laporan langsung diverifikasi petugas.{" "}
          <Link href={RUTE.pengaduan} className="text-foreground underline underline-offset-4">
            Laporkan gangguan air
          </Link>
          .
        </p>
      </Bagian>
    </HalamanInfo>
  )
}