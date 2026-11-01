import { describe, expect, it, vi } from "vitest"
import { bangunMenuAksi, type KeadaanMenu, type KunciMenu } from "./MenuAksi"

function keadaanMenu(): Record<KunciMenu, KeadaanMenu> {
  return {
    verifikasi: { aktif: true, onPilih: vi.fn() },
    unverifikasi: { aktif: true, onPilih: vi.fn() },
    edit: { aktif: true, onPilih: vi.fn() },
    add: { aktif: true, onPilih: vi.fn() },
    kondisiFoto: { aktif: true, onPilih: vi.fn() },
    bacaUlang: { aktif: true, onPilih: vi.fn() },
    batalBacaUlang: { aktif: true, onPilih: vi.fn() },
  }
}

describe("bangunMenuAksi", () => {
  it("mempertahankan aksi operasional pada laporan petugas", () => {
    const aksi = bangunMenuAksi("penilai", keadaanMenu())

    expect(aksi.map((item) => item.label)).toEqual([
      "Verifikasi",
      "Unverifikasi",
      "Edit",
      "ADD",
      "Kondisi Foto dan Lapangan",
      "Baca Ulang",
      "Batal Baca Ulang",
    ])
  })

  it("hanya menampilkan aksi Mandiri dan menyediakan pembatalan penolakan", () => {
    const aksi = bangunMenuAksi("penilai", keadaanMenu(), "mandiri")

    expect(aksi.map((item) => item.label)).toEqual([
      "Verifikasi",
      "Unverifikasi",
      "Baca Ulang",
      "Batal Baca Ulang",
    ])
  })

  it("menyediakan pembatalan baca ulang untuk profil CHN di Mandiri", () => {
    const aksi = bangunMenuAksi("chn", keadaanMenu(), "mandiri")

    expect(aksi.map((item) => item.label)).toEqual([
      "Verifikasi",
      "Unverifikasi",
      "Baca Ulang",
      "Batal Baca Ulang",
    ])
    expect(aksi[1]?.disabled).toBe(true)
  })
})
