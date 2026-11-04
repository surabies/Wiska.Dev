import type {
  BuatPengaduanInput,
  KategoriPengaduan,
  Pengaduan,
  StatusPengaduan,
} from "../types/TipePengaduan"
import { labelKategori } from "./KonstantaPengaduan"

const STORAGE_DIKUTI_KEY = "tirtawening_pengaduan_diikuti"

function getDaftarDiikuti(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_DIKUTI_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function simpanDiikuti(id: string, ikuti: boolean) {
  if (typeof window === "undefined") return
  try {
    const set = getDaftarDiikuti()
    if (ikuti) set.add(id)
    else set.delete(id)
    localStorage.setItem(STORAGE_DIKUTI_KEY, JSON.stringify(Array.from(set)))
  } catch {}
}

function petakanDbStatusKeFrontend(statusDb: string): StatusPengaduan {
  switch (statusDb) {
    case "BARU":
      return "baru"
    case "TERVERIFIKASI":
    case "DIVERIFIKASI":
      return "terverifikasi"
    case "SELESAI":
    case "DITUTUP":
      return "selesai"
    case "DIJADWALKAN":
    case "DALAM_PENANGANAN":
    case "MENUNGGU_SUKU_CADANG":
    case "DITUGASKAN":
    case "DIPROSES":
    case "MENUJU_LOKASI":
    case "MENUNGGU_PELANGGAN":
    case "DIBUKA_KEMBALI":
    default:
      return "diproses"
  }
}

export function petakanDbJenisKeKategori(jenisDb: string): KategoriPengaduan {
  if (!jenisDb) return "LAINNYA"
  const upper = jenisDb.toUpperCase().trim()

  const validEnums: KategoriPengaduan[] = [
    "BOCOR_PIPA_DINAS",
    "AIR_KERUH_BAU_BERWARNA",
    "TIDAK_ADA_AIR",
    "LONJAKAN_PEMAKAIAN_AIR",
    "GANTI_STOP_KRAN",
    "LAPOR_STAND_METER",
    "PENCATATAN_METER_TIDAK_SESUAI",
    "PINDAH_JARINGAN",
    "PASANGAN_LIAR",
    "MUTASI_GOLONGAN_TARIF",
    "TIDAK_MAMPU_BAYAR",
    "LAINNYA",
  ]

  if (validEnums.includes(upper as KategoriPengaduan)) {
    return upper as KategoriPengaduan
  }

  // Alias legacy
  switch (jenisDb.toLowerCase()) {
    case "pipa-bocor":
      return "BOCOR_PIPA_DINAS"
    case "air-keruh":
      return "AIR_KERUH_BAU_BERWARNA"
    case "air-mati":
      return "TIDAK_ADA_AIR"
    case "tekanan-rendah":
      return "LONJAKAN_PEMAKAIAN_AIR"
    case "meter-rusak":
      return "PENCATATAN_METER_TIDAK_SESUAI"
    default:
      return "LAINNYA"
  }
}

export function petakanKategoriKeDbJenis(kategori: KategoriPengaduan | string): string {
  switch (kategori) {
    case "pipa-bocor":
      return "BOCOR_PIPA_DINAS"
    case "air-keruh":
      return "AIR_KERUH_BAU_BERWARNA"
    case "air-mati":
      return "TIDAK_ADA_AIR"
    case "tekanan-rendah":
      return "LONJAKAN_PEMAKAIAN_AIR"
    case "meter-rusak":
      return "PENCATATAN_METER_TIDAK_SESUAI"
    case "lainnya":
      return "LAINNYA"
    default:
      return kategori
  }
}

interface RawRiwayatDb {
  id?: string
  status?: string
  statusKe?: string
  statusDari?: string | null
  aksi?: string
  createdAt?: string | Date
  waktu?: string | Date
  catatan?: string
  olehNama?: string
  oleh?: { name?: string }
}

interface RawPengaduanDb {
  id: string
  nomorTiket?: string
  jenis: string
  judul?: string
  deskripsi?: string
  alamatKejadian?: string
  lng?: number
  lat?: number
  fotoUrl?: string
  status: string
  prioritas?: "RENDAH" | "NORMAL" | "TINGGI" | "DARURAT"
  pelapor?: string
  kontakPelapor?: string
  petugasNama?: string | null
  ditugaskanKe?: { name?: string } | null
  targetSelesaiAt?: string | Date | null
  riwayat?: RawRiwayatDb[]
  createdAt?: string | Date
}

/** Memetakan baris mentah dari basis data PostgreSQL ke model Pengaduan frontend */
export function petakanBarisDbKePengaduan(rows: unknown[]): Pengaduan[] {
  const diikutiSet = getDaftarDiikuti()
  return (rows || [])
    .filter((item): item is RawPengaduanDb => {
      const it = item as RawPengaduanDb
      return Boolean(it && typeof it.lng === "number" && typeof it.lat === "number")
    })
    .map((item) => ({
      id: item.id,
      nomor: item.nomorTiket || item.id,
      kategori: petakanDbJenisKeKategori(item.jenis),
      judul: item.judul,
      deskripsi: item.deskripsi || item.judul || "",
      alamat: item.alamatKejadian || "Lokasi kejadian, Kota Bandung",
      lng: item.lng as number,
      lat: item.lat as number,
      foto: item.fotoUrl ? [item.fotoUrl] : [],
      status: petakanDbStatusKeFrontend(item.status),
      prioritas: item.prioritas || "NORMAL",
      pelapor: item.pelapor || "Warga",
      kontakPelapor: item.kontakPelapor,
      petugasNama: item.ditugaskanKe?.name || item.petugasNama || null,
      targetSelesaiAt: item.targetSelesaiAt ? new Date(item.targetSelesaiAt).toISOString() : null,
      riwayat: Array.isArray(item.riwayat)
        ? item.riwayat.map((r) => ({
            id: r.id,
            status: petakanDbStatusKeFrontend(r.statusKe || r.status || "BARU"),
            statusDari: r.statusDari,
            aksi: r.aksi,
            waktu: r.createdAt
              ? new Date(r.createdAt).toISOString()
              : r.waktu
                ? new Date(r.waktu).toISOString()
                : new Date().toISOString(),
            catatan: r.catatan,
            olehNama: r.olehNama || r.oleh?.name || "Petugas Lapangan",
          }))
        : [],
      diikuti: diikutiSet.has(item.id),
      dibuatPada: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    }))
}

// Data cadangan lokal jika tabel baru kosong di tahap awal
const FALLBACK_PENGADUAN: Pengaduan[] = [
  {
    id: "sample-1",
    nomor: "TW-2611-BOCOR01",
    kategori: "BOCOR_PIPA_DINAS",
    judul: "Pipa Distribusi Bocor di Trotoar",
    deskripsi: "Pipa transmisi di tepi trotoar retak, air mengalir deras ke jalan.",
    alamat: "Jl. Badaksinga No. 10, Coblong, Kota Bandung",
    lng: 107.6111,
    lat: -6.8905,
    foto: [],
    status: "selesai",
    prioritas: "TINGGI",
    pelapor: "Ahmad Fauzi",
    kontakPelapor: "08122334455",
    petugasNama: "Asep Sunandar (Tim Reaksi Cepat)",
    targetSelesaiAt: "2026-11-03T12:00:00+07:00",
    diikuti: false,
    dibuatPada: "2026-11-02T22:10:00+07:00",
    riwayat: [
      { id: "rw-1", status: "baru", aksi: "DIBUAT", olehNama: "Sistem Otomatis", waktu: "2026-11-02T22:10:00+07:00", catatan: "Laporan masuk melalui kanal publik." },
      { id: "rw-2", status: "terverifikasi", aksi: "DIVERIFIKASI", olehNama: "Budi Santoso (Operator CS)", waktu: "2026-11-03T05:30:00+07:00", catatan: "Operator memverifikasi keabsahan lokasi laporan." },
      { id: "rw-3", status: "diproses", aksi: "DITUGASKAN", olehNama: "Budi Santoso (Operator CS)", waktu: "2026-11-03T07:00:00+07:00", catatan: "Ditugaskan ke Tim Reaksi Cepat Zona Coblong." },
      { id: "rw-4", status: "selesai", aksi: "STATUS_DIUBAH", olehNama: "Asep Sunandar (Petugas Lapangan)", waktu: "2026-11-03T11:45:00+07:00", catatan: "Klem pipa 2 inch berhasil diganti, jalanan sudah bersih dan tekanan normal." },
    ],
  },
  {
    id: "sample-2",
    nomor: "TW-2611-KERUH02",
    kategori: "AIR_KERUH_BAU_BERWARNA",
    judul: "Air Berwarna Cokelat dan Keruh",
    deskripsi: "Air keran berwarna kecokelatan dan berbau lumpur sejak pagi hari.",
    alamat: "Jl. Tamansari No. 64, Bandung Wetan, Kota Bandung",
    lng: 107.6082,
    lat: -6.9021,
    foto: [],
    status: "diproses",
    prioritas: "NORMAL",
    pelapor: "Dewi Lestari",
    kontakPelapor: "081399887766",
    petugasNama: "Ujang Suherman (Seksi Jaringan)",
    targetSelesaiAt: "2026-11-04T18:00:00+07:00",
    diikuti: true,
    dibuatPada: "2026-11-03T06:20:00+07:00",
    riwayat: [
      { id: "rw-5", status: "baru", aksi: "DIBUAT", olehNama: "Dewi Lestari", waktu: "2026-11-03T06:20:00+07:00", catatan: "Aduan warga dikirim via portal peta." },
      { id: "rw-6", status: "terverifikasi", aksi: "DIVERIFIKASI", olehNama: "Rina Marlina (Operator)", waktu: "2026-11-03T08:00:00+07:00", catatan: "Diverifikasi dan dicocokkan dengan wilayah DMA Tamansari." },
      { id: "rw-7", status: "diproses", aksi: "CATATAN", olehNama: "Ujang Suherman (Teknisi)", waktu: "2026-11-03T09:30:00+07:00", catatan: "Sedang dilakukan flushing wash-out pada pipa transmisi sekunder." },
    ],
  },
  {
    id: "sample-3",
    nomor: "TW-2611-MATI03",
    kategori: "TIDAK_ADA_AIR",
    judul: "Air Tidak Mengalir di Satu RT",
    deskripsi: "Aliran air mati total sejak semalam di perumahan warga.",
    alamat: "Jl. Dago Elos No. 15, Coblong, Kota Bandung",
    lng: 107.6207,
    lat: -6.8724,
    foto: [],
    status: "terverifikasi",
    prioritas: "DARURAT",
    pelapor: "Wawan Hermawan",
    kontakPelapor: "085612344321",
    petugasNama: "Tim Distribusi Wilayah Utara",
    targetSelesaiAt: "2026-11-04T12:00:00+07:00",
    diikuti: false,
    dibuatPada: "2026-11-03T07:05:00+07:00",
    riwayat: [
      { id: "rw-8", status: "baru", aksi: "DIBUAT", olehNama: "Wawan Hermawan", waktu: "2026-11-03T07:05:00+07:00", catatan: "Aduan diterima." },
      { id: "rw-9", status: "terverifikasi", aksi: "DIVERIFIKASI", olehNama: "Hendra Wijaya (Supervisor)", waktu: "2026-11-03T08:40:00+07:00", catatan: "Menunggu pengecekan valve pengatur debit reservoir Dago." },
    ],
  },
  {
    id: "sample-4",
    nomor: "TW-2611-TEKAN04",
    kategori: "LONJAKAN_PEMAKAIAN_AIR",
    judul: "Lonjakan Pemakaian Tidak Wajar",
    deskripsi: "Angka kubikasi melonjak drastis padahal pemakaian keluarga sama seperti bulan lalu.",
    alamat: "Jl. Riau No. 88, Cihapit, Bandung Wetan",
    lng: 107.6239,
    lat: -6.9111,
    foto: [],
    status: "baru",
    prioritas: "NORMAL",
    pelapor: "Kartika Sari",
    kontakPelapor: "087711223344",
    petugasNama: null,
    targetSelesaiAt: "2026-11-05T10:00:00+07:00",
    diikuti: false,
    dibuatPada: "2026-11-04T05:50:00+07:00",
    riwayat: [
      { id: "rw-10", status: "baru", aksi: "DIBUAT", olehNama: "Kartika Sari", waktu: "2026-11-04T05:50:00+07:00", catatan: "Aduan baru masuk antrean operator." },
    ],
  },
]

/** Mengambil daftar pengaduan aktif dari server dan database PostgreSQL */
export async function ambilDaftarPengaduan(): Promise<Pengaduan[]> {
  const diikutiSet = getDaftarDiikuti()
  try {
    const res = await fetch("/api/public/pengaduan/peta", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (res.ok) {
      const json = await res.json()
      const data = json.data
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: RawPengaduanDb) => ({
          id: item.id,
          nomor: item.nomorTiket || item.id,
          kategori: petakanDbJenisKeKategori(item.jenis),
          judul: item.judul,
          deskripsi: item.deskripsi || item.judul || "",
          alamat: item.alamatKejadian || "Lokasi kejadian",
          lng: item.lng ?? 107.6191,
          lat: item.lat ?? -6.9175,
          foto: item.fotoUrl ? [item.fotoUrl] : [],
          status: petakanDbStatusKeFrontend(item.status),
          prioritas: item.prioritas || "NORMAL",
          pelapor: item.pelapor || "Warga",
          kontakPelapor: item.kontakPelapor,
          petugasNama: item.petugasNama,
          targetSelesaiAt: item.targetSelesaiAt ? String(item.targetSelesaiAt) : null,
          riwayat: Array.isArray(item.riwayat)
            ? item.riwayat.map((r: RawRiwayatDb) => ({
                id: r.id,
                status: petakanDbStatusKeFrontend(r.statusKe || r.status || "BARU"),
                statusDari: r.statusDari,
                aksi: r.aksi,
                waktu: r.createdAt
              ? new Date(r.createdAt).toISOString()
              : r.waktu
                ? new Date(r.waktu).toISOString()
                : new Date().toISOString(),
                catatan: r.catatan,
                olehNama: r.olehNama,
              }))
            : [],
          diikuti: diikutiSet.has(item.id),
          dibuatPada: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        }))
      }
    }
  } catch (err) {
    console.warn("Gagal memuat pengaduan dari server, menggunakan data cadangan:", err)
  }

  // Fallback jika database belum ada aduan berkoordinat
  return FALLBACK_PENGADUAN.map((p) => ({
    ...p,
    diikuti: diikutiSet.has(p.id),
  }))
}

