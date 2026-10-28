import type { Metadata } from "next"
import Link from "next/link"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"
import { RUTE } from "@/lib/landing/content"

export const metadata: Metadata = { title: "Cara Pembayaran" }

const LANGKAH = [
  { judul: "Cek tagihan", isi: "Masukkan nomor langganan 11 digit untuk melihat jumlah tagihan." },
  { judul: "Pilih kanal pembayaran", isi: "Pilih salah satu kanal pembayaran yang tersedia." },
  { judul: "Simpan bukti bayar", isi: "Simpan bukti pembayaran sampai status tagihan berubah lunas." },
]

// TODO: isi dengan kanal pembayaran yang benar-benar tersedia.
const KANAL = [
  { nama: "Contoh: Bank / ATM", deskripsi: "Isi petunjuk pembayaran" },
  { nama: "Contoh: Aplikasi dompet digital", deskripsi: "Isi petunjuk pembayaran" },
  { nama: "Contoh: Loket pembayaran", deskripsi: "Isi alamat dan jam layanan" },
]

export default function Page() {
  return (
    <HalamanInfo
      judul="Cara Pembayaran"
      deskripsi="Langkah membayar tagihan air dan kanal pembayaran yang tersedia."
    >
      <Bagian judul="Langkah pembayaran">
        <ol className="flex flex-col gap-3">
          {LANGKAH.map((l, i) => (
            <li key={l.judul} className="flex gap-4 rounded-lg border border-border bg-card p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{l.judul}</p>
                <p className="mt-1 text-sm text-muted-foreground">{l.isi}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Belum tahu jumlah tagihan?{" "}
          <Link href={RUTE.cekTagihan} className="text-foreground underline underline-offset-4">
            Cek tagihan
          </Link>
          .
        </p>
      </Bagian>

      <Bagian judul="Kanal pembayaran">
        <KontenContoh>Daftar kanal di bawah hanya contoh. Ganti dengan kanal resmi.</KontenContoh>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {KANAL.map((k) => (
            <li key={k.nama} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium text-foreground">{k.nama}</p>
              <p className="mt-1 text-sm text-muted-foreground">{k.deskripsi}</p>
            </li>
          ))}
        </ul>
      </Bagian>
    </HalamanInfo>
  )
}