// server/modules/pemutusan/Pemutusan.service.ts — logika bisnis dan kueri
// database untuk riwayat pemutusan sambungan (TSM/SPT dari closing resmi,
// LAINNYA dari survei lapangan).
//
// KEPUTUSAN PENTING (konsisten dengan seed, lihat prisma/docs/README.md):
// mencatat pemutusan TIDAK PERNAH mengubah `Pelanggan.status` sebagai efek
// samping. Pencatatan pemutusan dan perubahan status pelanggan adalah dua
// keputusan bisnis terpisah, supaya tidak ada perubahan tersembunyi di data
// billing.
//
// Perubahan status punya pintunya sendiri yang HARUS ditekan manusia:
// POST /pemutusan/terapkan-status (pratinjau dulu, lalu setujui),
// atau PATCH /pelanggan/:id untuk satu pelanggan. Yang dilarang adalah
// otomatisnya, bukan perubahannya.
//
// `pelangganId` opsional: 219 titik "Eks Pelanggan" dari survei geojson
// adalah histori cabut lama yang nolg-nya kerap tidak ada di tabel
// Pelanggan. Snapshot `nomorLangganan`/`namaPelanggan` tetap diisi supaya
// baris orphan tidak kehilangan identitas.
import type { JenisPemutusan, StatusPelanggan } from "@db"
import { prisma } from "@db"
import { NotFoundError } from "../../lib/Galat"
import { recordAudit } from "../../lib/Audit"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import {
  GEO,
  setPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
} from "../../lib/Spatial"
import type {
  ListPemutusanQuery,
  CreatePemutusanInput,
  TerapkanStatusPemutusanInput,
} from "./Pemutusan.schema"

// ── Terapkan status pelanggan dari pemutusan ─────────────────────────────
//
// KENAPA ADA, DAN KENAPA BENTUKNYA BEGINI. Kepala berkas ini menyatakan
// pemutusan tidak pernah mengubah Pelanggan.status otomatis, dan itu tetap
// berlaku. Yang keliru selama ini bukan aturannya, melainkan tidak adanya
// PINTU: satu-satunya jalur yang pernah mengubah status adalah unggah master
// STI dan PATCH /pelanggan/:id satu per satu. Akibatnya terukur — 34
// sambungan yang sudah dicabut Maret–Juni masih berstatus AKTIF, dan angka
// "pelanggan aktif" di layar data pelanggan meleset sebanyak itu.
//
// Jadi pintunya dibuka, tapi tetap DITEKAN MANUSIA: seorang supervisor
// memilih periodenya, melihat pratinjau baris demi baris, lalu menyetujui.
// Tidak ada yang berubah sebagai efek samping impor atau closing.
//
// STATUS TUJUAN DITURUNKAN DARI `jenis`, TIDAK DITANYAKAN KE PEMANGGIL.
// TSM -> TUTUP_SEMENTARA, SPT -> TUTUP_SPT: pemetaan yang sama dengan
// STATUS_DARI_MUTASI di master-sti.service.ts (mutasikode 5 & 4). Baris
// berjenis LAINNYA ("terkonfirmasi cabut, jenis belum diketahui") SENGAJA
// tidak ditebak — ia dilewati dan dilaporkan, supaya yang perlu ditentukan
// manusia terlihat jelas alih-alih diam-diam jadi TUTUP_SEMENTARA.
const STATUS_DARI_JENIS: Partial<Record<JenisPemutusan, StatusPelanggan>> = {
  TSM: "TUTUP_SEMENTARA",
  SPT: "TUTUP_SPT",
}

export interface BarisTerap {
  pemutusanId: string
  nomorLangganan: string | null
  namaPelanggan: string | null
  jenis: string
  statusSekarang: StatusPelanggan | null
  statusTujuan: StatusPelanggan | null
  tindakan:
    | "AKAN_DIUBAH"
    | "SUDAH_SESUAI"
    | "TANPA_PELANGGAN"
    | "JENIS_BELUM_PASTI"
    | "TERSAMBUNG_KEMBALI"
}

