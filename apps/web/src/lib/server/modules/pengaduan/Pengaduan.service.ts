// server/modules/pengaduan/Pengaduan.service.ts — logika bisnis sisi PETUGAS
// dari alur pengaduan (aduan masyarakat, termasuk keluhan kebocoran). Sisi
// warga ada di server/modules/publik/Publik.service.ts.
//
// Aturan yang mengikat seluruh file ini: perubahan status TIDAK PERNAH
// ditulis lewat `prisma.pengaduan.update({ data: { status } })` — semuanya
// lewat `transisiPengaduan()` di Alur.ts, supaya setiap perubahan otomatis
// punya jejak di linimasa dan efek samping SLA-nya tidak terlewat. Lihat
// alasan lengkapnya di Alur.ts.
//
// Catatan akses: POST terbuka untuk SEMUA user yang login (termasuk role
// USER = pelanggan), karena inilah kanal masuk aduan. Pengelolaan
// (tugaskan/ubah status/eskalasi) dibatasi SUPERVISOR ke atas; menulis
// catatan tindak lanjut dibuka untuk STAFF ke atas — petugas lapanganlah
// yang tahu perkembangannya, dan memaksa mereka menitip lewat supervisor
// hanya membuat linimasa kosong.
import type { Prisma, StatusPengaduan } from "@db"
import { prisma } from "@db"
import { NotFoundError, BadRequestError, ForbiddenError } from "../../lib/Galat"
import { buildSkipTake, buildMeta, buildOrderBy } from "../../lib/Pagination"
import {
  GEO,
  setPoint,
  getPointGeoJson,
  getPointGeoJsonMany,
  findNearby,
} from "../../lib/Spatial"
import { simpanBerkas, BerkasTidakValidError } from "../../lib/Penyimpanan"
import type { SessionUser } from "../../lib/Sesi"
import { buatNomorTiketUnik, normalisasiNomorTiket } from "./Tiket"
import { hitungTargetSla, prioritasAwal, ringkasSla } from "@/lib/domain/SLA"
import {
  STATUS_TERBUKA,
  statusTerbuka,
  periksaUbahStatus,
  prioritasLebihTinggi,
  transisiLewatPetugas,
  kewenanganTiket,
  type KonteksPelaku,
} from "@/lib/domain/AlurPengaduan"
import {
  transisiPengaduan,
  catatRiwayat,
  bolehTransisi,
  type Pelaku,
} from "./Alur"
import {
  ambilBatasKonfirmasiJam,
  hitungKonfirmasiBatasAt,
  sapuTutupOtomatis,
} from "./Otomatis"
import { tandaiWilayah } from "./Wilayah"
import { getNotifier } from "../notifikasi/Notifier"
import type {
  ListPengaduanQuery,
  NearPengaduanQuery,
  SayaPengaduanQuery,
  CreatePengaduanInput,
  TugaskanPengaduanInput,
  UbahStatusPengaduanInput,
  TambahCatatanPengaduanInput,
  KirimChatPengaduanInput,
  EskalasiPengaduanInput,
} from "./Pengaduan.schema"

/// Pelaku linimasa dari session. Nama di-snapshot di sini (bukan cuma id)
/// supaya linimasa tetap terbaca kalau user-nya kelak dihapus/berganti nama.
function pelakuDariUser(user: SessionUser): Pelaku {
  return { id: user.id, nama: user.name ?? user.email }
}

