// src/lib/server/modules/laporan/harian/LaporanHarianKoreksi.service.ts —
// koreksi laporan harian, penilaian kondisi foto, baca ulang (reject), dan
// pembatalan verifikasi (unverify).
import { prisma } from "@db"
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from "../../../lib/Galat"
import { ROLE_GROUPS } from "../../../middleware/RBAC"
import type { SessionUser } from "../../../lib/Sesi"
import { recordAudit } from "../../../lib/Audit"
import { hitungPemakaianGantiMeter } from "@/lib/domain/PerhitunganMeter"
import { pastikanV3UntukTagihan } from "./KewenanganTagihan"
import {
  pastikanPeriodeBelumTerkunci,
  validasiStandAngkat,
  validasiMeterBaru,
} from "./LaporanHarianVerifikasi.service"
import type {
  KoreksiLaporanInput,
  PenilaianFotoInput,
  RejectLaporanInput,
  AuditMeta,
} from "./LaporanHarian.schema"

export async function koreksiLaporanHarian(
  id: string,
  body: KoreksiLaporanInput,
  requester: SessionUser,
  auditMeta: AuditMeta
) {
  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")

  const staff = requester.role === "STAFF"
  const bolehSenior = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(
    requester.role
  )
  const bolehManajemen = (
    ROLE_GROUPS.MANAGEMENT_UP as readonly string[]
  ).includes(requester.role)
  const bolehSupervisor = (
    ROLE_GROUPS.SUPERVISOR_UP as readonly string[]
  ).includes(requester.role)
  if (body.pemakaianTagihVerif !== undefined) {
    pastikanV3UntukTagihan(requester.role)
  }
  const koreksiDiizinkan =
    staff ||
    (laporan.verif3At || laporan.pembacaanId
      ? bolehSenior
      : laporan.verif2At
        ? bolehSenior
        : laporan.verif1At
          ? bolehManajemen
          : bolehSupervisor)
  if (!koreksiDiizinkan)
    throw new ForbiddenError(
      "Role Anda tidak berwenang mengoreksi tahap laporan ini."
    )

  if (laporan.pembacaanId) {
    const tagihan = await prisma.tagihan.findUnique({
      where: { pembacaanId: laporan.pembacaanId },
      select: { id: true },
    })
    if (tagihan)
      throw new ConflictError(
        "Pembacaan ini sudah digunakan tagihan; koreksi biasa ditolak."
      )
  }
  // DEC-06 (VERIFIKASI.md): hasil V3 resmi aktif hanya boleh diubah melalui
  // reopen (Batalkan V3 -> koreksi -> verifikasi ulang V3), tidak boleh
  // dimutasi langsung lewat endpoint koreksi.
  if (laporan.pembacaanId || laporan.verif3At || laporan.isVerified) {
    throw new ConflictError(
      "Hasil V3 resmi aktif tidak dapat dikoreksi langsung. Batalkan V3 (reopen) terlebih dahulu sebelum mengoreksi."
    )
  }
  await pastikanPeriodeBelumTerkunci(laporan.periode)

  const kondisiRevisi =
    body.kondisiRevisi !== undefined
      ? body.kondisiRevisi
      : laporan.kondisiRevisi
  const kondisiEfektif = kondisiRevisi ?? laporan.kondisi
  const standAwalRevisi =
    body.standAwalRevisi !== undefined
      ? body.standAwalRevisi
      : laporan.standAwalRevisi
  if (kondisiEfektif === "REV_PENCATAT" && standAwalRevisi == null)
    throw new BadRequestError(
      "Kondisi Revisi Pencatat memerlukan nilai ST Awal revisi."
    )
  if (kondisiEfektif !== "REV_PENCATAT" && standAwalRevisi != null)
    throw new BadRequestError(
      "ST Awal revisi hanya boleh diisi untuk kondisi Revisi Pencatat."
    )

  const standAkhirRevisi =
    body.standAkhirRevisi !== undefined
      ? body.standAkhirRevisi
      : laporan.standAkhirRevisi
  const pemakaianTagihVerif =
    body.pemakaianTagihVerif !== undefined
      ? body.pemakaianTagihVerif
      : laporan.pemakaianTagihVerif
  const standAngkatLama =
    body.standAngkatLama !== undefined
      ? body.standAngkatLama
      : laporan.standAngkatLama
  const standMeterBaru =
    body.standMeterBaru !== undefined
      ? body.standMeterBaru
      : laporan.standMeterBaru
  const meterVerifId =
    body.meterVerifId !== undefined ? body.meterVerifId : laporan.meterVerifId
  if (meterVerifId) {
    if (!laporan.pelangganId)
      throw new BadRequestError(
        "Pelanggan laporan belum tertaut; meter tujuan tidak dapat divalidasi."
      )
    const meter = await prisma.meter.findFirst({
      where: {
        id: meterVerifId,
        pelangganId: laporan.pelangganId,
      },
      select: { id: true },
    })
    if (!meter)
      throw new BadRequestError(
        "Meter tujuan bukan milik pelanggan laporan ini."
      )
  }
  if (kondisiEfektif === "MB") {
    validasiStandAngkat(kondisiEfektif, standAngkatLama, standMeterBaru)
    await validasiMeterBaru(laporan.pelangganId, meterVerifId)
  }
  if (laporan.pembacaanId && !meterVerifId)
    throw new BadRequestError(
      "Pembacaan resmi harus tetap terhubung ke meter pelanggan."
    )

  const standAwalAktif = standAwalRevisi ?? laporan.standAwal
  const standAkhirAktif = standAkhirRevisi ?? laporan.standAkhir
  const pemakaianRiil =
    kondisiEfektif === "MB"
      ? hitungPemakaianGantiMeter({
          standAwalLama: standAwalAktif,
          standAngkatLama: standAngkatLama!,
          standMeterBaru: standMeterBaru!,
        })
      : standAkhirAktif - standAwalAktif
  if (pemakaianRiil < 0)
    throw new BadRequestError(
      "Pemakaian hasil koreksi negatif. Periksa kembali stand dan kondisi meter."
    )
  const perubahan = {
    standAwalRevisi,
    standAkhirRevisi,
    pemakaianTagihVerif,
    kondisiRevisi,
    standAngkatLama,
    standMeterBaru,
    meterVerifId,
  }
  const dataLaporan = {
    standAwalRevisi,
    standAkhirRevisi,
    pemakaianTagihVerif,
    kondisiRevisi,
    standAngkatLama,
    standMeterBaru,
    meterVerifId,
    ...(kondisiEfektif === "REV_PENCATAT" ? { pemakaian: pemakaianRiil } : {}),
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.laporanHarianPetugas.update({
      where: { id },
      data: dataLaporan,
    })
    if (laporan.pembacaanId) {
      const pakaiTagih = pemakaianTagihVerif ?? laporan.pemakaian
      await tx.pembacaanMeter.update({
        where: { id: laporan.pembacaanId },
        data: {
          standLalu: standAwalAktif,
          standAkhir: standAkhirAktif,
          pemakaianM3: pakaiTagih,
          pemakaianRiil,
          alasanTaksir:
            laporan.jenisInput === "MANUAL_MASSAL" &&
            pakaiTagih === laporan.pemakaian
              ? "MANUAL_ADD"
              : pemakaianTagihVerif != null &&
                  pemakaianTagihVerif !== pemakaianRiil
                ? "OVERRIDE_MANUAL"
                : null,
          kondisi: kondisiEfektif,
        },
      })
    }
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "KOREKSI_LAPORAN_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        sebelum: {
          standAwalRevisi: laporan.standAwalRevisi,
          standAkhirRevisi: laporan.standAkhirRevisi,
          pemakaianTagihVerif: laporan.pemakaianTagihVerif,
          kondisiRevisi: laporan.kondisiRevisi,
          standAngkatLama: laporan.standAngkatLama,
          standMeterBaru: laporan.standMeterBaru,
          meterVerifId: laporan.meterVerifId,
        },
        sesudah: perubahan,
        pemakaianRiil,
      },
      ...auditMeta,
    })
    return row
  })
}

