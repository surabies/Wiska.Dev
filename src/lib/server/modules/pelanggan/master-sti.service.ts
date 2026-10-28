// server/modules/pelanggan/master-sti.service.ts — UNGGAH MASTER PELANGGAN
// dari STI (`PEL{periode}-PW5.csv`).
//
// KENAPA INI BAGIAN DARI SIKLUS CLOSING, BUKAN SEKADAR ADMINISTRASI.
// Analisis enam periode (jan–juni 2026, lihat prisma/PEMETAAN-DATA.md
// bagian 8) menemukan bahwa daftar kerja bulanan Aurora sesekali
// MENJATUHKAN sambungan yang masih aktif — 156 baris di Maret, 34 di April
// — lalu mengembalikannya bulan berikutnya. Master pelanggan tidak pernah
// menjatuhkan mereka: diuji terhadap PEL202604, master memuat 100% sambungan
// yang ditagih, termasuk seluruh 34 yang bocor dari daftar kerja April.
// Itulah sebabnya Aurora menaruh "upload master pelanggan" di dalam ritual
// closing, dan sebabnya berkas ini ada.
//
// TIGA SIKAP YANG DIJAGA:
//
// 1. **Pratinjau dulu, terapkan kemudian.** Panggilan tanpa `terapkan`
//    tidak menulis apa pun; ia menjawab "apa yang akan berubah". Master
//    menyentuh 22 ribu baris sekaligus — melihat dampaknya lebih dulu bukan
//    kemewahan.
//
// 2. **Tidak pernah menghapus.** Nomor yang ada di database tapi tidak ada
//    di berkas hanya DILAPORKAN. Berkas master adalah potret satu periode,
//    bukan perintah "buang sisanya"; menghapus berdasarkan ketidakhadiran
//    akan menghilangkan sambungan hanya karena berkasnya kebetulan sebagian.
//
// 3. **GOLONGAN TARIF TIDAK PERNAH DIUBAH OLEH IMPOR INI — titik.**
//    Golongan tarif menentukan berapa rupiah yang ditagih ke warga, dan
//    penetapannya adalah keputusan manusia: hasil survei petugas bagian
//    langganan, diinput sadar lewat halaman Data pelanggan. Sistem tidak
//    berhak menaikkan atau menurunkannya hanya karena sebuah berkas ekspor
//    mengatakan begitu.
//
//    Versi pertama berkas ini melanggar aturan itu: ia menerapkan
//    `kd_goltarif` apa adanya, dan akibatnya nyata — tiga pelanggan berubah
//    golongan diam-diam, satu di antaranya TURUN dari 3B ke 2A3 (selisih
//    tagihan Rp 241.140). Sekarang perbedaan golongan hanya DILAPORKAN
//    sebagai usulan untuk ditinjau, tidak pernah ditulis.
//
// 4. **Status pelanggan TIDAK diubah otomatis.** Perubahan status (tutupan,
//    pembukaan kembali) diusulkan dan dihitung, tapi baru diterapkan bila
//    penelepon meminta `terapkanStatus` secara eksplisit. Ini mengikuti
//    sikap yang sudah dipegang seed step 09: status adalah keputusan yang
//    berkonsekuensi hukum & tagihan, jadi harus ada manusia yang menyetujui.

import type { Prisma, StatusPelanggan } from "@db"
import { prisma } from "@db"
import { saringPerubahan, type KolomTerjaga } from "@/lib/domain/asal-usul"
import { BadRequestError } from "../../lib/errors"
import { recordAudit } from "../../lib/audit"

/// Kolom berkas PEL — urutannya tetap dan sudah diverifikasi identik pada
/// PEL202604-PW5.csv dan PEL202606-PW5.csv.
const KOLOM = [
  "thbl",
  "thblcatat",
  "nolg",
  "nama",
  "almt",
  "rt",
  "rw",
  "kd_goltarif",
  "kd_merkmeter",
  "nometer",
  "kd_ukmeter",
  "caterseksikode",
  "wildistkode",
  "mutasikode",
  "mutasinama",
] as const

const UKURAN_BATCH = 500
const MAKS_CONTOH = 20

