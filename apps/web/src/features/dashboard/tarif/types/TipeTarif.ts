/**
 * TipeTarif.ts — Kontrak data untuk TarifGolongan dan TarifBlok harga air progresif.
 */

export interface BlokTarifItem {
  id: string
  tarifGolonganId: string
  blok: number
  batasAwalM3: number
  batasAkhirM3: number | null
  hargaPerM3: number
  berlakuMulai: string
  berlakuSampai: string | null
  catatan?: string | null
  createdAt?: string
}

export interface TarifGolonganItem {
  id: string
  kode: string
  kodeAsli: string
  nama: string
  kategori: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  blokTarif?: BlokTarifItem[]
  _count?: {
    pelanggan?: number
  }
}
