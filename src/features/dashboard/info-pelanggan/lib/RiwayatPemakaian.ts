import type { BarisRiwayat } from "../types/TipeInfoPelanggan"

export type PembacaanGrafik = {
  periode?: string | number
  standLalu?: number | null
  standAkhir?: number | null
  pemakaianM3?: number | null
}

function keYYYYMM(periode: string | number | undefined): string {
  return String(periode ?? "")
    .replace(/\D/g, "")
    .slice(0, 6)
}

function petakanBaris(rows: PembacaanGrafik[]): BarisRiwayat[] {
  return rows.map((row) => ({
    periode: keYYYYMM(row.periode),
    standLalu: row.standLalu ?? null,
    standAkhir: row.standAkhir ?? null,
    pemakaianM3: row.pemakaianM3 ?? null,
    tagihan: null,
  }))
}

export function susunRiwayatPemakaian<T extends PembacaanGrafik>({
  periode,
  pembacaanTerpilih,
  pembacaanTerbaru,
  historiSebelum,
}: {
  periode: string
  pembacaanTerpilih: T[]
  pembacaanTerbaru: T[]
  historiSebelum: T[]
}): { baca: T | undefined; riwayat: BarisRiwayat[] } {
  if (!periode) {
    return {
      baca: pembacaanTerbaru[0],
      riwayat: petakanBaris(pembacaanTerbaru.slice(1, 4)),
    }
  }

  return {
    baca: pembacaanTerpilih.find((row) => keYYYYMM(row.periode) === periode),
    riwayat: petakanBaris(
      historiSebelum
        .filter((row) => keYYYYMM(row.periode) < periode)
        .slice(0, 3)
    ),
  }
}
