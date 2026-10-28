"use client"

// features/dashboard/components/pemetaan-rute/panel-petugas.tsx — panel kiri:
// DataGrid petugas pencatat meter. Klik baris = memilih petugas yang
// rutenya diatur di panel kanan (pola master-detail bawaan DataGrid:
// onRowClicked + idTerpilih).
import { DataGrid } from "../data-grid"
import { KOLOM_PETUGAS_RUTE } from "./kolom-petugas-rute"
import type { PencatatBaris } from "./model"

// Di luar komponen supaya identitasnya stabil. Hanya pencatat meter yang
// memegang rute; penyelia anomali menerima seluruh wilayah.
const HANYA_PENCATAT = { jenisTugas: "PENCATAT_METER" }

export function PanelPetugas({
  terpilihId,
  refreshKey,
  onPilih,
}: {
  terpilihId: string | null
  /** Naik setiap rute ditambah/dilepas → kolom "Rute" ikut diperbarui. */
  refreshKey: number
  onPilih: (petugas: PencatatBaris) => void
}) {
  return (
    <DataGrid
      judul="Petugas Pencatat Meter"
      endpoint="/pencatat"
      columnDefs={KOLOM_PETUGAS_RUTE}
      searchParam="q"
      searchPlaceholder="Cari petugas…"
      extraParams={HANYA_PENCATAT}
      refreshKey={refreshKey}
      idTerpilih={terpilihId}
      // BarisData dari grid = baris /pencatat apa adanya.
      onRowClicked={(baris) => onPilih(baris as unknown as PencatatBaris)}
      tinggiClassName="min-h-64 flex-1"
    />
  )
}