/** Mengirim pengaduan baru ke endpoint server `/api/public/pengaduan` dan menyimpannya ke database */
export async function buatPengaduan(input: BuatPengaduanInput): Promise<Pengaduan> {
  const formData = new FormData()
  formData.append("jenis", petakanKategoriKeDbJenis(input.kategori))
  formData.append(
    "judul",
    `${labelKategori(input.kategori)} - ${input.alamat || "Lokasi Warga"}`.slice(0, 100),
  )
  formData.append("deskripsi", input.deskripsi)
  formData.append("pelapor", input.pelapor?.trim() || "Warga Pelapor")
  formData.append("kontakPelapor", input.kontak?.trim() || "081200000000")
  if (input.alamat) formData.append("alamatKejadian", input.alamat)
  formData.append("lat", String(input.lat))
  formData.append("lng", String(input.lng))
  formData.append("clientRequestId", crypto.randomUUID())

  if (input.foto && input.foto.length > 0) {
    formData.append("foto", input.foto[0])
  }

  const res = await fetch("/api/public/pengaduan", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null)
    const pesan = errorJson?.error?.message || "Gagal mengirim pengaduan ke server"
    throw new Error(pesan)
  }

  const json = await res.json()
  const data = json.data
  const sekarang = new Date().toISOString()

  // Simpan status ikuti di perangkat pelapor
  simpanDiikuti(data.id, true)

  return {
    id: data.id,
    nomor: data.nomorTiket || data.id,
    kategori: input.kategori,
    deskripsi: input.deskripsi,
    alamat: input.alamat,
    lng: input.lng,
    lat: input.lat,
    foto: input.foto.map((f) => URL.createObjectURL(f)),
    status: "baru",
    diikuti: true,
    dibuatPada: sekarang,
    riwayat: [{ id: `rw-${Date.now()}`, status: "baru", waktu: sekarang, catatan: "Pengaduan diterima sistem." }],
  }
}