/// Peta `mutasikode` -> status pelanggan. Diturunkan dari pasangan
/// kode/nama yang benar-benar muncul di kedua berkas master:
///   0 Pelanggan Baru · 1 Pembukaan Kembali SPT · 2 Pembukaan Kembali PS
///   3 PELANGGAN AKTIF · 4 Tutupan SPT · 5 Tutupan PS
/// "PS" dipetakan ke TUTUP_SEMENTARA mengikuti padanan TSM di r-nomor.csv
/// (lihat seed step 09). Kode di luar daftar ini TIDAK diterjemahkan —
/// barisnya dilaporkan, bukan ditebak.
/// rt/rw disimpan 3 digit berpadding nol di database ("001"), sedangkan
/// berkas master menulisnya apa adanya ("1"). Tanpa normalisasi yang SAMA
/// dengan seed (`lib/normalize.ts:normalizeRtRw`), setiap baris akan
/// terlihat "berubah" — dry-run pertama melaporkan 22.542 dari 22.542 baris
/// berubah hanya karena ini.
function samakanRtRw(raw: string | null): string | null {
  if (raw === null) return null
  const t = raw.trim()
  if (t === "") return null
  return /^\d{1,3}$/.test(t) ? t.padStart(3, "0") : t.slice(0, 3)
}

/// Kode golongan di database berawalan `GOL_` ("GOL_3B"), di berkas master
/// tidak ("3B") — pola yang sama dengan `normalizeGolonganTarif` di seed.
function kunciGolongan(raw: string | null): string | null {
  if (!raw) return null
  const k = raw.trim().replace(/\./g, "").toUpperCase()
  return k === "" ? null : `GOL_${k}`
}

const STATUS_DARI_MUTASI: Record<string, StatusPelanggan> = {
  "0": "AKTIF",
  "1": "AKTIF",
  "2": "AKTIF",
  "3": "AKTIF",
  "4": "TUTUP_SPT",
  "5": "TUTUP_SEMENTARA",
}

export interface BarisMaster {
  periode: number
  nomorLangganan: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  kodeGolongan: string | null
  kodeSeksiCater: string | null
  mutasiKode: string
  mutasiNama: string
}

/// Pembaca CSV yang sengaja kecil dan tanpa dependensi: berkas master
/// dipisah `;`, tanpa kutip, dan tidak punya field bernewline. Memakai
/// pustaka CSV penuh di sini hanya menambah permukaan tanpa manfaat.
export function uraiMasterSti(teks: string): {
  baris: BarisMaster[]
  galat: string[]
} {
  const galat: string[] = []
  const lines = teks.split(/\r?\n/).filter((l) => l.trim() !== "")
  if (lines.length === 0) throw new BadRequestError("Berkas master kosong.")

  const header = (lines[0] ?? "").split(";").map((h) => h.trim().toLowerCase())
  const hilang = KOLOM.filter((k) => !header.includes(k))
  if (hilang.length > 0) {
    throw new BadRequestError(
      `Berkas ini bukan master pelanggan STI — kolom yang hilang: ${hilang.join(", ")}. Header yang diharapkan: ${KOLOM.join(";")}`,
    )
  }
  const idx = Object.fromEntries(
    KOLOM.map((k) => [k, header.indexOf(k)]),
  ) as Record<(typeof KOLOM)[number], number>

  const baris: BarisMaster[] = []
  const terlihat = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const k = (lines[i] ?? "").split(";")
    const ambil = (nama: (typeof KOLOM)[number]) => (k[idx[nama]] ?? "").trim()

    const nolgMentah = ambil("nolg")
    if (!nolgMentah) continue
    // Nomor langganan dipadatkan ke 11 digit — sumbernya kadang tanpa nol
    // di depan (PBPK menulis "406100935", ProgresCater "00406100935").
    const nomorLangganan = nolgMentah.toUpperCase().padStart(11, "0")
    if (nomorLangganan.length > 11) {
      galat.push(
        `baris ${i + 1}: nomor langganan "${nolgMentah}" lebih dari 11 karakter`,
      )
      continue
    }
    if (terlihat.has(nomorLangganan)) {
      galat.push(
        `baris ${i + 1}: nomor langganan ${nomorLangganan} muncul lebih dari sekali`,
      )
      continue
    }
    terlihat.add(nomorLangganan)

    const periode = Number(ambil("thbl"))
    if (!Number.isInteger(periode) || periode < 190001) {
      galat.push(
        `baris ${i + 1}: thbl "${ambil("thbl")}" bukan periode yang sah`,
      )
      continue
    }

    baris.push({
      periode,
      nomorLangganan,
      nama: ambil("nama"),
      alamat: ambil("almt"),
      rt: samakanRtRw(ambil("rt")),
      rw: samakanRtRw(ambil("rw")),
      kodeGolongan: ambil("kd_goltarif") || null,
      kodeSeksiCater: ambil("caterseksikode") || null,
      mutasiKode: ambil("mutasikode"),
      mutasiNama: ambil("mutasinama"),
    })
  }

  if (baris.length === 0)
    throw new BadRequestError(
      "Tidak ada baris yang bisa dibaca dari berkas master.",
    )
  return { baris, galat }
}

