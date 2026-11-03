// src/lib/server/modules/laporan/harian/LaporanHarianVerifikasi.service.ts —
// alur verifikasi berjenjang V1 → V2 → V3, verifikasi langsung, dan
// verifikasi massal.
import type { KondisiCatat } from "@db"
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
import { tentukanBlok } from "@/lib/domain/Tagihan"
import { verifikasiMassal } from "./VerifMassal.service"
import { simpanPembacaanResmi } from "../bersama/PembacaanResmi.service"
import { pastikanV3UntukTagihan } from "./KewenanganTagihan"
import type {
  Verif1Input,
  CatatanVerifInput,
  VerifMassalInput,
  AuditMeta,
} from "./LaporanHarian.schema"

// ── Verifikasi berjenjang V1 → V2 → V3. PembacaanMeter resmi BARU
// dibuat saat V3 — bukan di V1 seperti alur lama. Urutan ring wajib, tapi
// role di atasnya boleh mengerjakan ring bawah (V1 = SUPERVISOR_UP,
// V2 = MANAGEMENT_UP, V3 = SENIOR_UP).

export function validasiStandAngkat(
  kondisi: string,
  standAngkatLama: number | null | undefined,
  standMeterBaru: number | null | undefined
) {
  if (kondisi !== "MB") return null
  if (standAngkatLama == null || standMeterBaru == null) {
    throw new BadRequestError(
      "Kondisi MB memerlukan stand angkat meter lama dan stand meter baru."
    )
  }
  return { standAngkatLama, standMeterBaru }
}

export async function validasiMeterBaru(
  pelangganId: string | null,
  meterId: string | null | undefined
) {
  if (!meterId) throw new BadRequestError("Meter baru belum dipilih.")
  const meter = await prisma.meter.findUnique({ where: { id: meterId } })
  if (!meter) throw new NotFoundError("Meter")
  if (!pelangganId || meter.pelangganId !== pelangganId || !meter.isAktif) {
    throw new BadRequestError(
      "Kondisi MB harus menggunakan meter baru yang aktif milik pelanggan ini."
    )
  }
}

export async function pastikanPeriodeBelumTerkunci(periode: number) {
  const row = await prisma.periodePenagihan.findUnique({
    where: { periode },
    select: { status: true },
  })
  if (row?.status === "TERKUNCI") {
    throw new ConflictError(
      "Periode sudah ditutup; tindakan verifikasi atau koreksi tidak dapat dilakukan."
    )
  }
}

