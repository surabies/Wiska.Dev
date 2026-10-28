// features/public/components/pelacakan/kartu-tiket.tsx — tampilan lengkap
// satu tiket untuk pelapor: status, janji waktu, petugas, linimasa tindak
// lanjut, dan aksi yang jadi haknya.
//
// Semua penilaian ("terlambat?", "boleh dinilai?") datang JADI dari server —
// komponen ini tidak menghitung ulang apa pun. Aturan SLA dan alur adalah
// kebijakan layanan; menyalinnya ke browser berarti dua sumber kebenaran
// yang pasti menyimpang, dan yang di browser tidak bisa dipercaya siapa pun.
import { CircleUser, Clock, ImageIcon, MapPin, Star, TriangleAlert, Video } from "@/components/ui/hugeicons-compat"
import { Badge } from "@/components/ui/badge"
import { BingkaiFoto } from "@/components/bingkai-foto"
import { BingkaiVideo } from "@/components/bingkai-video"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { StatusTiket } from "../../lib/api"
import {
  formatSisaWaktu,
  formatWaktu,
  LABEL_JENIS_PENGADUAN,
  statusPengaduanWarga,
  urlVideoTeroptimasi,
} from "../../lib/format"
import { Linimasa } from "./linimasa"
import { AksiPelapor } from "./aksi-pelapor"

function BarisInfo({ ikon: Ikon, label, children }: { ikon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Ikon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export function KartuTiket({ tiket, onPerbarui }: { tiket: StatusTiket; onPerbarui: () => void }) {
  const status = statusPengaduanWarga(tiket.status)
  const { sla } = tiket

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <code className="font-mono text-sm font-semibold tracking-wider">{tiket.nomorTiket}</code>
          <Badge variant="outline" className={status.badgeClass}>
            {status.label}
          </Badge>
        </div>
        <CardTitle className="text-base">{tiket.judul}</CardTitle>
        <CardDescription>
          {LABEL_JENIS_PENGADUAN[tiket.jenis] ?? tiket.jenis} · dilaporkan {formatWaktu(tiket.createdAt)} WIB
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Spanduk keterlambatan tampil ke WARGA, bukan disembunyikan. Kalau
            kita melewati janji sendiri, menyembunyikannya dari orang yang
            menunggu hanya membuat mereka menelepon — dan tidak memperbaiki
            apa pun. */}
        {sla.melanggar && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Penanganan tiket ini melewati target waktu kami ({formatSisaWaktu(sla.sisaMenit)}). Mohon maaf — laporan Anda
              tetap dalam antrean dan diprioritaskan.
            </span>
          </div>
        )}

        {sla.terjeda && (
          <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>Petugas menunggu tanggapan Anda. Hitungan waktu penanganan dijeda sampai Anda merespons.</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {sla.targetSelesaiAt && (
            <BarisInfo ikon={Clock} label="Target penanganan">
              <p>{formatWaktu(sla.targetSelesaiAt)} WIB</p>
              {!["SELESAI", "DITUTUP", "DITOLAK"].includes(tiket.status) && (
                <p className={sla.melanggar ? "text-destructive" : "text-muted-foreground"}>
                  {formatSisaWaktu(sla.sisaMenit)}
                </p>
              )}
            </BarisInfo>
          )}

          <BarisInfo ikon={CircleUser} label="Petugas penanggung jawab">
            {tiket.ditugaskanKe?.name ? (
              <p>{tiket.ditugaskanKe.name}</p>
            ) : (
              <p className="text-muted-foreground">Belum ditugaskan — laporan masih dalam antrean.</p>
            )}
          </BarisInfo>

          {tiket.alamatKejadian && (
            <BarisInfo ikon={MapPin} label="Lokasi kejadian">
              <p>{tiket.alamatKejadian}</p>
            </BarisInfo>
          )}

          {tiket.ratingKepuasan !== null && (
            <BarisInfo ikon={Star} label="Penilaian Anda">
              <p className="flex items-center gap-1">
                {tiket.ratingKepuasan}/5
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
              </p>
            </BarisInfo>
          )}
        </div>

        {(tiket.fotoUrl || tiket.videoUrl) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {tiket.fotoUrl && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <ImageIcon className="size-3.5" /> Foto bukti
                </p>
                <BingkaiFoto src={tiket.fotoUrl} alt="Foto bukti pengaduan" rasio="16/9" />
              </div>
            )}
            {tiket.videoUrl && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <Video className="size-3.5" /> Video bukti
                </p>
                <BingkaiVideo src={urlVideoTeroptimasi(tiket.videoUrl)!} rasio="16/9" />
              </div>
            )}
          </div>
        )}

        {tiket.catatanPenyelesaian && (
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Hasil penanganan</p>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">{tiket.catatanPenyelesaian}</p>
          </div>
        )}

        <AksiPelapor
          nomorTiket={tiket.nomorTiket}
          bisaDinilai={tiket.bisaDinilai}
          bisaDibukaKembali={tiket.bisaDibukaKembali}
          onSelesai={onPerbarui}
        />

        <Separator />

        <div>
          <p className="mb-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Riwayat tindak lanjut</p>
          <Linimasa riwayat={tiket.riwayat} />
        </div>
      </CardContent>
    </Card>
  )
}