export interface RingkasMaster {
  periode: number | null
  totalBaris: number
  baru: number
  berubah: number
  sama: number
  statusBerbeda: number
  tidakAdaDiBerkas: number
}

export interface ContohPerubahan {
  nomorLangganan: string
  jenis: "BARU" | "BERUBAH" | "STATUS"
  keterangan: string
}

export interface HasilMasterSti {
  diterapkan: boolean
  statusIkutDiterapkan: boolean
  ringkas: RingkasMaster
  /// Perbedaan golongan tarif yang DITEMUKAN tapi SENGAJA TIDAK diterapkan —
  /// wajib ditindaklanjuti manusia lewat halaman Data pelanggan.
  usulGolongan: { nomorLangganan: string; dari: string; ke: string }[]
  /// Kolom yang tidak diterapkan karena nilainya berasal dari sumber yang
  /// lebih tepercaya (mis. koreksi manusia). Bukan galat — ini justru
  /// penjaga yang membuat perbaikan manual tidak terhapus impor berikutnya.
  ditolakPeringkat: { nomorLangganan: string; kolom: string }[]
  contoh: ContohPerubahan[]
  /// Baris berkas yang tidak bisa dibaca / kode mutasi tak dikenal.
  galat: string[]
  /// Ditulis hanya bila `terapkan`.
  ditulis: { dibuat: number; diperbarui: number; statusDiubah: number }
}

export interface ImporMasterInput {
  teks: string
  terapkan: boolean
  terapkanStatus: boolean
  olehUserId: string
  jejak?: { ipAddress?: string | null; userAgent?: string | null }
}