export async function verifikasiV1LaporanHarian(
  id: string,
  body: Verif1Input,
  requester: SessionUser,
  auditMeta: AuditMeta = { ipAddress: null, userAgent: null }
) {
  if (body.pemakaianTagih !== undefined) {
    pastikanV3UntukTagihan(requester.role, 1)
  }

  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  await pastikanPeriodeBelumTerkunci(laporan.periode)
  if (laporan.pembacaanId)
    throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
  if (laporan.verif1At)
    throw new ConflictError(
      "V1 sudah diisi — batalkan dulu bila perlu mengulang"
    )
  if (laporan.verif2At || laporan.verif3At)
    throw new ConflictError(
      "V1 tidak dapat diulang setelah tahap berikutnya diverifikasi"
    )

  const meter = await prisma.meter.findUnique({
    where: { id: body.meterId },
  })
  if (!meter) throw new NotFoundError("Meter")
  const kondisiEfektif =
    body.kondisi ?? laporan.kondisiRevisi ?? laporan.kondisi
  validasiStandAngkat(kondisiEfektif, body.standAngkatLama, body.standMeterBaru)
  if (
    kondisiEfektif === "MB" &&
    (meter.pelangganId !== laporan.pelangganId || !meter.isAktif)
  ) {
    throw new BadRequestError(
      "Kondisi MB harus menggunakan meter baru yang aktif milik pelanggan ini."
    )
  }

  const kini = new Date()
  const kondisiRevisiBaru =
    body.kondisi !== undefined ? body.kondisi : laporan.kondisiRevisi
  return prisma.$transaction(async (tx) => {
    const berubah = await tx.laporanHarianPetugas.updateMany({
      where: {
        id,
        verif1At: null,
        verif2At: null,
        verif3At: null,
        pembacaanId: null,
      },
      data: {
        verif1At: kini,
        verif1ById: requester.id,
        meterVerifId: body.meterId,
        blokTarifVerif: body.blokTarif,
        standAkhirRevisi: body.standAkhirRevisi,
        standAngkatLama: kondisiEfektif === "MB" ? body.standAngkatLama : null,
        standMeterBaru: kondisiEfektif === "MB" ? body.standMeterBaru : null,
        pemakaianTagihVerif: body.pemakaianTagih,
        // Kondisi asli petugas (`kondisi`) tidak pernah ditimpa; hasil koreksi
        // verifikator disimpan di `kondisiRevisi` sesuai ATURAN-KONDISI.md.
        kondisiRevisi: kondisiRevisiBaru,
        // ?? null (bukan undefined): tanpa catatan baru, catatan penolakan
        // lama ikut terhapus — bukan menempel di laporan yang sudah lolos V1.
        catatanVerif: body.catatanVerif ?? null,
        // Laporan DITOLAK boleh diverifikasi ulang bila ternyata benar —
        // V1 baru menghapus jejak penolakan (penanda status DITOLAK adalah
        // verifiedAt terisi tanpa isVerified).
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
      aksi: "VERIFIKASI_V1_LAPORAN_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        sebelum: {
          verif1At: laporan.verif1At,
          verif1ById: laporan.verif1ById,
          meterVerifId: laporan.meterVerifId,
          blokTarifVerif: laporan.blokTarifVerif,
          standAkhirRevisi: laporan.standAkhirRevisi,
          kondisiRevisi: laporan.kondisiRevisi,
          standAngkatLama: laporan.standAngkatLama,
          standMeterBaru: laporan.standMeterBaru,
          catatanVerif: laporan.catatanVerif,
        },
        sesudah: {
          verif1At: kini,
          verif1ById: requester.id,
          meterVerifId: body.meterId,
          blokTarifVerif: body.blokTarif,
          standAkhirRevisi: body.standAkhirRevisi ?? null,
          kondisiRevisi: kondisiRevisiBaru ?? null,
          standAngkatLama:
            kondisiEfektif === "MB" ? (body.standAngkatLama ?? null) : null,
          standMeterBaru:
            kondisiEfektif === "MB" ? (body.standMeterBaru ?? null) : null,
          catatanVerif: body.catatanVerif ?? null,
        },
      },
      ...auditMeta,
    })
    return tx.laporanHarianPetugas.findUniqueOrThrow({
      where: { id },
      include: { verif1By: { select: { id: true, name: true } } },
    })
  })
}

/// Menerjemahkan koreksi opsional jadi potongan `data` Prisma. Kolom yang
/// TIDAK dikirim sengaja tidak masuk objek sama sekali — bukan diisi null —
/// supaya "tidak menyebut" tidak pernah berarti "kosongkan".
/// Koreksi kondisi disimpan di `kondisiRevisi` agar `kondisi` asli petugas
/// tetap utuh sesuai ATURAN-KONDISI.md & VERIFIKASI.md.
export function koreksiDari(body: CatatanVerifInput): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (body.meterId !== undefined) data.meterVerifId = body.meterId
  if (body.blokTarif !== undefined) data.blokTarifVerif = body.blokTarif
  if (body.standAkhirRevisi !== undefined)
    data.standAkhirRevisi = body.standAkhirRevisi
  if (body.standAngkatLama !== undefined)
    data.standAngkatLama = body.standAngkatLama
  if (body.standMeterBaru !== undefined)
    data.standMeterBaru = body.standMeterBaru
  if (body.pemakaianTagih !== undefined)
    data.pemakaianTagihVerif = body.pemakaianTagih
  if (body.kondisi !== undefined) data.kondisiRevisi = body.kondisi
  return data
}

