import {
  JenisPengaduan,
  KlasifikasiPengaduan,
  PrioritasPengaduan,
  StatusPengaduan,
} from "@generated"
import { prisma } from "./lib/db"
import { catatRiwayat, transisiPengaduan } from "../../src/lib/server/modules/pengaduan/alur"
import {
  ambilBatasKonfirmasiJam,
  hitungKonfirmasiBatasAt,
} from "../../src/lib/server/modules/pengaduan/otomatis"
import { hitungTargetSla } from "../../src/lib/domain/sla"

// Neon development/testing memerlukan opt-in `-- --allow-neon-test-data`.
// Gunakan `-- --dry-run` untuk pratinjau tanpa menulis data.
const STATUS: StatusPengaduan[] = Object.values(StatusPengaduan)
const PRIORITAS: PrioritasPengaduan[] = Object.values(PrioritasPengaduan)
const JENIS: JenisPengaduan[] = Object.values(JenisPengaduan)

const STATUS_LINTASAN: Record<StatusPengaduan, StatusPengaduan[]> = {
  BARU: [],
  TERVERIFIKASI: ["TERVERIFIKASI"],
  DITUGASKAN: ["DITUGASKAN"],
  MENUJU_LOKASI: ["DITUGASKAN", "MENUJU_LOKASI"],
  DIPROSES: ["DITUGASKAN", "DIPROSES"],
  MENUNGGU_PELANGGAN: ["DITUGASKAN", "MENUNGGU_PELANGGAN"],
  SELESAI: ["DITUGASKAN", "DIPROSES", "SELESAI"],
  DITUTUP: ["DITUGASKAN", "DIPROSES", "SELESAI", "DITUTUP"],
  DITOLAK: ["DITOLAK"],
  DIBUKA_KEMBALI: ["DITUGASKAN", "DIPROSES", "SELESAI", "DIBUKA_KEMBALI"],
}

const KLASIFIKASI_TAGIHAN = new Set<JenisPengaduan>([
  "LAPOR_STAND_METER",
  "MUTASI_GOLONGAN_TARIF",
  "TIDAK_MAMPU_BAYAR",
  "PENCATATAN_METER_TIDAK_SESUAI",
  "LONJAKAN_PEMAKAIAN_AIR",
])

const DETAIL_JENIS: Record<JenisPengaduan, { judul: string; deskripsi: string }> = {
  LAPOR_STAND_METER: {
    judul: "Laporan angka stand meter",
    deskripsi: "Angka stand meter pada rekening berbeda dari angka yang terlihat di meter rumah.",
  },
  MUTASI_GOLONGAN_TARIF: {
    judul: "Permohonan pemeriksaan golongan tarif",
    deskripsi: "Pelanggan meminta pemeriksaan ulang golongan tarif yang digunakan pada rekening.",
  },
  TIDAK_MAMPU_BAYAR: {
    judul: "Permohonan konsultasi pembayaran",
    deskripsi: "Pelapor meminta informasi dan bantuan terkait kesulitan pembayaran rekening air.",
  },
  PENCATATAN_METER_TIDAK_SESUAI: {
    judul: "Keberatan pencatatan meter",
    deskripsi: "Hasil pencatatan meter yang tercantum pada rekening perlu diperiksa kembali.",
  },
  LONJAKAN_PEMAKAIAN_AIR: {
    judul: "Pemakaian air meningkat",
    deskripsi: "Pemakaian pada rekening meningkat dibanding periode sebelumnya dan meminta pemeriksaan.",
  },
  GANTI_STOP_KRAN: {
    judul: "Permintaan pemeriksaan stop kran",
    deskripsi: "Stop kran sambungan perlu diperiksa karena sulit ditutup dan terlihat mengalami kerusakan.",
  },
  BOCOR_PIPA_DINAS: {
    judul: "Kebocoran pipa distribusi",
    deskripsi: "Terlihat air keluar dari pipa distribusi di lokasi. Mohon petugas memeriksa dan menangani kebocoran.",
  },
  PASANGAN_LIAR: {
    judul: "Laporan dugaan sambungan tidak resmi",
    deskripsi: "Pelapor meminta petugas memeriksa dugaan sambungan jaringan yang belum tercatat.",
  },
  TIDAK_ADA_AIR: {
    judul: "Pasokan air tidak mengalir",
    deskripsi: "Pasokan air di lokasi tidak mengalir. Pelapor sudah memeriksa instalasi di dalam bangunan.",
  },
  AIR_KERUH_BAU_BERWARNA: {
    judul: "Kualitas air berubah",
    deskripsi: "Air yang diterima tampak keruh dan memiliki bau atau warna yang tidak biasa.",
  },
  PINDAH_JARINGAN: {
    judul: "Permohonan pemindahan jaringan",
    deskripsi: "Pelapor meminta pemeriksaan kemungkinan pemindahan jalur jaringan di sekitar sambungan.",
  },
  LAINNYA: {
    judul: "Pertanyaan layanan lainnya",
    deskripsi: "Pelapor menyampaikan pertanyaan layanan yang memerlukan pemeriksaan petugas.",
  },
}

