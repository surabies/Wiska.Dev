// server/modules/pelanggan/pelanggan.service.ts — business logic Pelanggan:
// soft delete, FK opsional (Prisma P2003 -> 400 lewat errorHandler kalau
// referensinya tidak ada, tidak perlu dicek manual di sini), koordinat lewat
// spatial.ts, dan audit trail utk create/update/delete/restore.
import type { Prisma } from "@db"
import { prisma } from "@db"
import { bacaAsalUsul, KOLOM_TERJAGA } from "@/lib/domain/AsalUsul"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/Galat"
import {
  GEO,
  setPoint,
  clearPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
  findNearby,
  type GeoJsonPoint,
} from "../../lib/Spatial"
import { recordAudit, auditMetaFromRequest } from "../../lib/Audit"
import { ROLE_GROUPS } from "../../middleware/RBAC"
import type { SessionUser } from "../../lib/Sesi"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import type {
  CreatePelangganInput,
  UpdatePelangganInput,
  ListPelangganQuery,
  PerluRuteQuery,
} from "./Pelanggan.schema"
import { imporMasterSti } from "./MasterSti.service"
import { imporPbpk } from "./PBPK.service"

const LIST_INCLUDE = {
  tarifGolongan: { select: { kode: true, nama: true } },
  seksiCater: { select: { kode: true, nama: true } },
  zona: { select: { kode: true, nama: true } },
  kecamatan: { select: { kode: true, nama: true } },
  kelurahan: { select: { kode: true, nama: true } },
} satisfies Prisma.PelangganInclude

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  golonganBesar: true,
  dma: true,
  rute: true,
  author: { select: { id: true, name: true, email: true } },
  lastEditor: { select: { id: true, name: true, email: true } },
  meter: { where: { isAktif: true } },
} satisfies Prisma.PelangganInclude

function isManagement(role: SessionUser["role"]) {
  return (ROLE_GROUPS.MANAGEMENT_UP as readonly string[]).includes(role)
}

/// Jam "HH:mm" -> Date bertipe TIME (Prisma @db.Time). Konvensi sama persis
/// dengan prisma/seed/lib/normalize.ts#parseTimeOfDay — epoch 1970-01-01
/// UTC, hanya jam:menit yang relevan (Postgres TIME mengabaikan tanggal).
function parseTimeOfDay(hhmm: string): Date {
  const [hour, minute] = hhmm.split(":").map(Number)
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0))
}

function toGeoJsonPoint(koordinat: { lat: number; lng: number }): GeoJsonPoint {
  return { type: "Point", coordinates: [koordinat.lng, koordinat.lat] }
}

function buildStringFilter(
  value: string,
  operator: ListPelangganQuery["namaOperator"] | undefined,
  caseInsensitive = true
) {
  const filter =
    operator === "equals"
      ? { equals: value }
      : operator === "startsWith"
        ? { startsWith: value }
        : { contains: value }
  return caseInsensitive ? { ...filter, mode: "insensitive" as const } : filter
}

export async function listPelanggan(
  query: ListPelangganQuery,
  requester: SessionUser
) {
  const { skip, take } = buildSkipTake(query)
  const showDeleted = query.includeDeleted && isManagement(requester.role)

  const where: Prisma.PelangganWhereInput = {
    deletedAt: showDeleted ? undefined : null,
    status: query.status,
    nomorLangganan: query.nomorLangganan
      ? buildStringFilter(
          query.nomorLangganan,
          query.nomorLanggananOperator,
          false
        )
      : undefined,
    nama: query.nama
      ? buildStringFilter(query.nama, query.namaOperator)
      : undefined,
    alamat: query.alamat
      ? buildStringFilter(query.alamat, query.alamatOperator)
      : undefined,
    rt: query.rt
      ? buildStringFilter(query.rt, query.rtOperator, false)
      : undefined,
    rw: query.rw
      ? buildStringFilter(query.rw, query.rwOperator, false)
      : undefined,
    kecamatan: query.kecamatan
      ? {
          is: {
            nama: buildStringFilter(query.kecamatan, query.kecamatanOperator),
          },
        }
      : undefined,
    kelurahan: query.kelurahan
      ? {
          is: {
            nama: buildStringFilter(query.kelurahan, query.kelurahanOperator),
          },
        }
      : undefined,
    tarifGolongan: query.golTarif
      ? { is: { kode: query.golTarif } }
      : undefined,
    seksiCaterId: query.seksiCaterId,
    ruteId: query.ruteId,
    zonaId: query.zonaId,
    kecamatanId: query.kecamatanId,
    kelurahanId: query.kelurahanId,
    tarifGolonganId: query.tarifGolonganId,
    ...(query.q
      ? {
          OR: [
            { nama: { contains: query.q, mode: "insensitive" } },
            { nomorLangganan: { contains: query.q } },
            { alamat: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.pelanggan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { nama: "asc" }),
      include: LIST_INCLUDE,
    }),
    prisma.pelanggan.count({ where }),
  ])

  const koordinatMap = await getPointGeoJsonMany(
    prisma,
    GEO.pelanggan,
    rows.map((r) => r.id)
  )
  const data = rows.map((r) => ({
    ...r,
    koordinat: koordinatMap.get(r.id) ?? null,
  }))
  return { data, meta: buildMeta(total, query) }
}

