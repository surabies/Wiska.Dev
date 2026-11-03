// src/lib/server/modules/laporan/harian/LaporanHarianKueri.service.ts — kueri
// baca laporan harian (daftar, ringkasan stats, dan detail satuan).
import type { Prisma } from "@db"
import { prisma } from "@db"
import { NotFoundError } from "../../../lib/Galat"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../../lib/Pagination"
import { dateToPeriode } from "../../../lib/Periode"
import { rentangTanggalWIB } from "../../../lib/RentangTanggal"
import { pilihPemakaianLalu } from "@/lib/domain/PemakaianLalu"
import {
  ambilPemakaianPeriodeSebelumnya,
  ambilPembacaanResmi,
  denganSumberResmi,
} from "../bersama/PembacaanResmi.service"
import type {
  StatusVerif,
  ListLaporanQuery,
  StatsLaporanQuery,
} from "./LaporanHarian.schema"

export const WHERE_STATUS_VERIF: Record<
  StatusVerif,
  Prisma.LaporanHarianPetugasWhereInput
> = {
  MENUNGGU: { verifiedAt: null },
  DIVERIFIKASI: { isVerified: true },
  DITOLAK: { isVerified: false, verifiedAt: { not: null } },
}

/// Kolom yang benar-benar dibaca tabel verifikasi. Ditulis eksplisit, bukan
/// diturunkan dari komponen, supaya menambah kolom di UI memaksa orang
/// membuka berkas ini — daripada diam-diam mengandalkan `include` gemuk.
export const PILIH_RINGKAS = {
  id: true,
  pelangganId: true,
  nomorLangganan: true,
  namaPelanggan: true,
  alamatPelanggan: true,
  periode: true,
  standAwal: true,
  standAkhir: true,
  standAkhirRevisi: true,
  standAwalRevisi: true,
  kondisiRevisi: true,
  standAngkatLama: true,
  standMeterBaru: true,
  meterVerifId: true,
  blokTarifVerif: true,
  pemakaianTagihVerif: true,
  pemakaian: true,
  pemakaianLalu: true,
  persentase: true,
  kondisi: true,
  jenisInput: true,
  alasanManual: true,
  tanggalCatat: true,
  /// Usulan dari lapangan ikut di baris ringkas: layar tinjauan menyaring
  /// dengan `adaUsulan` lalu menampilkannya langsung di tabel, tanpa perlu
  /// membuka baris satu per satu.
  usulanPerubahan: true,
  usulanNoUrut: true,
  isVerified: true,
  verifiedAt: true,
  pembacaanId: true,
  verif1At: true,
  verif2At: true,
  verif3At: true,
  pencatat: { select: { id: true, namaLapangan: true } },
  pelanggan: {
    select: {
      id: true,
      nomorLangganan: true,
      nama: true,
      alamat: true,
      rute: { select: { kode: true } },
    },
  },
} as const

