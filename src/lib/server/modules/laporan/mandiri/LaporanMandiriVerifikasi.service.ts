import {
  JenisInputLaporanHarian,
  Prisma,
  type KondisiCatat,
  type KategoriPembacaan,
  type StatusLaporanMandiri,
} from "@db"
import { prisma } from "@db"
import { ROLE_GROUPS } from "../../../middleware/RBAC"
import type { SessionUser } from "../../../lib/Sesi"
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../../../lib/Galat"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../../lib/Pagination"
import { dateToPeriode, periodeToDate } from "../../../lib/Periode"
import { rentangTanggalWIB } from "../../../lib/RentangTanggal"
import { recordAudit } from "../../../lib/Audit"
import { pilihPemakaianLalu } from "@/lib/domain/PemakaianLalu"
import {
  ambilPemakaianPeriodeSebelumnya,
  ambilPembacaanResmi,
  denganSumberResmi,
} from "../bersama/PembacaanResmi.service"
import type {
  ListLaporanMandiriQuery,
  RejectLaporanMandiriInput,
  StatsLaporanMandiriQuery,
  VerifyLaporanMandiriInput,
} from "./LaporanMandiri.schema"

export type AuditMeta = {
  ipAddress: string | null
  userAgent: string | null
}

async function muatStandAwalSebelumnya(
  rows: { pelangganId: string; periode: number }[]
) {
  const pelangganIds = [...new Set(rows.map((row) => row.pelangganId))]
  if (pelangganIds.length === 0) return new Map<string, number>()

  const meters = await prisma.meter.findMany({
    where: { pelangganId: { in: pelangganIds }, isAktif: true },
    select: { id: true, pelangganId: true },
    orderBy: { createdAt: "desc" },
  })
  const meterPerPelanggan = new Map<string, string>()
  for (const meter of meters) {
    if (!meterPerPelanggan.has(meter.pelangganId))
      meterPerPelanggan.set(meter.pelangganId, meter.id)
  }

  const perPeriode = new Map<number, Set<string>>()
  for (const row of rows) {
    const meterId = meterPerPelanggan.get(row.pelangganId)
    if (!meterId) continue
    const ids = perPeriode.get(row.periode) ?? new Set<string>()
    ids.add(meterId)
    perPeriode.set(row.periode, ids)
  }

  const hasil = new Map<string, number>()
  for (const [thbl, meterIds] of perPeriode) {
    const ids = [...meterIds]
    for (let offset = 0; offset < ids.length; offset += 500) {
      const bacaan = await prisma.pembacaanMeter.findMany({
        where: {
          meterId: { in: ids.slice(offset, offset + 500) },
          periode: { lt: periodeToDate(thbl) },
        },
        orderBy: { periode: "desc" },
        select: { meterId: true, standAkhir: true },
      })
      for (const item of bacaan) {
        if (!hasil.has(`${thbl}:${item.meterId}`))
          hasil.set(`${thbl}:${item.meterId}`, item.standAkhir)
      }
    }
  }

  return new Map(
    rows.flatMap((row) => {
      const meterId = meterPerPelanggan.get(row.pelangganId)
      const stand = meterId ? hasil.get(`${row.periode}:${meterId}`) : undefined
      return stand === undefined
        ? []
        : [[`${row.pelangganId}:${row.periode}`, stand]]
    })
  )
}

/// Filter "DIVERIFIKASI" juga memuat status "DIGUNAKAN" lama untuk menjaga
/// kompatibilitas data yang dibuat sebelum verifikasi Mandiri dipisahkan dari
/// penerbitan pembacaan resmi.
function whereStatus(status?: StatusLaporanMandiri) {
  if (!status) return {}
  if (status === "DIVERIFIKASI") {
    return {
      status: { in: ["DIVERIFIKASI", "DIGUNAKAN"] as StatusLaporanMandiri[] },
    }
  }
  return { status }
}