export async function verifikasiV2LaporanHarian(
  id: string,
  body: CatatanVerifInput,
  requester: SessionUser,
  auditMeta: AuditMeta = { ipAddress: null, userAgent: null }
) {
  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  await pastikanPeriodeBelumTerkunci(laporan.periode)
  if (laporan.pembacaanId)
    throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
  if (laporan.verif2At)
    throw new ConflictError(
      "V2 sudah diisi — batalkan dulu bila perlu mengulang"
    )
  if (laporan.verif3At)
    throw new ConflictError(
      "V2 tidak dapat diulang setelah tahap V3 diverifikasi"
    )

  if (body.pemakaianTagih !== undefined) {
    pastikanV3UntukTagihan(requester.role, 2)
  }
  const kondisiEfektif =
    body.kondisi ?? laporan.kondisiRevisi ?? laporan.kondisi
  const standAngkatLama =
    body.standAngkatLama !== undefined
      ? body.standAngkatLama
      : laporan.standAngkatLama
  const standMeterBaru =
    body.standMeterBaru !== undefined
      ? body.standMeterBaru
      : laporan.standMeterBaru
  validasiStandAngkat(kondisiEfektif, standAngkatLama, standMeterBaru)
  if (kondisiEfektif === "MB")
    await validasiMeterBaru(
      laporan.pelangganId,
      body.meterId ?? laporan.meterVerifId
    )
  const koreksi = koreksiDari(body)
  const kini = new Date()
  return prisma.$transaction(async (tx) => {
    const berubah = await tx.laporanHarianPetugas.updateMany({
      where: {
        id,
        verif2At: null,
        verif3At: null,
        pembacaanId: null,
      },
      data: {
        verif2At: kini,
        verif2ById: requester.id,
        ...(body.catatanVerif !== undefined
          ? { catatanVerif: body.catatanVerif }
          : {}),
        ...koreksi,
      },
    })
    if (berubah.count !== 1) {
      throw new ConflictError(
        "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
      )
    }
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "VERIFIKASI_V2_LAPORAN_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        sebelum: {
          verif2At: laporan.verif2At,
          verif2ById: laporan.verif2ById,
          meterVerifId: laporan.meterVerifId,
          blokTarifVerif: laporan.blokTarifVerif,
          standAkhirRevisi: laporan.standAkhirRevisi,
          kondisiRevisi: laporan.kondisiRevisi,
          standAngkatLama: laporan.standAngkatLama,
          standMeterBaru: laporan.standMeterBaru,
          catatanVerif: laporan.catatanVerif,
        },
        sesudah: {
          verif2At: kini,
          verif2ById: requester.id,
          ...koreksi,
          ...(body.catatanVerif !== undefined
            ? { catatanVerif: body.catatanVerif }
            : {}),
        },
      },
      ...auditMeta,
    })
    return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
  })
}