export async function daftarLaporanHarian(query: ListLaporanQuery) {
  const { skip, take } = buildSkipTake(query)
  // Batas hari WIB, bukan UTC — aturannya (beserta alasannya) pindah ke
  // src/lib/server/lib/RentangTanggal.ts karena kiriman warga di /laporan-mandiri kini
  // memakai saringan tanggal yang sama persis.
  const tglCatat = rentangTanggalWIB(query.tanggalDari, query.tanggalSampai)
  let ambang = 50
  if (query.hanyaAnomali) {
    const konf = await prisma.konfigurasi.findUnique({
      where: { kunci: "AMBANG_ANOMALI_PERSEN" },
    })
    ambang = Number.parseInt(konf?.nilai ?? "", 10) || 50
  }
  // Dua syarat sama-sama butuh OR (anomali & pencarian). Ditulis sebagai
  // dua entri AND, BUKAN dua kunci `OR` di objek yang sama — kunci kedua
  // akan menimpa yang pertama secara diam-diam, dan hasilnya: mencari nama
  // sambil menyaring anomali akan mengembalikan baris yang tidak anomali.
  const and: Prisma.LaporanHarianPetugasWhereInput[] = []
  if (query.hanyaAnomali) {
    and.push({
      OR: [{ persentase: { gt: ambang } }, { persentase: { lt: -ambang } }],
    })
  }
  if (query.adaUsulan) {
    // Teks kosong dihitung "tidak ada usulan": aplikasi versi lama pernah
    // mengirim string kosong alih-alih null, dan menampilkannya sebagai
    // usulan akan mengisi layar tinjauan dengan baris hampa.
    and.push(
      { usulanPerubahan: { not: null } },
      { NOT: { usulanPerubahan: "" } }
    )
  }
  if (query.q) {
    and.push({
      OR: [
        { nomorLangganan: { contains: query.q } },
        {
          namaPelanggan: { contains: query.q, mode: "insensitive" as const },
        },
      ],
    })
  }
  if (query.alamat) {
    and.push({
      OR: [
        {
          alamatPelanggan: {
            contains: query.alamat,
            mode: "insensitive" as const,
          },
        },
        {
          pelanggan: {
            is: {
              alamat: {
                contains: query.alamat,
                mode: "insensitive" as const,
              },
            },
          },
        },
      ],
    })
  }
  if (query.noPel) {
    and.push({
      OR: [
        { nomorLangganan: { contains: query.noPel } },
        { pelanggan: { is: { nomorLangganan: { contains: query.noPel } } } },
      ],
    })
  }
  if (query.nama) {
    and.push({
      OR: [
        {
          namaPelanggan: {
            contains: query.nama,
            mode: "insensitive" as const,
          },
        },
        {
          pelanggan: {
            is: {
              nama: { contains: query.nama, mode: "insensitive" as const },
            },
          },
        },
      ],
    })
  }
  if (query.wilayahDistId) {
    and.push({
      pelanggan: {
        is: { seksiCater: { is: { wilayahDistId: query.wilayahDistId } } },
      },
    })
  }
  if (query.zonaId) and.push({ pelanggan: { is: { zonaId: query.zonaId } } })
  if (query.ruteLanjutanId) {
    and.push({ pelanggan: { is: { ruteId: query.ruteLanjutanId } } })
  }
  if (query.pencatatLanjutanId) {
    and.push({ pencatatId: query.pencatatLanjutanId })
  }
  if (query.kondisiLanjutan) {
    and.push({
      OR: [
        { kondisiRevisi: query.kondisiLanjutan },
        { kondisiRevisi: null, kondisi: query.kondisiLanjutan },
      ],
    })
  }
  if (query.tarifGolonganId) {
    and.push({
      pelanggan: { is: { tarifGolonganId: query.tarifGolonganId } },
    })
  }
  if (query.kecamatanId) {
    and.push({ pelanggan: { is: { kecamatanId: query.kecamatanId } } })
  }
  if (query.kelurahanId) {
    and.push({ pelanggan: { is: { kelurahanId: query.kelurahanId } } })
  }
  if (query.standKoreksi) {
    const adaRevisi = {
      OR: [
        { standAwalRevisi: { not: null } },
        { standAkhirRevisi: { not: null } },
        { kondisiRevisi: { not: null } },
      ],
    }
    and.push(
      query.standKoreksi === "ya"
        ? adaRevisi
        : {
            standAwalRevisi: null,
            standAkhirRevisi: null,
            kondisiRevisi: null,
          }
    )
  }
  if (query.statusSpt) {
    and.push(
      query.statusSpt === "ya"
        ? { pelanggan: { is: { status: "TUTUP_SPT" } } }
        : {
            OR: [
              { pelanggan: { is: { status: { not: "TUTUP_SPT" } } } },
              { pelanggan: null },
            ],
          }
    )
  }
  if (query.statusBaca) {
    and.push({ isVerified: query.statusBaca === "ya" })
  }
  const tanggalBaca = rentangTanggalWIB(
    query.tanggalBacaDari,
    query.tanggalBacaSampai
  )
  if (tanggalBaca) and.push({ tanggalCatat: tanggalBaca })
  if (query.kategori) and.push({ kategori: query.kategori })
  if (
    query.pemakaianRangeDari !== undefined ||
    query.pemakaianRangeSampai !== undefined
  ) {
    const pemakaian: Prisma.IntFilter = {}
    if (query.pemakaianRangeDari !== undefined)
      pemakaian.gte = query.pemakaianRangeDari
    if (query.pemakaianRangeSampai !== undefined)
      pemakaian.lte = query.pemakaianRangeSampai
    and.push({ pemakaian })
  }
  const operatorPrisma = {
    "=": "equals",
    ">": "gt",
    ">=": "gte",
    "<": "lt",
    "<=": "lte",
  } as const
  if (query.pemakaian !== undefined) {
    and.push({
      pemakaian: {
        [operatorPrisma[query.pemakaianOperator ?? "="]]: query.pemakaian,
      },
    })
  }
  if (query.persentase !== undefined) {
    and.push({
      persentase: {
        [operatorPrisma[query.persentaseOperator ?? "="]]: query.persentase,
      },
    })
  }
  for (const [parameter, kolom] of [
    ["verifWil", "verif1At"],
    ["verifKasie", "verif2At"],
    ["verifPusat", "verif3At"],
  ] as const) {
    const nilai = query[parameter]
    if (nilai) {
      and.push({
        [kolom]: nilai === "ya" ? { not: null } : null,
      })
    }
  }
  const where: Prisma.LaporanHarianPetugasWhereInput = {
    ...(tglCatat ? { tanggalCatat: tglCatat } : {}),
    periode: query.periode,
    isVerified: query.isVerified,
    pencatatId: query.pencatatId,
    pelangganId: query.pelangganId,
    kondisi: query.kondisi,
    jenisInput: query.jenisInput,
    // Lewat relasi pelanggan — rute bukan kolom laporan. Baris yang
    // pelanggannya belum ter-resolve (pelangganId null) memang ikut
    // tersaring keluar: baris tanpa pelanggan tidak punya rute.
    ...(query.ruteId ? { pelanggan: { is: { ruteId: query.ruteId } } } : {}),
    ...(query.statusVerif ? WHERE_STATUS_VERIF[query.statusVerif] : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.laporanHarianPetugas.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { tanggalCatat: "desc" }),
      ...(query.ringkas ? { select: PILIH_RINGKAS } : {}),
      ...(query.ringkas
        ? {}
        : {
            include: {
              // Tabel verifikasi (tabel.md) butuh kolom turunan pelanggan (tarif,
              // rute, W = wilayah seksi, zona), stand resmi dari pembacaan, dan
              // nama verifikator tiap ring — semuanya select sempit, bukan row utuh.
              pelanggan: {
                select: {
                  id: true,
                  nomorLangganan: true,
                  nama: true,
                  alamat: true,
                  tarifGolongan: { select: { kodeAsli: true } },
                  rute: { select: { kode: true } },
                  zona: {
                    select: {
                      kode: true,
                      wilayahSeksi: { select: { kode: true } },
                    },
                  },
                },
              },
              pencatat: { select: { id: true, namaLapangan: true } },
              pembacaan: { select: { id: true, standAkhir: true } },
              verifiedBy: { select: { id: true, name: true } },
              verif1By: { select: { id: true, name: true } },
              verif2By: { select: { id: true, name: true } },
              verif3By: { select: { id: true, name: true } },
            },
          }),
    }),
    prisma.laporanHarianPetugas.count({ where }),
  ])
  const pembacaanResmi = await ambilPembacaanResmi(
    data.map((row) => ({
      pelangganId: row.pelangganId,
      periode: row.periode,
    }))
  )
  const pemakaianPeriodeSebelumnya = await ambilPemakaianPeriodeSebelumnya(
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
  const dataDenganPembacaan = data.map((row) => ({
    ...row,
    pemakaianLalu: pilihPemakaianLalu(
      row.pemakaianLalu,
      pemakaianPeriodeSebelumnya.get(`${row.periode}:${row.pelangganId}`)
    ),
    pembacaan:
      petaPembacaan.get(`${row.pelangganId}:${row.periode}`) ??
      ("pembacaan" in row ? row.pembacaan : null),
  }))
  return { data: dataDenganPembacaan, meta: buildMeta(total, query) }
}

