import type { StyleSpecification } from "maplibre-gl"
import type { KategoriPengaduan, StatusPengaduan } from "../types/TipePengaduan"

/* ---------- Peta ---------- */

// [lng, lat] Kota Bandung / Kantor PDAM Tirtawening
export const PETA = {
  pusat: [107.6191, -6.9175] as [number, number],
  zoom: 12,
  zoomMin: 9,
  zoomTitik: 16, // zoom saat terbang ke satu titik
}

// Kotak wilayah layanan [barat, selatan, timur, utara] wilayah Kota Bandung sekitarnya
export const BATAS_WILAYAH: [number, number, number, number] = [107.55, -7.0, 107.75, -6.8]

export function dalamWilayah(lng: number, lat: number) {
  const [barat, selatan, timur, utara] = BATAS_WILAYAH
  return lng >= barat && lng <= timur && lat >= selatan && lat <= utara
}

export const FONT_KLASTER = ["Noto Sans Regular"]

/**
 * Membuat gaya dasar MapLibre dengan konfigurasi shader raster
 * yang otomatis adaptif terhadap tema terang atau gelap sejak inisialisasi pertama.
 */
export function buatGayaPeta(gelap = false): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: gelap
          ? {
              "raster-brightness-max": 0.45,
              "raster-saturation": -0.7,
              "raster-contrast": -0.15,
            }
          : {
              "raster-brightness-max": 1,
              "raster-saturation": 0,
              "raster-contrast": 0,
            },
      },
    ],
  }
}

export const GAYA_PETA = buatGayaPeta(false)

/* ---------- Status ---------- */

export const URUTAN_STATUS: StatusPengaduan[] = ["baru", "terverifikasi", "diproses", "selesai"]

// `warna` dipakai layer peta (hex); `badge` dipakai komponen UI (kelas Tailwind)
export const STATUS_META: Record<StatusPengaduan, { label: string; warna: string; badge: string }> = {
  baru: {
    label: "Belum terverifikasi",
    warna: "#f59e0b",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  },
  terverifikasi: {
    label: "Terverifikasi",
    warna: "#ef4444",
    badge: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200",
  },
  diproses: {
    label: "Sedang ditangani",
    warna: "#6366f1",
    badge: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-200",
  },
  selesai: {
    label: "Selesai",
    warna: "#16a34a",
    badge: "bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-200",
  },
}

/* ---------- 12 Kategori Sesuai Database Prisma JenisPengaduan ---------- */

export const KATEGORI: { value: KategoriPengaduan; label: string; deskripsi?: string }[] = [
  {
    value: "BOCOR_PIPA_DINAS",
    label: "Bocor Pipa Dinas",
    deskripsi: "Pipa retak/bocor atau semburan air di badan jalan & trotoar",
  },
  {
    value: "AIR_KERUH_BAU_BERWARNA",
    label: "Air Keruh, Bau, & Berwarna",
    deskripsi: "Kualitas fisik air tidak jernih, keruh, atau berbau",
  },
  {
    value: "TIDAK_ADA_AIR",
    label: "Air Tidak Mengalir",
    deskripsi: "Aliran air mati total di rumah atau lingkungan pelanggan",
  },
  {
    value: "LONJAKAN_PEMAKAIAN_AIR",
    label: "Lonjakan Pemakaian Air",
    deskripsi: "Pemakaian kubikasi air melonjak tinggi secara tidak wajar",
  },
  {
    value: "GANTI_STOP_KRAN",
    label: "Ganti Stop Kran",
    deskripsi: "Stop kran air rusak, aus, bocor, atau patah",
  },
  {
    value: "LAPOR_STAND_METER",
    label: "Lapor Stand Meter",
    deskripsi: "Laporan angka stand meteran air mandiri oleh pelanggan",
  },
  {
    value: "PENCATATAN_METER_TIDAK_SESUAI",
    label: "Pencatatan Meter Tidak Sesuai",
    deskripsi: "Angka di meter fisik berbeda dengan catatan tagihan",
  },
  {
    value: "PINDAH_JARINGAN",
    label: "Pindah Jaringan / Pipa",
    deskripsi: "Permintaan relokasi atau pemindahan jalur pipa sambungan",
  },
  {
    value: "PASANGAN_LIAR",
    label: "Pasangan Liar",
    deskripsi: "Dugaan sambungan liar atau manipulasi meteran air",
  },
  {
    value: "MUTASI_GOLONGAN_TARIF",
    label: "Mutasi Golongan Tarif",
    deskripsi: "Permohonan penyesuaian kelompok tarif pelanggan",
  },
  {
    value: "TIDAK_MAMPU_BAYAR",
    label: "Keringanan Biaya Rekening",
    deskripsi: "Permohonan keringanan atau restrukturisasi tagihan rekening",
  },
  {
    value: "LAINNYA",
    label: "Lainnya",
    deskripsi: "Keluhan atau pertanyaan seputar layanan air lainnya",
  },
]

const LABEL_MAPPING: Record<string, string> = {
  BOCOR_PIPA_DINAS: "Bocor Pipa Dinas",
  "pipa-bocor": "Bocor Pipa Dinas",
  AIR_KERUH_BAU_BERWARNA: "Air Keruh, Bau, & Berwarna",
  "air-keruh": "Air Keruh, Bau, & Berwarna",
  TIDAK_ADA_AIR: "Air Tidak Mengalir",
  "air-mati": "Air Tidak Mengalir",
  LONJAKAN_PEMAKAIAN_AIR: "Lonjakan Pemakaian Air",
  "tekanan-rendah": "Tekanan Air Rendah",
  GANTI_STOP_KRAN: "Ganti Stop Kran",
  LAPOR_STAND_METER: "Lapor Stand Meter",
  PENCATATAN_METER_TIDAK_SESUAI: "Pencatatan Meter Tidak Sesuai",
  "meter-rusak": "Meter Air Rusak",
  PINDAH_JARINGAN: "Pindah Jaringan / Pipa",
  PASANGAN_LIAR: "Pasangan Liar",
  MUTASI_GOLONGAN_TARIF: "Mutasi Golongan Tarif",
  TIDAK_MAMPU_BAYAR: "Keringanan Biaya Rekening",
  LAINNYA: "Lainnya",
  lainnya: "Lainnya",
}

export function labelKategori(k: KategoriPengaduan | string): string {
  if (LABEL_MAPPING[k]) return LABEL_MAPPING[k]
  const cocok = KATEGORI.find((x) => x.value === k)
  if (cocok) return cocok.label
  return k.replace(/_/g, " ")
}

/* ---------- Teks & Pengaturan ---------- */

export const MAKS_FOTO = 3

export const KONTAK = { callCenter: "(022) 2509030 / 2509032" }
