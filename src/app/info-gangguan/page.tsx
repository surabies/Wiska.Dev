import type { Metadata } from "next"
import Link from "next/link"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"
import { RUTE } from "@/lib/landing/content"

export const metadata: Metadata = { title: "Info Gangguan Air" }

type Gangguan = {
  id: string
  wilayah: string
  penyebab: string
  status: "Sedang ditangani" | "Selesai"
  perkiraan: string
}

// TODO: ganti dengan data dari server (API Hono / database).
const DAFTAR_GANGGUAN: Gangguan[] = [
  {
    id: "contoh-1",
    wilayah: "Contoh: Kelurahan A, Kecamatan B",
    penyebab: "Perbaikan pipa distribusi",
    status: "Sedang ditangani",
    perkiraan: "Contoh: hari ini pukul 18.00",
  },
]

export default function Page() {
  return (
    <HalamanInfo
      judul="Info Gangguan Air"
      deskripsi="Wilayah terdampak dan perkiraan waktu perbaikan gangguan air di Kota Bandung."
    >
      <Bagian judul="Gangguan saat ini">
        <KontenContoh>Data di bawah hanya contoh. Ganti dengan data gangguan yang sebenarnya.</KontenContoh>

        {DAFTAR_GANGGUAN.length === 0 ? (
          <p className="mt-4 text-muted-foreground">Tidak ada gangguan yang tercatat saat ini.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {DAFTAR_GANGGUAN.map((g) => (
              <li key={g.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{g.wilayah}</p>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {g.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{g.penyebab}</p>
                <p className="mt-1 text-sm text-muted-foreground">Perkiraan selesai: {g.perkiraan}</p>
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      <Bagian judul="Wilayah Anda belum tercantum?">
        <p className="text-muted-foreground">
          Sampaikan gangguan air di tempat Anda agar segera diverifikasi petugas.{" "}
          <Link href={RUTE.pengaduan} className="text-foreground underline underline-offset-4">
            Laporkan gangguan air
          </Link>
          .
        </p>
      </Bagian>
    </HalamanInfo>
  )
}