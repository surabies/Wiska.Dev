/**
 * ApiTarif.ts — Klien API untuk manajemen Tarif Golongan dan Blok Tarif Air.
 */
import { ambilList, ambilSatu, kirimJson } from "@/features/dashboard/api/ApiDashboard"
import type { TarifGolonganItem, BlokTarifItem } from "../types/TipeTarif"

export async function ambilDaftarTarif(params: { q?: string; hanyaAktif?: boolean } = {}) {
  const res = await ambilList<TarifGolonganItem>("/tarif", {
    pageSize: 100,
    ...params,
  })
  return res.rows
}

export function ambilTarifById(id: string) {
  return ambilSatu<TarifGolonganItem>(`/tarif/${id}`)
}

export function simpanTarifGolongan(data: {
  kode: string
  kodeAsli: string
  nama: string
  kategori: string
  isActive?: boolean
}) {
  return kirimJson<TarifGolonganItem>("/tarif", "POST", data)
}

export function perbaruiTarifGolongan(
  id: string,
  data: {
    nama?: string
    kategori?: string
    isActive?: boolean
  }
) {
  return kirimJson<TarifGolonganItem>(`/tarif/${id}`, "PATCH", data)
}

export function simpanTarifBlok(
  tarifGolonganId: string,
  data: {
    blok: number
    batasAwalM3: number
    batasAkhirM3?: number | null
    hargaPerM3: number
    berlakuMulai: string
  }
) {
  return kirimJson<BlokTarifItem>(`/tarif/${tarifGolonganId}/blok`, "POST", data)
}

export function tutupMasaTarifBlok(
  tarifGolonganId: string,
  blokId: string,
  data: {
    berlakuSampai: string
  }
) {
  return kirimJson<BlokTarifItem>(
    `/tarif/${tarifGolonganId}/blok/${blokId}`,
    "PATCH",
    data
  )
}
