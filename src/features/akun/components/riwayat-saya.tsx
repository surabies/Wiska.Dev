// features/akun/components/riwayat-saya.tsx — daftar "Laporan Saya" di /akun.
//
// Server component murni (tidak ada state/interaksi di sini selain
// navigasi <Link>) — detail lengkap satu tiket (linimasa, aksi
// konfirmasi/buka-kembali/nilai) TIDAK diduplikasi di sini. Baris diklik ->
// /pengaduan?nomor=TW-... yang membuka tab "Lacak tiket" dan otomatis
// mencari, memakai ULANG KartuTiket/Linimasa/AksiPelapor yang sudah ada di
// halaman publik — satu tempat saja yang merender detail tiket.
import Link from "next/link"
import { Inbox } from "@/components/ui/hugeicons-compat"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatSisaWaktu,
  formatWaktu,
  LABEL_JENIS_PENGADUAN,
  statusPengaduanWarga,
} from "@/features/public/lib/format"
import type { TiketSaya } from "../lib/queries"

const STATUS_SELESAI = ["SELESAI", "DITUTUP", "DITOLAK"]

export function RiwayatSaya({ tiket }: { tiket: TiketSaya[] }) {
  if (tiket.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Belum ada laporan yang tertaut ke akun ini. Pengaduan yang Anda
            kirim SAAT SEDANG MASUK ke akun ini akan muncul di sini secara
            otomatis.
          </p>
          <Link
            href="/pengaduan"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            Buat pengaduan baru
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {tiket.map((t) => {
        const status = statusPengaduanWarga(t.status)
        const tampilkanSisa =
          t.sla.targetSelesaiAt && !STATUS_SELESAI.includes(t.status)
        return (
          <Link
            key={t.id}
            href={`/pengaduan?nomor=${encodeURIComponent(t.nomorTiket)}`}
          >
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-xs font-semibold tracking-wider">
                      {t.nomorTiket}
                    </code>
                    <Badge variant="outline" className={status.badgeClass}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{t.judul}</p>
                  <p className="text-xs text-muted-foreground">
                    {LABEL_JENIS_PENGADUAN[t.jenis] ?? t.jenis} · dilaporkan{" "}
                    {formatWaktu(t.createdAt.toISOString())} WIB
                  </p>
                </div>
                {tampilkanSisa && (
                  <p
                    className={`shrink-0 text-xs ${t.sla.melanggar ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                  >
                    {formatSisaWaktu(t.sla.sisaMenit)}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
