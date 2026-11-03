import { describe, expect, it } from "vitest"
import {
  TRANSISI,
  TRANSISI_PETUGAS,
  STATUS_BUTUH_PETUGAS,
  STATUS_WAJIB_CATATAN,
  STATUS_TERBUKA,
  bolehTransisi,
  statusTerbuka,
  transisiLewatPetugas,
  periksaUbahStatus,
  prioritasLebihTinggi,
  kewenanganTiket,
} from "./AlurPengaduan"

describe("AlurPengaduan Domain Rules", () => {
  describe("bolehTransisi", () => {
    it("mengizinkan transisi normal tiket", () => {
      expect(bolehTransisi("BARU", "TERVERIFIKASI")).toBe(true)
      expect(bolehTransisi("BARU", "DITUGASKAN")).toBe(true)
      expect(bolehTransisi("BARU", "DITOLAK")).toBe(true)
      expect(bolehTransisi("DITUGASKAN", "MENUJU_LOKASI")).toBe(true)
      expect(bolehTransisi("DITUGASKAN", "DIPROSES")).toBe(true)
      expect(bolehTransisi("MENUJU_LOKASI", "DIPROSES")).toBe(true)
      expect(bolehTransisi("DIPROSES", "SELESAI")).toBe(true)
      expect(bolehTransisi("SELESAI", "DITUTUP")).toBe(true)
      expect(bolehTransisi("SELESAI", "DIBUKA_KEMBALI")).toBe(true)
    })

    it("menolak transisi ilegal atau melompat", () => {
      // BARU tidak boleh langsung DIPROSES tanpa penugasan
      expect(bolehTransisi("BARU", "DIPROSES")).toBe(false)
      expect(bolehTransisi("BARU", "SELESAI")).toBe(false)
      expect(bolehTransisi("BARU", "DITUTUP")).toBe(false)
      // DITUTUP adalah status terminal
      expect(bolehTransisi("DITUTUP", "BARU")).toBe(false)
      expect(bolehTransisi("DITUTUP", "DIBUKA_KEMBALI")).toBe(false)
      expect(TRANSISI.DITUTUP).toHaveLength(0)
    })
  })

  describe("STATUS_TERBUKA & statusTerbuka", () => {
    it("mencakup semua status antrean kerja aktif", () => {
      expect(statusTerbuka("BARU")).toBe(true)
      expect(statusTerbuka("TERVERIFIKASI")).toBe(true)
      expect(statusTerbuka("DITUGASKAN")).toBe(true)
      expect(statusTerbuka("MENUJU_LOKASI")).toBe(true)
      expect(statusTerbuka("DIPROSES")).toBe(true)
      expect(statusTerbuka("MENUNGGU_PELANGGAN")).toBe(true)
      expect(statusTerbuka("DIBUKA_KEMBALI")).toBe(true)

      // Status non-aktif / closed
      expect(statusTerbuka("SELESAI")).toBe(false)
      expect(statusTerbuka("DITUTUP")).toBe(false)
      expect(statusTerbuka("DITOLAK")).toBe(false)
    })
  })

  describe("transisiLewatPetugas", () => {
    it("membatasi staf hanya pada tiket miliknya dan transisi yang diizinkan", () => {
      const stafMilikSendiri = { pengelola: false, milikSendiri: true }
      const opsi = transisiLewatPetugas("DITUGASKAN", stafMilikSendiri)
      expect(opsi).toContain("MENUJU_LOKASI")
      expect(opsi).toContain("DIPROSES")
      expect(opsi).not.toContain("DITOLAK") // Staf tidak bisa menolak tiket

      const stafBukanMilik = { pengelola: false, milikSendiri: false }
      const opsiBukanMilik = transisiLewatPetugas("DITUGASKAN", stafBukanMilik)
      expect(opsiBukanMilik).toHaveLength(0)
    })

    it("mengizinkan pengelola melakukan transisi kontrol", () => {
      const supervisor = { pengelola: true, milikSendiri: false }
      const opsi = transisiLewatPetugas("DITUGASKAN", supervisor)
      expect(opsi).toContain("DITOLAK")
      expect(opsi).toContain("DIPROSES")

      // Supervisor bisa membuka kembali tiket DITOLAK
      const opsiDitolak = transisiLewatPetugas("DITOLAK", supervisor)
      expect(opsiDitolak).toContain("DIBUKA_KEMBALI")
    })
  })

  describe("periksaUbahStatus", () => {
    it("menolak perubahan ke status butuh petugas jika belum ada petugas penanggung jawab", () => {
      const galat = periksaUbahStatus({
        dari: "DITUGASKAN",
        ke: "DIPROSES",
        pelaku: { pengelola: true, milikSendiri: false },
        punyaPetugas: false,
      })
      expect(galat).toMatch(/belum punya petugas/i)
    })

    it("menolak status yang mewajibkan catatan jika catatan kosong", () => {
      const galatDitolak = periksaUbahStatus({
        dari: "BARU",
        ke: "DITOLAK",
        pelaku: { pengelola: true, milikSendiri: false },
        punyaPetugas: false,
        catatan: "   ",
      })
      expect(galatDitolak).toMatch(/wajib menyertakan catatan/i)

      const galatJeda = periksaUbahStatus({
        dari: "DIPROSES",
        ke: "MENUNGGU_PELANGGAN",
        pelaku: { pengelola: true, milikSendiri: true },
        punyaPetugas: true,
        catatan: "",
      })
      expect(galatJeda).toMatch(/wajib menyertakan catatan/i)
    })

    it("mencegah staf mengubah tiket yang bukan miliknya", () => {
      const galat = periksaUbahStatus({
        dari: "DITUGASKAN",
        ke: "DIPROSES",
        pelaku: { pengelola: false, milikSendiri: false },
        punyaPetugas: true,
      })
      expect(galat).toMatch(/Sebagai STAFF Anda hanya bisa/i)
    })

    it("mencegah petugas menutup langsung (DITUTUP)", () => {
      const galat = periksaUbahStatus({
        dari: "SELESAI",
        ke: "DITUTUP",
        pelaku: { pengelola: true, milikSendiri: false },
        punyaPetugas: true,
      })
      expect(galat).toMatch(/Tiket ditutup oleh pelapor/i)
    })

    it("mencegah petugas membantah SELESAI (DIBUKA_KEMBALI dari SELESAI hak pelapor)", () => {
      const galat = periksaUbahStatus({
        dari: "SELESAI",
        ke: "DIBUKA_KEMBALI",
        pelaku: { pengelola: true, milikSendiri: false },
        punyaPetugas: true,
        catatan: "Buka kembali",
      })
      expect(galat).toMatch(/hak pelapor/i)
    })

    it("mengizinkan supervisor membuka kembali tiket yang DITOLAK dengan catatan", () => {
      const hasil = periksaUbahStatus({
        dari: "DITOLAK",
        ke: "DIBUKA_KEMBALI",
        pelaku: { pengelola: true, milikSendiri: false },
        punyaPetugas: false,
        catatan: "Penolakan keliru, lokasi sudah dicek ulang.",
      })
      expect(hasil).toBeNull()
    })
  })

  describe("prioritasLebihTinggi", () => {
    it("mengevaluasi tingkatan urgensi SLA secara akurat", () => {
      expect(prioritasLebihTinggi("DARURAT", "TINGGI")).toBe(true)
      expect(prioritasLebihTinggi("TINGGI", "NORMAL")).toBe(true)
      expect(prioritasLebihTinggi("NORMAL", "RENDAH")).toBe(true)
      expect(prioritasLebihTinggi("RENDAH", "NORMAL")).toBe(false)
      expect(prioritasLebihTinggi("NORMAL", "NORMAL")).toBe(false)
    })
  })

  describe("kewenanganTiket", () => {
    it("mengatur kewenangan aksi supervisor vs staf", () => {
      const hakSupervisor = kewenanganTiket("BARU", {
        pengelola: true,
        milikSendiri: false,
      })
      expect(hakSupervisor.bisaTugaskan).toBe(true)
      expect(hakSupervisor.bisaEskalasi).toBe(true)
      expect(hakSupervisor.bisaChat).toBe(true)

      const hakStaf = kewenanganTiket("BARU", {
        pengelola: false,
        milikSendiri: false,
      })
      expect(hakStaf.bisaTugaskan).toBe(false)
      expect(hakStaf.bisaEskalasi).toBe(false)
      expect(hakStaf.bisaChat).toBe(true)

      const hakClosed = kewenanganTiket("DITUTUP", {
        pengelola: true,
        milikSendiri: false,
      })
      expect(hakClosed.bisaChat).toBe(false)
      expect(hakClosed.bisaEskalasi).toBe(false)
      expect(hakClosed.bisaTugaskan).toBe(false)
    })
  })
})