const NAMA_PELAPOR = [
  "Ayu Lestari",
  "Bima Pratama",
  "Citra Permata",
  "Dedi Setiawan",
  "Eka Puspita",
  "Farhan Nugraha",
  "Gita Maharani",
  "Hadi Saputra",
  "Intan Safitri",
  "Joko Firmansyah",
]

const PELAKU_PELAPOR = { id: null, nama: "Pelapor" }
const PELAKU_SISTEM = { id: null, nama: "Sistem" }
const AWAL_NOMOR_TIKET = "UJI-PENGADUAN-"

function pastikanTargetDatabase(): void {
  const url = process.env.DATABASE_URL
  let host = ""
  try {
    if (!url) throw new Error("DATABASE_URL tidak ditemukan.")
    host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname
  } catch {
    throw new Error(
      "Seed pengaduan uji ditolak: DATABASE_URL tidak ada atau tidak valid.",
    )
  }

  if (["localhost", "127.0.0.1", "::1", "db"].includes(host)) return

  const izinkanNeonTest = process.argv.includes("--allow-neon-test-data")
  if (izinkanNeonTest && host.toLowerCase().endsWith(".neon.tech")) {
    console.warn(
      `PERINGATAN: seed akan menulis atau memperbarui tiket uji di Neon (${host}).`,
    )
    return
  }

  if (!izinkanNeonTest) {
    throw new Error(
      `Seed pengaduan uji ditolak untuk database remote (host terbaca: ${host}). ` +
        "Untuk Neon development/testing saja, jalankan dengan -- --allow-neon-test-data.",
    )
  }

  throw new Error(
    `Seed pengaduan uji hanya mengizinkan localhost atau Neon saat opt-in (host terbaca: ${host}).`,
  )
}

function buatNomorTiket(index: number): string {
  return `${AWAL_NOMOR_TIKET}${String(index + 1).padStart(3, "0")}`
}

function tanggalContoh(index: number): Date {
  const hariLalu = (index % 21) + 1
  return new Date(Date.now() - hariLalu * 24 * 60 * 60 * 1000)
}

function jalurJenis(jenis: JenisPengaduan, index: number) {
  const detail = DETAIL_JENIS[jenis]
  const nomor = String(index + 1).padStart(3, "0")
  return {
    klasifikasi: KLASIFIKASI_TAGIHAN.has(jenis)
      ? KlasifikasiPengaduan.NILAI_TAGIHAN_REKENING
      : KlasifikasiPengaduan.BUKAN_NILAI_TAGIHAN_REKENING,
    jenis,
    judul: `[UJI ${nomor}] ${detail.judul}`,
    deskripsi: detail.deskripsi,
  }
}