export async function findPengaduanNear(query: NearPengaduanQuery) {
  const { lat, lng, radius, limit } = query
  const nearby = await findNearby(prisma, GEO.pengaduan, {
    lat,
    lng,
    radiusMeters: radius,
    limit,
  })
  if (nearby.length === 0) return []
  const rows = await prisma.pengaduan.findMany({
    where: { id: { in: nearby.map((r) => r.id) } },
    select: {
      id: true,
      nomorTiket: true,
      jenis: true,
      judul: true,
      status: true,
      prioritas: true,
      alamatKejadian: true,
    },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  return nearby.flatMap((r) => {
    const row = byId.get(r.id)
    return row ? [{ ...row, jarakMeter: r.jarakMeter }] : []
  })
}

/// Papan ringkasan antrean — angka untuk kartu statistik dashboard.
/// Diagregasi di DB (groupBy/count), bukan findMany().length: tabel ini
/// tumbuh terus dan menarik semua baris hanya untuk menghitungnya adalah
/// cara paling mahal yang tersedia.
export async function getStatistikPengaduan() {
  const sekarang = new Date()

  const [perStatus, perPrioritas, melanggarSla, belumDitugaskan, rataRating] =
    await Promise.all([
      prisma.pengaduan.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.pengaduan.groupBy({
        by: ["prioritas"],
        _count: { _all: true },
        where: { status: { in: STATUS_TERBUKA } },
      }),
      prisma.pengaduan.count({
        where: {
          status: { in: STATUS_TERBUKA },
          targetSelesaiAt: { lt: sekarang },
        },
      }),
      prisma.pengaduan.count({ where: { status: "BARU" } }),
      prisma.pengaduan.aggregate({
        _avg: { ratingKepuasan: true },
        _count: { ratingKepuasan: true },
      }),
    ])

  return {
    perStatus: Object.fromEntries(
      perStatus.map((r) => [r.status, (r._count as { _all?: number })?._all ?? 0])
    ),
    perPrioritasTerbuka: Object.fromEntries(
      perPrioritas.map((r) => [
        r.prioritas,
        (r._count as { _all?: number })?._all ?? 0,
      ])
    ),
    melanggarSla,
    belumDitugaskan,
    rataRating: rataRating._avg.ratingKepuasan,
    jumlahDinilai: rataRating._count.ratingKepuasan,
  }
}

/// Daftar petugas yang bisa ditugaskan/dieskalasi — bahan dropdown panel
/// penanganan.
///
/// KENAPA ADA DI SINI, BUKAN PAKAI `GET /users`? `GET /users` dibatasi
/// MANAGEMENT_UP, sementara menugaskan tiket hanya butuh SUPERVISOR_UP. Ini
/// bukan detail sepele: memakai /users membuat SUPERVISOR — justru peran yang
/// paling sering menugaskan — dapat 403 dan dropdown kosong, alias tidak bisa
/// menugaskan sama sekali. Endpoint ini menutup celah itu TANPA melonggarkan
/// /users: yang keluar hanya id/nama/role akun aktif, tanpa email, kontak,
/// atau data organisasi.
export async function listPetugasPengaduan() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { notIn: ["USER"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
    take: 500,
  })
}

export async function listPengaduan(
  query: ListPengaduanQuery,
  requester: SessionUser
) {
  const { skip, take } = buildSkipTake(query)
  const sekarang = new Date()

  const where: Prisma.PengaduanWhereInput = {
    jenis: query.jenis,
    status: query.status,
    prioritas: query.prioritas,
    pelangganId: query.pelangganId,
    kelurahanId: query.kelurahanId,
    kecamatanId: query.kecamatanId,
    ditugaskanKeId: query.milikSaya ? requester.id : query.ditugaskanKeId,
    ...(query.q
      ? {
          OR: [
            { judul: { contains: query.q, mode: "insensitive" as const } },
            {
              nomorTiket: { contains: query.q, mode: "insensitive" as const },
            },
          ],
        }
      : {}),
    // Lewat AND, BUKAN spread `status:` di level atas — spread akan MENIMPA
    // filter `status` dari query dan diam-diam mengabaikan pilihan pengguna.
    // Disaring di DB (bukan di JS setelah paginasi): menyaring setelah `take`
    // mengembalikan halaman yang isinya kurang dari pageSize dan `total` yang
    // bohong.
    ...(query.melanggarSla
      ? {
          AND: [
            { status: { in: STATUS_TERBUKA } },
            { targetSelesaiAt: { lt: sekarang } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.pengaduan.findMany({
      where,
      skip,
      take,
      // Default: yang paling mendesak di atas — prioritas, lalu tenggat
      // terdekat. Ini antrean kerja, bukan arsip kronologis.
      orderBy: buildOrderBy(query, [
        { prioritas: "desc" },
        { targetSelesaiAt: "asc" },
        { createdAt: "desc" },
      ]),
      include: {
        pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        ditugaskanKe: { select: { id: true, name: true } },
        kelurahan: { select: { id: true, nama: true } },
        kecamatan: { select: { id: true, nama: true } },
      },
    }),
    prisma.pengaduan.count({ where }),
  ])

  const koord = await getPointGeoJsonMany(
    prisma,
    GEO.pengaduan,
    rows.map((r) => r.id)
  )
  return {
    data: rows.map((r) => ({
      ...r,
      koordinat: koord.get(r.id) ?? null,
      sla: ringkasSla(r, sekarang),
    })),
    meta: buildMeta(total, query),
  }
}

/// "Laporan saya" — tiket yang DIBUAT oleh pengguna yang sedang login,
/// ditandai lewat `olehId` pada entri linimasa DIBUAT-nya (lihat catatan di
/// Publik.service.ts: POST /api/public/pengaduan menautkan otomatis kalau
/// pelapor kebetulan sedang login). TANPA requireRole — beda dari `GET /`
/// di atas yang STAFF_UP, ini justru harus terbuka untuk role USER: warga
/// yang login butuh cara melihat riwayat laporannya sendiri tanpa mengingat
/// nomor tiket satu per satu.
export async function listPengaduanSaya(
  query: SayaPengaduanQuery,
  requester: SessionUser
) {
  const { skip, take } = buildSkipTake(query)

  const dibuatOleh = await prisma.riwayatPengaduan.findMany({
    where: { aksi: "DIBUAT", olehId: requester.id },
    select: { pengaduanId: true },
  })
  const ids = dibuatOleh.map((r) => r.pengaduanId)
  if (ids.length === 0) return { data: [], meta: buildMeta(0, query) }

  const where: Prisma.PengaduanWhereInput = { id: { in: ids } }
  const [rows, total] = await Promise.all([
    prisma.pengaduan.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nomorTiket: true,
        jenis: true,
        judul: true,
        status: true,
        prioritas: true,
        createdAt: true,
        targetResponsAt: true,
        targetSelesaiAt: true,
        responsAt: true,
        jedaMulaiAt: true,
        selesaiAt: true,
        ditugaskanKe: { select: { name: true } },
      },
    }),
    prisma.pengaduan.count({ where }),
  ])

  return {
    data: rows.map((r) => ({ ...r, sla: ringkasSla(r) })),
    meta: buildMeta(total, query),
  }
}

export async function getPengaduanById(id: string, requester: SessionUser) {
  const row = await prisma.pengaduan.findUnique({
    where: { id },
    include: {
      pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
      ditugaskanKe: { select: { id: true, name: true, role: true } },
      eskalasiKe: { select: { id: true, name: true, role: true } },
      kelurahan: { select: { id: true, nama: true } },
      kecamatan: { select: { id: true, nama: true } },
      // Petugas melihat SELURUH linimasa, termasuk catatan internal — beda
      // dari endpoint publik yang hanya mengirim `isPublik: true`.
      riwayat: {
        orderBy: { createdAt: "asc" },
        include: { oleh: { select: { id: true, name: true, role: true } } },
      },
    },
  })
  if (!row) throw new NotFoundError("Pengaduan")

  // Transisi dan kewenangan yang BENAR-BENAR sah dieksekusi pemanggil ini
  // sesuai aturan domain AlurPengaduan.
  const isPengelola = requester.role !== "STAFF" && requester.role !== "USER"
  const isMilikSendiri = row.ditugaskanKeId === requester.id
  const konteks: KonteksPelaku = {
    pengelola: isPengelola,
    milikSendiri: isMilikSendiri,
  }
  const transisiTersedia = transisiLewatPetugas(row.status, konteks)
  const kewenangan = kewenanganTiket(row.status, konteks)

  return {
    ...row,
    koordinat: await getPointGeoJson(prisma, GEO.pengaduan, id),
    sla: ringkasSla(row),
    /// Diserahkan ke client supaya UI bisa menampilkan HANYA tombol yang
    /// sah — daripada menawarkan aksi yang pasti ditolak server.
    transisiTersedia,
    kewenangan,
  }
}

export async function createPengaduan(
  input: CreatePengaduanInput,
  requester: SessionUser
) {
  const { koordinat, prioritas, ...body } = input
  const pelaku = pelakuDariUser(requester)

  // Cegah tiket duplikat aktif untuk pelanggan dan jenis aduan yang sama
  if (body.pelangganId) {
    const tiketAktif = await prisma.pengaduan.findFirst({
      where: {
        pelangganId: body.pelangganId,
        jenis: body.jenis,
        status: { in: [...STATUS_TERBUKA] },
      },
      select: { nomorTiket: true, status: true },
    })
    if (tiketAktif) {
      throw new BadRequestError(
        `Pelanggan ini masih memiliki tiket aktif ${tiketAktif.nomorTiket} (${tiketAktif.status}) untuk jenis pengaduan ${body.jenis}. Selesaikan tiket sebelumnya terlebih dahulu.`
      )
    }
  }

  const prioritasFinal = prioritas ?? prioritasAwal(body.jenis)
  const sekarang = new Date()
  const target = hitungTargetSla(prioritasFinal, sekarang)

  const row = await buatNomorTiketUnik((nomorTiket) =>
    prisma.$transaction(async (tx) => {
      // Auto-tag wilayah kejadian dari koordinat (ST_Contains) — supaya
      // antrean bisa disaring per kelurahan/kecamatan sejak tiket lahir.
      const wilayah = koordinat
        ? await tandaiWilayah(tx, koordinat.lat, koordinat.lng)
        : null
      const row = await tx.pengaduan.create({
        data: {
          ...body,
          nomorTiket,
          prioritas: prioritasFinal,
          ...target,
          kelurahanId: wilayah?.kelurahanId ?? null,
          kecamatanId: wilayah?.kecamatanId ?? null,
        },
      })
      if (koordinat)
        await setPoint(tx, GEO.pengaduan, row.id, koordinat.lat, koordinat.lng)
      await catatRiwayat(tx, {
        pengaduanId: row.id,
        aksi: "DIBUAT",
        oleh: pelaku,
        catatan: `Aduan dicatat oleh ${pelaku.nama}.`,
        isPublik: true,
      })
      return row
    })
  )

  return {
    ...row,
    koordinat: koordinat
      ? { type: "Point" as const, coordinates: [koordinat.lng, koordinat.lat] }
      : null,
  }
}

export async function tugaskanPengaduan(
  id: string,
  input: TugaskanPengaduanInput,
  requester: SessionUser
) {
  const { ditugaskanKeId, catatan } = input
  const pelaku = pelakuDariUser(requester)

  // Divalidasi eksplisit supaya pesannya menyebut masalah operasional,
  // bukan DB foreign key error, dan mencegah penugasan ke non-aktif atau role pelanggan.
  const [petugas, tiket] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ditugaskanKeId },
      select: { name: true, status: true, role: true },
    }),
    prisma.pengaduan.findUnique({
      where: { id },
      select: { id: true, status: true },
    }),
  ])
  if (!petugas) throw new NotFoundError("Petugas")
  if (petugas.status !== "ACTIVE")
    throw new BadRequestError("Petugas tersebut tidak berstatus aktif.")
  if (petugas.role === "USER")
    throw new BadRequestError(
      "Pengaduan tidak dapat ditugaskan kepada pelanggan (role USER)."
    )
  if (!tiket) throw new NotFoundError("Pengaduan")
  if (!bolehTransisi(tiket.status, "DITUGASKAN")) {
    throw new BadRequestError(
      `Tiket berstatus ${tiket.status} tidak dapat langsung ditugaskan.`
    )
  }

  const row = await prisma.$transaction((tx) =>
    transisiPengaduan(tx, {
      pengaduanId: id,
      ke: "DITUGASKAN",
      aksi: "DITUGASKAN",
      oleh: pelaku,
      ditugaskanKeId,
      // Nama petugas ikut ditulis ke linimasa PUBLIK: warga berhak tahu
      // siapa yang menangani laporannya. Kontak/emailnya TIDAK — itu tetap
      // lewat kanal resmi.
      catatan: catatan ?? `Ditugaskan kepada ${petugas.name ?? "petugas"}.`,
      isPublik: true,
    })
  )
  // Beri tahu petugas yang ditugaskan (best-effort; tak menggagalkan aksi).
  await getNotifier().kirim([ditugaskanKeId], {
    judul: "Tiket pengaduan baru ditugaskan",
    isi: `Anda ditugaskan menangani tiket ${row.nomorTiket ?? id}.`,
    tipe: "pengaduan",
    data: { tipe: "pengaduan", id },
  })
  return row
}

