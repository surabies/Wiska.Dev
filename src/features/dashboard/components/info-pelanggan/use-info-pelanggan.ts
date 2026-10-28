"use client"

// Mengambil info satu pelanggan untuk satu periode, HANYA lewat endpoint yang
// sudah terbukti dipakai halaman lain (api-client, bukan fetch mentah):
//   GET /pelanggan?q=            → identitas (pola PelangganGrid, searchParam "q")
//   GET /meter?pelangganId=      → meter aktif (pola panel-lapangan)
//   GET /pembacaan               → pembacaan resmi + riwayat (pola PembacaanGrid)
//   GET /laporan-harian(/:id)    → foto & koordinat (pola panel-lapangan)
//
// Hanya /pelanggan yang wajib. Sisanya opsional: bila gagal atau kosong,
// kartu terkait tampil "—"/"belum ada", halaman tidak jatuh. Alasan
// kegagalan dicatat ke console.warn supaya mudah dilacak.
//
// Yang masih tebakan (ditandai ASUMSI): nama param filter di /pembacaan dan
// /laporan-harian, serta nama field noHp/ukuran meter.
import * as React from "react"
import { ambilList, ambilSatu, ApiError } from "../../lib/api-client"
import type { BarisRiwayat, InfoPelanggan } from "./tipe"

export type StatusInfo = "idle" | "memuat" | "galat" | "siap"

// --- bentuk respons (semua opsional: salah nama field = "—", bukan error) --
type Pelanggan = {
  id: string
  nomorLangganan?: string | null
  nama?: string | null
  status?: string | null
  alamat?: string | null
  rt?: string | null
  rw?: string | null
  kecamatan?: { nama?: string | null } | null
  kelurahan?: { nama?: string | null } | null
  tarifGolongan?: { kode?: string | null; nama?: string | null } | null
  noHp?: string | null // ASUMSI
  telepon?: string | null // ASUMSI
  geoLat?: number | null
  geoLong?: number | null
}

type Meter = {
  id: string
  nomorMeter?: string | null
  ukuran?: string | null // ASUMSI
  ukuranMeter?: string | null // ASUMSI
  isAktif?: boolean
}

type Pembacaan = {
  periode?: string | number
  standLalu?: number | null
  standAkhir?: number | null
  pemakaianM3?: number | null
  kondisi?: string | null
  fotoBukti?: string | null
  createdAt?: string | null
  meter?: {
    nomorMeter?: string | null
    pelanggan?: { nomorLangganan?: string | null } | null
  } | null
  pencatat?: { namaLapangan?: string | null } | null
}

type LaporanRingkas = {
  id: string
  nomorLangganan?: string | null
  periode?: string | number
}

type LaporanDetail = LaporanRingkas & {
  kondisi?: string | null
  standAwal?: number | null
  standAkhir?: number | null
  standAkhirRevisi?: number | null
  pemakaian?: number | null
  pemakaianTagihVerif?: number | null
  tanggalCatat?: string | null
  fotoStandUrl?: string | null
  fotoSegelUrl?: string | null
  fotoRumahUrl?: string | null
  pencatat?: { namaLapangan?: string | null } | null
  pembacaan?: {
    standAkhir?: number | null
    pemakaianM3?: number | null
    fotoBukti?: string | null
  } | null
  pelanggan?: { geoLat?: number | null; geoLong?: number | null } | null
}

// --- util -------------------------------------------------------------------
/** "2026-07-01T00:00:00Z" | 202607 | "202607" → "202607". */
function keYYYYMM(p: string | number | undefined | null): string {
  return String(p ?? "").replace(/\D/g, "").slice(0, 6)
}

function gabungAlamat(p: Pelanggan): string | null {
  const bagian = [
    p.alamat,
    p.rt || p.rw ? `RT ${p.rt ?? "-"}/RW ${p.rw ?? "-"}` : null,
    p.kelurahan?.nama,
    p.kecamatan?.nama,
  ].filter((v): v is string => Boolean(v && v.trim()))
  return bagian.length ? bagian.join(", ") : null
}

function catatan(alasan: unknown, nama: string) {
  console.warn(`[info-pelanggan] ${nama} gagal dimuat:`, alasan)
}