/// V3 = final approval: satu-satunya tempat PembacaanMeter resmi dibuat.
/// Stand resmi = standAkhirRevisi (bila V1 mengoreksi) atau standAkhir catat.
///
/// M³ resmi ditetapkan V3: formulir mengusulkan selisih matematis (termasuk
/// rumus gabungan untuk MB), lalu V3 dapat mengubahnya sesuai kebijakan.
/// Baris lama yang belum memiliki nilai verifikasi mempertahankan pemakaian
/// impor. Pemakaian riil selalu dihitung terpisah dan koreksi manual dicatat.
export async function verifikasiV3LaporanHarian(
  id: string,
  body: CatatanVerifInput,
  requester: SessionUser,
  auditMeta: AuditMeta
) {
  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  await pastikanPeriodeBelumTerkunci(laporan.periode)
  if (laporan.pembacaanId)
    throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
  // Koreksi yang dikirim BERSAMA V3 berlaku untuk pembacaan yang terbit di
  // transaksi ini juga — bukan cuma tersimpan di laporan. Kalau tidak,
  // senior manager akan melihat angka yang ia perbaiki tetap terbit salah.
  const koreksi = koreksiDari(body)
  const meterVerifId =
    (koreksi.meterVerifId as string | undefined) ?? laporan.meterVerifId
  if (!meterVerifId)
    throw new BadRequestError("Meter tujuan belum dipilih di V1")

  const standAwal =
    (koreksi.standAwalRevisi as number | null | undefined) ??
    laporan.standAwalRevisi ??
    laporan.standAwal
  const standAngkatLama =
    (koreksi.standAngkatLama as number | null | undefined) ??
    laporan.standAngkatLama
  const standMeterBaru =
    (koreksi.standMeterBaru as number | null | undefined) ??
    laporan.standMeterBaru
  const kondisiEfektif =
    (koreksi.kondisiRevisi as KondisiCatat | undefined) ??
    laporan.kondisiRevisi ??
    laporan.kondisi
  const dataStandAngkat = validasiStandAngkat(
    kondisiEfektif,
    standAngkatLama,
    standMeterBaru
  )
  if (kondisiEfektif === "MB")
    await validasiMeterBaru(laporan.pelangganId, meterVerifId)
  const standAkhir =
    kondisiEfektif === "MB" && (dataStandAngkat?.standMeterBaru ?? standMeterBaru) != null
      ? (dataStandAngkat?.standMeterBaru ?? standMeterBaru)!
      : ((koreksi.standAkhirRevisi as number | null | undefined) ??
        laporan.standAkhirRevisi ??
        laporan.standAkhir)
  const pemakaianTagihVerif =
    (koreksi.pemakaianTagihVerif as number | null | undefined) ??
    laporan.pemakaianTagihVerif
  const pemakaianRiil = dataStandAngkat
    ? hitungPemakaianGantiMeter({
        standAwalLama: standAwal,
        standAngkatLama: dataStandAngkat.standAngkatLama,
        standMeterBaru: dataStandAngkat.standMeterBaru,
      })
    : standAkhir - standAwal
  if (pemakaianRiil < 0)
    throw new BadRequestError(
      "Pemakaian hasil stand negatif. Koreksi dan tinjau datanya sebelum pengesahan V3."
    )

  // TIDAK ADA TAKSASI OTOMATIS.
  //
  // Aturan taksiran (minimum 5 m3, taksiran dari bulan lalu) DIHAPUS dari
  // jalur otomatis atas keputusan pemilik data. Alasannya: angka yang
  // dibawa lapdatameter & ProgresCater sudah matang — ia keluaran
  // verifikasi berjenjang di Aurora — sehingga menaksirnya ulang berarti
  // menimpa keputusan manusia dengan tebakan mesin.
  //
  // Aturan sistem tetap ada, tapi nilai Tagihan hanya ditetapkan V3
  // melalui kolom pemakaianTagihVerif. Dengan begitu setiap penyimpangan
  // dari angka catat
  // selalu punya nama orang di belakangnya dan bisa ditelusuri.
  // OVERRIDE_MANUAL HANYA bila operator yang menetapkannya — lihat catatan
  // yang sama di VerifMassal.ts.
  const pemakaianTagih =
    pemakaianTagihVerif ??
    (kondisiEfektif === "MB" ? pemakaianRiil : laporan.pemakaian)
  const alasanTaksir =
    laporan.jenisInput === "MANUAL_MASSAL" &&
    pemakaianTagih === laporan.pemakaian
      ? "MANUAL_ADD"
      : pemakaianTagihVerif != null && pemakaianTagihVerif !== pemakaianRiil
        ? "OVERRIDE_MANUAL"
        : null

  const kini = new Date()

  return prisma.$transaction(async (tx) => {
    const berubah = await tx.laporanHarianPetugas.updateMany({
      where: {
        id,
        verif3At: null,
        pembacaanId: null,
        isVerified: false,
      },
      data: {
        verif3At: kini,
        verif3ById: requester.id,
      },
    })
    if (berubah.count !== 1) {
      throw new ConflictError(
        "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
      )
    }

    const pembacaan = await simpanPembacaanResmi(tx, {
      pelangganId: laporan.pelangganId,
      nomorLangganan: laporan.nomorLangganan,
      meterId: meterVerifId,
      periode: laporan.periode,
      sumber: "PETUGAS",
      laporanId: laporan.id,
      aktor: {
        userId: requester.id,
        ...auditMeta,
      },
      data: {
        ...(meterVerifId ? { meterId: meterVerifId } : {}),
        standLalu: standAwal,
        standAkhir,
        pemakaianM3: pemakaianTagih,
        pemakaianRiil,
        alasanTaksir,
        blokTarif:
          (koreksi.blokTarifVerif as number | undefined) ??
          laporan.blokTarifVerif ??
          tentukanBlok(pemakaianTagih),
        pemakaianLalu: laporan.pemakaianLalu,
        kondisi: kondisiEfektif,
        kategori: laporan.kategori,
        pencatatId: laporan.pencatatId,
        tanggalCatat: laporan.tanggalCatat,
        // Foto stand ikut ke pembacaan resmi (cermin alur laporan mandiri
        // yang menyalin fotoUrl pelapor).
        fotoBukti: laporan.fotoStandUrl,
      },
    })
    // TUTUP LINGKARNYA: baris daftar catat ditandai DICATAT begitu pembacaan
    // resminya lahir. Tanpa ini statusnya membeku di nilai saat baris dibuat,
    // dan layar closing selamanya melaporkan "belum menghasilkan pembacaan"
    // untuk sambungan yang JUSTRU sudah dibaca — karena tidak ada satu pun
    // jalur yang memperbaruinya.
    //
    // updateMany (bukan update): baris DPM bisa saja tidak ada — mis. laporan
    // susulan atas sambungan yang belum masuk daftar kerja periode itu — dan
    // itu bukan alasan menggagalkan penerbitan pembacaan.
    if (laporan.pelangganId) {
      await tx.daftarCatat.updateMany({
        where: { periode: laporan.periode, pelangganId: laporan.pelangganId },
        data: { status: "DICATAT", selesaiAt: kini },
      })
    }

    const row = await tx.laporanHarianPetugas.update({
      where: { id },
      data: {
        verif3At: kini,
        verif3ById: requester.id,
        // Koreksi ikut TERSIMPAN di laporan, bukan cuma dipakai sekali —
        // supaya jejaknya bisa ditelusuri dan angka di layar sama dengan
        // angka yang terbit.
        ...koreksi,
        ...(body.catatanVerif !== undefined
          ? { catatanVerif: body.catatanVerif }
          : {}),
        // Penanda final legacy tetap diisi supaya filter statusVerif,
        // stats, dan konsumen lama (mobile) membaca status yang sama.
        isVerified: true,
        verifiedAt: kini,
        verifiedById: requester.id,
        pembacaanId: pembacaan.id,
      },
      include: { pembacaan: true },
    })

    await recordAudit(tx, {
      userId: requester.id,
      aksi: "VERIFIKASI_V3_LAPORAN_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        sebelum: {
          verif3At: laporan.verif3At,
          verif3ById: laporan.verif3ById,
          pembacaanId: laporan.pembacaanId,
          pemakaianTagihVerif: laporan.pemakaianTagihVerif,
          standAkhirRevisi: laporan.standAkhirRevisi,
          kondisiRevisi: laporan.kondisiRevisi,
        },
        sesudah: {
          verif3At: kini,
          verif3ById: requester.id,
          pembacaanId: pembacaan.id,
          pemakaianTagih,
          pemakaianRiil,
          ...koreksi,
        },
      },
      ...auditMeta,
    })

    return row
  })
}