/// STAFF_UP (bukan lagi SUPERVISOR_UP): petugas lapangan HARUS bisa
/// menggerakkan tiketnya sendiri (MENUJU_LOKASI/DIPROSES/dst) — versi lama
/// membuat seluruh app petugas gangguan 403 saat ganti status. Batasan
/// untuk role STAFF ditegakkan di sini:
///   1. verifikasi triase (BARU -> TERVERIFIKASI) — peran operator; atau
///   2. transisi TRANSISI_PETUGAS pada tiket yang DITUGASKAN KEPADANYA.
/// SUPERVISOR ke atas bebas (dalam batas matriks TRANSISI).
export async function ubahStatusPengaduan(
  id: string,
  input: UbahStatusPengaduanInput,
  requester: SessionUser
) {
  const {
    status,
    catatan,
    catatanPenyelesaian,
    isPublik,
    fotoPenyelesaianUrl,
    fotoPenyelesaianPublicId,
  } = input

  const tiket = await prisma.pengaduan.findUnique({
    where: { id },
    select: { id: true, status: true, ditugaskanKeId: true },
  })
  if (!tiket) throw new NotFoundError("Pengaduan")

  const isPengelola = requester.role !== "STAFF" && requester.role !== "USER"
  const isMilikSendiri = tiket.ditugaskanKeId === requester.id
  const konteks: KonteksPelaku = {
    pengelola: isPengelola,
    milikSendiri: isMilikSendiri,
  }

  const galatTransisi = periksaUbahStatus({
    dari: tiket.status,
    ke: status,
    pelaku: konteks,
    punyaPetugas: Boolean(tiket.ditugaskanKeId),
    catatan,
  })

  if (galatTransisi) {
    if (
      galatTransisi.includes("Sebagai STAFF") ||
      galatTransisi.includes("memerlukan kewenangan Supervisor")
    ) {
      throw new ForbiddenError(galatTransisi)
    }
    throw new BadRequestError(galatTransisi)
  }

  // "Selesai" harus BISA DIBUKTIKAN: tanpa foto hasil pekerjaan + catatan,
  // klaim selesai tidak berarti apa-apa bagi pelapor yang tinggal jauh dari
  // kantor. Ditegakkan untuk SEMUA role — supervisor bukan pengecualian.
  if (status === "SELESAI") {
    if (!catatanPenyelesaian?.trim()) {
      throw new BadRequestError(
        "Transisi SELESAI wajib menyertakan catatanPenyelesaian."
      )
    }
    if (!fotoPenyelesaianUrl) {
      throw new BadRequestError(
        "Transisi SELESAI wajib menyertakan foto bukti hasil pekerjaan (unggah lewat POST /pengaduan/foto, lalu kirim fotoPenyelesaianUrl)."
      )
    }
  }

  // Batas konfirmasi pelapor (auto-close) dihitung SEKALI di sini dari
  // konfigurasi saat transisi terjadi — bukan dihitung ulang saat dibaca.
  const konfirmasiBatasAt =
    status === "SELESAI"
      ? hitungKonfirmasiBatasAt(new Date(), await ambilBatasKonfirmasiJam())
      : undefined

  return prisma.$transaction((tx) =>
    transisiPengaduan(tx, {
      pengaduanId: id,
      ke: status,
      aksi: status === "TERVERIFIKASI" ? "DIVERIFIKASI" : undefined,
      oleh: pelakuDariUser(requester),
      catatan,
      catatanPenyelesaian,
      isPublik,
      // Foto bukti juga masuk entri linimasa publik — pelapor melihat
      // buktinya langsung di halaman pelacakan.
      fotoUrl: status === "SELESAI" ? fotoPenyelesaianUrl : undefined,
      fotoPenyelesaianUrl,
      fotoPenyelesaianPublicId,
      konfirmasiBatasAt,
    })
  )
}

