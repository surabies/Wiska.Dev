/**
 * ApiOrganisasi.ts — Endpoint CRUD Divisi, Bagian, dan Subbagian.
 */
import { ambilList, kirimJson } from "@/features/dashboard/api/ApiDashboard"
import type {
  DivisiItem,
  BagianItem,
  SubBagianItem,
} from "../types/TipeOrganisasi"

export async function ambilDaftarDivisi() {
  const res = await ambilList<DivisiItem>("/divisi", { pageSize: 100 })
  return res.rows
}

export function simpanDivisi(data: { kode: string; nama: string }) {
  return kirimJson<DivisiItem>("/divisi", "POST", data)
}

export function perbaruiDivisi(id: string, data: { kode?: string; nama?: string }) {
  return kirimJson<DivisiItem>(`/divisi/${id}`, "PATCH", data)
}

export function hapusDivisi(id: string) {
  return kirimJson<{ id: string }>(`/divisi/${id}`, "DELETE", {})
}

export async function ambilDaftarBagian() {
  const res = await ambilList<BagianItem>("/bagian", { pageSize: 200 })
  return res.rows
}

export function simpanBagian(data: {
  kode: string
  nama: string
  divisiId: string
  levelKepala?: string
}) {
  return kirimJson<BagianItem>("/bagian", "POST", data)
}

export function perbaruiBagian(
  id: string,
  data: {
    kode?: string
    nama?: string
    divisiId?: string
    levelKepala?: string
  }
) {
  return kirimJson<BagianItem>(`/bagian/${id}`, "PATCH", data)
}

export function hapusBagian(id: string) {
  return kirimJson<{ id: string }>(`/bagian/${id}`, "DELETE", {})
}

export async function ambilDaftarSubBagian() {
  const res = await ambilList<SubBagianItem>("/sub-bagian", { pageSize: 500 })
  return res.rows
}

export function simpanSubBagian(data: {
  kode: string
  nama: string
  bagianId: string
}) {
  return kirimJson<SubBagianItem>("/sub-bagian", "POST", data)
}

export function perbaruiSubBagian(
  id: string,
  data: {
    kode?: string
    nama?: string
    bagianId?: string
  }
) {
  return kirimJson<SubBagianItem>(`/sub-bagian/${id}`, "PATCH", data)
}

export function hapusSubBagian(id: string) {
  return kirimJson<{ id: string }>(`/sub-bagian/${id}`, "DELETE", {})
}
