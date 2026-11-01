import { prisma } from "@db"
import {
  TANGGAL_BUKA_LAPOR_MANDIRI,
  TANGGAL_TUTUP_LAPOR_MANDIRI,
  jendelaLaporMandiri,
} from "@/lib/domain/LaporMandiri"
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  isPrismaKnownError,
} from "../../lib/Galat"

export const KUNCI_TANGGAL_BUKA = "LAPOR_MANDIRI_TANGGAL_BUKA"
export const KUNCI_TANGGAL_TUTUP = "LAPOR_MANDIRI_TANGGAL_TUTUP"

function parseTanggalKonfigurasi(
  nilai: string | undefined,
  nilaiDefault: number,
  kunci: string
): number {
  if (nilai === undefined) return nilaiDefault
  if (!/^\d{1,2}$/.test(nilai)) {
    throw new Error(`Nilai konfigurasi ${kunci} harus berupa bilangan bulat.`)
  }
  const angka = Number(nilai)
  if (angka < 1 || angka > 28) {
    throw new Error(
      `Nilai konfigurasi ${kunci} harus berada pada rentang 1–28.`
    )
  }
  return angka
}

export async function dapatkanJendelaLaporMandiri(sekarang = new Date()) {
  const konfigurasi = await prisma.konfigurasi.findMany({
    where: {
      kunci: { in: [KUNCI_TANGGAL_BUKA, KUNCI_TANGGAL_TUTUP] },
    },
    select: { kunci: true, nilai: true },
  })
  const nilai = new Map(konfigurasi.map((item) => [item.kunci, item.nilai]))
  const tanggalBuka = parseTanggalKonfigurasi(
    nilai.get(KUNCI_TANGGAL_BUKA),
    TANGGAL_BUKA_LAPOR_MANDIRI,
    KUNCI_TANGGAL_BUKA
  )
  const tanggalTutup = parseTanggalKonfigurasi(
    nilai.get(KUNCI_TANGGAL_TUTUP),
    TANGGAL_TUTUP_LAPOR_MANDIRI,
    KUNCI_TANGGAL_TUTUP
  )

  return jendelaLaporMandiri(sekarang, { tanggalBuka, tanggalTutup })
}

export async function daftarPeriodeUjiLaporMandiri() {
  if (process.env.NODE_ENV === "production") return []

  const [daftarCatat, periodeTerkunci] = await Promise.all([
    prisma.daftarCatat.groupBy({
      by: ["periode"],
      orderBy: { periode: "desc" },
    }),
    prisma.periodePenagihan.findMany({
      where: { status: "TERKUNCI" },
      select: { periode: true },
    }),
  ])
  const terkunci = new Set(periodeTerkunci.map((row) => row.periode))
  return daftarCatat
    .map((row) => row.periode)
    .filter((periode) => !terkunci.has(periode))
}

export async function pastikanPeriodeUjiLaporMandiri(
  nilai: string | null | undefined
) {
  if (process.env.NODE_ENV === "production") {
    throw new BadRequestError("Pemilihan periode uji tidak tersedia.")
  }
  if (!nilai || !/^\d{6}$/.test(nilai)) {
    throw new BadRequestError(
      "Periode uji harus dipilih dari daftar yang tersedia."
    )
  }

  const periode = Number(nilai)
  const tersedia = await daftarPeriodeUjiLaporMandiri()
  if (!tersedia.includes(periode)) {
    throw new BadRequestError(
      "Periode uji tidak tersedia atau sudah terkunci. Pilih periode kerja yang masih terbuka."
    )
  }
  return periode
}

export async function pastikanSambunganTertautKeAkun(
  userId: string,
  pelangganId: string
) {
  const langganan = await prisma.langgananWarga.findUnique({
    where: { userId_pelangganId: { userId, pelangganId } },
    select: {
      pelanggan: {
        select: { id: true, nomorLangganan: true, deletedAt: true },
      },
    },
  })

  if (!langganan || langganan.pelanggan.deletedAt) {
    throw new NotFoundError("Sambungan")
  }

  return langganan.pelanggan
}

interface DataKirimanLaporanMandiri {
  pelangganId: string
  nomorLangganan: string
  periode: number
  standDilaporkan: number
  fotoUrl: string
  fotoPublicId: string
  nomorPelapor: string
  namaPelapor: string
  pengirimId: string | null
}

function pastikanBolehKirim(status: string | undefined, periode: number): void {
  if (status && status !== "DITOLAK") {
    throw new ConflictError(
      `Laporan periode ${periode} untuk sambungan ini sudah ada (status: ${status}). Satu laporan aktif per sambungan per periode.`
    )
  }
}

export async function pastikanLaporanMandiriBolehDikirim(
  pelangganId: string,
  periode: number
): Promise<boolean> {
  const existing = await prisma.laporanMandiri.findUnique({
    where: { pelangganId_periode: { pelangganId, periode } },
    select: { status: true },
  })
  pastikanBolehKirim(existing?.status, periode)
  return existing?.status === "DITOLAK"
}

export async function simpanKirimanLaporanMandiri(
  data: DataKirimanLaporanMandiri
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.laporanMandiri.findUnique({
        where: {
          pelangganId_periode: {
            pelangganId: data.pelangganId,
            periode: data.periode,
          },
        },
        select: { id: true, status: true },
      })
      pastikanBolehKirim(existing?.status, data.periode)

      const sekarang = new Date()
      const nilaiTerbaru = {
        standDilaporkan: data.standDilaporkan,
        fotoUrl: data.fotoUrl,
        fotoPublicId: data.fotoPublicId,
        nomorPelapor: data.nomorPelapor,
        namaPelapor: data.namaPelapor,
        status: "MENUNGGU" as const,
      }

      let laporan
      if (existing) {
        const hasilUpdate = await tx.laporanMandiri.updateMany({
          where: { id: existing.id, status: "DITOLAK" },
          data: {
            ...nilaiTerbaru,
            alasanDitolak: null,
            verifiedAt: null,
            verifiedById: null,
            pembacaanId: null,
            createdAt: sekarang,
          },
        })
        if (hasilUpdate.count !== 1) {
          throw new ConflictError(
            "Status laporan berubah saat kiriman diproses. Muat ulang status lalu coba kembali."
          )
        }
        laporan = await tx.laporanMandiri.findUniqueOrThrow({
          where: { id: existing.id },
        })
      } else {
        laporan = await tx.laporanMandiri.create({
          data: {
            pelangganId: data.pelangganId,
            nomorLangganan: data.nomorLangganan,
            periode: data.periode,
            ...nilaiTerbaru,
          },
        })
      }

      await tx.kirimanLaporanMandiri.create({
        data: {
          laporanMandiriId: laporan.id,
          pengirimId: data.pengirimId,
          standDilaporkan: data.standDilaporkan,
          fotoUrl: data.fotoUrl,
          fotoPublicId: data.fotoPublicId,
          nomorPelapor: data.nomorPelapor,
          namaPelapor: data.namaPelapor,
          diterimaPada: sekarang,
        },
      })

      return laporan
    })
  } catch (error) {
    if (isPrismaKnownError(error) && error.code === "P2002") {
      throw new ConflictError(
        "Kiriman atau bukti laporan sudah tercatat. Muat ulang status laporan dan gunakan bukti yang belum pernah dikirim."
      )
    }
    throw error
  }
}