/// Tindak lanjut tanpa mengubah status — "sudah survei, menunggu material",
/// "regu berangkat". Dibuka untuk STAFF: petugas lapangan yang tahu
/// perkembangannya.
export async function tambahCatatanPengaduan(
  id: string,
  input: TambahCatatanPengaduanInput,
  requester: SessionUser
) {
  const { catatan, isPublik, fotoUrl } = input

  const ada = await prisma.pengaduan.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!ada) throw new NotFoundError("Pengaduan")

  return prisma.$transaction((tx) =>
    catatRiwayat(tx, {
      pengaduanId: id,
      aksi: "CATATAN",
      oleh: pelakuDariUser(requester),
      catatan,
      isPublik,
      fotoUrl,
    })
  )
}

/// Pesan CHAT dua arah pada thread tiket — sisi PETUGAS/operator/supervisor.
/// Sisi pelapor ada di POST /api/public/pengaduan/:nomorTiket/chat. Beda
/// dari /catatan: chat SELALU publik (memang untuk dibaca pelapor) dan
/// tercatat sebagai aksi CHAT supaya UI bisa merendernya sebagai
/// percakapan, bukan log status.
export async function kirimChatPetugas(
  id: string,
  input: KirimChatPengaduanInput,
  requester: SessionUser
) {
  const { pesan, fotoUrl } = input

  const tiket = await prisma.pengaduan.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!tiket) throw new NotFoundError("Pengaduan")
  if (tiket.status === "DITUTUP") {
    throw new BadRequestError(
      "Tiket sudah ditutup — percakapan tidak bisa dilanjutkan."
    )
  }

  return prisma.$transaction((tx) =>
    catatRiwayat(tx, {
      pengaduanId: id,
      aksi: "CHAT",
      oleh: pelakuDariUser(requester),
      catatan: pesan,
      fotoUrl,
      isPublik: true,
    })
  )
}