export async function listLaporanMandiri(query: ListLaporanMandiriQuery) {
  const { skip, take } = buildSkipTake(query)
  const masuk = rentangTanggalWIB(query.tanggalDari, query.tanggalSampai)
  const where = {
    ...whereStatus(query.status),
    periode: query.periode,
    pelangganId: query.pelangganId,
    ...(masuk ? { createdAt: masuk } : {}),
    ...(query.q
      ? {
          OR: [
            { nomorLangganan: { contains: query.q } },
            {
              namaPelapor: {
                contains: query.q,
                mode: "insensitive" as const,
              },
            },
            {
              pelanggan: {
                nama: { contains: query.q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.laporanMandiri.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
      include: {
        verifiedBy: { select: { id: true, name: true, role: true } },
        pelanggan: {
          select: {
            id: true,
            nomorLangganan: true,
            nama: true,
            alamat: true,
            tarifGolongan: { select: { kodeAsli: true } },
            rute: { select: { kode: true } },
          },
        },
        pembacaan: {
          select: {
            standLalu: true,
            standAkhir: true,
            pemakaianRiil: true,
            pemakaianM3: true,
            pemakaianLalu: true,
            kondisi: true,
            tagihan: { select: { id: true } },
          },
        },
      },
    }),
    prisma.laporanMandiri.count({ where }),
  ])
  const pembacaanResmi = await ambilPembacaanResmi(
    data.map((row) => ({
      pelangganId: row.pelangganId,
      periode: row.periode,
    }))
  )
  const petaPembacaan = new Map<
    string,
    ReturnType<typeof denganSumberResmi<(typeof pembacaanResmi)[number]>>
  >()
  for (const row of pembacaanResmi) {
    const kunci = `${row.meter.pelangganId}:${dateToPeriode(row.periode)}`
    if (!petaPembacaan.has(kunci))
      petaPembacaan.set(kunci, denganSumberResmi(row))
  }
  const standAwalSebelumnya = await muatStandAwalSebelumnya(data)
  const pemakaianPeriodeSebelumnya = await ambilPemakaianPeriodeSebelumnya(
    data.map((row) => ({
      pelangganId: row.pelangganId,
      periode: row.periode,
    }))
  )
  const laporanPetugasSinkron =
    data.length > 0
      ? await prisma.laporanHarianPetugas.findMany({
          where: {
            OR: data.map((row) => ({
              nomorLangganan: row.nomorLangganan,
              periode: row.periode,
            })),
          },
          select: {
            nomorLangganan: true,
            periode: true,
            jenisInput: true,
            kondisi: true,
            kondisiRevisi: true,
            verif1At: true,
            verif2At: true,
            verif3At: true,
            isVerified: true,
            pembacaanId: true,
            pembacaan: {
              select: { tagihan: { select: { id: true } } },
            },
          },
        })
      : []
  const petaPetugasSinkron = new Map(
    laporanPetugasSinkron.map((item) => [
      `${item.nomorLangganan}:${item.periode}`,
      item,
    ])
  )
  const dataDenganPembacaan = data.map((row) => {
    const petugas = petaPetugasSinkron.get(
      `${row.nomorLangganan}:${row.periode}`
    )
    const sudahTahapPetugas = Boolean(
      petugas &&
      petugas.jenisInput === JenisInputLaporanHarian.KONSUMEN &&
      (petugas.verif1At != null ||
        petugas.verif2At != null ||
        petugas.verif3At != null ||
        petugas.isVerified ||
        petugas.pembacaanId != null)
    )
    const sudahDitagih = Boolean(
      row.pembacaan?.tagihan || petugas?.pembacaan?.tagihan
    )
    const terverifikasiMandiri =
      row.status === "DIVERIFIKASI" || row.status === "DIGUNAKAN"
    const sudahResmiDariMandiri =
      terverifikasiMandiri &&
      (row.pembacaanId != null ||
        (petugas?.jenisInput === JenisInputLaporanHarian.KONSUMEN &&
          (petugas?.pembacaanId != null ||
            petugas?.verif3At != null ||
            petugas?.isVerified)))
    const pembacaanPeriode = petaPembacaan.get(
      `${row.pelangganId}:${row.periode}`
    )
    const pembacaanAktif = sudahResmiDariMandiri
      ? (pembacaanPeriode ??
        (row.pembacaan ? denganSumberResmi(row.pembacaan) : null))
      : null
    const kondisi =
      terverifikasiMandiri &&
      petugas?.jenisInput === JenisInputLaporanHarian.KONSUMEN
        ? (pembacaanAktif?.kondisi ??
          petugas.kondisiRevisi ??
          petugas.kondisi ??
          ("STAND_KONSUMEN" as KondisiCatat))
        : ("STAND_KONSUMEN" as KondisiCatat)
    return {
      ...row,
      verifiedByRole: row.verifiedBy?.role ?? null,
      sudahTahapPetugas,
      sudahDitagih,
      kondisi,
      standAwal:
        pembacaanPeriode?.standLalu ??
        standAwalSebelumnya.get(`${row.pelangganId}:${row.periode}`) ??
        null,
      pemakaianLalu: pilihPemakaianLalu(
        pembacaanPeriode?.pemakaianLalu,
        row.pembacaan?.pemakaianLalu,
        pemakaianPeriodeSebelumnya.get(`${row.periode}:${row.pelangganId}`)
      ),
      pembacaan: pembacaanAktif,
    }
  })
  return { data: dataDenganPembacaan, meta: buildMeta(total, query) }
}

export async function ambilStatistikLaporanMandiri(
  query: StatsLaporanMandiriQuery
) {
  const { periode } = query
  const where = periode ? { periode } : {}
  const [perStatus, periodes] = await Promise.all([
    prisma.laporanMandiri.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.laporanMandiri.groupBy({
      by: ["periode"],
      orderBy: { periode: "desc" },
      take: 24,
    }),
  ])
  const hitung = Object.fromEntries(
    perStatus.map((s) => [s.status, s._count._all])
  ) as Partial<Record<StatusLaporanMandiri, number>>
  const total = perStatus.reduce((acc, s) => acc + s._count._all, 0)
  return {
    total,
    menunggu: hitung.MENUNGGU ?? 0,
    diverifikasi: (hitung.DIVERIFIKASI ?? 0) + (hitung.DIGUNAKAN ?? 0),
    ditolak: hitung.DITOLAK ?? 0,
    periodes: periodes.map((p) => p.periode),
  }
}

export async function getLaporanMandiriById(id: string) {
  const row = await prisma.laporanMandiri.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      pembacaan: true,
      verifiedBy: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("LaporanMandiri")
  const [pembacaan, petugas] = await Promise.all([
    ambilPembacaanResmi([
      { pelangganId: row.pelangganId, periode: row.periode },
    ]),
    prisma.laporanHarianPetugas.findUnique({
      where: {
        nomorLangganan_periode: {
          nomorLangganan: row.nomorLangganan,
          periode: row.periode,
        },
      },
      select: {
        jenisInput: true,
        kondisi: true,
        kondisiRevisi: true,
        pembacaanId: true,
        verif3At: true,
        isVerified: true,
      },
    }),
  ])
  const terverifikasiMandiri =
    row.status === "DIVERIFIKASI" || row.status === "DIGUNAKAN"
  const sudahResmiDariMandiri =
    terverifikasiMandiri &&
    (row.pembacaanId != null ||
      (petugas?.jenisInput === JenisInputLaporanHarian.KONSUMEN &&
        (petugas?.pembacaanId != null ||
          petugas?.verif3At != null ||
          petugas?.isVerified)))
  const pembacaanAktif = sudahResmiDariMandiri
    ? denganSumberResmi(
        pembacaan.find((item) => item.meter.pelangganId === row.pelangganId) ??
          row.pembacaan
      )
    : null
  const kondisi =
    terverifikasiMandiri &&
    petugas?.jenisInput === JenisInputLaporanHarian.KONSUMEN
      ? (pembacaanAktif?.kondisi ??
        petugas.kondisiRevisi ??
        petugas.kondisi ??
        ("STAND_KONSUMEN" as KondisiCatat))
      : ("STAND_KONSUMEN" as KondisiCatat)
  return {
    ...row,
    kondisi,
    pembacaan: pembacaanAktif,
  }
}

function bobotRole(role: string | null | undefined): number {
  switch (role) {
    case "SUPER_ADMIN":
    case "DIREKSI":
    case "SENIOR_MANAGER":
      return 3
    case "MANAGER":
      return 2
    case "SUPERVISOR":
      return 1
    case "STAFF":
      return 0
    default:
      return -1
  }
}

interface SnapshotPetugasSebelumMandiri {
  standAwal?: number
  standAkhir: number
  pemakaian?: number
  pemakaianLalu?: number | null
  persentase?: number | null
  kondisi?: KondisiCatat
  kategori?: KategoriPembacaan
  jenisInput?: JenisInputLaporanHarian
  alasanManual?: string | null
  manualProvenance?: Prisma.InputJsonValue | null
  pencatatId?: string | null
  fotoStandUrl?: string | null
  tanggalCatat?: string | Date
  isVerified?: boolean
  verifiedAt?: string | Date | null
  verifiedById?: string | null
  catatanVerif?: string | null
  pembacaanId?: string | null
  pemakaianTagihVerif?: number | null
  blokTarifVerif?: number | null
  meterVerifId?: string | null
  standAkhirRevisi?: number | null
  standAwalRevisi?: number | null
  kondisiRevisi?: KondisiCatat | null
  standAngkatLama?: number | null
  standMeterBaru?: number | null
  verif1At?: string | Date | null
  verif1ById?: string | null
  verif2At?: string | Date | null
  verif2ById?: string | null
  verif3At?: string | Date | null
  verif3ById?: string | null
}

function hitungPersentaseLaporan(
  pemakaian: number,
  pemakaianLalu: number | null
) {
  if (pemakaianLalu == null || pemakaianLalu === 0) return null
  const nilai = Math.round(((pemakaian - pemakaianLalu) / pemakaianLalu) * 100)
  return Number.isSafeInteger(nilai) && Math.abs(nilai) <= 2_147_483_647
    ? nilai
    : null
}

/// Verifikasi Mandiri menyinkronkan koreksi ke antrean Petugas dan mereset
/// tahap lama. PembacaanMeter tetap hanya diterbitkan melalui verifikasi V3.
export async function verifikasiLaporanMandiri(
  id: string,
  input: VerifyLaporanMandiriInput,
  requester: SessionUser,
  metaAudit: AuditMeta
) {
  const { standDilaporkan } = input

  const laporan = await prisma.laporanMandiri.findUnique({
    where: { id },
    include: { pelanggan: { select: { nama: true, alamat: true } } },
  })
  if (!laporan) throw new NotFoundError("LaporanMandiri")
  if (laporan.status !== "MENUNGGU")
    throw new ConflictError(
      `Laporan sudah diproses sebelumnya (status: ${laporan.status})`
    )
  const standKoreksi = standDilaporkan ?? laporan.standDilaporkan

  return prisma.$transaction(async (tx) => {
    const periode = await tx.periodePenagihan.findUnique({
      where: { periode: laporan.periode },
      select: { status: true },
    })
    if (periode?.status === "TERKUNCI") {
      throw new ConflictError(
        "Periode sudah ditutup; laporan Mandiri tidak dapat mengganti data verifikasi."
      )
    }

    const laporanPetugas = await tx.laporanHarianPetugas.findUnique({
      where: {
        nomorLangganan_periode: {
          nomorLangganan: laporan.nomorLangganan,
          periode: laporan.periode,
        },
      },
      include: {
        pembacaan: {
          select: { id: true, tagihan: { select: { id: true } } },
        },
      },
    })
    const daftarCatat = await tx.daftarCatat.findFirst({
      where: {
        periode: laporan.periode,
        pelangganId: laporan.pelangganId,
      },
      select: { pencatatId: true },
    })
    const penugasanRute =
      laporanPetugas?.pencatatId || daftarCatat?.pencatatId
        ? null
        : await tx.pelanggan.findUnique({
            where: { id: laporan.pelangganId },
            select: {
              rute: {
                select: {
                  penugasanRute: {
                    orderBy: { urutan: "asc" },
                    take: 1,
                    select: { pencatatId: true },
                  },
                },
              },
            },
          })
    const sudahDiverifikasi =
      laporanPetugas &&
      (laporanPetugas.verif1At != null ||
        laporanPetugas.verif2At != null ||
        laporanPetugas.verif3At != null ||
        laporanPetugas.isVerified ||
        laporanPetugas.pembacaanId != null)
    if (
      sudahDiverifikasi &&
      !(ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(requester.role)
    ) {
      throw new ForbiddenError(
        "Mengganti hasil verifikasi Petugas memerlukan kewenangan V3 (Senior Manager ke atas)."
      )
    }
    if (laporanPetugas?.pembacaan?.tagihan) {
      throw new ConflictError(
        "Hasil periode ini sudah masuk proses tagihan; selesaikan atau batalkan proses closing sebelum mengoreksinya."
      )
    }

    let standAwal = laporanPetugas?.standAwal
    if (!laporanPetugas) {
      const meterAktif = await tx.meter.findMany({
        where: { pelangganId: laporan.pelangganId, isAktif: true },
        select: { id: true },
        take: 2,
      })
      if (meterAktif.length > 1) {
        throw new ConflictError(
          "Stand awal tidak dapat ditentukan karena pelanggan memiliki lebih dari satu meter aktif."
        )
      }
      const meterId = meterAktif[0]?.id
      const pembacaanSebelumnya = meterId
        ? await tx.pembacaanMeter.findFirst({
            where: {
              meterId,
              periode: { lt: periodeToDate(laporan.periode) },
            },
            orderBy: { periode: "desc" },
            select: { standAkhir: true },
          })
        : null
      standAwal = pembacaanSebelumnya?.standAkhir ?? 0
    }
    standAwal ??= 0
    const pemakaian = standKoreksi - standAwal
    const dataSinkron = {
      standAkhir: standKoreksi,
      pemakaian,
      persentase: hitungPersentaseLaporan(
        pemakaian,
        laporanPetugas?.pemakaianLalu ?? null
      ),
      kondisi: "STAND_KONSUMEN" as KondisiCatat,
      kategori: "OFFSITE" as const,
      jenisInput: JenisInputLaporanHarian.KONSUMEN,
      pencatatId:
        laporanPetugas?.pencatatId ??
        daftarCatat?.pencatatId ??
        penugasanRute?.rute?.penugasanRute[0]?.pencatatId ??
        null,
      fotoStandUrl: laporan.fotoUrl,
      tanggalCatat: laporanPetugas?.tanggalCatat ?? laporan.createdAt,
      isVerified: false,
      verifiedAt: null,
      verifiedById: null,
      catatanVerif: null,
      pembacaanId: null,
      pemakaianTagihVerif: null,
      blokTarifVerif: null,
      meterVerifId: null,
      standAkhirRevisi: null,
      standAwalRevisi: null,
      kondisiRevisi: null,
      standAngkatLama: null,
      standMeterBaru: null,
      verif1At: null,
      verif1ById: null,
      verif2At: null,
      verif2ById: null,
      verif3At: null,
      verif3ById: null,
    }

    let petugasDiperbarui
    if (laporanPetugas) {
      const hasilSinkron = await tx.laporanHarianPetugas.updateMany({
        where: {
          id: laporanPetugas.id,
          verif1At: laporanPetugas.verif1At,
          verif2At: laporanPetugas.verif2At,
          verif3At: laporanPetugas.verif3At,
          isVerified: laporanPetugas.isVerified,
          pembacaanId: laporanPetugas.pembacaanId,
        },
        data: dataSinkron,
      })
      if (hasilSinkron.count !== 1) {
        throw new ConflictError(
          "Data verifikasi Petugas berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
        )
      }
      if (laporanPetugas.pembacaanId) {
        await tx.pembacaanMeter.delete({
          where: { id: laporanPetugas.pembacaanId },
        })
      }
      petugasDiperbarui = await tx.laporanHarianPetugas.findUniqueOrThrow({
        where: { id: laporanPetugas.id },
      })
    } else {
      petugasDiperbarui = await tx.laporanHarianPetugas.create({
        data: {
          nomorLangganan: laporan.nomorLangganan,
          pelangganId: laporan.pelangganId,
          namaPelanggan: laporan.pelanggan.nama,
          alamatPelanggan: laporan.pelanggan.alamat,
          periode: laporan.periode,
          standAwal,
          ...dataSinkron,
        },
      })
    }

    const verifiedAt = new Date()
    const hasilUpdate = await tx.laporanMandiri.updateMany({
      where: { id, status: "MENUNGGU" },
      data: {
        status: "DIVERIFIKASI",
        verifiedAt,
        verifiedById: requester.id,
        standDilaporkan: standKoreksi,
      },
    })
    if (hasilUpdate.count !== 1) {
      throw new ConflictError(
        "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
      )
    }

    const hasil = await tx.laporanMandiri.findUniqueOrThrow({
      where: { id },
    })
    await recordAudit(tx, {
      userId: requester.id,
      aksi: laporanPetugas
        ? "LAPORAN_MANDIRI_SINKRON_PETUGAS"
        : "LAPORAN_MANDIRI_MASUK_PETUGAS",
      entitas: "LaporanHarianPetugas",
      entitasId: petugasDiperbarui.id,
      perubahan: {
        sebelum: laporanPetugas
          ? {
              standAwal: laporanPetugas.standAwal,
              standAkhir: laporanPetugas.standAkhir,
              pemakaian: laporanPetugas.pemakaian,
              pemakaianLalu: laporanPetugas.pemakaianLalu,
              persentase: laporanPetugas.persentase,
              kondisi: laporanPetugas.kondisi,
              kategori: laporanPetugas.kategori,
              jenisInput: laporanPetugas.jenisInput,
              alasanManual: laporanPetugas.alasanManual,
              manualProvenance: laporanPetugas.manualProvenance,
              pencatatId: laporanPetugas.pencatatId,
              fotoStandUrl: laporanPetugas.fotoStandUrl,
              tanggalCatat: laporanPetugas.tanggalCatat,
              isVerified: laporanPetugas.isVerified,
              verifiedAt: laporanPetugas.verifiedAt,
              verifiedById: laporanPetugas.verifiedById,
              catatanVerif: laporanPetugas.catatanVerif,
              pembacaanId: laporanPetugas.pembacaanId,
              pemakaianTagihVerif: laporanPetugas.pemakaianTagihVerif,
              blokTarifVerif: laporanPetugas.blokTarifVerif,
              meterVerifId: laporanPetugas.meterVerifId,
              standAkhirRevisi: laporanPetugas.standAkhirRevisi,
              standAwalRevisi: laporanPetugas.standAwalRevisi,
              kondisiRevisi: laporanPetugas.kondisiRevisi,
              standAngkatLama: laporanPetugas.standAngkatLama,
              standMeterBaru: laporanPetugas.standMeterBaru,
              verif1At: laporanPetugas.verif1At,
              verif1ById: laporanPetugas.verif1ById,
              verif2At: laporanPetugas.verif2At,
              verif2ById: laporanPetugas.verif2ById,
              verif3At: laporanPetugas.verif3At,
              verif3ById: laporanPetugas.verif3ById,
            }
          : null,
        sesudah: {
          standAkhir: standKoreksi,
          verif1At: null,
          verif2At: null,
          verif3At: null,
          pembacaanId: null,
        },
        laporanMandiriId: id,
      },
      ...metaAudit,
    })
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "VERIFIKASI_LAPORAN_MANDIRI",
      entitas: "LaporanMandiri",
      entitasId: id,
      perubahan: {
        sebelum: {
          status: laporan.status,
          standDilaporkan: laporan.standDilaporkan,
        },
        sesudah: {
          status: "DIVERIFIKASI",
          standDilaporkan: hasil.standDilaporkan,
        },
      },
      ...metaAudit,
    })
    return hasil
  })
}

export async function tolakLaporanMandiri(
  id: string,
  input: RejectLaporanMandiriInput,
  requester: SessionUser,
  metaAudit: AuditMeta = { ipAddress: null, userAgent: null }
) {
  const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanMandiri")
  if (laporan.status !== "MENUNGGU")
    throw new ConflictError(
      `Laporan sudah diproses sebelumnya (status: ${laporan.status})`
    )

  const kini = new Date()
  return prisma.$transaction(async (tx) => {
    const periode = await tx.periodePenagihan.findUnique({
      where: { periode: laporan.periode },
      select: { status: true },
    })
    if (periode?.status === "TERKUNCI") {
      throw new ConflictError(
        "Periode sudah ditutup; laporan Mandiri tidak dapat ditolak."
      )
    }

    const hasilUpdate = await tx.laporanMandiri.updateMany({
      where: { id, status: "MENUNGGU" },
      data: {
        status: "DITOLAK",
        alasanDitolak: input.alasanDitolak,
        verifiedAt: kini,
        verifiedById: requester.id,
      },
    })
    if (hasilUpdate.count !== 1) {
      throw new ConflictError(
        "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
      )
    }

    await recordAudit(tx, {
      userId: requester.id,
      aksi: "TOLAK_LAPORAN_MANDIRI",
      entitas: "LaporanMandiri",
      entitasId: id,
      perubahan: {
        sebelum: {
          status: laporan.status,
          alasanDitolak: laporan.alasanDitolak,
        },
        sesudah: {
          status: "DITOLAK",
          alasanDitolak: input.alasanDitolak,
          verifiedAt: kini,
          verifiedById: requester.id,
        },
      },
      ...metaAudit,
    })

    return tx.laporanMandiri.findUniqueOrThrow({ where: { id } })
  })
}

/// "Unverifikasi": membatalkan hasil proses — DIGUNAKAN/DIVERIFIKASI maupun
/// DITOLAK kembali ke MENUNGGU. Pembatalan laporan yang sudah jadi
/// PembacaanMeter resmi ikut menghapus pembacaannya, dan ditolak bila
/// pembacaan itu sudah dipakai Tagihan (angka penagihan tidak boleh berubah
/// diam-diam).
export async function batalkanVerifikasiLaporanMandiri(
  id: string,
  requester: SessionUser,
  metaAudit: AuditMeta = { ipAddress: null, userAgent: null }
) {
  const laporan = await prisma.laporanMandiri.findUnique({
    where: { id },
    include: {
      verifiedBy: { select: { id: true, role: true } },
    },
  })
  if (!laporan) throw new NotFoundError("LaporanMandiri")
  if (laporan.status === "MENUNGGU")
    throw new ConflictError(
      "Laporan masih menunggu — belum ada hasil verifikasi untuk dibatalkan"
    )

  const roleVerifikatorSebelumnya =
    (laporan as { verifiedBy?: { role?: string | null } | null }).verifiedBy
      ?.role ?? null
  if (
    roleVerifikatorSebelumnya &&
    bobotRole(requester.role) < bobotRole(roleVerifikatorSebelumnya)
  ) {
    throw new ForbiddenError(
      "Membatalkan hasil verifikasi/penolakan laporan Mandiri memerlukan kewenangan minimal setara dengan verifikator sebelumnya."
    )
  }

  return prisma.$transaction(async (tx) => {
    const periode = await tx.periodePenagihan.findUnique({
      where: { periode: laporan.periode },
      select: { status: true },
    })
    if (periode?.status === "TERKUNCI") {
      throw new ConflictError(
        "Periode sudah ditutup; verifikasi laporan Mandiri tidak dapat dibatalkan."
      )
    }

    if (laporan.pembacaanId) {
      const tagihan = await tx.tagihan.findUnique({
        where: { pembacaanId: laporan.pembacaanId },
      })
      if (tagihan)
        throw new ConflictError(
          "Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan"
        )
    }

    // Periksa sinkronisasi pada antrean Petugas bila berasal dari KONSUMEN
    const laporanPetugas = await tx.laporanHarianPetugas.findUnique({
      where: {
        nomorLangganan_periode: {
          nomorLangganan: laporan.nomorLangganan,
          periode: laporan.periode,
        },
      },
      include: {
        pembacaan: {
          select: { id: true, tagihan: { select: { id: true } } },
        },
      },
    })

    // Cari jejak sinkronisasi Mandiri -> Petugas terakhir di AuditLog
    const auditSinkron =
      laporanPetugas &&
      laporanPetugas.jenisInput === JenisInputLaporanHarian.KONSUMEN
        ? await tx.auditLog?.findFirst?.({
            where: {
              entitas: "LaporanHarianPetugas",
              entitasId: laporanPetugas.id,
              aksi: {
                in: [
                  "LAPORAN_MANDIRI_SINKRON_PETUGAS",
                  "LAPORAN_MANDIRI_MASUK_PETUGAS",
                ],
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : null
    const perubahanSinkron = (auditSinkron?.perubahan ?? null) as {
      sebelum?: SnapshotPetugasSebelumMandiri | null
    } | null
    const snapshotPetugasSebelum = perubahanSinkron?.sebelum ?? null

    if (
      laporanPetugas &&
      laporanPetugas.jenisInput === JenisInputLaporanHarian.KONSUMEN
    ) {
      if (laporanPetugas.pembacaan?.tagihan) {
        throw new ConflictError(
          "Hasil periode ini sudah masuk proses tagihan — tidak bisa dibatalkan"
        )
      }
      const sudahDiverifikasiV3Petugas =
        laporanPetugas.verif3At != null ||
        laporanPetugas.isVerified ||
        laporanPetugas.pembacaanId != null
      if (sudahDiverifikasiV3Petugas) {
        throw new ConflictError(
          "Tidak dapat melakukan unverifikasi di halaman Mandiri karena data telah diverifikasi V3 (Pembacaan Resmi) di halaman Verifikasi Petugas. Batalkan V3 di halaman Verifikasi Petugas terlebih dahulu."
        )
      }
      const sudahDiverifikasiV1V2Petugas =
        laporanPetugas.verif1At != null || laporanPetugas.verif2At != null
      if (sudahDiverifikasiV1V2Petugas) {
        throw new ConflictError(
          "Tidak dapat melakukan unverifikasi di halaman Mandiri karena data telah masuk tahap verifikasi (V1/V2) di halaman Verifikasi Petugas. Batalkan verifikasi di halaman Verifikasi Petugas terlebih dahulu."
        )
      }
      const menimpaTahapPetugasSebelumnya =
        snapshotPetugasSebelum?.verif1At != null ||
        snapshotPetugasSebelum?.verif2At != null ||
        snapshotPetugasSebelum?.verif3At != null ||
        Boolean(snapshotPetugasSebelum?.isVerified) ||
        snapshotPetugasSebelum?.pembacaanId != null
      if (
        menimpaTahapPetugasSebelumnya &&
        !(ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(requester.role)
      ) {
        throw new ForbiddenError(
          "Membatalkan laporan Mandiri yang menimpa hasil verifikasi Petugas memerlukan kewenangan V3 (Senior Manager ke atas)."
        )
      }
    }

    // Kembalikan standDilaporkan ke kiriman asli warga terbaru (bila sempat diedit saat verifikasi)
    const kirimanTerakhir = await tx.kirimanLaporanMandiri?.findFirst?.({
      where: { laporanMandiriId: id },
      orderBy: { diterimaPada: "desc" },
      select: { standDilaporkan: true },
    })
    const auditVerifMandiri =
      kirimanTerakhir == null
        ? await tx.auditLog?.findFirst?.({
            where: {
              entitas: "LaporanMandiri",
              entitasId: id,
              aksi: "VERIFIKASI_LAPORAN_MANDIRI",
            },
            orderBy: { createdAt: "desc" },
          })
        : null
    const standSebelumVerif = (
      auditVerifMandiri?.perubahan as {
        sebelum?: { standDilaporkan?: number }
      } | null
    )?.sebelum?.standDilaporkan
    const standDilaporkanAsli =
      kirimanTerakhir?.standDilaporkan ??
      standSebelumVerif ??
      laporan.standDilaporkan

    const hasilUpdate = await tx.laporanMandiri.updateMany({
      where: { id, status: laporan.status },
      data: {
        status: "MENUNGGU",
        ...(standDilaporkanAsli !== undefined
          ? { standDilaporkan: standDilaporkanAsli }
          : {}),
        verifiedAt: null,
        verifiedById: null,
        alasanDitolak: null,
        pembacaanId: null,
      },
    })
    if (hasilUpdate.count !== 1) {
      throw new ConflictError(
        "Status laporan berubah saat proses berjalan. Muat ulang sebelum mencoba lagi."
      )
    }

    if (laporan.pembacaanId) {
      await tx.pembacaanMeter.delete({ where: { id: laporan.pembacaanId } })
    }

    let aksiRollbackPetugas: "DIPULIHKAN" | "DIHAPUS" | null = null
    if (
      laporanPetugas &&
      laporanPetugas.jenisInput === JenisInputLaporanHarian.KONSUMEN
    ) {
      if (
        laporanPetugas.pembacaanId &&
        laporanPetugas.pembacaanId !== laporan.pembacaanId
      ) {
        await tx.pembacaanMeter.delete({
          where: { id: laporanPetugas.pembacaanId },
        })
      }

      if (snapshotPetugasSebelum) {
        // Sebelumnya sudah ada laporan Petugas/Manual sebelum ditimpa Mandiri:
        // pulihkan kembali ke kondisi dan nilai sebelum Verifikasi Mandiri.
        const standAwalPulih =
          snapshotPetugasSebelum.standAwal ?? laporanPetugas.standAwal
        const standAkhirPulih = snapshotPetugasSebelum.standAkhir
        const pemakaianPulih =
          snapshotPetugasSebelum.pemakaian ?? standAkhirPulih - standAwalPulih
        const persentasePulih =
          snapshotPetugasSebelum.persentase !== undefined
            ? snapshotPetugasSebelum.persentase
            : hitungPersentaseLaporan(
                pemakaianPulih,
                laporanPetugas.pemakaianLalu
              )

        await tx.laporanHarianPetugas.updateMany({
          where: { id: laporanPetugas.id },
          data: {
            standAwal: standAwalPulih,
            standAkhir: standAkhirPulih,
            pemakaian: pemakaianPulih,
            persentase: persentasePulih,
            kondisi: snapshotPetugasSebelum.kondisi ?? laporanPetugas.kondisi,
            kategori: snapshotPetugasSebelum.kategori ?? "ONSITE",
            jenisInput:
              snapshotPetugasSebelum.jenisInput ??
              JenisInputLaporanHarian.PETUGAS,
            alasanManual: snapshotPetugasSebelum.alasanManual ?? null,
            manualProvenance:
              snapshotPetugasSebelum.manualProvenance ?? Prisma.DbNull,
            ...(snapshotPetugasSebelum.pencatatId !== undefined
              ? { pencatatId: snapshotPetugasSebelum.pencatatId }
              : {}),
            ...(snapshotPetugasSebelum.fotoStandUrl !== undefined
              ? { fotoStandUrl: snapshotPetugasSebelum.fotoStandUrl }
              : {}),
            ...(snapshotPetugasSebelum.tanggalCatat
              ? {
                  tanggalCatat: new Date(snapshotPetugasSebelum.tanggalCatat),
                }
              : {}),
            standAwalRevisi: snapshotPetugasSebelum.standAwalRevisi ?? null,
            standAkhirRevisi: snapshotPetugasSebelum.standAkhirRevisi ?? null,
            kondisiRevisi: snapshotPetugasSebelum.kondisiRevisi ?? null,
            standAngkatLama: snapshotPetugasSebelum.standAngkatLama ?? null,
            standMeterBaru: snapshotPetugasSebelum.standMeterBaru ?? null,
            pemakaianTagihVerif:
              snapshotPetugasSebelum.pemakaianTagihVerif ?? null,
            blokTarifVerif: snapshotPetugasSebelum.blokTarifVerif ?? null,
            meterVerifId: snapshotPetugasSebelum.meterVerifId ?? null,
            catatanVerif: snapshotPetugasSebelum.catatanVerif ?? null,
            verif1At: snapshotPetugasSebelum.verif1At
              ? new Date(snapshotPetugasSebelum.verif1At)
              : null,
            verif1ById: snapshotPetugasSebelum.verif1ById ?? null,
            verif2At: snapshotPetugasSebelum.verif2At
              ? new Date(snapshotPetugasSebelum.verif2At)
              : null,
            verif2ById: snapshotPetugasSebelum.verif2ById ?? null,
            // Jika sebelumnya sudah V3 namun pembacaanMeter resminya telah dihapus saat
            // ditimpa Mandiri, biarkan verif3At/isVerified/pembacaanId kosong agar V3
            // mengesahkan ulang pembacaan resminya secara sah.
            verif3At: null,
            verif3ById: null,
            isVerified: false,
            verifiedAt: null,
            verifiedById: null,
            pembacaanId: null,
          },
        })
        aksiRollbackPetugas = "DIPULIHKAN"
      } else {
        // Baris di Verifikasi Petugas murni dibuat oleh sinkronisasi Mandiri
        // (LAPORAN_MANDIRI_MASUK_PETUGAS): tarik/hapus dari antrean Petugas.
        if (typeof tx.laporanHarianPetugas.delete === "function") {
          await tx.laporanHarianPetugas.delete({
            where: { id: laporanPetugas.id },
          })
        } else {
          await tx.laporanHarianPetugas.updateMany({
            where: { id: laporanPetugas.id },
            data: {
              isVerified: false,
              verifiedAt: null,
              verifiedById: null,
              pembacaanId: null,
              verif1At: null,
              verif1ById: null,
              verif2At: null,
              verif2ById: null,
              verif3At: null,
              verif3ById: null,
            },
          })
        }
        aksiRollbackPetugas = "DIHAPUS"
      }
    }

    await recordAudit(tx, {
      userId: requester.id,
      aksi: "BATALKAN_VERIFIKASI_LAPORAN_MANDIRI",
      entitas: "LaporanMandiri",
      entitasId: id,
      perubahan: {
        sebelum: {
          status: laporan.status,
          standDilaporkan: laporan.standDilaporkan,
          verifiedAt: laporan.verifiedAt,
          verifiedById: laporan.verifiedById,
          alasanDitolak: laporan.alasanDitolak,
          pembacaanId: laporan.pembacaanId,
        },
        sesudah: {
          status: "MENUNGGU",
          standDilaporkan: standDilaporkanAsli,
          verifiedAt: null,
          verifiedById: null,
          alasanDitolak: null,
          pembacaanId: null,
          rollbackPetugas: aksiRollbackPetugas,
        },
      },
      ...metaAudit,
    })

    return tx.laporanMandiri.findUniqueOrThrow({ where: { id } })
  })
}