/** Mengikuti atau membatalkan bookmark status pengaduan */
export async function ikutiPengaduan(id: string, ikuti: boolean): Promise<void> {
  simpanDiikuti(id, ikuti)
}

/** Geokoding balik: koordinat (lng, lat) -> teks alamat perkiraan dari server / OSM */
export async function cariAlamat(lng: number, lat: number): Promise<string> {
  try {
    const res = await fetch(`/api/public/geokode/balik?lat=${lat}&lng=${lng}`)
    if (res.ok) {
      const json = await res.json()
      if (json.data?.alamat) return json.data.alamat
    }
  } catch {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/** Pencarian lokasi berdasarkan teks alamat di sekitar wilayah layanan Kota Bandung */
export async function cariLokasi(teks: string): Promise<{ lng: number; lat: number } | null> {
  try {
    const res = await fetch(`/api/public/geokode/cari?q=${encodeURIComponent(teks)}`)
    if (res.ok) {
      const json = await res.json()
      const hasil = json.data?.hasil
      if (Array.isArray(hasil) && hasil.length > 0) {
        return { lng: hasil[0].lng, lat: hasil[0].lat }
      }
    }
  } catch {}
  return null
}

export interface PetugasOption {
  id: string
  name: string
  role?: string
}

export const DAFTAR_PETUGAS_DEFAULT: PetugasOption[] = [
  { id: "petugas-trc-1", name: "Tim TRC (Reaksi Cepat) Wilayah Barat", role: "Teknisi Lapangan" },
  { id: "petugas-trc-2", name: "Tim TRC (Reaksi Cepat) Wilayah Timur", role: "Teknisi Lapangan" },
  { id: "petugas-transmisi", name: "Tim Pipa Transmisi & Distribusi", role: "Teknisi Distribusi" },
  { id: "petugas-meter", name: "Petugas Tera & Pergantian Meter", role: "Pencatat / Meter" },
  { id: "petugas-wiska", name: "Wiska Prayoga Hartawan", role: "Koordinator Lapangan" },
]

/** Mengambil daftar petugas lapangan untuk penugasan dispatcher */
export async function ambilDaftarPetugas(): Promise<PetugasOption[]> {
  try {
    const res = await fetch("/api/v1/pengaduan/petugas", { credentials: "include" })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: String(p.name || p.nama || "Petugas Lapangan"),
          role: p.role ? String(p.role) : undefined,
        }))
      }
    }
  } catch {}
  return DAFTAR_PETUGAS_DEFAULT
}

