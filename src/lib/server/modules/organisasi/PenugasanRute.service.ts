// server/modules/organisasi/PenugasanRute.service.ts — logika bisnis pemetaan
// Rute↔Petugas (halaman Pemetaan Rute dashboard). Many-to-many BERURUT: satu
// pencatat banyak rute (urut `urutan`), satu rute boleh dibagi >1 pencatat
// (pengganti cuti). PERMANEN — berlaku tiap periode tanpa admin mengatur ulang;
// dibaca aplikasi mobile lewat GET /laporan-harian/rute-saya. Menggantikan
// kolom tunggal `Pencatat.ruteId` + dialog penugasan lama.
import { prisma } from "@db"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/Galat"
import { getNotifier } from "../notifikasi/Notifier"
import { buildMeta, buildSkipTake } from "../../lib/Pagination"
import type {
  RuteTanpaPetugasQuery,
  BuatPenugasanRuteInput,
  UrutanPenugasanRuteInput,
} from "./PenugasanRute.schema"

// Jumlah pelanggan (target pencatatan) per rute — filter SAMA dengan
// rute-saya: hanya soft delete yang tidak dihitung. Tidak ada status yang
// mengeluarkan sambungan dari beban kerja (lihat catatan di rute-saya).
export async function targetPerRute(
  ruteIds: string[]
): Promise<Map<string, number>> {
  if (ruteIds.length === 0) return new Map()
  const grup = await prisma.pelanggan.groupBy({
    by: ["ruteId"],
    where: { ruteId: { in: ruteIds }, deletedAt: null },
    _count: { _all: true },
  })
  return new Map(grup.map((g) => [g.ruteId as string, g._count._all]))
}

export async function listPenugasanRute(pencatatId: string) {
  const rows = await prisma.penugasanRute.findMany({
    where: { pencatatId },
    orderBy: { urutan: "asc" },
    include: {
      rute: {
        select: {
          id: true,
          kode: true,
          seksiCater: { select: { kode: true, nama: true } },
        },
      },
    },
  })
  const target = await targetPerRute(rows.map((r) => r.ruteId))
  return rows.map((r) => ({
    id: r.id,
    ruteId: r.ruteId,
    urutan: r.urutan,
    rute: r.rute,
    target: target.get(r.ruteId) ?? 0,
  }))
}

export async function getRingkasanPenugasanRute() {
  const [pencatat, penugasan] = await Promise.all([
    prisma.pencatat.findMany({
      orderBy: { namaLapangan: "asc" },
      select: {
        id: true,
        namaLapangan: true,
        namaLengkap: true,
        isAktif: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.penugasanRute.findMany({
      select: { pencatatId: true, ruteId: true },
    }),
  ])
  const target = await targetPerRute([
    ...new Set(penugasan.map((p) => p.ruteId)),
  ])
  const perPencatat = new Map<
    string,
    { jumlahRute: number; totalTarget: number }
  >()
  for (const p of penugasan) {
    const agg = perPencatat.get(p.pencatatId) ?? {
      jumlahRute: 0,
      totalTarget: 0,
    }
    agg.jumlahRute += 1
    agg.totalTarget += target.get(p.ruteId) ?? 0
    perPencatat.set(p.pencatatId, agg)
  }
  return pencatat.map((p) => ({
    ...p,
    jumlahRute: perPencatat.get(p.id)?.jumlahRute ?? 0,
    totalTarget: perPencatat.get(p.id)?.totalTarget ?? 0,
  }))
}

export async function getOpsiFilterPenugasanRute(periode?: number) {
  return periode === undefined
    ? prisma.penugasanRute.findMany({
        select: { pencatatId: true, ruteId: true },
      })
    : prisma.daftarCatat.groupBy({
        by: ["pencatatId", "ruteId"],
        where: {
          periode,
          pencatatId: { not: null },
          ruteId: { not: null },
        },
      })
}

export async function listRuteTanpaPetugas(query: RuteTanpaPetugasQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    penugasanRute: { none: {} },
    ...(query.q
      ? { kode: { contains: query.q, mode: "insensitive" as const } }
      : {}),
  }
  const [rute, total] = await Promise.all([
    prisma.rute.findMany({
      where,
      orderBy: { kode: "asc" },
      skip,
      take,
      select: {
        id: true,
        kode: true,
        seksiCater: { select: { nama: true } },
        _count: { select: { pelanggan: { where: { deletedAt: null } } } },
      },
    }),
    prisma.rute.count({ where }),
  ])
  return {
    data: rute.map((r) => ({
      id: r.id,
      kode: r.kode,
      namaSeksi: r.seksiCater.nama,
      target: r._count.pelanggan,
    })),
    meta: buildMeta(total, query),
  }
}

export async function buatPenugasanRute({
  pencatatId,
  ruteId,
}: BuatPenugasanRuteInput) {
  const [pencatat, rute, sudahAda] = await Promise.all([
    prisma.pencatat.findUnique({
      where: { id: pencatatId },
      select: { id: true, userId: true },
    }),
    prisma.rute.findUnique({
      where: { id: ruteId },
      select: { id: true, kode: true },
    }),
    prisma.penugasanRute.findUnique({
      where: { pencatatId_ruteId: { pencatatId, ruteId } },
      select: { id: true },
    }),
  ])
  if (!pencatat) throw new NotFoundError("Pencatat")
  if (!rute) throw new NotFoundError("Rute")
  if (sudahAda)
    throw new ConflictError("Rute ini sudah ditugaskan ke pencatat tersebut")

  const terakhir = await prisma.penugasanRute.aggregate({
    where: { pencatatId },
    _max: { urutan: true },
  })
  const row = await prisma.penugasanRute.create({
    data: { pencatatId, ruteId, urutan: (terakhir._max.urutan ?? -1) + 1 },
  })
  // Beri tahu petugas pemilik akun (best-effort).
  if (pencatat.userId) {
    await getNotifier().kirim([pencatat.userId], {
      judul: "Rute baca meter baru ditugaskan",
      isi: `Anda ditugaskan ke rute ${rute.kode}. Buka Baca Meter untuk mengunduhnya.`,
      tipe: "rute",
      data: { tipe: "rute", ruteId },
    })
  }
  return row
}

export async function hapusPenugasanRute(id: string) {
  const existing = await prisma.penugasanRute.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("PenugasanRute")
  await prisma.penugasanRute.delete({ where: { id } })
  return { id }
}

export async function urutkanPenugasanRute({
  pencatatId,
  ruteIds,
}: UrutanPenugasanRuteInput) {
  const milik = await prisma.penugasanRute.findMany({
    where: { pencatatId },
    select: { ruteId: true },
  })
  const setMilik = new Set(milik.map((m) => m.ruteId))
  if (
    ruteIds.length !== setMilik.size ||
    new Set(ruteIds).size !== ruteIds.length ||
    !ruteIds.every((r) => setMilik.has(r))
  ) {
    throw new BadRequestError(
      "Daftar rute tidak cocok dengan penugasan pencatat ini"
    )
  }
  await prisma.$transaction(
    ruteIds.map((ruteId, i) =>
      prisma.penugasanRute.update({
        where: { pencatatId_ruteId: { pencatatId, ruteId } },
        data: { urutan: i },
      })
    )
  )
  return { pencatatId, jumlah: ruteIds.length }
}
