// Kartu rincian pencatatan (kanan baris kedua, seperti PDF): periode, kondisi,
// petugas, waktu, biaya, dan koordinat. Baris tanpa data tidak ditampilkan.
import { LABEL_KONDISI_CATAT } from "@/features/dashboard/lib/LabelPencatatan"
import { PanelDasbor } from "../../shared/PanelDasbor"
import { BarisInfo, DaftarInfo } from "./BarisInfo"
import { fmtPeriode, fmtRupiah, fmtTeks, fmtWaktu } from "../lib/FormatTampilan"
import type { DataCatat } from "../types/TipeInfoPelanggan"

export function RincianCatat({
  catat,
  lokasi,
}: {
  catat: DataCatat
  lokasi: { lat: number; lng: number } | null
}) {
  const kondisi = catat.kondisi
    ? ((LABEL_KONDISI_CATAT as Record<string, string>)[catat.kondisi] ??
      catat.kondisi)
    : null

  return (
    <PanelDasbor label="Rincian pencatatan" className="min-w-0">
      <DaftarInfo>
        <BarisInfo label="Periode">{fmtPeriode(catat.periode)}</BarisInfo>
        {kondisi && <BarisInfo label="Kondisi">{kondisi}</BarisInfo>}
        <BarisInfo label="Petugas">{fmtTeks(catat.petugas)}</BarisInfo>
        {catat.kodeRute && (
          <BarisInfo label="Kode rute">{catat.kodeRute}</BarisInfo>
        )}
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
    </PanelDasbor>
  )
}
