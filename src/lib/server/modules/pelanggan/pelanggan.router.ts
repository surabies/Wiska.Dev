// server/modules/pelanggan/pelanggan.router.ts — endpoint HTTP tipis di
// atas pelanggan.service.ts. Route statis (/near) didaftarkan SEBELUM
// route param (/:id) supaya Hono tidak mencoba mencocokkan "near" sebagai
// :id lebih dulu.
import { z } from "zod"
import { Hono } from "hono"
import { prisma } from "@db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import {
  createPelangganSchema,
  updatePelangganSchema,
  listPelangganQuerySchema,
  nearPelangganQuerySchema,
} from "./pelanggan.schema"
import * as service from "./pelanggan.service"
import { BadRequestError } from "../../lib/errors"
import { auditMetaFromRequest } from "../../lib/audit"
import { imporMasterSti } from "./master-sti.service"
import { imporPbpk } from "./pbpk.service"

export const pelangganRouter = new Hono()

// ── Master pelanggan STI (PEL{periode}-PW5.csv) ──────────────────────────
// SENGAJA DUA ENDPOINT, bukan satu dengan flag. Pratinjau tidak menulis dan
// boleh dijalankan manajemen untuk memeriksa berkas; penerapan menyentuh 22
// ribu baris pelanggan sekaligus dan disamakan kewenangannya dengan closing
// (SENIOR_UP). Memisahkannya membuat "siapa boleh melihat" dan "siapa boleh
// mengubah" tidak bergantung pada isi body request.

/// Batas ukuran berkas. Master nyata ~2,5 MB; 20 MB memberi ruang besar
/// tanpa membuka pintu unggahan yang membekukan proses.
const MAKS_BERKAS_BYTE = 20 * 1024 * 1024

async function bacaBerkasMaster(req: Request): Promise<string> {
  const form = await req.formData()
  const berkas = form.get("berkas")
  if (!(berkas instanceof File)) {
    throw new BadRequestError("Lampirkan berkas master pada field `berkas`.")
  }
  if (berkas.size === 0) throw new BadRequestError("Berkas master kosong.")
  if (berkas.size > MAKS_BERKAS_BYTE) {
    throw new BadRequestError("Ukuran berkas melebihi 20 MB.")
  }
  return berkas.text()
}

