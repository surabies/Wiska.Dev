// Kartu grafik pemakaian per periode (kiri baris kedua, seperti PDF).
import { GrafikPemakaian } from "./GrafikPemakaian"
import { PanelDasbor } from "../../shared/PanelDasbor"
import type { BarisRiwayat, DataCatat } from "../types/TipeInfoPelanggan"

export function KartuGrafik({
  catat,
  riwayat,
}: {
  catat: DataCatat
  riwayat: BarisRiwayat[]
}) {
  return (
    <PanelDasbor label="Pemakaian per periode" deskripsi="(m³)">
      <GrafikPemakaian
        periode={catat.periode}
        pemakaianM3={catat.pemakaianM3}
        riwayat={riwayat}
      />
    </PanelDasbor>
  )
}
