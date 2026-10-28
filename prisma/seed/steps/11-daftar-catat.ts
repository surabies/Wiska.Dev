// prisma/seed/steps/11-daftar-catat.ts — DAFTAR CATAT PER PERIODE +
// DETEKSI CABUTAN, diturunkan progresif bulan demi bulan.
//
// ATURAN YANG DIPEGANG — DIKOREKSI 2026-08-01. Versi sebelumnya menyatakan
// "ProgresCater adalah SUMBER KEBENARAN, lapdatameter TIDAK dipakai di sini".
// Itu terbalik, dan akibatnya daftar catat yang dibangun bukan daftar kerja
// melainkan hasil closing bulan sebelumnya.
//
//   `lapdatametertes.csv` = DAFTAR CATAT (DPM) — daftar kerja petugas yang
//     benar-benar dijalankan di Aurora. Inilah acuannya.
//
//   `ProgresCater-PW5.csv` = HASIL CLOSING (DRD) — KELUARAN periode yang
//     sudah ditutup. Di aplikasi ini padanannya ekspor DRD.
//
// DPM(N) = lapdatameter(N) ∪ ProgresCater(N)
//
// Suku kedua bukan hiasan. Daftar kerja Aurora sesekali kehilangan satu rute
// UTUH karena gagal unggah, sementara pelanggannya tetap ditagih:
//
//     Maret : 157 sambungan — rute TA607 (84) & KC202 (68), petugas DANI &
//             DIDIN. 156 di antaranya tetap ditagih, dan 156 kembali ke
//             daftar April.
//     April :  34 sambungan — SELURUHNYA rute KC302, petugas DIDIN. 34/34
//             tetap ditagih, semuanya kembali di Mei.
//
// Tanpa penggabungan itu, satu kegagalan unggah menghapus seluruh rute dari
// daftar kerja padahal tagihannya terus terbit.
//
// ARITMETIKA yang tereproduksi (diuji anggota per anggota, bukan cuma
// jumlah), pada periode yang berkas sumbernya lengkap:
//
//     Daftar catat(N) = ditagih(N) + dicabut pada N + PBPK(N)
//
//     Mei  : 22.523 + 19 + 11 = 22.553   ✓ identik dengan lapdatameter Mei
//     Juni : 22.515 + 19 +  5 = 22.539   ✓
//     Juli : 22.511 +  9 + 11 = 22.531   ✓
//
// Yang dicabut PADA bulan N TETAP masuk daftar kerja bulan itu — petugas
// tetap mengunjunginya — tapi TIDAK ditagih. Begitu pula PBPK bulan N:
// dicatat dengan stand nol, ditagih baru bulan berikutnya. Keduanya
// ditegakkan saat closing (packages/server/modules/closing/closing.service.ts).
//
// PBPK TIDAK dibaca di sini — ia masuk lewat jalur aplikasi (/dashboard/pbpk)
// yang membuat baris daftar catat sendiri bersumber PBPK. Karena itu, untuk
// periode yang PBPK-nya belum diimpor, DPM hasil seed akan kurang sebanyak
// PBPK periode itu. Itu bukan kesalahan aritmetika, melainkan pekerjaan yang
// memang belum dilakukan — dan barisnya dilaporkan di akhir step ini.
//
// JENIS PENCABUTAN TIDAK PERNAH DITEBAK. Kalau nomornya ada di r-nomor,
// jenisnya diambil dari sana lewat mapJenisPemutusanToStatus() di
// lib/status.ts — kamus yang sama yang menerjemahkan dialek ProgresCater,
// supaya "SPT" dan "tupsp" tidak berujung status berbeda.
// Kalau tidak ada di r-nomor mana pun, statusnya diset TUTUP_SEMENTARA —
// pilihan yang PALING TIDAK MERUGIKAN karena masih bisa dibuka kembali,
// sedangkan TUTUP_SPT mengunci sambungan sampai tunggakan lunas — dan
// barisnya DILAPORKAN supaya petugas menentukan jenis sebenarnya.
// TSM dan SPT berbeda akibat hukumnya; menebak di antara keduanya bukan
// wewenang skrip.
//
// PERIODE r-nomor DIAMBIL DARI KOLOMNYA, bukan dari folder tempat berkasnya
// disimpan: pencabutan yang dicatat bulan ini bisa saja terjadi bulan lalu.

