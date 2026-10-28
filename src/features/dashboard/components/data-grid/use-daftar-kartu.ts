import * as React from "react"
import { ambilList, ApiError } from "../../lib/api-client"
import { UKURAN_HALAMAN_MOBILE } from "./konstanta"
import { paramDaftar } from "./param"
import type { BarisData, KeadaanDaftar } from "./tipe"

const KEADAAN_DAFTAR_AWAL: KeadaanDaftar = {
  kunci: "",
  baris: [],
  halaman: 1,
  total: null,
  adaLagi: false,
  memuat: true,
  galat: null,
}

/** Daftar kartu ponsel: halaman pertama dimuat otomatis tiap kueri berubah,
 *  halaman berikutnya lewat `muatLagi`. `kunci` = sidik jari kueri; hasil yang
 *  tiba dari kueri lama (atau keadaan yang bukan milik kueri sekarang) tidak
 *  dipakai — itulah sebabnya `terkini` bisa null sesaat setelah filter diubah. */
export function useDaftarKartu(o: {
  aktif: boolean
  endpoint: string
  searchParam?: string
  cari: string
  filterNilai: Record<string, string>
  extraSerial: string
  urutKartu: string
  refreshKey?: number
}) {
  const { aktif, endpoint, searchParam, cari, filterNilai } = o
  const { extraSerial, urutKartu, refreshKey } = o
  const [percobaan, setPercobaan] = React.useState(0)
  const [keadaan, setKeadaan] =
    React.useState<KeadaanDaftar>(KEADAAN_DAFTAR_AWAL)
  const permintaanRef = React.useRef(0)

  const kunci = JSON.stringify([
    endpoint,
    searchParam,
    cari,
    filterNilai,
    extraSerial,
    refreshKey,
    urutKartu,
    percobaan,
  ])
  const terkini = keadaan.kunci === kunci ? keadaan : null
  const memuat = !terkini || keadaan.memuat

  React.useEffect(() => {
    if (!aktif) return

    const permintaan = ++permintaanRef.current
    void ambilList<BarisData>(
      endpoint,
      paramDaftar({
        halaman: 1,
        searchParam,
        cari,
        filterNilai,
        urutKartu,
        extraSerial,
      })
    )
      .then(({ rows, total }) => {
        if (permintaanRef.current !== permintaan) return
        setKeadaan({
          kunci,
          baris: rows,
          halaman: 1,
          total,
          adaLagi: rows.length < total,
          memuat: false,
          galat: null,
        })
      })
      .catch((err: unknown) => {
        if (permintaanRef.current !== permintaan) return
        setKeadaan({
          kunci,
          baris: [],
          halaman: 1,
          total: null,
          adaLagi: false,
          memuat: false,
          galat: err instanceof ApiError ? err.message : "Gagal memuat data.",
        })
      })

    return () => {
      permintaanRef.current += 1
    }
  }, [
    aktif,
    kunci,
    endpoint,
    searchParam,
    cari,
    filterNilai,
    extraSerial,
    urutKartu,
  ])

  async function muatLagi() {
    if (memuat || !terkini?.adaLagi) return
    const permintaan = permintaanRef.current
    const halaman = terkini.halaman + 1
    setKeadaan((sebelumnya) => ({ ...sebelumnya, memuat: true, galat: null }))
    try {
      const { rows, total } = await ambilList<BarisData>(
        endpoint,
        paramDaftar({
          halaman,
          searchParam,
          cari,
          filterNilai,
          urutKartu,
          extraSerial,
        })
      )
      if (permintaanRef.current !== permintaan) return
      setKeadaan((sebelumnya) => ({
        ...sebelumnya,
        baris: [...sebelumnya.baris, ...rows],
        halaman,
        total,
        adaLagi: rows.length > 0 && halaman * UKURAN_HALAMAN_MOBILE < total,
        memuat: false,
        galat: null,
      }))
    } catch (err) {
      if (permintaanRef.current !== permintaan) return
      setKeadaan((sebelumnya) => ({
        ...sebelumnya,
        memuat: false,
        galat: err instanceof ApiError ? err.message : "Gagal memuat data.",
      }))
    }
  }

  return {
    baris: terkini?.baris ?? [],
    total: terkini?.total ?? null,
    adaLagi: terkini?.adaLagi ?? false,
    galat: terkini?.galat ?? null,
    memuat,
    muatLagi,
    ulangi: () => setPercobaan((n) => n + 1),
  }
}