export async function statistikLaporanHarian(query: StatsLaporanQuery) {
  const { periode } = query
  const where = periode ? { periode } : {}
  // Ambang anomali dikonfigurasi lewat Konfigurasi (lihat komentar kolom
  // `persentase` di operasional.prisma); 50% bila belum diset.
  const konf = await prisma.konfigurasi.findUnique({
    where: { kunci: "AMBANG_ANOMALI_PERSEN" },
  })
  const ambangAnomali = Number.parseInt(konf?.nilai ?? "", 10) || 50
  const [total, menunggu, diverifikasi, ditolak, anomali, periodes] =
    await Promise.all([
      prisma.laporanHarianPetugas.count({ where }),
      prisma.laporanHarianPetugas.count({
        where: { ...where, ...WHERE_STATUS_VERIF.MENUNGGU },
      }),
      prisma.laporanHarianPetugas.count({
        where: { ...where, ...WHERE_STATUS_VERIF.DIVERIFIKASI },
      }),
      prisma.laporanHarianPetugas.count({
        where: { ...where, ...WHERE_STATUS_VERIF.DITOLAK },
      }),
      prisma.laporanHarianPetugas.count({
        where: {
          ...where,
          OR: [
            { persentase: { gt: ambangAnomali } },
            { persentase: { lt: -ambangAnomali } },
          ],
        },
      }),
      prisma.laporanHarianPetugas.groupBy({
        by: ["periode"],
        orderBy: { periode: "desc" },
        take: 24,
      }),
    ])
  return {
    total,
    menunggu,
    diverifikasi,
    ditolak,
    anomali,
    ambangAnomali,
    periodes: periodes.map((p) => p.periode),
  }
}