/// Upload foto bukti penyelesaian (multipart, field `foto`) — dipanggil app
/// petugas SEBELUM PATCH /:id/status SELESAI, lalu URL-nya dikirim sebagai
/// `fotoPenyelesaianUrl`. Pola sama dengan POST /laporan-harian/foto:
/// validasi magic bytes + penamaan deterministik di simpanBerkas().
export async function unggahFotoPenyelesaian(
  nomorTiketInput: string,
  foto: File
) {
  const nomorTiket = normalisasiNomorTiket(nomorTiketInput)
  try {
    const hasil = await simpanBerkas(foto, {
      prefix: "pengaduan",
      namaBerkas: `${nomorTiket}_penyelesaian`,
      subFolder: nomorTiket.slice(3, 7),
    })
    return { url: hasil.url, publicId: hasil.publicId }
  } catch (err) {
    if (err instanceof BerkasTidakValidError)
      throw new BadRequestError(err.message)
    throw err
  }
}

/// Sweep auto-close: tutup semua tiket SELESAI yang batas konfirmasinya
/// lewat. Idempoten & aman dipanggil kapan pun — untuk penjadwal eksternal
/// (cron) ATAU tombol manual supervisor. Jalur malasnya (per-tiket saat
/// dibaca publik) ada di Publik.service.ts; keduanya memakai Otomatis.ts.
export async function tutupOtomatisPengaduan() {
  const jumlahDitutup = await sapuTutupOtomatis()
  return { jumlahDitutup }
}