// ── Sambungan yang perlu dipetakan ke rute ──────────────────────────────
// Endpoint tersendiri, BUKAN filter di /pelanggan biasa: pertanyaannya bukan
// "pelanggan mana yang rutenya X" melainkan "siapa yang JATUH DI CELAH" —
// belum punya rute sama sekali, atau rutenya belum ditugaskan ke pencatat
// mana pun. Keduanya berakibat sama: tidak muncul di beban kerja siapa pun,
// jadi tidak dikunjungi, tidak dicatat, tidak tertagih.
//
// Sekalian mengembalikan daftar rute + pencatatnya, supaya layar pemetaan
// tidak perlu memanggil dua endpoint hanya untuk mengisi satu dropdown.
const perluRuteQuerySchema = z.object({
  /// Periode yang sedang dikerjakan. Bila diisi, SELURUH sambungan PBPK
  /// periode itu ikut ditampilkan — termasuk yang rutenya SUDAH terisi.
  ///
  /// Kenapa yang sudah terisi pun ikut: rute pada berkas PBPK datang dari
  /// bagian langganan dan bisa salah, sedangkan kode rute lama pada baris PK
  /// kerap sudah dihapus atau digabung. Menyembunyikan yang "sudah terpetakan"
  /// membuat kesalahan itu tidak bisa dikoreksi di mana pun — operator baru
  /// menyadarinya bulan depan, saat sambungannya masuk daftar kerja petugas
  /// yang keliru.
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

pelangganRouter.get(
  "/perlu-rute",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", perluRuteQuerySchema),
  async (c) => {
    const { periode } = c.req.valid("query")
    const [tanpaRute, ruteTanpaPencatat, rute] = await Promise.all([
      prisma.pelanggan.findMany({
        where: {
          deletedAt: null,
          status: "AKTIF",
          ...(periode
            ? {
                OR: [
                  { ruteId: null },
                  { daftarCatat: { some: { periode, sumber: "PBPK" } } },
                ],
              }
            : { ruteId: null }),
        },
        select: {
          id: true,
          nomorLangganan: true,
          nama: true,
          alamat: true,
          rt: true,
          rw: true,
          ruteId: true,
          noUrutRute: true,
          kelurahan: { select: { nama: true } },
          rute: { select: { kode: true } },
          // Sudah punya laporan periode ini? Itu penanda "pekerjaannya selesai"
          // — barisnya tetap ditampilkan supaya rutenya masih bisa dikoreksi,
          // tapi tidak lagi dihitung sebagai pekerjaan yang menunggu.
          laporanHarian: periode
            ? { where: { periode }, select: { id: true }, take: 1 }
            : { where: { id: "-" }, select: { id: true }, take: 1 },
        },
        orderBy: { nomorLangganan: "asc" },
        take: 500,
      }),
      prisma.pelanggan.findMany({
        where: {
          deletedAt: null,
          status: "AKTIF",
          ruteId: { not: null },
          rute: { penugasanRute: { none: {} } },
        },
        select: {
          id: true,
          nomorLangganan: true,
          nama: true,
          alamat: true,
          rt: true,
          rw: true,
          ruteId: true,
          noUrutRute: true,
          kelurahan: { select: { nama: true } },
          rute: { select: { kode: true } },
        },
        orderBy: { nomorLangganan: "asc" },
        take: 500,
      }),
      prisma.rute.findMany({
        select: {
          id: true,
          kode: true,
          penugasanRute: {
            select: { pencatat: { select: { namaLapangan: true } } },
            take: 1,
          },
        },
        orderBy: { kode: "asc" },
      }),
    ])

    return ok(c, {
      // `kelurahan` diratakan jadi teks: layar hanya menampilkannya, dan
      // mengirim objek bersarang untuk satu nama cuma menambah kedalaman yang
      // harus dibongkar di sisi klien.
      // kodeRute DIAMBIL dari relasinya, bukan dipaksa null. Dulu daftar ini
      // hanya berisi sambungan tanpa rute sehingga null selalu benar; sejak ia
      // juga memuat seluruh PBPK periode berjalan, memaksa null menyembunyikan
      // rute yang SUDAH terisi — persis yang perlu dilihat operator untuk tahu
      // apakah rutenya keliru.
      tanpaRute: tanpaRute.map(({ kelurahan, rute, laporanHarian, ...p }) => ({
        ...p,
        kelurahan: kelurahan?.nama ?? null,
        kodeRute: rute?.kode ?? null,
        sudahDicatat: laporanHarian.length > 0,
      })),
      ruteTanpaPencatat: ruteTanpaPencatat.map(({ rute, kelurahan, ...p }) => ({
        ...p,
        kelurahan: kelurahan?.nama ?? null,
        kodeRute: rute?.kode ?? null,
        sudahDicatat: false,
      })),
      rute: rute.map((r) => ({
        id: r.id,
        kode: r.kode,
        pencatat: r.penugasanRute[0]?.pencatat.namaLapangan ?? null,
      })),
    })
  },
)

// ── PBPK (pasang baru / pasang kembali) ─────────────────────────────────
// Pola dua endpoint yang sama dengan master. `periode` WAJIB dikirim —
// berkas PBPK tidak punya kolom periode dan namanya bervariasi, jadi
// menebaknya dari nama berkas berarti satu penggantian nama diam-diam
// memasukkan sambungan ke bulan yang salah.
async function bacaBerkasPbpk(req: Request): Promise<{
  berkas: { nama: string; teks?: string; buffer?: ArrayBuffer }
  periode: number
}> {
  const form = await req.formData()
  const f = form.get("berkas")
  if (!(f instanceof File))
    throw new BadRequestError("Lampirkan berkas PBPK pada field `berkas`.")
  if (f.size === 0) throw new BadRequestError("Berkas PBPK kosong.")
  if (f.size > MAKS_BERKAS_BYTE)
    throw new BadRequestError("Ukuran berkas melebihi 20 MB.")

  const periode = Number(form.get("periode"))
  if (
    !Number.isInteger(periode) ||
    periode < 190001 ||
    periode > 999912 ||
    periode % 100 < 1 ||
    periode % 100 > 12
  ) {
    throw new BadRequestError(
      "Field `periode` wajib diisi dalam bentuk TTTTBB (mis. 202606).",
    )
  }

  const excel = /\.xlsx?$/i.test(f.name)
  return {
    berkas: excel
      ? { nama: f.name, buffer: await f.arrayBuffer() }
      : { nama: f.name, teks: await f.text() },
    periode,
  }
}

pelangganRouter.post(
  "/impor-pbpk/pratinjau",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    const { berkas, periode } = await bacaBerkasPbpk(c.req.raw)
    return ok(
      c,
      await imporPbpk({
        berkas,
        periode,
        terapkan: false,
        olehUserId: requester.id,
      }),
    )
  },
)

pelangganRouter.post(
  "/impor-pbpk",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  async (c) => {
    const requester = getSessionUser(c)
    const { berkas, periode } = await bacaBerkasPbpk(c.req.raw)
    return ok(
      c,
      await imporPbpk({
        berkas,
        periode,
        terapkan: true,
        olehUserId: requester.id,
        jejak: auditMetaFromRequest(c.req.raw),
      }),
    )
  },
)

pelangganRouter.post(
  "/impor-master/pratinjau",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    return ok(
      c,
      await imporMasterSti({
        teks: await bacaBerkasMaster(c.req.raw),
        terapkan: false,
        terapkanStatus: false,
        olehUserId: requester.id,
      }),
    )
  },
)

