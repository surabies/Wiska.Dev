// server/modules/konfigurasi/Konfigurasi.service.ts — logika bisnis key-value
// store operasional (mis. AMBANG_ANOMALI_PERSEN). `isRahasia` menyamarkan
// `nilai` di response untuk siapapun selain SUPER_ADMIN — bukan enkripsi,
// murni supaya nilai sensitif tidak nongol begitu saja di UI admin biasa.

import { prisma } from "@db"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import { BadRequestError, NotFoundError } from "../../lib/Galat"
import {
  dapatkanJendelaLaporMandiri,
  KUNCI_TANGGAL_BUKA,
  KUNCI_TANGGAL_TUTUP,
} from "../laporan/mandiri/LaporanMandiri.service"
import type {
  ListKonfigurasiQuery,
  JendelaLaporMandiriInput,
  UpsertKonfigurasiInput,
} from "./Konfigurasi.schema"

const MASK = "••••••••"

function maskIfNeeded<T extends { nilai: string; isRahasia: boolean }>(
  row: T,
  canSeeSecret: boolean
): T {
  if (!row.isRahasia || canSeeSecret) return row
  return { ...row, nilai: MASK }
}

export async function listKonfigurasi(
  query: ListKonfigurasiQuery,
  canSeeSecret: boolean
) {
  const { skip, take } = buildSkipTake(query)
  const where = query.q
    ? {
        OR: [
          { kunci: { contains: query.q, mode: "insensitive" as const } },
          { deskripsi: { contains: query.q, mode: "insensitive" as const } },
        ],
      }
    : {}
  const [data, total] = await Promise.all([
    prisma.konfigurasi.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { kunci: "asc" }),
    }),
    prisma.konfigurasi.count({ where }),
  ])
  return {
    data: data.map((row) => maskIfNeeded(row, canSeeSecret)),
    meta: buildMeta(total, query),
  }
}

export async function ambilJendelaLaporMandiri() {
  const jendela = await dapatkanJendelaLaporMandiri()
  return {
    tanggalBuka: jendela.tanggalBuka,
    tanggalTutup: jendela.tanggalTutup,
  }
}

export async function perbaruiJendelaLaporMandiri({
  tanggalBuka,
  tanggalTutup,
}: JendelaLaporMandiriInput) {
  const [konfigurasiBuka, konfigurasiTutup] = await prisma.$transaction(
    async (tx) => {
      const buka = await tx.konfigurasi.upsert({
        where: { kunci: KUNCI_TANGGAL_BUKA },
        update: { nilai: String(tanggalBuka) },
        create: {
          kunci: KUNCI_TANGGAL_BUKA,
          nilai: String(tanggalBuka),
          deskripsi: "Tanggal mulai laporan meter mandiri setiap bulan.",
          tipe: "number",
        },
      })
      const tutup = await tx.konfigurasi.upsert({
        where: { kunci: KUNCI_TANGGAL_TUTUP },
        update: { nilai: String(tanggalTutup) },
        create: {
          kunci: KUNCI_TANGGAL_TUTUP,
          nilai: String(tanggalTutup),
          deskripsi: "Tanggal akhir laporan meter mandiri setiap bulan.",
          tipe: "number",
        },
      })
      return [buka, tutup] as const
    }
  )
  return {
    tanggalBuka: Number(konfigurasiBuka.nilai),
    tanggalTutup: Number(konfigurasiTutup.nilai),
  }
}

export async function getKonfigurasiByKunci(
  kunci: string,
  canSeeSecret: boolean
) {
  const row = await prisma.konfigurasi.findUnique({
    where: { kunci },
  })
  if (!row) throw new NotFoundError("Konfigurasi")
  return maskIfNeeded(row, canSeeSecret)
}

export async function upsertKonfigurasi(
  kunci: string,
  body: UpsertKonfigurasiInput
) {
  if (kunci === KUNCI_TANGGAL_BUKA || kunci === KUNCI_TANGGAL_TUTUP) {
    throw new BadRequestError(
      "Ubah tanggal buka dan tutup sekaligus melalui /api/v1/konfigurasi/lapor-mandiri/jendela."
    )
  }
  return prisma.konfigurasi.upsert({
    where: { kunci },
    update: body,
    create: { kunci, ...body },
  })
}
