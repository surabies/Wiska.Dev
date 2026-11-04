// features/dashboard/pengguna/types/TipeFormulirPengguna.ts — tipe &
// konstanta yang dipakai bersama oleh bagian-bagian dialog.

export interface BarisPengguna {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  jenisAkun?: "PETUGAS" | "PELANGGAN" | null
  nik?: string | null
  nip?: string | null
  nomorPelanggan?: string | null
  jabatan?: string | null
  telepon?: string | null
  divisiId?: string | null
  divisiKode?: string | null
  bagianId?: string | null
  subBagianId?: string | null
  divisi?: { id: string; kode: string; nama: string } | null
  bagian?: { id: string; kode: string; nama: string } | null
  subBagian?: { id: string; kode: string; nama: string } | null
}

export interface Divisi {
  id: string
  kode: string
  nama: string
}

export interface BagianItem {
  id: string
  kode: string
  nama: string
  divisiId: string
}

export interface SubBagianItem {
  id: string
  kode: string
  nama: string
  bagianId: string
}

/// Nilai sentinel untuk opsi kosong pada Select (Select tidak menerima value kosong).
export const TANPA_DIVISI = "__TANPA_DIVISI__"
export const TANPA_BAGIAN = "__TANPA_BAGIAN__"
export const TANPA_SUB_BAGIAN = "__TANPA_SUB_BAGIAN__"
