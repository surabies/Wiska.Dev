// Kartu rincian pencatatan (kanan baris kedua, seperti PDF): periode, kondisi,
// petugas, waktu, biaya, dan koordinat. Baris tanpa data tidak ditampilkan.
import { LABEL_KONDISI_CATAT } from "../../lib/label"
import { BarisInfo, DaftarInfo } from "./baris-info"
import { fmtPeriode, fmtRupiah, fmtTeks, fmtWaktu } from "./format"
import type { DataCatat } from "./tipe"

export function RincianCatat({
  catat,
  lokasi,
}: {
  catat: DataCatat
  lokasi: { lat: number; lng: number } | null
}) {
  const kondisi = catat.kondisi
    ? ((LABEL_KONDISI_CATAT as Record<string, string>)[catat.kondisi] ?? catat.kondisi)
    : null

  return (
    <section
      aria-label="Rincian pencatatan"
      className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-panel"
    >
      <h2 className="mb-1 text-sm font-semibold">Rincian pencatatan</h2>
      <DaftarInfo>
        <BarisInfo label="Periode">{fmtPeriode(catat.periode)}</BarisInfo>
        {kondisi && <BarisInfo label="Kondisi">{kondisi}</BarisInfo>}
        <BarisInfo label="Petugas">{fmtTeks(catat.petugas)}</BarisInfo>
        <BarisInfo label="Dicatat">{fmtWaktu(catat.waktuCatat)}</BarisInfo>
        {catat.waktuUpload && (
          <BarisInfo label="Diunggah">{fmtWaktu(catat.waktuUpload)}</BarisInfo>
        )}
        {catat.biaya != null && (
          <BarisInfo label="Biaya">{fmtRupiah(catat.biaya)}</BarisInfo>
        )}
        {lokasi && (
          <BarisInfo label="Koordinat" mono>
            {lokasi.lat.toFixed(6)}, {lokasi.lng.toFixed(6)}
          </BarisInfo>
        )}
      </DaftarInfo>
    </section>
  )
}