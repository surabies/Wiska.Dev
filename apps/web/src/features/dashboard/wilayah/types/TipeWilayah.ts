/**
 * TipeWilayah.ts — Kontrak data untuk Kecamatan dan Kelurahan administratif.
 */

export interface KecamatanItem {
  id: string
  kode: string
  nama: string
  _count?: {
    kelurahan?: number
    pelanggan?: number
  }
}

export interface KelurahanItem {
  id: string
  kode: string
  nama: string
  kecamatanId: string
  kecamatan?: {
    id: string
    kode: string
    nama: string
  }
  _count?: {
    pelanggan?: number
  }
}
