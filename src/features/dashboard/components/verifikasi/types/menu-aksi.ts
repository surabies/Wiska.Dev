// features/dashboard/components/verifikasi/menu-aksi.ts — SATU tempat yang
// menyusun isi menu klik kanan, untuk halaman Petugas dan Pelanggan.
//
// Dua profil:
// - "penilai": Verifikasi · Unverifikasi · Edit · ADD · Kondisi Foto dan
//   Lapangan · BacaUlang                                (Spv, Manager, Senior Manager)
// - "chn":     Verifikasi · Unverifikasi (SELALU mati) · CHN · ADD · Kondisi
//   Foto dan Lapangan · Baca Ulang · Batal Baca Ulang
//
// CHN dan Edit membuka form yang SAMA — di sini keduanya memakai kunci `edit`.
// Halaman cukup melaporkan keadaan tiap item (aktif atau tidak, dan apa yang
// terjadi saat dipilih); susunan, label, ikon, dan pemisah diurus di sini.
import {
  Add01Icon,
  ArrowTurnBackwardIcon,
  Camera01Icon,
  CancelCircleIcon,
  Edit02Icon,
  RotateLeft01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import type { AksiKonteks } from "../menu-konteks"

export type ProfilMenu = "penilai" | "chn"

export type KunciMenu =
  | "verifikasi"
  | "unverifikasi"
  | "edit"
  | "add"
  | "kondisiFoto"
  | "bacaUlang"
  | "batalBacaUlang"

export interface KeadaanMenu {
  aktif: boolean
  /** Penjelas kecil di bawah label (mis. "Tahap V2", alasan tidak aktif). */
  keterangan?: string
  onPilih: () => void
}

export function bangunMenuAksi(
  profil: ProfilMenu,
  k: Record<KunciMenu, KeadaanMenu>,
): AksiKonteks[] {
  const item = (
    kunci: KunciMenu,
    label: string,
    icon: IconSvgElement,
    ekstra: Partial<AksiKonteks> = {},
  ): AksiKonteks => ({
    label,
    icon,
    onPilih: k[kunci].onPilih,
    disabled: !k[kunci].aktif,
    keterangan: k[kunci].keterangan,
    ...ekstra,
  })

  if (profil === "chn") {
    return [
      item("verifikasi", "Verifikasi", SecurityCheckIcon),
      item("unverifikasi", "Unverifikasi", ArrowTurnBackwardIcon, {
        disabled: true,
        keterangan: "Tidak tersedia untuk peran ini",
      }),
      item("edit", "CHN", Edit02Icon, { pemisah: true }),
      item("add", "ADD", Add01Icon),
      item("kondisiFoto", "Kondisi Foto dan Lapangan", Camera01Icon),
      item("bacaUlang", "Baca Ulang", RotateLeft01Icon, { pemisah: true }),
      item("batalBacaUlang", "Batal Baca Ulang", CancelCircleIcon),
    ]
  }

  return [
    item("verifikasi", "Verifikasi", SecurityCheckIcon),
    item("unverifikasi", "Unverifikasi", ArrowTurnBackwardIcon, { destruktif: true }),
    item("edit", "Edit", Edit02Icon, { pemisah: true }),
    item("add", "ADD", Add01Icon),
    item("kondisiFoto", "Kondisi Foto dan Lapangan", Camera01Icon),
    item("bacaUlang", "BacaUlang", RotateLeft01Icon, { pemisah: true }),
  ]
}