async function seedPengaduanUji(): Promise<void> {
  if (process.argv.includes("--dry-run")) {
    console.log(
      `Dry run: ${STATUS.length * PRIORITAS.length} tiket akan dibuat/diperbarui; ` +
        `${JENIS.length} jenis, ${PRIORITAS.length} prioritas, ${STATUS.length} status.`,
    )
    return
  }

  pastikanTargetDatabase()

  const [pelanggan, petugas] = await Promise.all([
    prisma.pelanggan.findMany({
      where: { deletedAt: null },
      select: { id: true, nomorLangganan: true },
      orderBy: { nomorLangganan: "asc" },
      take: STATUS.length * PRIORITAS.length,
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          in: [
            "STAFF",
            "SUPERVISOR",
            "MANAGER",
            "SENIOR_MANAGER",
            "DIREKSI",
            "SUPER_ADMIN",
          ],
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 10,
    }),
  ])

  if (pelanggan.length === 0) {
    console.warn("Tidak ada pelanggan aktif; tiket uji dibuat tanpa relasi pelanggan.")
  }
  if (petugas.length === 0) {
    console.warn("Tidak ada petugas/staf aktif; tiket yang ditugaskan tidak memiliki petugas.")
  }

  let dibuat = 0
  let diperbarui = 0
  const total = STATUS.length * PRIORITAS.length
  const batasKonfirmasiJam = await ambilBatasKonfirmasiJam()

  for (let index = 0; index < total; index++) {
    const status = STATUS[Math.floor(index / PRIORITAS.length)]!
    const prioritas = PRIORITAS[index % PRIORITAS.length]!
    const jenis = JENIS[index % JENIS.length]!
    const nomorTiket = buatNomorTiket(index)
    const waktuBuat = tanggalContoh(index)
    const sla = hitungTargetSla(prioritas, waktuBuat)
    const dataJenis = jalurJenis(jenis, index)
    const pelangganTerpilih = pelanggan[index % Math.max(pelanggan.length, 1)]
    const pelapor = NAMA_PELAPOR[index % NAMA_PELAPOR.length]!
    const petugasTerpilih = petugas[index % Math.max(petugas.length, 1)]
    const lintasan = STATUS_LINTASAN[status]

    const baruDibuat = await prisma.$transaction(async (tx) => {
      const ada = await tx.pengaduan.findUnique({
        where: { nomorTiket },
        select: { id: true },
      })

      const baseData = {
        ...dataJenis,
        nomorTiket,
        clientRequestId: null,
        pelangganId: pelangganTerpilih?.id ?? null,
        nomorLangganan:
          pelangganTerpilih?.nomorLangganan ??
          String(99999000000 + index).padStart(11, "0"),
        prioritas,
        status: StatusPengaduan.BARU,
        pelapor,
        kontakPelapor: `08120000${String(index + 1).padStart(4, "0")}`,
        alamatKejadian: `Alamat simulasi ${index + 1}, Kota Bandung`,
        fotoUrl: null,
        videoUrl: null,
        ditugaskanKeId: null,
        ditanganiMulai: null,
        selesaiAt: null,
        catatanPenyelesaian: null,
        targetResponsAt: sla.targetResponsAt,
        targetSelesaiAt: sla.targetSelesaiAt,
        responsAt: null,
        jedaMulaiAt: null,
        jedaTotalMenit: 0,
        eskalasiAt: null,
        eskalasiKeId: null,
        alasanEskalasi: null,
        ratingKepuasan: null,
        komentarKepuasan: null,
        ratingAt: null,
        jumlahDibukaKembali: 0,
        fotoPenyelesaianUrl: null,
        konfirmasiBatasAt: null,
        verifikasiAt: null,
        createdAt: waktuBuat,
      }

      const row = ada
        ? await tx.pengaduan.update({
            where: { nomorTiket },
            data: baseData,
          })
        : await tx.pengaduan.create({ data: baseData })

      await tx.riwayatPengaduan.deleteMany({
        where: { pengaduanId: row.id },
      })
      await catatRiwayat(tx, {
        pengaduanId: row.id,
        aksi: "DIBUAT",
        oleh: PELAKU_PELAPOR,
        catatan: "Tiket simulasi dibuat untuk pengujian halaman pengaduan.",
        isPublik: true,
      })

      if (jenis === "BOCOR_PIPA_DINAS") {
        await tx.$executeRaw`
          UPDATE "pengaduan"
          SET "koordinat" = ST_SetSRID(ST_MakePoint(107.6098, -6.9147), 4326)
          WHERE "id" = ${row.id}
        `
      }

      for (const tujuan of lintasan) {
        const ditugaskan = tujuan === "DITUGASKAN"
        await transisiPengaduan(tx, {
          pengaduanId: row.id,
          ke: tujuan,
          oleh: ditugaskan ? { id: petugasTerpilih?.id ?? null, nama: petugasTerpilih?.name ?? "Petugas simulasi" } : PELAKU_SISTEM,
          aksi: tujuan === "TERVERIFIKASI"
            ? "DIVERIFIKASI"
            : tujuan === "DITUGASKAN"
              ? "DITUGASKAN"
              : tujuan === "DIBUKA_KEMBALI"
                ? "DIBUKA_KEMBALI"
                : tujuan === "DITUTUP"
                  ? "DIKONFIRMASI"
                  : "STATUS_DIUBAH",
          catatan:
            tujuan === "TERVERIFIKASI"
              ? "Kelengkapan laporan sudah diperiksa."
              : tujuan === "DITUGASKAN"
                ? "Ditugaskan untuk simulasi penanganan."
                : tujuan === "MENUNGGU_PELANGGAN"
                  ? "Menunggu informasi tambahan dari pelapor."
                  : tujuan === "SELESAI"
                    ? "Perbaikan simulasi telah diselesaikan."
                    : tujuan === "DIBUKA_KEMBALI"
                      ? "Pelapor menyampaikan masalah belum sepenuhnya selesai."
                      : null,
          isPublik: tujuan === "SELESAI" || tujuan === "DIBUKA_KEMBALI",
          ...(ditugaskan ? { ditugaskanKeId: petugasTerpilih?.id ?? null } : {}),
          ...(tujuan === "SELESAI"
            ? {
                catatanPenyelesaian: "Pemeriksaan dan tindak lanjut simulasi selesai.",
                fotoPenyelesaianUrl: "/logo.png",
                fotoUrl: "/logo.png",
                konfirmasiBatasAt: hitungKonfirmasiBatasAt(
                  new Date(),
                  batasKonfirmasiJam,
                ),
              }
            : {}),
        })
      }

      if (status === "DITUTUP") {
        const rating = (index % 5) + 1
        await tx.pengaduan.update({
          where: { id: row.id },
          data: {
            ratingKepuasan: rating,
            komentarKepuasan: "Penilaian simulasi setelah tiket dikonfirmasi.",
            ratingAt: new Date(),
          },
        })
        await catatRiwayat(tx, {
          pengaduanId: row.id,
          aksi: "DINILAI",
          oleh: PELAKU_PELAPOR,
          catatan: `Penilaian simulasi: ${rating}/5.`,
          isPublik: true,
        })
      }

      if (index % 4 === 0) {
        await catatRiwayat(tx, {
          pengaduanId: row.id,
          aksi: "CHAT",
          oleh: PELAKU_PELAPOR,
          catatan: "Halo, apakah ada perkembangan penanganan laporan saya?",
          isPublik: true,
        })
      }

      if (index % 5 === 0) {
        await catatRiwayat(tx, {
          pengaduanId: row.id,
          aksi: "CATATAN",
          oleh: PELAKU_SISTEM,
          catatan: "Catatan internal simulasi untuk pengujian linimasa staf.",
        })
      }

      return !ada
    })

    if (baruDibuat) dibuat++
    else diperbarui++
  }

  console.log(
    `Seed pengaduan uji selesai: ${dibuat} tiket dibuat, ${diperbarui} tiket diperbarui.`,
  )
  console.log(
    `Cakupan: ${JENIS.length} jenis, ${PRIORITAS.length} prioritas, ${STATUS.length} status (${total} kombinasi status-prioritas).`,
  )
}

seedPengaduanUji()
  .catch((error: unknown) => {
    console.error("Seed pengaduan uji gagal:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