export async function getPelangganById(id: string, requester: SessionUser) {
  const row = await prisma.pelanggan.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  })
  if (!row) throw new NotFoundError("Pelanggan")
  if (row.deletedAt && !isManagement(requester.role))
    throw new NotFoundError("Pelanggan")
  const koordinat = await getPointGeoJson(prisma, GEO.pelanggan, id)
  return { ...row, koordinat }
}

export async function createPelanggan(
  input: CreatePelangganInput,
  requester: SessionUser,
  req: Request
) {
  const { koordinat, jamGilirMulai, jamGilirSelesai, ...rest } = input
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.pelanggan.create({
      data: {
        ...rest,
        jamGilirMulai: jamGilirMulai ? parseTimeOfDay(jamGilirMulai) : null,
        jamGilirSelesai: jamGilirSelesai
          ? parseTimeOfDay(jamGilirSelesai)
          : null,
        authorId: requester.id,
        lastEditorId: requester.id,
      },
    })
    if (koordinat)
      await setPoint(tx, GEO.pelanggan, row.id, koordinat.lat, koordinat.lng)
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "CREATE",
      entitas: "Pelanggan",
      entitasId: row.id,
      perubahan: { after: row },
      ipAddress,
      userAgent,
    })
    return row
  })

  return { ...row, koordinat: koordinat ? toGeoJsonPoint(koordinat) : null }
}

export async function updatePelanggan(
  id: string,
  input: UpdatePelangganInput,
  requester: SessionUser,
  req: Request
) {
  const existing = await prisma.pelanggan.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new NotFoundError("Pelanggan")

  const { koordinat, jamGilirMulai, jamGilirSelesai, ...rest } = input
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  // Suntingan lewat layar adalah keputusan MANUSIA — peringkat tertinggi di
  // src/lib/domain/AsalUsul.ts. Menandainya di sini yang membuat koreksi
  // petugas tidak dikembalikan oleh impor ProgresCater/master berikutnya.
  // Tidak lewat saringPerubahan: manusia tidak pernah kalah peringkat, jadi
  // yang perlu hanyalah mencatat kolom terjaga mana yang benar-benar dikirim.
  const asalUsul = bacaAsalUsul(existing.sumberKolom)
  let adaKolomTerjaga = false
  for (const kolom of KOLOM_TERJAGA) {
    if (rest[kolom as keyof typeof rest] === undefined) continue
    asalUsul[kolom] = "MANUSIA"
    adaKolomTerjaga = true
  }

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.pelanggan.update({
      where: { id },
      data: {
        ...rest,
        jamGilirMulai:
          jamGilirMulai === undefined
            ? undefined
            : jamGilirMulai
              ? parseTimeOfDay(jamGilirMulai)
              : null,
        jamGilirSelesai:
          jamGilirSelesai === undefined
            ? undefined
            : jamGilirSelesai
              ? parseTimeOfDay(jamGilirSelesai)
              : null,
        lastEditorId: requester.id,
        ...(adaKolomTerjaga ? { sumberKolom: asalUsul } : {}),
      },
    })
    if (koordinat !== undefined) {
      if (koordinat === null) await clearPoint(tx, GEO.pelanggan, id)
      else await setPoint(tx, GEO.pelanggan, id, koordinat.lat, koordinat.lng)
    }
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "UPDATE",
      entitas: "Pelanggan",
      entitasId: id,
      perubahan: { before: existing, after: row },
      ipAddress,
      userAgent,
    })
    return row
  })

  const finalKoordinat =
    koordinat !== undefined
      ? koordinat
        ? toGeoJsonPoint(koordinat)
        : null
      : await getPointGeoJson(prisma, GEO.pelanggan, id)
  return { ...row, koordinat: finalKoordinat }
}

