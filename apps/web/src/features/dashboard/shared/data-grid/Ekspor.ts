// Ekspor Excel: tarik seluruh baris per blok, tulis .xlsx di browser.
import type { ColDef } from "ag-grid-community"
import { ambilList } from "@/features/dashboard/api/ApiDashboard"
import { EKSPOR_BLOK, EKSPOR_MAKS_BLOK } from "./lib/KonstantaDataGrid"
import { nilaiEkspor } from "./NilaiSel"
import type { BarisData } from "./types/TipeDataGrid"

/** Tarik SELURUH baris per blok `EKSPOR_BLOK`, dengan pagar `EKSPOR_MAKS_BLOK`. */
export async function ambilSemuaBaris(
  endpoint: string,
  params: Record<string, string | undefined>
): Promise<BarisData[]> {
  const semua: BarisData[] = []
  for (let page = 1; page <= EKSPOR_MAKS_BLOK; page++) {
    const { rows, total } = await ambilList<BarisData>(endpoint, {
      page,
      pageSize: EKSPOR_BLOK,
      ...params,
    })
    semua.push(...rows)
    if (semua.length >= total || rows.length === 0) break
  }
  return semua
}

export async function unduhExcel(
  judul: string,
  kolom: ColDef[],
  baris: BarisData[]
) {
  const data = baris.map((row) => {
    const o: BarisData = {}
    for (const c of kolom) o[c.headerName!] = nilaiEkspor(c, row)
    return o
  })

  // Import dinamis: xlsx (~400 kB) hanya diunduh saat tombol dipakai,
  // bukan membebani setiap kunjungan halaman.
  const XLSX = await import("xlsx")
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Data")
  const slug = judul.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  XLSX.writeFile(wb, `${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
