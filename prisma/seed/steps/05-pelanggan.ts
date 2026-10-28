// prisma/seed/steps/05-pelanggan.ts — Pelanggan dari ProgresCater, dan
// HANYA dari ProgresCater.
//
// Dulu file ini juga membaca PBPK (sambungan baru bulan berjalan) dan
// r-nomor (pelanggan yang dicabut, dilengkapi nama/alamat dari lapdatameter).
// Keduanya sudah dihapus: PBPK masuk lewat /dashboard/pbpk di akhir siklus
// pencatatan, dan pemutusan lewat layarnya sendiri menjelang closing —
// keduanya kejadian bulanan, bukan bahan serah terima. Lihat catatan panjang
// di seed/index.ts.
//
// DUA ATURAN KESELAMATAN DATA yang WAJIB dijaga di file ini:
//
// 1. STATUS PELANGGAN — lihat lib/status.ts. Diresolve lewat
//    resolvePelangganStatus(), TIDAK PERNAH langsung di-set dari mutasinama
//    mentah. Setiap perubahan status dicatat ke report.statusChange().
//
// 2. FIELD YANG TIDAK DIBAWA SUMBER INI TIDAK BOLEH DI-NULL-KAN. Contoh:
//    ProgresCater TIDAK punya kolom jumlahPenghuni/geoLat/geoLong/dmakode
//    kosong-per-baris — kalau field itu di-set eksplisit ke null di setiap
//    update, data yang sudah terisi dari import PBPK sebelumnya akan
//    HILANG. Solusinya: bangun object `update`/`create` Prisma secara
//    DINAMIS, cuma masukkan key yang baris ini benar-benar punya nilainya.
//    Field yang tidak dipunyai baris ini -> key-nya TIDAK DIMASUKKAN sama
//    sekali ke object update (Prisma cuma menyentuh key yang eksplisit
//    ada).

import type { Prisma } from "@generated"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater } from "../lib/csv"
import {
  normalizeNolg,
  normalizeRtRw,
  normalizePhone,
  normalizeGolonganTarif,
  normalizeStatusPasokanAir,
  parseTimeOfDay,
  trimOrNull,
} from "../lib/normalize"
import { mapMutasiNamaToStatus, resolvePelangganStatus } from "../lib/status"
import { saringPerubahan, type KolomTerjaga } from "@/lib/domain/asal-usul"

const STEP = "05-pelanggan"

interface RefCaches {
  tarifGolongan: Map<string, string>
  seksiCater: Map<string, string>
  rute: Map<string, string>
  zona: Map<string, string>
  kecamatan: Map<string, string>
  kelurahan: Map<string, string>
  golonganBesar: Map<string, string>
  dma: Map<string, string>
}

async function loadRefCaches(prisma: PrismaClientLike): Promise<RefCaches> {
  const [tarifGolongan, seksiCater, rute, zona, kecamatan, kelurahan, golonganBesar, dma] =
    await Promise.all([
      prisma.tarifGolongan.findMany({ select: { id: true, kode: true } }),
      prisma.seksiCater.findMany({ select: { id: true, kode: true } }),
      prisma.rute.findMany({ select: { id: true, kode: true } }),
      prisma.zona.findMany({ select: { id: true, kode: true } }),
      prisma.kecamatan.findMany({ select: { id: true, kode: true } }),
      prisma.kelurahan.findMany({ select: { id: true, kode: true } }),
      prisma.golonganBesar.findMany({ select: { id: true, kode: true } }),
      prisma.dma.findMany({ select: { id: true, kode: true } }),
    ])
  const toMap = (rows: { id: string; kode: string }[]) => new Map(rows.map((r) => [r.kode, r.id]))
  return {
    tarifGolongan: toMap(tarifGolongan),
    seksiCater: toMap(seksiCater),
    rute: toMap(rute),
    zona: toMap(zona),
    kecamatan: toMap(kecamatan),
    kelurahan: toMap(kelurahan),
    golonganBesar: toMap(golonganBesar),
    dma: toMap(dma),
  }
}

export async function seedPelanggan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const caches = await loadRefCaches(prisma)
  await seedFromProgresCater(prisma, report, caches)
}

/// Sama seperti step 06: lookup di-preload sekali dan baris diproses
/// berkelompok secara paralel. Versi lama melakukan findUnique + upsert
/// BERURUTAN per baris (~45.000 round-trip untuk 22.523 baris) — terukur
/// masih berjalan setelah 11 menit. Aman diparalelkan karena `nolg`
/// terverifikasi unik di ProgresCater: tidak ada dua baris menyentuh
/// pelanggan yang sama.
const KONKURENSI = 16