export async function imporMasterSti(
  input: ImporMasterInput,
): Promise<HasilMasterSti> {
  const { baris, galat } = uraiMasterSti(input.teks)
  const periode = baris[0]?.periode ?? null

  const [pelangganDb, golongan, seksi] = await Promise.all([
    prisma.pelanggan.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nomorLangganan: true,
        nama: true,
        alamat: true,
        rt: true,
        rw: true,
        status: true,
        tarifGolonganId: true,
        tarifGolongan: { select: { kode: true } },
        seksiCaterId: true,
        sumberKolom: true,
      },
    }),
    prisma.tarifGolongan.findMany({ select: { id: true, kode: true } }),
    prisma.seksiCater.findMany({ select: { id: true, kode: true } }),
  ])

  const dbPer = new Map(pelangganDb.map((p) => [p.nomorLangganan, p]))
  const golonganId = new Map(
    golongan.map((g) => [g.kode.trim().toUpperCase(), g.id]),
  )
  const seksiId = new Map(seksi.map((s) => [s.kode.trim().toUpperCase(), s.id]))

  const contoh: ContohPerubahan[] = []
  const tambahContoh = (c: ContohPerubahan) => {
    if (contoh.length < MAKS_CONTOH) contoh.push(c)
  }

  const akanDibuat: Prisma.PelangganCreateManyInput[] = []
  const akanDiperbarui: { id: string; data: Prisma.PelangganUpdateInput }[] = []
  const akanUbahStatus: { id: string; status: StatusPelanggan }[] = []
  /// Usulan perubahan golongan tarif — hanya untuk dibaca manusia. TIDAK
  /// pernah diterapkan oleh impor ini.
  const usulGolongan: { nomorLangganan: string; dari: string; ke: string }[] =
    []
  /// Kolom yang TIDAK diterapkan karena sudah diisi sumber berperingkat lebih
  /// tinggi (praktisnya: koreksi manusia). Dilaporkan, bukan dipaksakan.
  const ditolakPeringkat: { nomorLangganan: string; kolom: string }[] = []
  let sama = 0

  for (const b of baris) {
    const statusUsul = STATUS_DARI_MUTASI[b.mutasiKode]
    if (!statusUsul) {
      galat.push(
        `${b.nomorLangganan}: mutasikode "${b.mutasiKode}" (${b.mutasiNama}) belum dikenal — status tidak diterjemahkan`,
      )
    }
    const kunciGol = kunciGolongan(b.kodeGolongan)
    const gId = kunciGol ? (golonganId.get(kunciGol) ?? null) : null
    const sId = b.kodeSeksiCater
      ? (seksiId.get(b.kodeSeksiCater.toUpperCase()) ?? null)
      : null
    if (b.kodeGolongan && !gId) {
      galat.push(
        `${b.nomorLangganan}: golongan tarif "${b.kodeGolongan}" tidak ada di data induk`,
      )
    }

    const ada = dbPer.get(b.nomorLangganan)
    if (!ada) {
      akanDibuat.push({
        nomorLangganan: b.nomorLangganan,
        // nomorPersil wajib di skema tapi tidak ada di berkas master —
        // dikosongkan, bukan dikarang. Diisi belakangan lewat ProgresCater.
        nomorPersil: "",
        nama: b.nama,
        alamat: b.alamat,
        rt: b.rt,
        rw: b.rw,
        tarifGolonganId: gId,
        seksiCaterId: sId,
        status: statusUsul ?? "AKTIF",
        // Baris baru: seluruh identitas & alamatnya lahir dari master.
        // Golongan sengaja tidak diklaim — ia mengisi kolom kosong, tapi
        // penetapannya tetap wewenang survei bagian langganan.
        sumberKolom: {
          nama: "MASTER_STI",
          alamat: "MASTER_STI",
          rt: "MASTER_STI",
          rw: "MASTER_STI",
        },
      })
      tambahContoh({
        nomorLangganan: b.nomorLangganan,
        jenis: "BARU",
        keterangan: `${b.nama} — ${b.mutasiNama}`,
      })
      continue
    }

    // Perbedaan data (BUKAN status) — inilah yang boleh diterapkan langsung,
    // dan hanya sejauh diizinkan peringkat sumber. Master STI berperingkat
    // tinggi untuk identitas & alamat (ia terbukti utuh), tapi tetap kalah
    // dari MANUSIA: koreksi yang diketik petugas di layar tidak boleh
    // dikembalikan oleh berkas ekspor. Lihat src/lib/domain/asal-usul.ts.
    const beda: string[] = []
    const data: Prisma.PelangganUpdateInput = {}

    const usulan: Partial<Record<KolomTerjaga, unknown>> = {}
    if (b.nama) usulan.nama = b.nama
    if (b.alamat) usulan.alamat = b.alamat
    usulan.rt = b.rt
    usulan.rw = b.rw

    const saring = saringPerubahan({
      usulan,
      sumber: "MASTER_STI",
      nilaiLama: ada,
      asalUsulLama: ada.sumberKolom,
    })
    for (const kolom of saring.berubah) {
      beda.push(kolom)
      ;(data as Record<string, unknown>)[kolom] = saring.data[kolom]
    }
    if (saring.berubah.length > 0) data.sumberKolom = saring.asalUsul
    for (const kolom of saring.ditolak) {
      ditolakPeringkat.push({ nomorLangganan: b.nomorLangganan, kolom })
    }
    // Golongan tarif: DILAPORKAN, TIDAK PERNAH DITULIS. Lihat sikap 3 di
    // kepala berkas — penetapan golongan adalah keputusan hasil survei, dan
    // impor tidak berhak mengubahnya.
    if (gId && gId !== ada.tarifGolonganId) {
      usulGolongan.push({
        nomorLangganan: b.nomorLangganan,
        dari: ada.tarifGolongan?.kode ?? "(kosong)",
        ke: b.kodeGolongan ?? "?",
      })
    }
    if (sId && sId !== ada.seksiCaterId) {
      beda.push("seksi cater")
      data.seksiCater = { connect: { id: sId } }
    }

    if (beda.length > 0) {
      akanDiperbarui.push({ id: ada.id, data })
      tambahContoh({
        nomorLangganan: b.nomorLangganan,
        jenis: "BERUBAH",
        keterangan: beda.join(", "),
      })
    } else {
      sama++
    }

    if (statusUsul && statusUsul !== ada.status) {
      akanUbahStatus.push({ id: ada.id, status: statusUsul })
      tambahContoh({
        nomorLangganan: b.nomorLangganan,
        jenis: "STATUS",
        keterangan: `${ada.status} -> ${statusUsul} (${b.mutasiNama})`,
      })
    }
  }

  const nomorBerkas = new Set(baris.map((b) => b.nomorLangganan))
  const tidakAdaDiBerkas = pelangganDb.filter(
    (p) => !nomorBerkas.has(p.nomorLangganan),
  ).length

  // PENJAGA BERKAS BASI. Master adalah potret SATU periode; menerapkan potret
  // lama di atas data yang lebih baru MENGEMBALIKAN perubahan yang sudah
  // benar. Ini bukan kekhawatiran teoretis — terjadi sungguhan: menerapkan
  // PEL202604 mengembalikan golongan tarif 3 pelanggan ke nilai April,
  // termasuk satu yang naik dari 2A3 ke 3B pada Mei, sehingga tagihannya
  // salah hitung Rp 241.140.
  //
  // Sengaja PERINGATAN, bukan penolakan: membetulkan data lama dari master
  // lama kadang memang yang diinginkan. Yang tidak boleh adalah melakukannya
  // tanpa sadar.
  const periodeTerbaru = await prisma.periodePenagihan.findFirst({
    orderBy: { periode: "desc" },
    select: { periode: true },
  })
  if (periode !== null && periodeTerbaru && periode < periodeTerbaru.periode) {
    galat.push(
      `BERKAS LEBIH LAMA DARI DATA: berkas ini periode ${periode}, sedangkan sistem sudah memproses periode ${periodeTerbaru.periode}. ` +
        `Menerapkannya akan MENGEMBALIKAN perubahan yang terjadi sesudah ${periode} (mis. pelanggan yang naik golongan tarif). ` +
        `Pakai master periode terbaru kecuali Anda memang sengaja memundurkan data.`,
    )
  }

  const ringkas: RingkasMaster = {
    periode,
    totalBaris: baris.length,
    baru: akanDibuat.length,
    berubah: akanDiperbarui.length,
    sama,
    statusBerbeda: akanUbahStatus.length,
    tidakAdaDiBerkas,
  }

  if (!input.terapkan) {
    return {
      diterapkan: false,
      statusIkutDiterapkan: false,
      ringkas,
      usulGolongan,
      ditolakPeringkat,
      contoh,
      galat,
      ditulis: { dibuat: 0, diperbarui: 0, statusDiubah: 0 },
    }
  }

  // ── Penerapan ──
  let dibuat = 0
  for (let m = 0; m < akanDibuat.length; m += UKURAN_BATCH) {
    const res = await prisma.pelanggan.createMany({
      data: akanDibuat.slice(m, m + UKURAN_BATCH),
      skipDuplicates: true,
    })
    dibuat += res.count
  }

  // Pembaruan tidak bisa createMany — tiap baris beda isinya. Dijalankan
  // berkelompok paralel, pola yang sama dengan skrip seed (satu per satu ke
  // Postgres terkelola makan waktu berjam-jam untuk 22 ribu baris).
  let diperbarui = 0
  for (let m = 0; m < akanDiperbarui.length; m += 16) {
    const kelompok = akanDiperbarui.slice(m, m + 16)
    await Promise.all(
      kelompok.map((u) =>
        prisma.pelanggan.update({ where: { id: u.id }, data: u.data }),
      ),
    )
    diperbarui += kelompok.length
  }

  let statusDiubah = 0
  if (input.terapkanStatus) {
    for (let m = 0; m < akanUbahStatus.length; m += 16) {
      const kelompok = akanUbahStatus.slice(m, m + 16)
      await Promise.all(
        kelompok.map((u) =>
          prisma.pelanggan.update({
            where: { id: u.id },
            data: { status: u.status },
          }),
        ),
      )
      statusDiubah += kelompok.length
    }
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "IMPOR_MASTER_PELANGGAN",
      entitas: "Pelanggan",
      entitasId: periode === null ? null : String(periode),
      perubahan: {
        periode,
        totalBaris: baris.length,
        dibuat,
        diperbarui,
        statusDiubah,
        statusIkutDiterapkan: input.terapkanStatus,
        tidakAdaDiBerkas,
      },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
  })

  return {
    diterapkan: true,
    statusIkutDiterapkan: input.terapkanStatus,
    ringkas,
    usulGolongan,
    ditolakPeringkat,
    contoh,
    galat,
    ditulis: { dibuat, diperbarui, statusDiubah },
  }
}