export async function listPemutusan(query: ListPemutusanQuery) {
  const { skip, take } = buildSkipTake(query)
  const where = {
    pelangganId: query.pelangganId,
    jenis: query.jenis,
    periode: query.periode,
    sumberData: query.sumberData,
    ...(query.q
      ? {
          OR: [
            { nomorLangganan: { contains: query.q } },
            {
              namaPelanggan: {
                contains: query.q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.pemutusan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
      include: {
        pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        kelurahan: { select: { id: true, nama: true } },
      },
    }),
    prisma.pemutusan.count({ where }),
  ])
  const koord = await getPointGeoJsonMany(
    prisma,
    GEO.pemutusan,
    rows.map((r) => r.id)
  )
  return {
    data: rows.map((r) => ({
      ...r,
      koordinatVerifikasi: koord.get(r.id) ?? null,
    })),
    meta: buildMeta(total, query),
  }
}

export async function getPemutusanById(id: string) {
  const row = await prisma.pemutusan.findUnique({
    where: { id },
    include: { pelanggan: true, kelurahan: true, kecamatan: true },
  })
  if (!row) throw new NotFoundError("Pemutusan")
  return {
    ...row,
    koordinatVerifikasi: await getPointGeoJson(prisma, GEO.pemutusan, id),
  }
}

export async function createPemutusan(
  input: CreatePemutusanInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { koordinatVerifikasi, ...body } = input
  const { ipAddress, userAgent } = auditMeta

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.pemutusan.create({
      data: { ...body, sumberData: "API", prosesOlehId: requesterId },
    })
    if (koordinatVerifikasi)
      await setPoint(
        tx,
        GEO.pemutusan,
        row.id,
        koordinatVerifikasi.lat,
        koordinatVerifikasi.lng
      )

    // TANDAI DAFTAR CATAT PERIODE ITU SEBAGAI DICABUT.
    //
    // Inilah yang membuat pemutusan benar-benar berpengaruh pada siklus.
    // Tanpa baris ini, sambungan yang dicabut lewat aplikasi TETAP muncul di
    // daftar kerja bulan berikutnya — terus dikunjungi dan terus ditagih —
    // karena "buka bulan baru" mengeluarkan pelanggan berdasarkan tanda
    // DICABUT di daftar catat, bukan berdasarkan tabel Pemutusan.
    // Sebelumnya tanda itu HANYA pernah dibuat oleh skrip seed dari
    // r-nomor.csv, sehingga cabutan dari aplikasi tidak berefek sama sekali.
    //
    // Barisnya tidak dihapus, hanya ditandai: beban kerja periode berjalan
    // tidak boleh berubah surut — petugas memang sudah mengunjunginya.
    if (body.pelangganId) {
      await tx.daftarCatat.updateMany({
        where: { periode: body.periode, pelangganId: body.pelangganId },
        data: { status: "DICABUT", selesaiAt: new Date() },
      })
    }

    await recordAudit(tx, {
      userId: requesterId,
      aksi: `PEMUTUSAN_${body.jenis}`,
      entitas: "Pemutusan",
      entitasId: row.id,
      perubahan: { after: row },
      ipAddress,
      userAgent,
    })
    return row
  })

  return {
    ...row,
    koordinatVerifikasi: koordinatVerifikasi
      ? {
          type: "Point",
          coordinates: [koordinatVerifikasi.lng, koordinatVerifikasi.lat],
        }
      : null,
  }
}