export async function nilaiKondisiFotoLaporanHarian(
  id: string,
  body: PenilaianFotoInput,
  requester: SessionUser,
  auditMeta: AuditMeta
) {
  const { sesuai, keterangan } = body
  return prisma.$transaction(async (tx) => {
    const laporan = await tx.laporanHarianPetugas.findUnique({
      where: { id },
      select: {
        id: true,
        nomorLangganan: true,
        periode: true,
      },
    })
    if (!laporan) throw new NotFoundError("LaporanHarianPetugas")

    await recordAudit(tx, {
      userId: requester.id,
      aksi: "PENILAIAN_KONDISI_FOTO_LAPORAN_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        sesuai,
        keterangan,
        nomorLangganan: laporan.nomorLangganan,
        periode: laporan.periode,
      },
      ...auditMeta,
    })

    return { id, sesuai, keterangan }
  })
}

/// "Baca ulang": kembalikan laporan nonfinal ke petugas. Ring dan koreksi
/// periode aktif direset dalam transaksi; nilai sebelumnya dan alasan tetap
/// tersimpan pada audit agar pengiriman ulang tidak menghapus histori.
export async function tolakLaporanHarian(
  id: string,
  body: RejectLaporanInput,
  requester: SessionUser,
  auditMeta: AuditMeta
) {
  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  await pastikanPeriodeBelumTerkunci(laporan.periode)
  if (laporan.pembacaanId || laporan.isVerified || laporan.verif3At)
    throw new ConflictError(
      "Laporan sudah mencapai tahap final; gunakan alur pembatalan V3 yang sesuai."
    )

  const alasan = body.catatanVerif
  const kini = new Date()
  return prisma.$transaction(async (tx) => {
    const berubah = await tx.laporanHarianPetugas.updateMany({
      where: {
        id,
        isVerified: false,
        verifiedAt: null,
        pembacaanId: null,
        verif3At: null,
        verif1At: laporan.verif1At,
        verif2At: laporan.verif2At,
        standAwalRevisi: laporan.standAwalRevisi,
        standAkhirRevisi: laporan.standAkhirRevisi,
        kondisiRevisi: laporan.kondisiRevisi,
        standAngkatLama: laporan.standAngkatLama,
        standMeterBaru: laporan.standMeterBaru,
        pemakaianTagihVerif: laporan.pemakaianTagihVerif,
        meterVerifId: laporan.meterVerifId,
        blokTarifVerif: laporan.blokTarifVerif,
      },
      data: {
        isVerified: false,
        verifiedAt: kini,
        verifiedById: requester.id,
        catatanVerif: alasan,
        verif1At: null,
        verif1ById: null,
        verif2At: null,
        verif2ById: null,
        verif3At: null,
        verif3ById: null,
        standAwalRevisi: null,
        standAkhirRevisi: null,
        kondisiRevisi: null,
        standAngkatLama: null,
        standMeterBaru: null,
        pemakaianTagihVerif: null,
        meterVerifId: null,
        blokTarifVerif: null,
      },
    })
    if (berubah.count !== 1)
      throw new ConflictError(
        "Status laporan berubah. Muat ulang sebelum mengirim baca ulang."
      )

    await recordAudit(tx, {
      userId: requester.id,
      aksi: "KIRIM_BACA_ULANG_LAPORAN_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        alasan,
        sebelum: {
          catatanVerif: laporan.catatanVerif,
          verifiedAt: laporan.verifiedAt,
          verifiedById: laporan.verifiedById,
          verif1At: laporan.verif1At,
          verif1ById: laporan.verif1ById,
          verif2At: laporan.verif2At,
          verif2ById: laporan.verif2ById,
          verif3At: laporan.verif3At,
          verif3ById: laporan.verif3ById,
          standAwalRevisi: laporan.standAwalRevisi,
          standAkhirRevisi: laporan.standAkhirRevisi,
          kondisiRevisi: laporan.kondisiRevisi,
          standAngkatLama: laporan.standAngkatLama,
          standMeterBaru: laporan.standMeterBaru,
          pemakaianTagihVerif: laporan.pemakaianTagihVerif,
          meterVerifId: laporan.meterVerifId,
          blokTarifVerif: laporan.blokTarifVerif,
        },
        sesudah: {
          status: "DITOLAK",
          verifiedAt: kini,
          verifiedById: requester.id,
          catatanVerif: alasan,
          verif1At: null,
          verif2At: null,
          verif3At: null,
          koreksiDireset: true,
        },
      },
      ...auditMeta,
    })

    return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
  })
}