async function seedFromProgresCater(
  prisma: PrismaClientLike,
  report: SeedReport,
  caches: RefCaches
): Promise<void> {
  const rows = readProgresCater()
  // Potret keadaan SEBELUM step ini jalan, termasuk asal-usul tiap kolom.
  // Potret (bukan pembacaan per baris) sudah memadai: seluruh baris di step
  // ini bersumber sama (PROGRES_CATER), dan sesama sumber berperingkat sama
  // memang boleh saling menimpa — periode yang lebih baru menang, persis
  // yang diinginkan karena rows tersusun kronologis jan->juni.
  const dbAwal = new Map(
    (
      await prisma.pelanggan.findMany({
        select: {
          nomorLangganan: true,
          status: true,
          nama: true,
          alamat: true,
          rt: true,
          rw: true,
          notelp: true,
          tarifGolonganId: true,
          sumberKolom: true,
        },
      })
    ).map((p) => [p.nomorLangganan, p])
  )
  /// Kolom yang ditolak karena kalah peringkat — diringkas sekali di akhir,
  /// bukan satu warning per baris (bisa ribuan).
  const tertolak = new Map<string, number>()

  async function prosesBaris(row: (typeof rows)[number], i: number): Promise<void> {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) {
      report.warn(STEP, `nolg tidak valid: ${JSON.stringify(row.nolg)}, baris dilewati`, {
        row: i,
        key: row.nolg,
      })
      report.skipped(STEP)
      return
    }

    const nomorPersil = trimOrNull(row.nprs)
    const nama = trimOrNull(row.nama)
    const alamat = trimOrNull(row.almt)
    if (!nomorPersil || !nama || !alamat) {
      report.warn(STEP, `nprs/nama/almt kosong untuk nolg ${nomorLangganan}, baris dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      return
    }

    const barisDb = dbAwal.get(nomorLangganan) ?? null
    const existing = barisDb?.status ?? null

    const mutasiNamaStatus = mapMutasiNamaToStatus(row.mutasinama)
    const resolution = resolvePelangganStatus({
      existingStatus: existing,
      mutasiNamaStatus,
    })
    if (resolution.changed) {
      report.statusChange({
        nomorLangganan,
        from: existing,
        to: resolution.status,
        reason: resolution.reason,
      })
    }
    if (existing === null && mutasiNamaStatus === null) {
      report.warn(
        STEP,
        `mutasinama "${row.mutasinama}" tidak dikenali untuk pelanggan baru ${nomorLangganan} -> default AKTIF`,
        { key: nomorLangganan }
      )
    }

    // Field yang SELALU ada di tiap baris ProgresCater -> aman selalu di-set.
    const alwaysPresent: Prisma.PelangganUncheckedUpdateInput = {
      nomorPersil,
      status: resolution.status,
    }

    // KOLOM TERJAGA tidak ditulis langsung lagi. ProgresCater berperingkat
    // PALING RENDAH untuk identitas & alamat — ia terbukti merusak spasi
    // ("JL.MERDEKANO 51"), sedangkan master STI menyimpannya utuh. Yang
    // lolos saringan hanya kolom yang belum pernah diisi sumber yang lebih
    // tepercaya. Lihat lib/asal-usul.ts.
    const usulan: Partial<Record<KolomTerjaga, unknown>> = { nama, alamat }
    const rt = normalizeRtRw(row.rt)
    if (rt !== null) usulan.rt = rt
    const rw = normalizeRtRw(row.rw)
    if (rw !== null) usulan.rw = rw
    const notelp = normalizePhone(row.notelp)
    if (notelp !== null) usulan.notelp = notelp

    const golonganTarifKode = normalizeGolonganTarif(row.trp)
    if (golonganTarifKode) {
      const id = caches.tarifGolongan.get(golonganTarifKode)
      if (id) usulan.tarifGolonganId = id
    }

    const saring = saringPerubahan({
      usulan,
      sumber: "PROGRES_CATER",
      nilaiLama: barisDb ?? {},
      asalUsulLama: barisDb?.sumberKolom ?? null,
    })
    Object.assign(alwaysPresent, saring.data)
    alwaysPresent.sumberKolom = saring.asalUsul
    for (const kolom of saring.ditolak) tertolak.set(kolom, (tertolak.get(kolom) ?? 0) + 1)
    const seksiCaterId = caches.seksiCater.get(row.caterseksikode.trim())
    if (seksiCaterId) alwaysPresent.seksiCaterId = seksiCaterId
    const ruteId = caches.rute.get(row.rute_kode.trim())
    if (ruteId) alwaysPresent.ruteId = ruteId
    const zonaId = caches.zona.get(row.zonakode.trim())
    if (zonaId) alwaysPresent.zonaId = zonaId
    const kecamatanId = caches.kecamatan.get(row.kdkec.trim())
    if (kecamatanId) alwaysPresent.kecamatanId = kecamatanId
    const kelurahanId = caches.kelurahan.get(row.kdkel.trim())
    if (kelurahanId) alwaysPresent.kelurahanId = kelurahanId

    // isMBR/kodeMBR: ProgresCater selalu punya kolom ismbr ("t"/"f"), aman
    // di-set tiap kali.
    alwaysPresent.isMBR = row.ismbr.trim().toLowerCase() === "t"
    const kodeMBR = trimOrNull(row.mbr)
    if (kodeMBR) alwaysPresent.kodeMBR = kodeMBR

    // Field yang CUMA ADA kalau baris ini punya nilainya -> jangan
    // pernah di-null-kan kalau kosong (lihat komentar atas file).
    const golonganBesarKode = trimOrNull(row.gbid)
    if (golonganBesarKode) {
      const id = caches.golonganBesar.get(golonganBesarKode)
      if (id) alwaysPresent.golonganBesarId = id
    }
    const objekBayarRaw = trimOrNull(row.obnama)
    if (objekBayarRaw === "SIPIL" || objekBayarRaw === "AUTODEBET" || objekBayarRaw === "HANKAM") {
      alwaysPresent.objekBayar = objekBayarRaw
    }
    const dmaKode = trimOrNull(row.dmakode)
    if (dmaKode && dmaKode !== "-") {
      const id = caches.dma.get(dmaKode)
      if (id) alwaysPresent.dmaId = id
    }
    const statusPasokanAir = normalizeStatusPasokanAir(row.durasi)
    if (statusPasokanAir) alwaysPresent.statusPasokanAir = statusPasokanAir
    const jamMulai = parseTimeOfDay(row.jamgilirstart)
    if (jamMulai) alwaysPresent.jamGilirMulai = jamMulai
    const jamSelesai = parseTimeOfDay(row.jamgilirend)
    if (jamSelesai) alwaysPresent.jamGilirSelesai = jamSelesai
    const polaGilir = trimOrNull(row.waktugilir)
    if (polaGilir) alwaysPresent.polaGilir = polaGilir

    // ProgresCater TIDAK punya kolom jumlahPenghuni sama sekali (cuma
    // ada di PBPK) — sengaja tidak disentuh di sini, lihat komentar atas
    // file soal "jangan null-kan field yang tidak dibawa sumber ini".

    // Cabang CREATE tidak boleh memakai hasil saringan. Saringan menjawab
    // "boleh menimpa nilai yang sudah ada?", dan pada baris yang belum ada
    // tidak ada yang perlu dilindungi — nama & alamat justru WAJIB terisi.
    // Prisma memvalidasi payload create walau cabang itu tidak dieksekusi,
    // jadi tanpa ini seluruh baris yang alamatnya ditolak akan gagal dengan
    // "Argument `nama` is missing".
    const create: Prisma.PelangganUncheckedCreateInput = {
      ...(alwaysPresent as Prisma.PelangganUncheckedCreateInput),
      nomorLangganan,
      nama,
      alamat,
      sumberKolom: {
        nama: "PROGRES_CATER",
        alamat: "PROGRES_CATER",
        ...(rt !== null ? { rt: "PROGRES_CATER" } : {}),
        ...(rw !== null ? { rw: "PROGRES_CATER" } : {}),
        ...(notelp !== null ? { notelp: "PROGRES_CATER" } : {}),
      },
    }

    try {
      await prisma.pelanggan.upsert({
        where: { nomorLangganan },
        create,
        update: alwaysPresent,
      })
      existing !== null ? report.updated(STEP) : report.created(STEP)
    } catch (err) {
      report.error(STEP, `Gagal upsert Pelanggan ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
    }
  }

  for (let mulai = 0; mulai < rows.length; mulai += KONKURENSI) {
    const kelompok = rows.slice(mulai, mulai + KONKURENSI)
    await Promise.all(kelompok.map((row, n) => prosesBaris(row, mulai + n)))
  }

  if (tertolak.size > 0) {
    const rincian = [...tertolak].map(([k, n]) => `${k}: ${n}`).join(", ")
    report.warn(
      STEP,
      `Perubahan dari ProgresCater DITOLAK karena kolomnya sudah diisi sumber yang lebih tepercaya — ${rincian}. Ini yang diharapkan, bukan galat: lihat prisma/seed/lib/asal-usul.ts.`
    )
  }
}
