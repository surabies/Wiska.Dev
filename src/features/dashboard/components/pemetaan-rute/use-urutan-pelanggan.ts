"use client"

import * as React from "react"
import { ambilList, kirimJson, ApiError } from "../../lib/api-client"

export interface PelangganBaris {
  id: string
  nomorLangganan: string
  nama: string
  noUrutRute: number | null
}

const UKURAN_HALAMAN = 5000

export function useUrutanPelanggan(ruteId: string) {
  const [items, setItems] = React.useState<PelangganBaris[]>([])
  const [itemsAwal, setItemsAwal] = React.useState<PelangganBaris[]>([])
  const [total, setTotal] = React.useState<number | null>(null)
  const [memuat, setMemuat] = React.useState(true)
  const [menyimpan, setMenyimpan] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [versi, setVersi] = React.useState(0)

  React.useEffect(() => {
    let batal = false
    ambilList<PelangganBaris>(`/rute/${ruteId}/pelanggan-urutan`, {
      page: 1,
      pageSize: UKURAN_HALAMAN,
    })
      .then(async ({ rows: awal, total: jumlah }) => {
        const halaman = Math.ceil(jumlah / UKURAN_HALAMAN)
        const sisanya = await Promise.all(
          Array.from({ length: Math.max(0, halaman - 1) }, (_, i) =>
            ambilList<PelangganBaris>(`/rute/${ruteId}/pelanggan-urutan`, {
              page: i + 2,
              pageSize: UKURAN_HALAMAN,
            }),
          ),
        )
        if (batal) return
        const semua = [awal, ...sisanya.flatMap((h) => h.rows)]
        const rows = semua.flat()
        if (rows.length !== jumlah) {
          setGalat("Daftar pelanggan berubah saat dimuat. Muat ulang sebelum mengubah urutan.")
          return
        }
        setItems(rows)
        setItemsAwal(rows)
        setTotal(jumlah)
      })
      .catch((e) => {
        if (!batal)
          setGalat(e instanceof ApiError ? e.message : "Gagal memuat pelanggan.")
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [ruteId, versi])

  function pindah(sebelumId: string, setelahId: string) {
    if (sebelumId === setelahId) return
    setItems((lama) => {
      const asal = lama.findIndex((p) => p.id === sebelumId)
      const tujuan = lama.findIndex((p) => p.id === setelahId)
      if (asal < 0 || tujuan < 0) return lama
      const baru = [...lama]
      const [dipindah] = baru.splice(asal, 1)
      if (!dipindah) return lama
      baru.splice(tujuan, 0, dipindah)
      return baru
    })
  }

  function pindahSatu(indeks: number, arah: -1 | 1) {
    const tujuan = indeks + arah
    if (tujuan < 0 || tujuan >= items.length) return
    pindah(items[indeks].id, items[tujuan].id)
  }

  function aturPosisi(id: string, posisi: number) {
    const asal = items.findIndex((p) => p.id === id)
    const tujuan = posisi - 1
    if (asal < 0 || tujuan < 0 || tujuan >= items.length || asal === tujuan) return
    const baru = [...items]
    const [dipindah] = baru.splice(asal, 1)
    if (!dipindah) return
    baru.splice(tujuan, 0, dipindah)
    setItems(baru)
  }

  const posisiAwal = React.useMemo(
    () => new Map(itemsAwal.map((item, index) => [item.id, index + 1])),
    [itemsAwal],
  )
  const berubah =
    items.length !== itemsAwal.length ||
    items.some((item, index) => itemsAwal[index]?.id !== item.id)

  async function simpan() {
    if (menyimpan || memuat || !berubah || items.length === 0) return
    setMenyimpan(true)
    setGalat(null)
    try {
      await kirimJson(`/rute/${ruteId}/urutan-pelanggan`, "PATCH", {
        pelangganIds: items.map((i) => i.id),
      })
      setItemsAwal(items)
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menyimpan urutan.")
    } finally {
      setMenyimpan(false)
    }
  }

  return {
    items,
    total,
    memuat,
    menyimpan,
    galat,
    berubah,
    posisiAwal,
    pindah,
    pindahSatu,
    aturPosisi,
    simpan,
    muatUlang: () => {
      setMemuat(true)
      setGalat(null)
      setVersi((v) => v + 1)
    },
  }
}