/// "Unverifikasi": membatalkan SATU tahap terakhir (V3 → V2 → V1 → kosong;
/// baris DITOLAK kembali ke MENUNGGU).
/// Sesuai VERIFIKASI.md:
/// - V1 tidak dapat membatalkan V1 miliknya sendiri; pembatalan V1 memerlukan
///   V2/V3 (`MANAGEMENT_UP`).
/// - V2 tidak dapat membatalkan V2 miliknya sendiri; pembatalan V2 memerlukan
///   V3 (`SENIOR_UP`).
/// - V3 (`SENIOR_UP`) boleh membuka kembali (reopen) hasil V3 sendiri sebelum
///   masuk Tagihan; PembacaanMeter resmi dihapus dan snapshot sebelum/sesudah
///   dicatat ke AuditLog (OPEN-08 Opsi A).
export async function batalkanVerifikasiLaporanHarian(
  id: string,
  requester: SessionUser,
  auditMeta: AuditMeta = { ipAddress: null, userAgent: null }
) {
  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  await pastikanPeriodeBelumTerkunci(laporan.periode)

  const bolehSenior = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(
    requester.role
  )
  const bolehManajemen = (
    ROLE_GROUPS.MANAGEMENT_UP as readonly string[]
  ).includes(requester.role)

  if (laporan.pembacaanId) {
    if (!bolehSenior)
      throw new ForbiddenError(
        "Membatalkan approve final (V3) memerlukan Senior Manager ke atas"
      )
    const tagihan = await prisma.tagihan.findUnique({
      where: { pembacaanId: laporan.pembacaanId },
    })
    if (tagihan)
      throw new ConflictError(
        "Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan"
      )

    const pembacaanId = laporan.pembacaanId
    return prisma.$transaction(async (tx) => {
      const pembacaanLama = await tx.pembacaanMeter.findUnique({
        where: { id: pembacaanId },
      })
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          pembacaanId,
        },
        data: {
          verif3At: null,
          verif3ById: null,
          isVerified: false,
          verifiedAt: null,
          verifiedById: null,
          pembacaanId: null,
        },
      })
      if (berubah.count !== 1) {
        throw new ConflictError(
          "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }
      if (pembacaanLama) {
        await tx.pembacaanMeter.delete({ where: { id: pembacaanId } })
      }
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "BATALKAN_VERIFIKASI_V3_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif3At: laporan.verif3At,
            verif3ById: laporan.verif3ById,
            isVerified: laporan.isVerified,
            verifiedAt: laporan.verifiedAt,
            verifiedById: laporan.verifiedById,
            pembacaanId,
            pembacaanResmiDihapus: pembacaanLama
              ? {
                  id: pembacaanLama.id,
                  meterId: pembacaanLama.meterId,
                  standLalu: pembacaanLama.standLalu,
                  standAkhir: pembacaanLama.standAkhir,
                  pemakaianM3: pembacaanLama.pemakaianM3,
                  pemakaianRiil: pembacaanLama.pemakaianRiil,
                  alasanTaksir: pembacaanLama.alasanTaksir,
                  kondisi: pembacaanLama.kondisi,
                }
              : null,
          },
          sesudah: {
            verif3At: null,
            verif3ById: null,
            isVerified: false,
            verifiedAt: null,
            verifiedById: null,
            pembacaanId: null,
          },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
  }

  if (laporan.isVerified || laporan.verif3At) {
    if (!bolehSenior)
      throw new ForbiddenError(
        "Membatalkan approve final (V3) memerlukan Senior Manager ke atas"
      )
    return prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          pembacaanId: null,
          verif3At: laporan.verif3At,
          isVerified: laporan.isVerified,
        },
        data: {
          verif3At: null,
          verif3ById: null,
          isVerified: false,
          verifiedAt: null,
          verifiedById: null,
        },
      })
      if (berubah.count !== 1) {
        throw new ConflictError(
          "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "BATALKAN_VERIFIKASI_V3_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif3At: laporan.verif3At,
            verif3ById: laporan.verif3ById,
            isVerified: laporan.isVerified,
            verifiedAt: laporan.verifiedAt,
            verifiedById: laporan.verifiedById,
          },
          sesudah: {
            verif3At: null,
            verif3ById: null,
            isVerified: false,
            verifiedAt: null,
            verifiedById: null,
          },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
  }

  if (laporan.verif2At) {
    // VERIFIKASI.md: V2 tidak dapat membatalkan V2 miliknya setelah verifikasi;
    // hanya V3 (SENIOR_UP) yang berwenang membuka kembali tahap V2.
    if (!bolehSenior)
      throw new ForbiddenError(
        "Membatalkan V2 memerlukan Senior Manager ke atas (V3); V2 tidak dapat membatalkan tahapnya sendiri"
      )
    return prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          verif2At: laporan.verif2At,
          verif3At: null,
          pembacaanId: null,
        },
        data: { verif2At: null, verif2ById: null },
      })
      if (berubah.count !== 1) {
        throw new ConflictError(
          "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "BATALKAN_VERIFIKASI_V2_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif2At: laporan.verif2At,
            verif2ById: laporan.verif2ById,
          },
          sesudah: { verif2At: null, verif2ById: null },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
  }

  if (laporan.verif1At) {
    // VERIFIKASI.md: V1 tidak dapat membatalkan V1 miliknya setelah verifikasi;
    // hanya V2/V3 (MANAGEMENT_UP) yang berwenang membuka kembali tahap V1.
    if (!bolehManajemen)
      throw new ForbiddenError(
        "Membatalkan V1 memerlukan Manager ke atas (V2/V3); V1 tidak dapat membatalkan tahapnya sendiri"
      )
    return prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          verif1At: laporan.verif1At,
          verif2At: null,
          verif3At: null,
          pembacaanId: null,
        },
        data: {
          verif1At: null,
          verif1ById: null,
          standAwalRevisi: null,
          standAkhirRevisi: null,
          kondisiRevisi: null,
          standAngkatLama: null,
          standMeterBaru: null,
          pemakaianTagihVerif: null,
          meterVerifId: null,
          blokTarifVerif: null,
        },
      })
      if (berubah.count !== 1) {
        throw new ConflictError(
          "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "BATALKAN_VERIFIKASI_V1_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif1At: laporan.verif1At,
            verif1ById: laporan.verif1ById,
            standAwalRevisi: laporan.standAwalRevisi,
            standAkhirRevisi: laporan.standAkhirRevisi,
            kondisiRevisi: laporan.kondisiRevisi,
            standAngkatLama: laporan.standAngkatLama,
            standMeterBaru: laporan.standMeterBaru,
            pemakaianTagihVerif: laporan.pemakaianTagihVerif,
            meterVerifId: laporan.meterVerifId,
            blokTarifVerif: laporan.blokTarifVerif,
          },
          sesudah: {
            verif1At: null,
            verif1ById: null,
            standAwalRevisi: null,
            standAkhirRevisi: null,
            kondisiRevisi: null,
            standAngkatLama: null,
            standMeterBaru: null,
            pemakaianTagihVerif: null,
            meterVerifId: null,
            blokTarifVerif: null,
          },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
  }

  if (laporan.verifiedAt) {
    // Baris DITOLAK (cek ulang) — kembalikan ke MENUNGGU.
    return prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          verifiedAt: laporan.verifiedAt,
          isVerified: false,
          pembacaanId: null,
        },
        data: { verifiedAt: null, verifiedById: null, catatanVerif: null },
      })
      if (berubah.count !== 1) {
        throw new ConflictError(
          "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "BATALKAN_BACA_ULANG_LAPORAN_PETUGAS",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verifiedAt: laporan.verifiedAt,
            verifiedById: laporan.verifiedById,
            catatanVerif: laporan.catatanVerif,
          },
          sesudah: {
            verifiedAt: null,
            verifiedById: null,
            catatanVerif: null,
          },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
  }

  throw new BadRequestError("Belum ada tahap verifikasi yang bisa dibatalkan")
}