/// Menaikkan tiket ke atasan — mis. kebocoran yang butuh alat berat atau
/// keputusan anggaran.
///
/// TIDAK mengubah status: eskalasi adalah soal SIAPA yang memegang, bukan
/// sudah sampai mana pekerjaannya. Tiket yang dieskalasi tetap DIPROSES.
///
/// Menaikkan prioritas SENGAJA memperketat tenggat penyelesaian dihitung
/// dari sekarang: tiket yang baru disadari gawat tidak boleh tetap memakai
/// tenggat santai yang diberikan saat ia disangka biasa saja.
export async function eskalasiPengaduan(
  id: string,
  input: EskalasiPengaduanInput,
  requester: SessionUser
) {
  const { eskalasiKeId, alasan, prioritasBaru } = input
  const pelaku = pelakuDariUser(requester)

  const [pengaduan, atasan] = await Promise.all([
    prisma.pengaduan.findUnique({
      where: { id },
      select: { id: true, status: true, prioritas: true, nomorTiket: true },
    }),
    prisma.user.findUnique({
      where: { id: eskalasiKeId },
      select: { name: true, status: true, role: true },
    }),
  ])
  if (!pengaduan) throw new NotFoundError("Pengaduan")
  if (!statusTerbuka(pengaduan.status)) {
    throw new BadRequestError(
      `Hanya tiket berstatus terbuka yang dapat dieskalasi (status saat ini: ${pengaduan.status}).`
    )
  }
  if (!atasan) throw new NotFoundError("Penerima eskalasi")
  if (atasan.status !== "ACTIVE")
    throw new BadRequestError("Penerima eskalasi tidak berstatus aktif.")
  if (atasan.role === "USER")
    throw new BadRequestError(
      "Penerima eskalasi tidak boleh akun pelanggan (role USER)."
    )

  if (
    prioritasBaru &&
    !prioritasLebihTinggi(prioritasBaru, pengaduan.prioritas)
  ) {
    throw new BadRequestError(
      `Eskalasi hanya boleh menaikkan prioritas (prioritas saat ini: ${pengaduan.prioritas}, diminta: ${prioritasBaru}).`
    )
  }

  const sekarang = new Date()
  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.pengaduan.update({
      where: { id },
      data: {
        eskalasiKeId,
        eskalasiAt: sekarang,
        alasanEskalasi: alasan,
        ...(prioritasBaru
          ? {
              prioritas: prioritasBaru,
              targetSelesaiAt: hitungTargetSla(prioritasBaru, sekarang)
                .targetSelesaiAt,
            }
          : {}),
      },
    })
    await catatRiwayat(tx, {
      pengaduanId: id,
      aksi: "ESKALASI",
      oleh: pelaku,
      catatan: `Dieskalasi ke ${atasan.name ?? "atasan"}: ${alasan}`,
      // Internal: alasan eskalasi kerap menyangkut kendala anggaran/personel
      // yang bukan urusan pelapor. Kabar untuk warga disampaikan lewat
      // catatan publik tersendiri.
      isPublik: false,
    })
    return row
  })
  // Beri tahu penerima eskalasi (best-effort).
  await getNotifier().kirim([eskalasiKeId], {
    judul: "Tiket dieskalasikan kepada Anda",
    isi: `Tiket ${row.nomorTiket ?? id} dieskalasi: ${alasan}`,
    tipe: "pengaduan",
    data: { tipe: "pengaduan", id },
  })
  return row
}