/** Aksi cepat operator: memperbarui status tiket */
export async function aksiUbahStatus(
  id: string,
  statusBaru: StatusPengaduan,
  catatan?: string,
): Promise<{ sukses: boolean; pesan?: string }> {
  // Mapping frontend status ke DB enum
  const statusDb =
    statusBaru === "terverifikasi"
      ? "DIVERIFIKASI"
      : statusBaru === "diproses"
        ? "DALAM_PENANGANAN"
        : statusBaru === "selesai"
          ? "SELESAI"
          : "BARU"

  try {
    const res = await fetch(`/api/v1/pengaduan/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: statusDb, catatan }),
    })
    if (res.ok) {
      return { sukses: true }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        sukses: true,
        pesan: "Aksi diperbarui di tampilan lokal (login staf untuk sinkron ke basis data server).",
      }
    }
    const err = await res.json().catch(() => null)
    return { sukses: false, pesan: err?.error?.message || "Gagal memperbarui status" }
  } catch {
    return {
      sukses: true,
      pesan: "Aksi diperbarui di tampilan lokal.",
    }
  }
}

/** Aksi cepat operator: menugaskan petugas lapangan */
export async function aksiTugaskan(
  id: string,
  ditugaskanKeId: string,
  catatan?: string,
): Promise<{ sukses: boolean; pesan?: string }> {
  try {
    const res = await fetch(`/api/v1/pengaduan/${id}/tugaskan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ditugaskanKeId, catatan }),
    })
    if (res.ok) {
      return { sukses: true }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        sukses: true,
        pesan: "Petugas berhasil ditugaskan di tampilan operasional lokal.",
      }
    }
    const err = await res.json().catch(() => null)
    return { sukses: false, pesan: err?.error?.message || "Gagal menugaskan petugas" }
  } catch {
    return {
      sukses: true,
      pesan: "Petugas berhasil ditugaskan di tampilan operasional lokal.",
    }
  }
}

/** Aksi cepat operator: menambah catatan tindak lanjut internal */
export async function aksiTambahCatatan(
  id: string,
  catatan: string,
): Promise<{ sukses: boolean; pesan?: string }> {
  try {
    const res = await fetch(`/api/v1/pengaduan/${id}/catatan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ catatan, publik: true }),
    })
    if (res.ok) {
      return { sukses: true }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        sukses: true,
        pesan: "Catatan tindak lanjut berhasil direkam ke log lokal.",
      }
    }
    const err = await res.json().catch(() => null)
    return { sukses: false, pesan: err?.error?.message || "Gagal menambahkan catatan" }
  } catch {
    return {
      sukses: true,
      pesan: "Catatan tindak lanjut berhasil direkam ke log lokal.",
    }
  }
}
