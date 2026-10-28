import type { Metadata } from "next"
import Link from "next/link"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"
import { RUTE } from "@/lib/landing/content"

export const metadata: Metadata = { title: "Pasang Baru" }

// TODO: sesuaikan dengan prosedur resmi pemasangan sambungan baru.
const SYARAT = [
  "Contoh: fotokopi KTP pemohon",
  "Contoh: bukti kepemilikan atau penguasaan bangunan",
  "Contoh: surat permohonan pemasangan",
]

const ALUR = [
  { judul: "Ajukan permohonan", isi: "Datangi kantor layanan atau hubungi petugas." },
  { judul: "Survei lokasi", isi: "Petugas memeriksa lokasi dan kelayakan pemasangan." },
  { judul: "Pembayaran biaya", isi: "Bayar biaya pemasangan sesuai rincian yang diberikan." },
  { judul: "Pemasangan", isi: "Petugas memasang sambungan dan meter air." },
]

export default function Page() {
  return (
    <HalamanInfo
      judul="Pasang Baru"
      deskripsi="Syarat dan alur pengajuan sambungan air baru PERUMDA Tirtawening."
    >
      <Bagian judul="Syarat permohonan">
        <KontenContoh>Daftar syarat hanya contoh. Ganti dengan persyaratan resmi.</KontenContoh>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-muted-foreground">
          {SYARAT.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Bagian>

      <Bagian judul="Alur pemasangan">
        <ol className="flex flex-col gap-3">
          {ALUR.map((a, i) => (
            <li key={a.judul} className="flex gap-4 rounded-lg border border-border bg-card p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{a.judul}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.isi}</p>
              </div>
            </li>
          ))}
        </ol>
      </Bagian>

      <Bagian judul="Butuh bantuan?">
        <p className="text-muted-foreground">
          Lihat alamat dan jam layanan di halaman{" "}
          <Link href={RUTE.kontak} className="text-foreground underline underline-offset-4">
            Kontak &amp; Kantor Layanan
          </Link>
          .
        </p>
      </Bagian>
    </HalamanInfo>
  )
}