// --- pengambilan data --------------------------------------------------------
async function ambilInfo(nomor: string, periode: string): Promise<InfoPelanggan> {
  // 1) WAJIB: identitas pelanggan. `q` = searchParam yang sama dgn PelangganGrid;
  //    cocokkan nomornya persis karena `q` juga mencari nama/alamat.
  const { rows: calon } = await ambilList<Pelanggan>("/pelanggan", {
    page: 1,
    pageSize: 10,
    q: nomor,
  })
  const pel = calon.find((c) => c.nomorLangganan === nomor)
  if (!pel) throw new Error(`Pelanggan dengan No. Langganan ${nomor} tidak ditemukan.`)

  // 2) OPSIONAL, paralel. Param ekstra yang tak dikenal server diabaikan;
  //    keluarannya tetap disaring persis di sisi klien (lihat bawah).
  const [rMeter, rBaca, rLapor] = await Promise.allSettled([
    ambilList<Meter>("/meter", { pelangganId: pel.id, pageSize: 100 }),
    ambilList<Pembacaan>("/pembacaan", {
      page: 1,
      pageSize: 8,
      sortBy: "periode",
      sortDir: "desc",
      pelangganId: pel.id, // ASUMSI
      nomorLangganan: nomor, // ASUMSI
      q: nomor, // ASUMSI
    }),
    ambilList<LaporanRingkas>("/laporan-harian", {
      page: 1,
      pageSize: 10,
      q: nomor, // ASUMSI
      nomorLangganan: nomor, // ASUMSI
      ...(periode ? { periode } : {}),
    }),
  ])

  if (rMeter.status === "rejected") catatan(rMeter.reason, "/meter")
  if (rBaca.status === "rejected") catatan(rBaca.reason, "/pembacaan")
  if (rLapor.status === "rejected") catatan(rLapor.reason, "/laporan-harian")

  const meters = rMeter.status === "fulfilled" ? rMeter.value.rows : []
  // Pengaman: hanya baris milik pelanggan ini yang dipakai.
  const bacaan = (rBaca.status === "fulfilled" ? rBaca.value.rows : []).filter(
    (b) => b.meter?.pelanggan?.nomorLangganan === nomor
  )
  const laporan = (rLapor.status === "fulfilled" ? rLapor.value.rows : []).filter(
    (l) => l.nomorLangganan === nomor && (!periode || keYYYYMM(l.periode) === periode)
  )

  // 3) Periode terpilih → baris pembacaan resmi + riwayat 3 periode sesudahnya.
  const idx = periode ? bacaan.findIndex((b) => keYYYYMM(b.periode) === periode) : 0
  const baca = idx >= 0 ? bacaan[idx] : undefined
  const riwayat: BarisRiwayat[] =
    idx >= 0
      ? bacaan.slice(idx + 1, idx + 4).map((r) => ({
          periode: keYYYYMM(r.periode),
          standLalu: r.standLalu ?? null,
          standAkhir: r.standAkhir ?? null,
          pemakaianM3: r.pemakaianM3 ?? null,
          tagihan: null, // tidak ada di /pembacaan
        }))
      : []

  // 4) Detail laporan harian (foto, koordinat, stand) — opsional.
  let det: LaporanDetail | null = null
  if (laporan[0]) {
    try {
      det = await ambilSatu<LaporanDetail>(`/laporan-harian/${laporan[0].id}`)
    } catch (err) {
      catatan(err, "/laporan-harian/:id")
    }
  }

  const meter =
    meters.find((m) => m.nomorMeter && m.nomorMeter === baca?.meter?.nomorMeter) ??
    meters.find((m) => m.isAktif) ??
    meters[0]

  const periodeCatat = keYYYYMM(baca?.periode ?? det?.periode ?? periode)
  const adaCatat = Boolean(baca || det)

  const lat = pel.geoLat ?? det?.pelanggan?.geoLat
  const lng = pel.geoLong ?? det?.pelanggan?.geoLong

  return {
    pelanggan: {
      nomorLangganan: nomor,
      nama: pel.nama ?? "",
      alamat: gabungAlamat(pel),
      golongan:
        pel.tarifGolongan?.kode?.replace("GOL_", "") ?? pel.tarifGolongan?.nama ?? null,
      nomorMeter: meter?.nomorMeter ?? baca?.meter?.nomorMeter ?? null,
      ukuranMeter: meter?.ukuran ?? meter?.ukuranMeter ?? null,
      noHp: pel.noHp ?? pel.telepon ?? null,
      status: pel.status ?? null,
    },
    catat: adaCatat
      ? {
          periode: periodeCatat,
          standLalu: baca?.standLalu ?? det?.standAwal ?? null,
          standAkhir:
            baca?.standAkhir ?? det?.pembacaan?.standAkhir ?? det?.standAkhirRevisi ?? det?.standAkhir ?? null,
          pemakaianM3:
            baca?.pemakaianM3 ?? det?.pembacaan?.pemakaianM3 ?? det?.pemakaianTagihVerif ?? det?.pemakaian ?? null,
          biaya: null, // tidak ada di /pembacaan maupun /laporan-harian
          kondisi: baca?.kondisi ?? det?.kondisi ?? null,
          petugas: baca?.pencatat?.namaLapangan ?? det?.pencatat?.namaLapangan ?? null,
          waktuCatat: det?.tanggalCatat ?? baca?.createdAt ?? null,
          waktuUpload: null,
        }
      : null,
    riwayat,
    lokasi: lat != null && lng != null ? { lat, lng } : null,
    foto: {
      segel: det?.fotoSegelUrl ?? null,
      stand: det?.fotoStandUrl ?? det?.pembacaan?.fotoBukti ?? baca?.fotoBukti ?? null,
      rumah: det?.fotoRumahUrl ?? null,
    },
  }
}

// --- hook --------------------------------------------------------------------
type Hasil = { kunci: string; data?: InfoPelanggan; galat?: string }

export function useInfoPelanggan(nomor: string, periode: string) {
  const kunci = nomor ? `${nomor}|${periode}` : ""
  const [hasil, setHasil] = React.useState<Hasil | null>(null)

  React.useEffect(() => {
    if (!nomor) return
    let batal = false
    const k = `${nomor}|${periode}`

    ambilInfo(nomor, periode)
      .then((data) => {
        if (!batal) setHasil({ kunci: k, data })
      })
      .catch((err: unknown) => {
        if (batal) return
        setHasil({
          kunci: k,
          galat:
            err instanceof ApiError || err instanceof Error
              ? err.message
              : "Gagal memuat data pelanggan.",
        })
      })

    return () => {
      batal = true
    }
  }, [nomor, periode])

  const status: StatusInfo = !kunci
    ? "idle"
    : hasil?.kunci !== kunci
      ? "memuat"
      : hasil.galat
        ? "galat"
        : "siap"

  return {
    status,
    data: status === "siap" ? (hasil?.data ?? null) : null,
    galat: status === "galat" ? (hasil?.galat ?? null) : null,
  }
}
