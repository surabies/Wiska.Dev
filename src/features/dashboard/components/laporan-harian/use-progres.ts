import * as React from "react"
import { ambilSatu, ApiError } from "../../lib/api-client"
import type { JenisHari, Progres, Ringkasan, TitikGrafik } from "./tipe"

export function useProgres(periodes: number[]) {
  const [periode, setPeriode] = React.useState<number | null>(null)
  const [data, setData] = React.useState<Progres | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)

  // Periode bawaan = yang terbaru; dipilih saat render agar tidak ada permintaan kosong.
  const [periodeAwal, setPeriodeAwal] = React.useState<number | null>(null)
  if (periodes.length > 0 && periodeAwal !== periodes[0]) {
    setPeriodeAwal(periodes[0]!)
    if (periode === null) setPeriode(periodes[0]!)
  }

  React.useEffect(() => {
    if (periode === null) return
    let batal = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    setGalat(null)
    ambilSatu<Progres>("/laporan-harian/progres-pencatat", { periode })
      .then((d) => { if (!batal) setData(d) })
      .catch((e) => {
        if (!batal) setGalat(e instanceof ApiError ? e.message : "Progres gagal dimuat.")
      })
    return () => { batal = true }
  }, [periode])

  const jenisPer = React.useMemo(
    () => new Map((data?.hari ?? []).map((h) => [h.tanggal, h.jenis])),
    [data]
  )

  const ringkas = React.useMemo<Ringkasan | null>(() => {
    if (!data) return null
    const acuan = data.tanggalAcuan
    const setorAcuan = acuan ? data.pencatat.reduce((n, p) => n + (p.perTanggal[acuan] ?? 0), 0) : 0
    const orangAcuan = acuan ? data.pencatat.filter((p) => (p.perTanggal[acuan] ?? 0) > 0).length : 0
    const target = data.pencatat.reduce((n, p) => n + p.target, 0)
    const tersetor = data.pencatat.reduce((n, p) => n + p.tersetor, 0)
    const belumJalan = data.pencatat.filter((p) => p.status === "belum" || p.status === "diam").length
    return { setorAcuan, orangAcuan, target, tersetor, belumJalan }
  }, [data])

  const grafik = React.useMemo<TitikGrafik[]>(
    () =>
      (data?.totalPerTanggal ?? []).map((t) => ({
        ...t,
        jenis: jenisPer.get(t.tanggal) ?? ("kerja" as JenisHari),
      })),
    [data, jenisPer]
  )

  // Rata-rata hanya hari kerja yang sudah lewat (sampai tanggal acuan).
  const rataKerja = React.useMemo(() => {
    const acuan = data?.tanggalAcuan
    const hari = grafik.filter((g) => g.jenis === "kerja" && (!acuan || g.tanggal <= acuan))
    if (hari.length === 0) return 0
    return Math.round(hari.reduce((n, g) => n + g.jumlah, 0) / hari.length)
  }, [grafik, data])

  return { periode, setPeriode, data, galat, jenisPer, ringkas, grafik, rataKerja }
}
