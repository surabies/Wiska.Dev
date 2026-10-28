// server/modules/publik/langganan-saya.router.ts — nomor langganan yang
// ditautkan akun warga yang SEDANG LOGIN (model LanggananWarga).
//
// Di-mount di /api/v1/langganan-saya (blanket verifyAuthFleksibel, cookie
// web ATAU Bearer mobile) TANPA requireRole: pemakainya justru role paling
// rendah (USER, akun hasil daftar mandiri). Setiap query di sini WAJIB
// terikat `userId` sesi — tidak ada jalan membaca/mengubah tautan akun lain.
//
// Batas keterbukaan data: menautkan nomor hanya butuh tahu NOMORNYA (klaim
// tidak diverifikasi kepemilikan — keputusan produk di verifikasi.ts), jadi
// endpoint ini tidak boleh membuka data melebihi endpoint publik
// GET /api/public/pelanggan/:nomorLangganan: alamat tetap disamarkan, dan
// ringkasan tagihan hanya agregat (total tunggakan) yang juga sudah terbuka
// di POST /api/public/cek-tagihan. Dua rem anti-panen tambahan:
// rate limit per-akun saat menambah + kuota maksimal tautan per akun.
import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "@db"
import type { Prisma } from "@db"
import { validate } from "../../lib/validate"
import { ok, created } from "../../lib/response"
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors"
import { cekRateLimit } from "../../lib/rate-limit"
import { getSessionUser } from "../../lib/session"
import { verifikasiPelanggan, samarkanAlamat } from "./verifikasi"

export const langgananSayaRouter = new Hono()

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
  pelangganId: string,
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
    ]),
  )
}

/// Daftar langganan tertaut akun ini — sumber kartu biodata di beranda
/// aplikasi publik. Utama selalu di urutan pertama.
langgananSayaRouter.get("/", async (c) => {
  const user = getSessionUser(c)

  const rows = await prisma.langgananWarga.findMany({
    where: { userId: user.id },
    orderBy: [{ isUtama: "desc" }, { createdAt: "asc" }],
    select: { ...LANGGANAN_SELECT, pelangganId: true },
  })

  const tunggakan = await ringkasTunggakan(rows.map((r) => r.pelangganId))
  return ok(
    c,
    rows.map((r) => bentukBaris(r, tunggakan, r.pelangganId)),
  )
})

const tambahSchema = z.object({
  nomorLangganan: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka"),
})

/// Tautkan satu nomor langganan lagi ke akun ini (pelanggan dengan lebih
/// dari satu sambungan). Tautan pertama otomatis jadi utama.
langgananSayaRouter.post("/", validate("json", tambahSchema), async (c) => {
  const user = getSessionUser(c)
  // Per-AKUN (bukan per-IP): inilah rem enumerasi nomor lewat endpoint ini
  // — pindah IP tidak menambah jatah.
  cekRateLimit(`user:${user.id}`, {
    nama: "tambah-langganan",
    maks: 10,
    jendelaMs: 15 * 60 * 1000,
  })

  const { nomorLangganan } = c.req.valid("json")

  const jumlah = await prisma.langgananWarga.count({
    where: { userId: user.id },
  })
  if (jumlah >= MAKS_TAUTAN) {
    throw new BadRequestError(
      `Maksimal ${MAKS_TAUTAN} nomor langganan per akun. Hapus salah satu tautan sebelum menambah yang baru.`,
    )
  }

  const pelanggan = await verifikasiPelanggan(nomorLangganan)

  const sudahTertaut = await prisma.langgananWarga.findUnique({
    where: {
      userId_pelangganId: { userId: user.id, pelangganId: pelanggan.id },
    },
    select: { id: true },
  })
  if (sudahTertaut)
    throw new ConflictError("Nomor langganan ini sudah tertaut ke akun Anda.")

  const baris = await prisma.langgananWarga.create({
    data: { userId: user.id, pelangganId: pelanggan.id, isUtama: jumlah === 0 },
    select: { ...LANGGANAN_SELECT, pelangganId: true },
  })

  const tunggakan = await ringkasTunggakan([baris.pelangganId])
  return created(c, bentukBaris(baris, tunggakan, baris.pelangganId))
})

/// Jadikan satu tautan sebagai utama (biodata yang tampil pertama di
/// beranda + nilai prefill formulir). Transaksi: turunkan semua, naikkan
/// satu — supaya "tepat satu utama" tidak pernah sempat dilanggar.
langgananSayaRouter.patch("/:id/utama", async (c) => {
  const user = getSessionUser(c)
  const id = c.req.param("id")

  // Terikat userId: id milik akun lain berakhir NotFound, bukan bocor.
  const milik = await prisma.langgananWarga.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })
  if (!milik) throw new NotFoundError("Tautan langganan")

  await prisma.$transaction([
    prisma.langgananWarga.updateMany({
      where: { userId: user.id },
      data: { isUtama: false },
    }),
    prisma.langgananWarga.update({ where: { id }, data: { isUtama: true } }),
  ])

  return ok(c, { pesan: "Langganan utama diperbarui." })
})

/// Lepas tautan. Tautan terakhir TIDAK boleh dilepas (akun warga selalu
/// punya minimal satu langganan — invariant yang sama dengan pendaftaran).
/// Bila yang dilepas kebetulan utama, tautan tertua yang tersisa naik jadi
/// utama supaya beranda tidak pernah kosong.
langgananSayaRouter.delete("/:id", async (c) => {
  const user = getSessionUser(c)
  const id = c.req.param("id")

  const milik = await prisma.langgananWarga.findFirst({
    where: { id, userId: user.id },
    select: { id: true, isUtama: true },
  })
  if (!milik) throw new NotFoundError("Tautan langganan")

  const jumlah = await prisma.langgananWarga.count({
    where: { userId: user.id },
  })
  if (jumlah <= 1) {
    throw new BadRequestError(
      "Nomor langganan terakhir tidak bisa dihapus — akun warga harus tetap tertaut ke minimal satu langganan.",
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.langgananWarga.delete({ where: { id } })
    if (milik.isUtama) {
      const pengganti = await tx.langgananWarga.findFirst({
        where: { userId: user.id },
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

  return ok(c, { pesan: "Tautan langganan dihapus." })
})