/// Verifikasi satu klik: akun menandai tahap miliknya dengan data yang sudah
/// tersimpan. Koreksi data dilakukan lewat endpoint /koreksi, bukan di sini.
export async function verifikasiLangsungLaporanHarian(
  id: string,
  requester: SessionUser,
  auditMeta: AuditMeta
) {
  const ring = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(
    requester.role
  )
    ? 3
    : (ROLE_GROUPS.MANAGEMENT_UP as readonly string[]).includes(requester.role)
      ? 2
      : 1
  const laporan = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
  })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  await pastikanPeriodeBelumTerkunci(laporan.periode)
  if (laporan.pembacaanId || laporan.isVerified)
    throw new ConflictError("Laporan sudah menjadi pembacaan resmi")

  const kini = new Date()
  if (ring === 1) {
    if (laporan.verif1At)
      throw new ConflictError("Tahap V1 sudah ditandai diverifikasi")
    if (laporan.verif2At || laporan.verif3At)
      throw new ConflictError(
        "V1 tidak dapat diulang setelah tahap berikutnya diverifikasi"
      )
    if (!laporan.pelangganId)
      throw new BadRequestError(
        "Alamat belum tertaut ke data pelanggan; koreksi data pelanggan sebelum verifikasi."
      )
    const meterId = laporan.meterVerifId
      ? (
          await prisma.meter.findFirst({
            where: {
              id: laporan.meterVerifId,
              pelangganId: laporan.pelangganId,
            },
            select: { id: true },
          })
        )?.id
      : (
            await prisma.meter.findMany({
              where: { pelangganId: laporan.pelangganId, isAktif: true },
              select: { id: true },
              take: 2,
            })
          ).length === 1
        ? (
            await prisma.meter.findFirst({
              where: { pelangganId: laporan.pelangganId, isAktif: true },
              select: { id: true },
            })
          )?.id
        : null
    if (!meterId)
      throw new BadRequestError(
        "Meter aktif tidak dapat ditentukan dengan pasti. Lengkapi pilihan meter lewat Edit sebelum verifikasi."
      )

    const row = await prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          verif1At: null,
          verif2At: null,
          verif3At: null,
          pembacaanId: null,
          isVerified: false,
        },
        data: {
          verif1At: kini,
          verif1ById: requester.id,
          meterVerifId: meterId,
          verifiedAt: null,
          verifiedById: null,
        },
      })
      if (berubah.count !== 1)
        throw new ConflictError(
          "Status laporan berubah. Muat ulang sebelum mencoba lagi."
        )
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "VERIFIKASI_V1_LANGSUNG",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif1At: laporan.verif1At,
            verif1ById: laporan.verif1ById,
          },
          sesudah: {
            verif1At: kini,
            verif1ById: requester.id,
            meterVerifId: meterId,
          },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
    return { ring, laporan: row }
  }

  if (ring === 2) {
    if (laporan.verif2At)
      throw new ConflictError("Tahap V2 sudah ditandai diverifikasi")
    if (laporan.verif3At)
      throw new ConflictError(
        "V2 tidak dapat diulang setelah tahap V3 diverifikasi"
      )
    const row = await prisma.$transaction(async (tx) => {
      const berubah = await tx.laporanHarianPetugas.updateMany({
        where: {
          id,
          verif2At: null,
          verif3At: null,
          pembacaanId: null,
          isVerified: false,
        },
        data: { verif2At: kini, verif2ById: requester.id },
      })
      if (berubah.count !== 1)
        throw new ConflictError(
          "Status laporan berubah. Muat ulang sebelum mencoba lagi."
        )
      await recordAudit(tx, {
        userId: requester.id,
        aksi: "VERIFIKASI_V2_LANGSUNG",
        entitas: "LaporanHarianPetugas",
        entitasId: id,
        perubahan: {
          sebelum: {
            verif2At: laporan.verif2At,
            verif2ById: laporan.verif2ById,
          },
          sesudah: { verif2At: kini, verif2ById: requester.id },
        },
        ...auditMeta,
      })
      return tx.laporanHarianPetugas.findUniqueOrThrow({ where: { id } })
    })
    return { ring, laporan: row }
  }

  if (laporan.verif3At)
    throw new ConflictError("Tahap V3 sudah ditandai diverifikasi")
  if (!laporan.pelangganId)
    throw new BadRequestError(
      "Alamat belum tertaut ke data pelanggan; koreksi data pelanggan sebelum pengesahan V3."
    )
  const meter = laporan.meterVerifId
    ? await prisma.meter.findFirst({
        where: {
          id: laporan.meterVerifId,
          pelangganId: laporan.pelangganId,
        },
      })
    : await (async () => {
        const aktif = await prisma.meter.findMany({
          where: { pelangganId: laporan.pelangganId!, isAktif: true },
          take: 2,
        })
        return aktif.length === 1 ? (aktif[0] ?? null) : null
      })()
  if (!meter)
    throw new BadRequestError(
      "Meter aktif tidak dapat ditentukan dengan pasti. Lengkapi pilihan meter lewat Edit sebelum pengesahan V3."
    )

  const kondisi = laporan.kondisiRevisi ?? laporan.kondisi
  const standAwal = laporan.standAwalRevisi ?? laporan.standAwal
  const standAkhir =
    kondisi === "MB" && laporan.standMeterBaru != null
      ? laporan.standMeterBaru
      : (laporan.standAkhirRevisi ?? laporan.standAkhir)
  let pemakaianRiil: number
  let standLalu = standAwal
  if (kondisi === "MB") {
    const dataStandAngkat = validasiStandAngkat(
      kondisi,
      laporan.standAngkatLama,
      laporan.standMeterBaru
    )
    pemakaianRiil = hitungPemakaianGantiMeter({
      standAwalLama: standAwal,
      standAngkatLama: dataStandAngkat!.standAngkatLama,
      standMeterBaru: dataStandAngkat!.standMeterBaru,
    })
    standLalu = standAwal
  } else {
    pemakaianRiil = standAkhir - standAwal
  }
  if (pemakaianRiil < 0)
    throw new BadRequestError(
      "Pemakaian hasil stand negatif. Koreksi dan tinjau datanya sebelum pengesahan V3."
    )
  const pemakaianTagih =
    laporan.pemakaianTagihVerif ??
    (kondisi === "MB" ? pemakaianRiil : laporan.pemakaian)
  if (pemakaianTagih < 0)
    throw new BadRequestError(
      "Pemakaian tagih bernilai negatif dan harus ditinjau sebelum pengesahan V3."
    )

  const hasil = await prisma.$transaction(async (tx) => {
    const berubah = await tx.laporanHarianPetugas.updateMany({
      where: {
        id,
        verif3At: null,
        pembacaanId: null,
        isVerified: false,
      },
      data: { verif3At: kini, verif3ById: requester.id },
    })
    if (berubah.count !== 1)
      throw new ConflictError(
        "Status laporan berubah. Muat ulang sebelum mencoba lagi."
      )

    const pembacaan = await simpanPembacaanResmi(tx, {
      pelangganId: laporan.pelangganId,
      nomorLangganan: laporan.nomorLangganan,
      meterId: meter.id,
      periode: laporan.periode,
      sumber: "PETUGAS",
      laporanId: id,
      aktor: {
        userId: requester.id,
        ...auditMeta,
      },
      data: {
        standLalu,
        standAkhir,
        pemakaianM3: pemakaianTagih,
        pemakaianRiil,
        alasanTaksir:
          laporan.jenisInput === "MANUAL_MASSAL" &&
          pemakaianTagih === laporan.pemakaian
            ? "MANUAL_ADD"
            : laporan.pemakaianTagihVerif != null &&
                laporan.pemakaianTagihVerif !== pemakaianRiil
              ? "OVERRIDE_MANUAL"
              : null,
        blokTarif: laporan.blokTarifVerif ?? tentukanBlok(pemakaianTagih),
        pemakaianLalu: laporan.pemakaianLalu,
        kondisi,
        kategori: laporan.kategori,
        pencatatId: laporan.pencatatId,
        tanggalCatat: laporan.tanggalCatat,
        fotoBukti: laporan.fotoStandUrl,
      },
    })
    if (laporan.pelangganId) {
      await tx.daftarCatat.updateMany({
        where: { periode: laporan.periode, pelangganId: laporan.pelangganId },
        data: { status: "DICATAT", selesaiAt: kini },
      })
    }
    const row = await tx.laporanHarianPetugas.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: kini,
        verifiedById: requester.id,
        pembacaanId: pembacaan.id,
      },
      include: { pembacaan: true },
    })
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "VERIFIKASI_V3_LANGSUNG",
      entitas: "LaporanHarianPetugas",
      entitasId: id,
      perubahan: {
        sebelum: {
          verif3At: laporan.verif3At,
          pembacaanId: laporan.pembacaanId,
        },
        sesudah: { verif3At: kini, pembacaanId: pembacaan.id },
      },
      ...auditMeta,
    })
    return row
  })
  return { ring, laporan: hasil }
}

