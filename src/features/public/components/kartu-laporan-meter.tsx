// features/public/components/kartu-laporan-meter.tsx — tampilan lengkap
// laporan meter mandiri periode BERJALAN untuk pelapor: status verifikasi,
// angka yang dilaporkan, pemakaian resmi (begitu tersedia), dan foto
// buktinya sendiri.
//
// Sengaja HANYA periode berjalan (bukan daftar riwayat semua periode) —
// permintaan produk: warga hanya perlu tahu status laporan bulan ini, bukan
// diarsipkan menggulung riwayat lama. Lihat cek-laporan-meter-form.tsx.
//
// Pola sama dengan kartu-tiket.tsx (pelacakan pengaduan): semua penilaian
// ("sudah diverifikasi?", "berapa pemakaiannya?") datang JADI dari server,
// komponen ini tidak menghitung ulang apa pun.
import { ImageIcon } from "@/components/ui/hugeicons-compat"
import { Badge } from "@/components/ui/badge"
import { BingkaiFoto } from "@/components/bingkai-foto"
import {
  HaloCard,
  HaloCardAction,
  HaloCardContent,
  HaloCardDescription,
  HaloCardHeader,
  HaloCardTitle,
} from "@/components/ui/halo-card"
import type { DetailLaporanBulanIni } from "../lib/api"
import { formatPeriode, formatWaktu, statusLaporanMandiriWarga } from "../lib/format"

export function KartuLaporanMeter({ laporan }: { laporan: DetailLaporanBulanIni }) {
  const status = statusLaporanMandiriWarga(laporan.status)
  const periodeLabel = formatPeriode(laporan.periode)

  return (
    // Tahap 1: HaloCard polos dengan aria-label.
    <HaloCard aria-label={`Laporan meter periode ${periodeLabel}`}>
      {/* Tahap 2: judul + deskripsi di header, badge status di slot Action. */}
      <HaloCardHeader>
        <HaloCardTitle className="text-base">Periode {periodeLabel}</HaloCardTitle>
        <HaloCardDescription>Dikirim {formatWaktu(laporan.createdAt)} WIB</HaloCardDescription>
        <HaloCardAction>
          <Badge variant="outline" className={status.badgeClass}>
            {status.label}
          </Badge>
        </HaloCardAction>
      </HaloCardHeader>

      {/* Tahap 3: isi kartu. */}
      <HaloCardContent className="flex flex-col gap-4">
        {/* Alasan penolakan tampil ke WARGA, bukan disembunyikan — persis yang
            perlu mereka baca sebelum mengirim ulang. */}
        {laporan.status === "DITOLAK" && laporan.alasanDitolak && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {laporan.alasanDitolak}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Stand dilaporkan</p>
            <p className="font-mono text-sm font-medium">{laporan.standDilaporkan.toLocaleString("id-ID")} m³</p>
          </div>

          {/* Hanya ada setelah petugas memverifikasi (PembacaanMeter resmi
              dibuat) — lihat catatan pemakaianM3 di features/public/lib/api.ts. */}
          {laporan.pemakaianM3 !== null && (
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Pemakaian tercatat</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {laporan.pemakaianM3.toLocaleString("id-ID")} m³
              </p>
            </div>
          )}

          {laporan.verifiedAt && (
            <div>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Diverifikasi</p>
              <p className="text-sm">{formatWaktu(laporan.verifiedAt)} WIB</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <ImageIcon className="size-3.5" /> Foto stand meter yang dikirim
          </p>
          <BingkaiFoto src={laporan.fotoUrl} alt={`Foto stand meter periode ${periodeLabel}`} mode="utuh" rasio="16/9" />
        </div>
      </HaloCardContent>
    </HaloCard>
  )
}