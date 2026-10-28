// features/publik/components/hasil-tagihan/tab-tagihan.tsx — rincian tagihan
// TERBARU beserta susunan biayanya.
//
// Dulu yang ditampilkan adalah "tagihan belum lunas pertama", dan tanggal
// jatuh temponya diberi peringatan merah "Telah jatuh tempo". Keduanya
// pernyataan tentang PEMBAYARAN, padahal basis data ini belum pernah
// menerima satu pun data pembayaran (lihat catatan di header.tsx) — sehingga
// peringatan itu muncul untuk semua orang, termasuk yang sudah membayar.
// Yang tersisa kini hanya fakta tagihannya sendiri: periode, tanggal jatuh
// tempo sebagai keterangan, dan rincian biayanya.
import { Droplets, Calendar } from "@/components/ui/hugeicons-compat"
import { Separator } from "@/components/ui/separator"
import { BiayaRow, FieldLabel, FieldValue, SectionLabel } from "./atoms"
import { formatPeriode, formatRupiah, formatTanggal } from "../../lib/format"
import type { HasilCekTagihan, TagihanPublik } from "../../lib/api"

function biayaItems(t: TagihanPublik) {
  return [
    { label: `Pemakaian air (${t.pemakaianM3} m³)`, value: t.jmlHargaAir, accent: false },
    { label: "Beban tetap", value: t.beaBeban, accent: false },
    { label: "Pemeliharaan meter", value: t.beaAdmin, accent: false },
    ...(t.airKotor > 0 ? [{ label: "Air kotor", value: t.airKotor, accent: false }] : []),
    ...(t.lainLain > 0 ? [{ label: "Lain-lain", value: t.lainLain, accent: false }] : []),
    ...(t.denda > 0 ? [{ label: "Denda keterlambatan", value: t.denda, accent: true }] : []),
  ]
}

export function TabTagihan({ hasil }: { hasil: HasilCekTagihan }) {
  const { pelanggan, tagihan } = hasil

  if (tagihan.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Droplets className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Belum ada tagihan tercatat</p>
        <p className="mt-1 text-xs text-muted-foreground">Tidak ada tagihan untuk sambungan ini.</p>
      </div>
    )
  }

  // Tagihan TERBARU, tanpa syarat. Daftarnya sudah urut periode menurun.
  const t = tagihan[0]!

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <FieldLabel>Periode</FieldLabel>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <FieldValue>{formatPeriode(t.periode)}</FieldValue>
          </div>
        </div>

        {/* Netral, bukan merah: tanggal jatuh tempo adalah keterangan pada
            tagihannya, bukan vonis bahwa ia belum dibayar. */}
        <div className="rounded-lg bg-muted/40 p-3">
          <FieldLabel>Jatuh tempo</FieldLabel>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <FieldValue>{formatTanggal(t.tanggalJatuhTempo)}</FieldValue>
          </div>
        </div>
      </div>

      {pelanggan.tarifGolongan && (
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <FieldLabel>Golongan tarif</FieldLabel>
            <span className="font-mono text-[10px] text-muted-foreground">{pelanggan.tarifGolongan.kodeAsli}</span>
          </div>
          <FieldValue>{pelanggan.tarifGolongan.kategori}</FieldValue>
        </div>
      )}

      <Separator className="opacity-50" />

      <div>
        <SectionLabel>Rincian biaya</SectionLabel>
        <div className="rounded-lg bg-muted/40 px-4 py-1">
          {biayaItems(t).map(({ label, value, accent }, i, arr) => (
            <BiayaRow key={label} label={label} value={value} accent={accent} last={i === arr.length - 1} />
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Total tagihan</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatPeriode(t.periode)}</p>
          </div>
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">{formatRupiah(t.totalTagihan)}</p>
        </div>
      </div>
    </div>
  )
}