import type { Prisma, StatusPelanggan } from "@generated"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { PERIODE_TERSEDIA, readLapDataMeterPeriode, readProgresCaterPeriode } from "../lib/csv"
import { normalizeNolg } from "../lib/normalize"
import { statusTerminal } from "../lib/status"

const STEP = "11-daftar-catat"

/// 22 ribu insert satu per satu ke Postgres terkelola makan waktu berjam-jam.
const UKURAN_BATCH = 1000

interface SnapshotBaris {
  ruteKode: string
  pencatat: string
  /// Kode kelainan catat dari lapdatameter (`Kd_kel`). "D" = DI CABUT —
  /// satu-satunya sinyal cabutan yang tersedia pada periode PERTAMA, saat
  /// belum ada bulan pembanding. Kosong untuk baris yang berasal dari
  /// ProgresCater (kolom itu tidak ada di sana).
  kondisi: string
}

interface IsiPeriode {
  thbl: number
  /// nolg -> snapshot rute/petugas, dari baris ProgresCater periode itu.
  /// Ini yang BERTAGIHAN — dipakai sebagai penambal daftar kerja dan sebagai
  /// pembanding untuk mendeteksi cabutan.
  ditagih: Map<string, SnapshotBaris>
  /// nolg -> snapshot rute/petugas, dari baris lapdatameter periode itu.
  /// Inilah DAFTAR KERJA sebenarnya.
  daftarKerja: Map<string, SnapshotBaris>
  /// Gabungan keduanya = anggota DPM periode ini (lihat kepala berkas).
  anggota: Map<string, SnapshotBaris>
  /// Ada di daftar kerja tapi tidak di ProgresCater — dilaporkan supaya
  /// selisihnya bisa ditelusuri, bukan lenyap tanpa jejak.
  takDitagih: string[]
  /// Ditagih tapi tidak ada di daftar kerja — gejala rute gagal terunggah.
  takDidaftar: string[]
}

function bacaPeriode(folder: string, thbl: number): IsiPeriode {
  const ditagih = new Map<string, SnapshotBaris>()
  for (const row of readProgresCaterPeriode(folder)) {
    const nolg = normalizeNolg(row.nolg)
    if (!nolg) continue
    ditagih.set(nolg, {
      ruteKode: (row.rute_kode ?? "").trim(),
      pencatat: (row.pencatat ?? "").trim().toUpperCase(),
      kondisi: "",
    })
  }

  const daftarKerja = new Map<string, SnapshotBaris>()
  for (const row of readLapDataMeterPeriode(folder)) {
    // `No Pel` berawalan karakter tab literal di sumber — normalizeNolg
    // sudah menanganinya bersama zero-pad 11 digit.
    const nolg = normalizeNolg(row["No Pel"])
    if (!nolg) continue
    // `?? ""` bukan basa-basi: pembaca CSV memakai relax_column_count, jadi
    // baris yang kolomnya kurang menghasilkan undefined — dan `.trim()` di
    // atasnya akan menggagalkan SELURUH step gara-gara satu baris cacat.
    daftarKerja.set(nolg, {
      ruteKode: (row.Rute ?? "").trim(),
      // "-" di kolom petugas berarti BELUM berpetugas (lazim pada sambungan
      // PBPK yang baru dibuka), bukan nama petugas bernama "-".
      pencatat: (row["Nama Petugas"] ?? "").trim().toUpperCase().replace(/^-$/, ""),
      kondisi: (row.Kd_kel ?? "").trim().toUpperCase(),
    })
  }

  // Daftar kerja menang sebagai sumber snapshot: ia yang mencerminkan
  // penugasan saat kunjungan. ProgresCater hanya mengisi yang tidak ada.
  const anggota = new Map(daftarKerja)
  for (const [nolg, snap] of ditagih) if (!anggota.has(nolg)) anggota.set(nolg, snap)

  const takDitagih = [...daftarKerja.keys()].filter((n) => !ditagih.has(n))
  const takDidaftar = [...ditagih.keys()].filter((n) => !daftarKerja.has(n))

  return { thbl, ditagih, daftarKerja, anggota, takDitagih, takDidaftar }
}

