// Pembentuk param query untuk endpoint daftar.
import { UKURAN_HALAMAN_MOBILE } from "./konstanta"
import type { ParamUrut } from "./tipe"

/** "kolom:arah" (pilihan urut di mode kartu) -> param sortBy/sortDir. */
export function paramUrut(urut: string): ParamUrut {
  const [sortBy, sortDir] = urut.split(":")
  return sortBy ? { sortBy, sortDir: sortDir ?? "asc" } : {}
}

export function paramCari(searchParam: string | undefined, cari: string) {
  const teks = cari.trim()
  return searchParam && teks ? { [searchParam]: teks } : {}
}

/** Param satu halaman daftar kartu. `extraSerial` = JSON `extraParams`
 *  (identitas objeknya berubah tiap render parent, jadi yang dipakai sebagai
 *  dependency — dan sumber nilainya — adalah serialisasinya). */
export function paramDaftar(o: {
  halaman: number
  searchParam?: string
  cari: string
  filterNilai: Record<string, string>
  urutKartu: string
  extraSerial: string
}) {
  return {
    page: o.halaman,
    pageSize: UKURAN_HALAMAN_MOBILE,
    ...paramCari(o.searchParam, o.cari),
    ...o.filterNilai,
    ...paramUrut(o.urutKartu),
    ...(JSON.parse(o.extraSerial) as Record<string, string>),
  }
}