export async function terapkanStatusPemutusan(
  input: TerapkanStatusPemutusanInput,
  requesterId: string,
  auditMeta: { ipAddress: string | null; userAgent: string | null }
) {
  const { periode, terapkan } = input
  const { ipAddress, userAgent } = auditMeta

  const rows = await prisma.pemutusan.findMany({
    where: { periode },
    select: {
      id: true,
      jenis: true,
      nomorLangganan: true,
      namaPelanggan: true,
      pelanggan: {
        select: {
          id: true,
          nama: true,
          nomorLangganan: true,
          status: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { nomorLangganan: "asc" },
  })

  // PENJAGA "TERSAMBUNG KEMBALI". Mutasi "Pembukaan Kembali PS/SPT" nyata
  // ada di data ini (lihat bulan-baru.service.ts: lima kejadian di 202604),
  // dan tanpa penjaga ini menerapkan status periode LAMA akan mengembalikan
  // sambungan yang sudah hidup lagi menjadi tertutup — merusak data yang
  // benar dengan keputusan yang sudah kedaluwarsa.
  //
  // Tandanya diambil dari daftar catat: muncul lagi di periode SESUDAH
  // pemutusannya dengan status selain DICABUT = ia kembali jadi pekerjaan,
  // artinya sudah tersambung lagi.
  const idPelanggan = rows
    .map((r) => r.pelanggan?.id)
    .filter((v): v is string => !!v)
  const sesudah = await prisma.daftarCatat.findMany({
    where: {
      pelangganId: { in: idPelanggan },
      periode: { gt: periode },
      status: { not: "DICABUT" },
    },
    select: { pelangganId: true },
    distinct: ["pelangganId"],
  })
  const tersambungLagi = new Set(sesudah.map((x) => x.pelangganId))

  const rencana: BarisTerap[] = rows.map((r) => {
    const tujuan = STATUS_DARI_JENIS[r.jenis] ?? null
    const dasar = {
      pemutusanId: r.id,
      nomorLangganan: r.pelanggan?.nomorLangganan ?? r.nomorLangganan,
      namaPelanggan: r.pelanggan?.nama ?? r.namaPelanggan,
      jenis: r.jenis,
      statusSekarang: r.pelanggan?.status ?? null,
      statusTujuan: tujuan,
    }
    if (!tujuan) return { ...dasar, tindakan: "JENIS_BELUM_PASTI" as const }
    // Pelanggan yang sudah dihapus diperlakukan sama dengan yang tidak
    // punya baris Pelanggan: tidak ada yang bisa diubah statusnya.
    if (!r.pelanggan || r.pelanggan.deletedAt)
      return { ...dasar, tindakan: "TANPA_PELANGGAN" as const }
    if (tersambungLagi.has(r.pelanggan.id))
      return { ...dasar, tindakan: "TERSAMBUNG_KEMBALI" as const }
    if (r.pelanggan.status === tujuan)
      return { ...dasar, tindakan: "SUDAH_SESUAI" as const }
    return { ...dasar, tindakan: "AKAN_DIUBAH" as const }
  })

  const akanDiubah = rencana.filter((r) => r.tindakan === "AKAN_DIUBAH")
  const ringkas = {
    periode,
    diperiksa: rencana.length,
    akanDiubah: akanDiubah.length,
    sudahSesuai: rencana.filter((r) => r.tindakan === "SUDAH_SESUAI").length,
    tanpaPelanggan: rencana.filter((r) => r.tindakan === "TANPA_PELANGGAN")
      .length,
    jenisBelumPasti: rencana.filter((r) => r.tindakan === "JENIS_BELUM_PASTI")
      .length,
    tersambungKembali: rencana.filter(
      (r) => r.tindakan === "TERSAMBUNG_KEMBALI"
    ).length,
  }

  if (!terapkan) return { ...ringkas, diterapkan: false, rencana }

  // Satu transaksi per baris, bukan satu transaksi raksasa: perubahan status
  // ini per-pelanggan dan saling bebas — satu baris bermasalah tidak boleh
  // membatalkan yang lain. Jejak audit ditulis bersama perubahannya supaya
  // tidak pernah ada perubahan status tanpa nama orang di belakangnya.
  let diubah = 0
  for (const r of akanDiubah) {
    const asal = rows.find((x) => x.id === r.pemutusanId)!
    await prisma.$transaction(async (tx) => {
      await tx.pelanggan.update({
        where: { id: asal.pelanggan!.id },
        data: { status: r.statusTujuan! },
      })
      await recordAudit(tx, {
        userId: requesterId,
        aksi: "UBAH_STATUS_DARI_PEMUTUSAN",
        entitas: "Pelanggan",
        entitasId: asal.pelanggan!.id,
        perubahan: {
          before: { status: r.statusSekarang },
          after: { status: r.statusTujuan },
          dasar: { pemutusanId: r.pemutusanId, periode, jenis: r.jenis },
        },
        ipAddress,
        userAgent,
      })
    })
    diubah++
  }

  return { ...ringkas, diterapkan: true, diubah, rencana }
}