export async function seedDaftarCatat(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const periode = PERIODE_TERSEDIA.map((p) => bacaPeriode(p.folder, p.thbl))

  const [pelangganRows, ruteRows, pencatatRows] = await Promise.all([
    prisma.pelanggan.findMany({
      select: { id: true, nomorLangganan: true, nama: true, noUrutRute: true, status: true },
    }),
    prisma.rute.findMany({ select: { id: true, kode: true } }),
    prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } }),
  ])
  const pelangganCache = new Map(pelangganRows.map((p) => [p.nomorLangganan, p]))
  const ruteCache = new Map(ruteRows.map((r) => [r.kode, r.id]))
  const pencatatCache = new Map(pencatatRows.map((p) => [p.namaLapangan, p.id]))

  /// Sekali keluar, tidak kembali sendiri. Tanpa penanda ini, pelanggan yang
  /// hilang di Februari akan terhitung "dicabut lagi" setiap bulan sesudahnya.
  const sudahDicabut = new Set<string>()
  const perluTinjau: string[] = []
  const ringkasan: string[] = []

  for (let i = 0; i < periode.length; i++) {
    const kini = periode[i]!
    const lalu = i > 0 ? periode[i - 1]! : null

    // Dicabut PADA periode ini — dua sinyal yang saling melengkapi, dan
    // keduanya DATA, bukan tebakan:
    //
    //   1. Ada di DRD bulan lalu, hilang dari DRD bulan ini. Terverifikasi
    //      persis terhadap r-nomor di enam transisi: 24/24, 26/27, 10/10,
    //      19/19, 19/19, 9/9.
    //   2. Kondisi catat "D" (DI CABUT) di daftar kerja DAN tidak ditagih
    //      bulan ini. Sinyal ini yang menyelamatkan periode PERTAMA, yang
    //      tidak punya bulan pembanding sama sekali — dan menangkap cabutan
    //      yang kondisinya sudah "D" sebelum hilang dari DRD.
    //
    // Yang sudah dicabut sebelumnya tidak dihitung ulang: tanpa penjagaan
    // itu, pelanggan yang hilang di Februari akan terhitung "dicabut lagi"
    // setiap bulan sesudahnya.
    const dicabutKini = new Set<string>()
    if (lalu) {
      for (const nolg of lalu.ditagih.keys()) {
        if (!kini.ditagih.has(nolg) && !sudahDicabut.has(nolg)) dicabutKini.add(nolg)
      }
    }
    for (const nolg of kini.takDitagih) {
      if (kini.daftarKerja.get(nolg)?.kondisi === "D" && !sudahDicabut.has(nolg)) dicabutKini.add(nolg)
    }

    // Ada di daftar kerja, tidak ditagih, dan bukan cabutan = SAMBUNGAN BARU
    // yang dibuka dengan stand nol (PBPK). Sisa ini tepat sama dengan isi
    // berkas PBPK di setiap periode yang berkasnya ada: 26, 8, 5, 15, 11, 5.
    // Ditandai sumber PBPK supaya closing tahu belum boleh menagihnya.
    const pbpkKini = new Set(kini.takDitagih.filter((n) => !dicabutKini.has(n)))

    // STATUS = BELUM_DICATAT, dan itu bukan kelalaian.
    //
    // Seed tidak membuat PembacaanMeter (lihat steps/06-meter.ts). Menandai
    // baris `DICATAT` berarti menyatakan "petugas sudah mengunjungi dan
    // mencatat" padahal tidak ada satu pun pembacaan di database yang
    // mendukungnya — klaim tanpa dasar, dan database yang berbohong tentang
    // dirinya sendiri lebih berbahaya daripada database yang kosong.
    //
    // Efek sampingnya juga nyata: penjaga di bulan-baru.service menolak
    // menerbitkan ulang DPM bila ada baris berstatus selain BELUM_DICATAT.
    // Menandai hasil seed `DICATAT` mengunci seluruh periode dari alur
    // normal aplikasi sejak menit pertama.
    //
    // Statusnya berpindah ke DICATAT saat closing, dari bukti yang benar:
    // adanya PembacaanMeter periode itu.
    const anggota = new Map<string, { sumber: "CARRY_OVER" | "PBPK"; status: "BELUM_DICATAT" | "DICABUT" }>()
    // Basisnya DAFTAR KERJA, lalu ditambal oleh yang bertagihan (lihat kepala
    // berkas: satu rute utuh bisa hilang dari daftar kerja karena gagal
    // unggah, sementara pelanggannya tetap ditagih).
    for (const nolg of kini.daftarKerja.keys()) anggota.set(nolg, { sumber: "CARRY_OVER", status: "BELUM_DICATAT" })
    for (const nolg of kini.ditagih.keys()) anggota.set(nolg, { sumber: "CARRY_OVER", status: "BELUM_DICATAT" })
    for (const nolg of pbpkKini) anggota.set(nolg, { sumber: "PBPK", status: "BELUM_DICATAT" })
    // DICABUT tetap ditandai: ini kejadian yang TERBUKTI dari data (hilang
    // dari DRD, atau kondisi catat "D"), bukan klaim tentang pencatatan.
    for (const nolg of dicabutKini) anggota.set(nolg, { sumber: "CARRY_OVER", status: "DICABUT" })

    const baris: Prisma.DaftarCatatUncheckedCreateInput[] = []
    for (const [nolg, info] of anggota) {
      const pelanggan = pelangganCache.get(nolg)
      if (!pelanggan) {
        report.warn(STEP, `${nolg} ada di daftar kerja ${kini.thbl} tapi tidak punya baris Pelanggan — dilewati`, {
          key: nolg,
        })
        report.skipped(STEP)
        continue
      }
      // Snapshot rute & petugas: dari daftar kerja periode ini lebih dulu
      // (itu penugasan saat kunjungan sebenarnya), lalu DRD periode ini,
      // baru daftar bulan lalu untuk baris yang tidak muncul di keduanya.
      const snap =
        kini.daftarKerja.get(nolg) ??
        kini.ditagih.get(nolg) ??
        lalu?.daftarKerja.get(nolg) ??
        lalu?.ditagih.get(nolg) ??
        null
      baris.push({
        periode: kini.thbl,
        pelangganId: pelanggan.id,
        ruteId: snap ? (ruteCache.get(snap.ruteKode) ?? null) : null,
        pencatatId: snap ? (pencatatCache.get(snap.pencatat) ?? null) : null,
        urutan: pelanggan.noUrutRute ?? 0,
        sumber: info.sumber,
        status: info.status,
        selesaiAt: new Date(),
      })
    }

    for (let m = 0; m < baris.length; m += UKURAN_BATCH) {
      const res = await prisma.daftarCatat.createMany({
        data: baris.slice(m, m + UKURAN_BATCH),
        skipDuplicates: true,
      })
      for (let n = 0; n < res.count; n++) report.created(STEP)
    }

    // ── Status pelanggan yang dicabut pada periode ini.
    for (const nolg of dicabutKini) {
      sudahDicabut.add(nolg)
      const pelanggan = pelangganCache.get(nolg)
      if (!pelanggan) continue

      // ARSIP: setiap nomor yang terdeteksi hilang dari ProgresCater WAJIB
      // meninggalkan jejak permanen di tabel Pemutusan — sebelumnya cuma
      // tercatat di statusChange laporan JSON seed (hilang begitu file
      // laporannya tidak dibuka lagi) dan/atau perubahan status Pelanggan
      // (yang bisa tertimpa kalau statusnya berubah lagi belakangan).
      // jenis=LAINNYA + sumberData="PROGRESCATER_HILANG": pola yang SAMA
      // dengan baris asal survei geojson (lihat komentar sumberData di
      // schema) — sama-sama "terkonfirmasi hilang, alasan pasti belum
      // diketahui". sumberKey menjaga idempoten kalau seed dijalankan ulang.
      await prisma.pemutusan.upsert({
        where: { sumberKey: `PROGRESCATER:${kini.thbl}:${nolg}` },
        create: {
          pelangganId: pelanggan.id,
          nomorLangganan: nolg,
          namaPelanggan: pelanggan.nama,
          jenis: "LAINNYA",
          periode: kini.thbl,
          sumberData: "PROGRESCATER_HILANG",
          sumberKey: `PROGRESCATER:${kini.thbl}:${nolg}`,
          catatan: `Hilang dari ProgresCater ${kini.thbl} tanpa baris r-nomor pendamping — jenis pencabutan perlu ditinjau lewat layar pemutusan.`,
        },
        update: {},
      })

      // JENIS pemutusannya TIDAK bisa disimpulkan di sini, dan itu memang
      // seharusnya. ProgresCater cuma memberi tahu sebuah nomor HILANG; yang
      // tahu apakah itu tutup sementara (permintaan pelanggan) atau tutup SPT
      // (karena tunggakan) adalah berkas r-nomor, dan r-nomor masuk lewat
      // layar pemutusan menjelang closing — bukan lewat seed.
      let status: StatusPelanggan
      let alasan: string
      if (statusTerminal(pelanggan.status)) {
        // Sudah terminal dari BUKTI (mis. "tupsp" di ProgresCater lewat
        // step 05). Tebakan tanpa bukti TIDAK BOLEH menurunkannya: sekali
        // jadi TUTUP_SEMENTARA, sambungan bisa diaktifkan lagi tanpa
        // melunasi tunggakan. Dulu justru ini yang terjadi — 38 pelanggan
        // turun dari TUTUP_SPT hanya karena step 11 jalan belakangan.
        continue
      } else {
        // TUTUP_SEMENTARA adalah tebakan yang PALING TIDAK MERUGIKAN —
        // ia masih bisa dibuka kembali, sedangkan TUTUP_SPT mengunci
        // sambungan sampai tunggakannya lunas. Barisnya dilaporkan.
        // TUTUP_SEMENTARA adalah pilihan PALING TIDAK MERUGIKAN: masih bisa
        // dibuka kembali, sedangkan TUTUP_SPT mengunci sambungan sampai
        // tunggakannya lunas.
        status = "TUTUP_SEMENTARA"
        alasan = `hilang dari ProgresCater ${kini.thbl} — jenis pencabutan PERLU DITINJAU lewat layar pemutusan`
        perluTinjau.push(nolg)
      }

      if (pelanggan.status !== status) {
        await prisma.pelanggan.update({ where: { id: pelanggan.id }, data: { status } })
        report.statusChange({ nomorLangganan: nolg, from: pelanggan.status, to: status, reason: alasan })
        pelanggan.status = status
      }
    }

    ringkasan.push(
      `${kini.thbl}: ${anggota.size} = ditagih ${kini.ditagih.size}` +
        ` + dicabut ${dicabutKini.size} + PBPK ${pbpkKini.size}` +
        (kini.takDidaftar.length > 0 ? ` (+${kini.takDidaftar.length} ditambal dari DRD)` : "")
    )

    // Sambungan yang DITAGIH tapi tidak ada di daftar kerja periode itu.
    // Bukan sekadar keganjilan angka: itu tanda satu rute gagal terunggah,
    // dan tanpa penambalan di atas seluruh pelanggannya akan lenyap dari
    // daftar kerja meski tagihannya terus terbit.
    if (kini.takDidaftar.length > 0) {
      report.warn(
        STEP,
        `${kini.thbl}: ${kini.takDidaftar.length} sambungan BERTAGIHAN tapi tidak ada di daftar kerja ` +
          `(lapdatameter) — ditambal dari DRD. Periksa apakah ada rute yang gagal terunggah: ` +
          `${kini.takDidaftar.slice(0, 10).join(", ")}` +
          `${kini.takDidaftar.length > 10 ? ` … (+${kini.takDidaftar.length - 10} lagi)` : ""}`
      )
    }
  }

  // Ringkasan per periode dicetak sebagai satu warning supaya ikut masuk
  // laporan JSON — SeedReport tidak punya kanal "info".
  report.warn(STEP, `Aritmetika daftar catat per periode — ${ringkasan.join(" | ")}`)

  if (perluTinjau.length > 0) {
    report.warn(
      STEP,
      `${perluTinjau.length} pelanggan hilang dari ProgresCater tanpa baris r-nomor — status diset TUTUP_SEMENTARA, jenis pencabutan WAJIB ditinjau petugas: ${perluTinjau
        .slice(0, 20)
        .join(", ")}${perluTinjau.length > 20 ? ` … (+${perluTinjau.length - 20} lagi)` : ""}`
    )
  }
}
