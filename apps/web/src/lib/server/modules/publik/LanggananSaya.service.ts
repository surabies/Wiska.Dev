// server/modules/publik/LanggananSaya.service.ts — logika bisnis pengelolaan
// nomor langganan yang ditautkan ke akun warga yang sedang login.

import { prisma } from "@db"
import type { Prisma } from "@db"
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/Galat"
import { verifikasiPelanggan, samarkanAlamat } from "./Verifikasi"
import type { TambahLanggananInput } from "./LanggananSaya.schema"

/// Kuota tautan per akun — rumah kedua/kios masih masuk akal, memanen
/// puluhan nomor lewat satu akun tidak.
const MAKS_TAUTAN = 5

const LANGGANAN_SELECT = {
  id: true,
  isUtama: true,
  createdAt: true,
  pelanggan: {
    select: {
      nomorLangganan: true,
      nama: true,
      alamat: true,
      rt: true,
      rw: true,
      status: true,
      tarifGolongan: { select: { kodeAsli: true, kategori: true } },
    },
  },
} satisfies Prisma.LanggananWargaSelect

type BarisLangganan = Prisma.LanggananWargaGetPayload<{
  select: typeof LANGGANAN_SELECT
}>

/// Bentuk satu baris untuk client: biodata (alamat disamarkan) + ringkasan
/// tunggakan agregat. `tunggakan` = map pelangganId -> {jumlah, total}.
function bentukBaris(
  baris: BarisLangganan,
  tunggakan: Map<string, { jumlah: number; total: number }>,
  pelangganId: string
) {
  const t = tunggakan.get(pelangganId)
  return {
    id: baris.id,
    isUtama: baris.isUtama,
    createdAt: baris.createdAt,
    nomorLangganan: baris.pelanggan.nomorLangganan,
    nama: baris.pelanggan.nama,
    alamat: samarkanAlamat(baris.pelanggan.alamat),
    rt: baris.pelanggan.rt,
    rw: baris.pelanggan.rw,
    status: baris.pelanggan.status,
    tarifGolongan: baris.pelanggan.tarifGolongan,
    jumlahTagihanBelumBayar: t?.jumlah ?? 0,
    totalTunggakan: t?.total ?? 0,
  }
}

async function ringkasTunggakan(pelangganIds: string[]) {
  if (pelangganIds.length === 0)
    return new Map<string, { jumlah: number; total: number }>()
  const grup = await prisma.tagihan.groupBy({
    by: ["pelangganId"],
    where: {
      pelangganId: { in: pelangganIds },
      status: { in: ["BELUM_BAYAR", "JATUH_TEMPO"] },
    },
    _count: { _all: true },
    _sum: { totalTagihan: true },
  })
  return new Map(
    grup.map((g) => [
      g.pelangganId,
      { jumlah: g._count._all, total: g._sum.totalTagihan ?? 0 },
    ])
  )
}

/// Daftar langganan tertaut akun ini — sumber kartu biodata di beranda
/// aplikasi publik. Utama selalu di urutan pertama.
export async function daftarLanggananSaya(userId: string) {
  const rows = await prisma.langgananWarga.findMany({
    where: { userId },
    orderBy: [{ isUtama: "desc" }, { createdAt: "asc" }],
    select: { ...LANGGANAN_SELECT, pelangganId: true },
  })

  const tunggakan = await ringkasTunggakan(rows.map((r) => r.pelangganId))
  return rows.map((r) => bentukBaris(r, tunggakan, r.pelangganId))
}

/// Tautkan satu nomor langganan lagi ke akun ini (pelanggan dengan lebih
/// dari satu sambungan). Tautan pertama otomatis jadi utama.
export async function tambahLanggananSaya(
  userId: string,
  { nomorLangganan }: TambahLanggananInput
) {
  const jumlah = await prisma.langgananWarga.count({
    where: { userId },
  })
  if (jumlah >= MAKS_TAUTAN) {
    throw new BadRequestError(
      `Maksimal ${MAKS_TAUTAN} nomor langganan per akun. Hapus salah satu tautan sebelum menambah yang baru.`
    )
  }

  const pelanggan = await verifikasiPelanggan(nomorLangganan)

  const sudahTertaut = await prisma.langgananWarga.findUnique({
    where: {
      userId_pelangganId: { userId, pelangganId: pelanggan.id },
    },
    select: { id: true },
  })
  if (sudahTertaut)
    throw new ConflictError("Nomor langganan ini sudah tertaut ke akun Anda.")

  const baris = await prisma.langgananWarga.create({
    data: { userId, pelangganId: pelanggan.id, isUtama: jumlah === 0 },
    select: { ...LANGGANAN_SELECT, pelangganId: true },
  })

  const tunggakan = await ringkasTunggakan([baris.pelangganId])
  return bentukBaris(baris, tunggakan, baris.pelangganId)
}

/// Jadikan satu tautan sebagai utama (biodata yang tampil pertama di
/// beranda + nilai prefill formulir). Transaksi: turunkan semua, naikkan
/// satu — supaya "tepat satu utama" tidak pernah sempat dilanggar.
export async function jadikanLanggananUtama(userId: string, id: string) {
  // Terikat userId: id milik akun lain berakhir NotFound, bukan bocor.
  const milik = await prisma.langgananWarga.findFirst({
    where: { id, userId },
    select: { id: true },
  })
  if (!milik) throw new NotFoundError("Tautan langganan")

  await prisma.$transaction([
    prisma.langgananWarga.updateMany({
      where: { userId },
      data: { isUtama: false },
    }),
    prisma.langgananWarga.update({ where: { id }, data: { isUtama: true } }),
  ])

  return { pesan: "Langganan utama diperbarui." }
}

/// Lepas tautan. Tautan terakhir TIDAK boleh dilepas (akun warga selalu
/// punya minimal satu langganan — invariant yang sama dengan pendaftaran).
/// Bila yang dilepas kebetulan utama, tautan tertua yang tersisa naik jadi
/// utama supaya beranda tidak pernah kosong.
export async function hapusLanggananSaya(userId: string, id: string) {
  const milik = await prisma.langgananWarga.findFirst({
    where: { id, userId },
    select: { id: true, isUtama: true },
  })
  if (!milik) throw new NotFoundError("Tautan langganan")

  const jumlah = await prisma.langgananWarga.count({
    where: { userId },
  })
  if (jumlah <= 1) {
    throw new BadRequestError(
      "Nomor langganan terakhir tidak bisa dihapus — akun warga harus tetap tertaut ke minimal satu langganan."
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.langgananWarga.delete({ where: { id } })
    if (milik.isUtama) {
      const pengganti = await tx.langgananWarga.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
      if (pengganti) {
        await tx.langgananWarga.update({
          where: { id: pengganti.id },
          data: { isUtama: true },
        })
      }
    }
  })

  return { pesan: "Tautan langganan dihapus." }
}