pelangganRouter.post(
  "/impor-master",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  async (c) => {
    const requester = getSessionUser(c)
    // `terapkanStatus` harus diminta EKSPLISIT. Perubahan status (tutupan /
    // pembukaan kembali) berkonsekuensi ke tagihan, jadi tidak ikut terbawa
    // hanya karena berkasnya diunggah.
    const terapkanStatus =
      new URL(c.req.url).searchParams.get("terapkanStatus") === "true"
    return ok(
      c,
      await imporMasterSti({
        teks: await bacaBerkasMaster(c.req.raw),
        terapkan: true,
        terapkanStatus,
        olehUserId: requester.id,
        jejak: auditMetaFromRequest(c.req.raw),
      }),
    )
  },
)

pelangganRouter.get(
  "/near",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", nearPelangganQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const data = await service.findPelangganNear(query)
    return ok(c, data)
  },
)

pelangganRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("query", listPelangganQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const requester = getSessionUser(c)
    const { data, meta } = await service.listPelanggan(query, requester)
    return paginated(c, data, meta)
  },
)

pelangganRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.getPelangganById(c.req.param("id"), requester)
  return ok(c, row)
})

pelangganRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", createPelangganSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.createPelanggan(
      c.req.valid("json"),
      requester,
      c.req.raw,
    )
    return created(c, row)
  },
)

pelangganRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", updatePelangganSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.updatePelanggan(
      c.req.param("id"),
      c.req.valid("json"),
      requester,
      c.req.raw,
    )
    return ok(c, row)
  },
)

pelangganRouter.delete(
  "/:id",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.softDeletePelanggan(
      c.req.param("id"),
      requester,
      c.req.raw,
    )
    return ok(c, row)
  },
)

pelangganRouter.post(
  "/:id/restore",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.restorePelanggan(
      c.req.param("id"),
      requester,
      c.req.raw,
    )
    return ok(c, row)
  },
)