export async function ambilLaporanHarianById(id: string) {
  const row = await prisma.laporanHarianPetugas.findUnique({
    where: { id },
    include: {
      pelanggan: {
        include: {
          tarifGolongan: { select: { kodeAsli: true } },
          rute: { select: { kode: true } },
        },
      },
      pencatat: true,
      pembacaan: true,
      meterVerif: { select: { id: true, nomorMeter: true } },
      verifiedBy: { select: { id: true, name: true } },
      verif1By: { select: { id: true, name: true } },
      verif2By: { select: { id: true, name: true } },
      verif3By: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("LaporanHarianPetugas")
  const daftarCatat = row.pelangganId
    ? await prisma.daftarCatat.findFirst({
        where: { periode: row.periode, pelangganId: row.pelangganId },
        select: { rute: { select: { kode: true } } },
      })
    : null
  const pembacaan = row.pelangganId
    ? await ambilPembacaanResmi([
        { pelangganId: row.pelangganId, periode: row.periode },
      ])
    : []
  const pemakaianPeriodeSebelumnya = await ambilPemakaianPeriodeSebelumnya([
    { pelangganId: row.pelangganId, periode: row.periode },
  ])
  return {
    ...row,
    pemakaianLalu: pilihPemakaianLalu(
      row.pemakaianLalu,
      pemakaianPeriodeSebelumnya.get(`${row.periode}:${row.pelangganId}`)
    ),
    ruteKodeCatat: daftarCatat?.rute?.kode ?? row.pelanggan?.rute?.kode ?? null,
    pembacaan: denganSumberResmi(
      pembacaan.find((item) => item.meter.pelangganId === row.pelangganId) ??
        row.pembacaan
    ),
  }
}