export async function softDeletePelanggan(
  id: string,
  requester: SessionUser,
  req: Request
) {
  const existing = await prisma.pelanggan.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) throw new NotFoundError("Pelanggan")
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  return prisma.$transaction(async (tx) => {
    const row = await tx.pelanggan.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "DELETE",
      entitas: "Pelanggan",
      entitasId: id,
      ipAddress,
      userAgent,
    })
    return row
  })
}

export async function restorePelanggan(
  id: string,
  requester: SessionUser,
  req: Request
) {
  const existing = await prisma.pelanggan.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Pelanggan")
  if (!existing.deletedAt)
    throw new ConflictError("Pelanggan tidak sedang dalam status terhapus")
  const { ipAddress, userAgent } = auditMetaFromRequest(req)

  return prisma.$transaction(async (tx) => {
    const row = await tx.pelanggan.update({
      where: { id },
      data: { deletedAt: null },
    })
    await recordAudit(tx, {
      userId: requester.id,
      aksi: "RESTORE",
      entitas: "Pelanggan",
      entitasId: id,
      ipAddress,
      userAgent,
    })
    return row
  })
}

export async function findPelangganNear(params: {
  lat: number
  lng: number
  radius: number
  limit: number
}) {
  const nearby = await findNearby(prisma, GEO.pelanggan, {
    lat: params.lat,
    lng: params.lng,
    radiusMeters: params.radius,
    limit: params.limit,
  })
  if (nearby.length === 0) return []

  const rows = await prisma.pelanggan.findMany({
    where: { id: { in: nearby.map((r) => r.id) }, deletedAt: null },
    select: {
      id: true,
      nomorLangganan: true,
      nama: true,
      alamat: true,
      status: true,
    },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  return nearby
    .map((r) => ({ ...byId.get(r.id), jarakMeter: r.jarakMeter }))
    .filter(
      (r): r is (typeof rows)[number] & { jarakMeter: number } =>
        r.id !== undefined
    )
}

// ── Master pelanggan STI (PEL{periode}-PW5.csv) & PBPK ───────────────────
/// Batas ukuran berkas. Master nyata ~2,5 MB; 20 MB memberi ruang besar
/// tanpa membuka pintu unggahan yang membekukan proses.
const MAKS_BERKAS_BYTE = 20 * 1024 * 1024

export async function bacaBerkasMaster(req: Request): Promise<string> {
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

// `periode` WAJIB dikirim — berkas PBPK tidak punya kolom periode dan namanya
// bervariasi, jadi menebaknya dari nama berkas berarti satu penggantian nama
// diam-diam memasukkan sambungan ke bulan yang salah.
export async function bacaBerkasPbpk(req: Request): Promise<{
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
      "Field `periode` wajib diisi dalam bentuk TTTTBB (mis. 202606)."
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

export async function pratinjauImporPbpk(req: Request, requester: SessionUser) {
  const { berkas, periode } = await bacaBerkasPbpk(req)
  return imporPbpk({
    berkas,
    periode,
    terapkan: false,
    olehUserId: requester.id,
  })
}

export async function terapkanImporPbpk(req: Request, requester: SessionUser) {
  const { berkas, periode } = await bacaBerkasPbpk(req)
  return imporPbpk({
    berkas,
    periode,
    terapkan: true,
    olehUserId: requester.id,
    jejak: auditMetaFromRequest(req),
  })
}

export async function pratinjauImporMaster(
  req: Request,
  requester: SessionUser
) {
  return imporMasterSti({
    teks: await bacaBerkasMaster(req),
    terapkan: false,
    terapkanStatus: false,
    olehUserId: requester.id,
  })
}

export async function terapkanImporMaster(
  req: Request,
  terapkanStatus: boolean,
  requester: SessionUser
) {
  return imporMasterSti({
    teks: await bacaBerkasMaster(req),
    terapkan: true,
    terapkanStatus,
    olehUserId: requester.id,
    jejak: auditMetaFromRequest(req),
  })
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
export async function getPelangganPerluRute({ periode }: PerluRuteQuery) {
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

  return {
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
  }
}
