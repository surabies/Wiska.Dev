export const JENIS_FOTO = [
  { id: "stand", label: "Foto stand meter" },
  { id: "segel", label: "Foto segel" },
  { id: "rumah", label: "Foto rumah" },
  { id: "video", label: "Video pembacaan" },
] as const

export type JenisFoto = (typeof JENIS_FOTO)[number]["id"]
export type KunciImpor = "catatan" | "foto"

export type StatusBaris = "TERSIMPAN" | "DUPLIKAT" | "DILAMPIRKAN" | "TANPA_PENCATATAN" | "GAGAL"

export interface HasilBaris {
  index: number
  jenis: string
  nomorLangganan: string
  periode: number
  status: StatusBaris
  pesan?: string
}

export interface HasilImpor {
  total: number
  tersimpan: number
  duplikat: number
  dilampirkan: number
  tanpaPencatatan: number
  gagal: number
  hasil: HasilBaris[]
}
