"use client"

// features/dashboard/components/pemetaan-rute/use-penugasan-rute.ts — semua
// logika data panel kanan: memuat rute satu petugas, mengurutkan, menugaskan,
// melepas. Komponen hanya menampilkan.
//
// Keadaan dikunci ke `pencatatId` (`untuk`): respons petugas A yang terlambat
// tiba tidak akan menimpa tampilan petugas B, dan `memuat` diturunkan dari
// keadaan — tidak ada setState sinkron di dalam effect.
import * as React from "react"
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client"
import { keBarisSeret, type PenugasanBaris } from "./model"

type Hasil = { untuk: string; baris: PenugasanBaris[] }
type Galat = { untuk: string; pesan: string }
type DrafUrutan = { untuk: string; ids: string[] }

const pesanDari = (e: unknown, cadangan: string) => (e instanceof ApiError ? e.message : cadangan)

export function usePenugasanRute(pencatatId: string | null, onBerubah: () => void) {
  const [hasil, setHasil] = React.useState<Hasil | null>(null)
  const [galatSimpan, setGalat] = React.useState<Galat | null>(null)
  const [versi, setVersi] = React.useState(0)
  const [menyusun, setMenyusun] = React.useState(false)
  const [draf, setDraf] = React.useState<DrafUrutan | null>(null)

  React.useEffect(() => {
    if (!pencatatId) return
    let batal = false
    ambilSatu<PenugasanBaris[]>("/penugasan-rute", { pencatatId })
      .then((baris) => {
        if (batal) return
        setHasil({ untuk: pencatatId, baris })
        setGalat(null)
      })
      .catch((e) => {
        if (!batal) setGalat({ untuk: pencatatId, pesan: pesanDari(e, "Gagal memuat rute petugas.") })
      })
    return () => {
      batal = true
    }
  }, [pencatatId, versi])

  const baris = hasil?.untuk === pencatatId ? hasil.baris : null
  const galat = galatSimpan?.untuk === pencatatId ? galatSimpan.pesan : null
  const memuat = pencatatId !== null && baris === null && galat === null

  const idAwal = React.useMemo(() => (baris ?? []).map((b) => b.ruteId), [baris])
  const idTampil = draf?.untuk === pencatatId ? draf.ids : idAwal
  const posisiAwal = React.useMemo(
    () => new Map(idAwal.map((id, indeks) => [id, indeks + 1])),
    [idAwal],
  )
  const barisDenganUrutan = React.useMemo(() => {
    const peta = new Map((baris ?? []).map((b) => [b.ruteId, b]))
    return idTampil.flatMap((id) => {
      const item = peta.get(id)
      return item ? [item] : []
    })
  }, [baris, idTampil])
  const rute = React.useMemo(() => barisDenganUrutan.map(keBarisSeret), [barisDenganUrutan])
  const perubahanUrutan = React.useMemo(
    () => new Map(idTampil.map((id, indeks) => [id, posisiAwal.get(id) ?? indeks + 1])),
    [idTampil, posisiAwal],
  )
  const berubah = draf?.untuk === pencatatId &&
    (draf.ids.length !== idAwal.length || draf.ids.some((id, indeks) => id !== idAwal[indeks]))
  const totalTarget = React.useMemo(() => rute.reduce((n, r) => n + r.target, 0), [rute])
  /** Identitas stabil: dipakai dialog tambah rute sebagai penyaring. */
  const ruteTerpakai = React.useMemo(() => new Set(rute.map((r) => r.id)), [rute])

  function segarkan() {
    setDraf(null)
    setVersi((v) => v + 1)
    onBerubah()
  }

  function urutkan(ruteIds: string[]) {
    if (!pencatatId || !baris || menyusun) return
    const milik = new Set(baris.map((b) => b.ruteId))
    if (ruteIds.length !== milik.size || new Set(ruteIds).size !== milik.size ||
      !ruteIds.every((id) => milik.has(id))) return
    const samaDenganAwal =
      ruteIds.length === idAwal.length && ruteIds.every((id, indeks) => id === idAwal[indeks])
    setDraf(samaDenganAwal ? null : { untuk: pencatatId, ids: ruteIds })
    setGalat(null)
  }

  function aturPosisi(ruteId: string, posisi: number) {
    const ids = [...idTampil]
    const asal = ids.indexOf(ruteId)
    const tujuan = posisi - 1
    if (asal < 0 || tujuan < 0 || tujuan >= ids.length || asal === tujuan) return
    const [dipindah] = ids.splice(asal, 1)
    if (!dipindah) return
    ids.splice(tujuan, 0, dipindah)
    urutkan(ids)
  }

  function batalkanUrutan() {
    setDraf(null)
  }

  async function simpanUrutan() {
    if (!pencatatId || !baris || !berubah || menyusun) return
    const untuk = pencatatId
    const ids = idTampil
    setMenyusun(true)
    setGalat(null)
    try {
      await kirimJson("/penugasan-rute/urutan", "PATCH", { pencatatId: untuk, ruteIds: ids })
      const peta = new Map(baris.map((b) => [b.ruteId, b]))
      const baru = ids.flatMap((id, urutan) => {
        const item = peta.get(id)
        return item ? [{ ...item, urutan }] : []
      })
      setHasil((h) => h?.untuk === untuk ? { untuk, baris: baru } : h)
      setDraf(null)
      onBerubah()
    } catch (e) {
      setGalat({ untuk, pesan: pesanDari(e, "Gagal menyimpan urutan.") })
    } finally {
      setMenyusun(false)
    }
  }

  /** Melempar galat — dipanggil dari dialog konfirmasi yang menampilkannya. */
  async function lepas(penugasanId: string) {
    await kirimJson(`/penugasan-rute/${penugasanId}`, "DELETE", {})
    segarkan()
  }

  /** Melempar galat — dialog tambah rute yang menampilkannya. */
  async function tugaskan(ruteId: string) {
    if (!pencatatId) return
    await kirimJson("/penugasan-rute", "POST", { pencatatId, ruteId })
    segarkan()
  }

  return {
    rute,
    totalTarget,
    ruteTerpakai,
    memuat,
    galat,
    menyusun,
    berubah: Boolean(berubah),
    perubahanUrutan,
    urutkan,
    aturPosisi,
    batalkanUrutan,
    simpanUrutan,
    lepas,
    tugaskan,
  }
}
