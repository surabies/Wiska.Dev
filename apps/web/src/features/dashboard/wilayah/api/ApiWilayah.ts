/**
 * ApiWilayah.ts — Endpoint CRUD Kecamatan dan Kelurahan.
 */
import { ambilList, kirimJson } from "@/features/dashboard/api/ApiDashboard"
import type { KecamatanItem, KelurahanItem } from "../types/TipeWilayah"

export async function ambilDaftarKecamatan() {
  const res = await ambilList<KecamatanItem>("/kecamatan", { pageSize: 100 })
  return res.rows
}

export function simpanKecamatan(data: { kode: string; nama: string }) {
  return kirimJson<KecamatanItem>("/kecamatan", "POST", data)
}

export function perbaruiKecamatan(id: string, data: { kode?: string; nama?: string }) {
  return kirimJson<KecamatanItem>(`/kecamatan/${id}`, "PATCH", data)
}

export function hapusKecamatan(id: string) {
  return kirimJson<{ id: string }>(`/kecamatan/${id}`, "DELETE", {})
}

export async function ambilDaftarKelurahan() {
  const res = await ambilList<KelurahanItem>("/kelurahan", { pageSize: 500 })
  return res.rows
}

export function simpanKelurahan(data: {
  kode: string
  nama: string
  kecamatanId: string
}) {
  return kirimJson<KelurahanItem>("/kelurahan", "POST", data)
}

export function perbaruiKelurahan(
  id: string,
  data: {
    kode?: string
    nama?: string
    kecamatanId?: string
  }
) {
  return kirimJson<KelurahanItem>(`/kelurahan/${id}`, "PATCH", data)
}

export function hapusKelurahan(id: string) {
  return kirimJson<{ id: string }>(`/kelurahan/${id}`, "DELETE", {})
}