// ── Verifikasi massal (V1/V2/V3 untuk banyak baris sekaligus) ────────────
//
// Wewenangnya MENGIKUTI RING, bukan diseragamkan: V1 supervisor ke atas,
// V2 manajemen ke atas, V3 senior ke atas — sama persis dengan endpoint
// satuannya. Borongan tidak boleh jadi pintu belakang yang lebih longgar.
export const RING_ROLE = {
  1: ROLE_GROUPS.SUPERVISOR_UP,
  2: ROLE_GROUPS.MANAGEMENT_UP,
  3: ROLE_GROUPS.SENIOR_UP,
} as const

export async function verifikasiMassalLaporanHarian(
  body: VerifMassalInput,
  requester: SessionUser,
  auditMeta: AuditMeta
) {
  const { ring, ids, sertakanAnomali } = body
  // Penjagaan ring KEDUA, setelah penjagaan kasar di middleware: middleware
  // hanya bisa memeriksa satu daftar role, sedangkan ring-nya baru diketahui
  // dari body.
  if (!(RING_ROLE[ring] as readonly string[]).includes(requester.role)) {
    throw new ForbiddenError(
      `Verifikasi V${ring} memerlukan salah satu role: ${RING_ROLE[ring].join(", ")}`
    )
  }

  const konf = await prisma.konfigurasi.findUnique({
    where: { kunci: "AMBANG_ANOMALI_PERSEN" },
  })
  const ambangAnomali = Number.parseInt(konf?.nilai ?? "", 10) || 50

  return verifikasiMassal({
    ids,
    ring,
    userId: requester.id,
    auditMeta,
    ambangAnomali,
    sertakanAnomali: sertakanAnomali ?? false,
  })
}
