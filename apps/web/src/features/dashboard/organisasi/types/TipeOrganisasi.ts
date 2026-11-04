/**
 * TipeOrganisasi.ts — Kontrak data untuk Divisi, Bagian, dan Subbagian SOTK Perumda Tirtawening.
 */

export interface DivisiItem {
  id: string
  kode: string
  nama: string
  createdAt?: string
  updatedAt?: string
  _count?: {
    bagian?: number
    users?: number
  }
}

export interface BagianItem {
  id: string
  kode: string
  nama: string
  levelKepala?: string
  divisiId: string
  createdAt?: string
  updatedAt?: string
  divisi?: {
    id: string
    kode: string
    nama: string
  }
  _count?: {
    subBagian?: number
    users?: number
  }
}

export interface SubBagianItem {
  id: string
  kode: string
  nama: string
  bagianId: string
  createdAt?: string
  updatedAt?: string
  bagian?: {
    id: string
    kode: string
    nama: string
    divisiId?: string
    divisi?: {
      id: string
      kode: string
      nama: string
    }
  }
  _count?: {
    users?: number
  }
}
