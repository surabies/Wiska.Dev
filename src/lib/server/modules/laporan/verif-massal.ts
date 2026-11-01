// server/modules/laporan/verif-massal.ts — VERIFIKASI BERJENJANG SECARA
// MASSAL (V1/V2/V3 untuk banyak baris sekaligus).
//
// KENAPA ADA. Satu periode berisi ~22.500 laporan. Memverifikasinya satu per
// satu lewat modal bukan pilihan yang bisa dijalankan siapa pun; di aplikasi
// lama pekerjaan ini memang dilakukan borongan. Yang penting bukan
// menghilangkan pemeriksaan, melainkan memisahkan mana yang boleh diborong
// dan mana yang WAJIB dilihat satu-satu.
//
// SIKAP YANG DIJAGA:
//
// 1. **Massal = "tidak ada yang perlu dikoreksi".** Endpoint ini TIDAK
//    menerima koreksi stand/pemakaian/kondisi. Baris yang perlu dikoreksi
//    harus lewat modal V1 satuan — di situlah verifikator melihat angkanya.
//    Membolehkan koreksi borongan sama dengan membolehkan koreksi tanpa
//    melihat, dan itu justru yang harus dicegah.
//
// 2. **Anomali TIDAK ikut terborong secara diam-diam.** Pemanggil wajib
//    menyatakan `sertakanAnomali` bila memang mau memasukkannya. Bawaannya
//    baris anomali DILEWATI dan dilaporkan, supaya "verifikasi semua" tidak
//    pernah berarti "loloskan yang mencurigakan tanpa dilihat".
//
// 3. **Per baris, bukan per transaksi raksasa.** Satu baris bermasalah tidak
//    menjatuhkan sisanya, dan hasilnya dilaporkan per baris supaya
//    verifikator tahu persis apa yang tidak jadi.

import { prisma } from "@db"
import { tentukanBlok } from "@/lib/domain/tagihan"
import { recordAudit } from "../../lib/audit"
import { simpanPembacaanResmi } from "./pembacaan-resmi"

export type Ring = 1 | 2 | 3

export interface HasilVerifBaris {
  id: string
  nomorLangganan: string
  status: "OK" | "DILEWATI" | "GAGAL"
  pesan?: string
}

export interface HasilVerifMassal {
  diproses: number
  berhasil: number
  dilewati: number
  gagal: number
  masalah: HasilVerifBaris[]
}

interface Opsi {
  ids: string[]
  ring: Ring
  userId: string
  auditMeta: { ipAddress: string | null; userAgent: string | null }
  /// Ambang anomali (%) — dibaca pemanggil dari Konfigurasi.
  ambangAnomali: number
  sertakanAnomali: boolean
}

function anomali(persentase: number | null, ambang: number): boolean {
  if (persentase === null) return false
  return persentase > ambang || persentase < -ambang
}

export async function verifikasiMassal(opsi: Opsi): Promise<HasilVerifMassal> {
  const { ids, ring, userId, auditMeta, ambangAnomali, sertakanAnomali } = opsi
  const hasil: HasilVerifMassal = {
    diproses: ids.length,
    berhasil: 0,
    dilewati: 0,
    gagal: 0,
    masalah: [],
  }

  const laporan = await prisma.laporanHarianPetugas.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nomorLangganan: true,
      pelangganId: true,
      periode: true,
      standAwal: true,
      standAkhir: true,
      standAkhirRevisi: true,
      pemakaian: true,
      pemakaianLalu: true,
      pemakaianTagihVerif: true,
      blokTarifVerif: true,
      kondisi: true,
      kategori: true,
      pencatatId: true,
      tanggalCatat: true,
      fotoStandUrl: true,
      persentase: true,
      jenisInput: true,
      verif1At: true,
      verif2At: true,
      verif3At: true,
      meterVerifId: true,
      pembacaanId: true,
    },
  })

  // Meter aktif per pelanggan — dipreload sekali, bukan per baris.
  const pelangganIds = laporan
    .map((l) => l.pelangganId)
    .filter((v): v is string => v !== null)
  const meter = await prisma.meter.findMany({
    where: { pelangganId: { in: pelangganIds } },
    select: { id: true, pelangganId: true, isAktif: true },
  })
  const meterPelanggan = new Map<string, Set<string>>()
  const meterAktif = new Map<string, string[]>()
  for (const item of meter) {
    const semuaMeter = meterPelanggan.get(item.pelangganId) ?? new Set<string>()
    semuaMeter.add(item.id)
    meterPelanggan.set(item.pelangganId, semuaMeter)
    if (item.isAktif) {
      const idsPelanggan = meterAktif.get(item.pelangganId) ?? []
      idsPelanggan.push(item.id)
      meterAktif.set(item.pelangganId, idsPelanggan)
    }
  }
  const meterAktifUnik = new Map(
    [...meterAktif]
      .filter(([, idsMeter]) => idsMeter.length === 1)
      .map(([pelangganId, [meterId]]) => [pelangganId, meterId]),
  )
  const tentukanMeter = (laporan: {
    pelangganId: string | null
    meterVerifId: string | null
  }) => {
    if (!laporan.pelangganId) return undefined
    if (laporan.meterVerifId) {
      return meterPelanggan
        .get(laporan.pelangganId)
        ?.has(laporan.meterVerifId)
        ? laporan.meterVerifId
        : undefined
    }
    return meterAktifUnik.get(laporan.pelangganId)
  }

  const lewati = (l: { id: string; nomorLangganan: string }, pesan: string) => {
    hasil.dilewati++
    hasil.masalah.push({
      id: l.id,
      nomorLangganan: l.nomorLangganan,
      status: "DILEWATI",
      pesan,
    })
  }
  const gagal = (l: { id: string; nomorLangganan: string }, pesan: string) => {
    hasil.gagal++
    hasil.masalah.push({
      id: l.id,
      nomorLangganan: l.nomorLangganan,
      status: "GAGAL",
      pesan,
    })
  }

  for (const l of laporan) {
    if (l.pembacaanId) {
      lewati(l, "Sudah jadi pembacaan resmi")
      continue
    }
    if (!sertakanAnomali && anomali(l.persentase, ambangAnomali)) {
      lewati(
        l,
        `Anomali ${l.persentase}% (> ±${ambangAnomali}%) — periksa satu per satu`,
      )
      continue
    }

    try {
      if (ring === 1) {
        if (l.verif1At) {
          lewati(l, "V1 sudah terisi")
          continue
        }
        const meterId = tentukanMeter(l)
        if (!meterId) {
          lewati(
            l,
            "Tidak ada meter aktif untuk pelanggan ini — pilih meternya lewat V1 satuan",
          )
          continue
        }
        const kini = new Date()
        await prisma.$transaction(async (tx) => {
          const berubah = await tx.laporanHarianPetugas.updateMany({
            where: {
              id: l.id,
              verif1At: null,
              verif2At: null,
              verif3At: null,
              pembacaanId: null,
              isVerified: false,
            },
            data: {
              verif1At: kini,
              verif1ById: userId,
              meterVerifId: meterId,
              verifiedAt: null,
              verifiedById: null,
            },
          })
          if (berubah.count !== 1)
            throw new Error("Status laporan berubah sebelum V1 dapat disimpan")
          await recordAudit(tx, {
            userId,
            aksi: "VERIFIKASI_V1_MASSAL",
            entitas: "LaporanHarianPetugas",
            entitasId: l.id,
            perubahan: {
              sebelum: { verif1At: l.verif1At },
              sesudah: { verif1At: kini, verif1ById: userId, meterVerifId: meterId },
            },
            ...auditMeta,
          })
        })
        hasil.berhasil++
        continue
      }

      if (ring === 2) {
        if (l.verif2At) {
          lewati(l, "V2 sudah terisi")
          continue
        }
        if (l.verif3At) {
          lewati(l, "V3 sudah terisi")
          continue
        }
        const kini = new Date()
        await prisma.$transaction(async (tx) => {
          const berubah = await tx.laporanHarianPetugas.updateMany({
            where: {
              id: l.id,
              verif2At: null,
              verif3At: null,
              pembacaanId: null,
              isVerified: false,
            },
            data: { verif2At: kini, verif2ById: userId },
          })
          if (berubah.count !== 1)
            throw new Error("Status laporan berubah sebelum V2 dapat disimpan")
          await recordAudit(tx, {
            userId,
            aksi: "VERIFIKASI_V2_MASSAL",
            entitas: "LaporanHarianPetugas",
            entitasId: l.id,
            perubahan: {
              sebelum: { verif2At: l.verif2At },
              sesudah: { verif2At: kini, verif2ById: userId },
            },
            ...auditMeta,
          })
        })
        hasil.berhasil++
        continue
      }

      // ring === 3 — satu-satunya tempat PembacaanMeter resmi lahir.
      if (l.verif3At) {
        lewati(l, "V3 sudah terisi")
        continue
      }
      const meterId = tentukanMeter(l)
      if (!meterId) {
        lewati(l, "Meter aktif tidak dapat ditentukan dengan pasti")
        continue
      }

      const standAkhir = l.standAkhirRevisi ?? l.standAkhir
      const pemakaianRiil = standAkhir - l.standAwal
      if (pemakaianRiil < 0) {
        lewati(l, "Stand akhir lebih kecil dari stand awal")
        continue
      }
      // TIDAK ADA TAKSASI OTOMATIS.
      //
      // Aturan taksiran (minimum 5 m3, taksiran dari bulan lalu) DIHAPUS dari
      // jalur otomatis atas keputusan pemilik data. Alasannya: angka yang
      // dibawa lapdatameter & ProgresCater sudah matang — ia keluaran
      // verifikasi berjenjang di Aurora — sehingga menaksirnya ulang berarti
      // menimpa keputusan manusia dengan tebakan mesin.
      //
      // Aturan sistem tetap ada, tapi berlaku hanya saat OPERATOR yang
      // menerapkannya dengan jarinya sendiri (lewat kolom pemakaianTagihVerif
      // di modal V1/V2/V3). Dengan begitu setiap penyimpangan dari angka catat
      // selalu punya nama orang di belakangnya dan bisa ditelusuri.
      // OVERRIDE_MANUAL HANYA bila operator yang menetapkannya. Angka dari
      // berkas yang kebetulan beda dari selisih stand BUKAN override — itu
      // justru angka matang dari Aurora, dan menandainya sebagai campur
      // tangan manusia akan membuat jejak audit berbohong.
      const pemakaianTagih = l.pemakaianTagihVerif ?? l.pemakaian
      const alasanTaksir =
        l.jenisInput === "MANUAL_MASSAL" &&
        pemakaianTagih === l.pemakaian
          ? "MANUAL_ADD"
          : l.pemakaianTagihVerif !== null
            ? "OVERRIDE_MANUAL"
            : null

      const kini = new Date()
      await prisma.$transaction(async (tx) => {
        const berubah = await tx.laporanHarianPetugas.updateMany({
          where: {
            id: l.id,
            verif3At: null,
            pembacaanId: null,
            isVerified: false,
          },
          data: {
            verif3At: kini,
            verif3ById: userId,
            meterVerifId: meterId,
            isVerified: true,
            verifiedAt: kini,
            verifiedById: userId,
          },
        })
        if (berubah.count !== 1)
          throw new Error("Status laporan berubah sebelum V3 dapat disimpan")

        const pembacaan = await simpanPembacaanResmi(tx, {
          pelangganId: l.pelangganId,
          nomorLangganan: l.nomorLangganan,
          meterId,
          periode: l.periode,
          sumber: "PETUGAS",
          laporanId: l.id,
          aktor: { userId, ...auditMeta },
          data: {
            standLalu: l.standAwal,
            standAkhir,
            pemakaianM3: pemakaianTagih,
            pemakaianRiil,
            alasanTaksir,
            blokTarif: l.blokTarifVerif ?? tentukanBlok(pemakaianTagih),
            pemakaianLalu: l.pemakaianLalu,
            kondisi: l.kondisi,
            kategori: l.kategori,
            pencatatId: l.pencatatId,
            tanggalCatat: l.tanggalCatat,
            fotoBukti: l.fotoStandUrl,
          },
        })
        // Sama seperti V3 satuan: tandai baris daftar catatnya DICATAT.
        if (l.pelangganId) {
          await tx.daftarCatat.updateMany({
            where: { periode: l.periode, pelangganId: l.pelangganId },
            data: { status: "DICATAT", selesaiAt: kini },
          })
        }
        await tx.laporanHarianPetugas.update({
          where: { id: l.id },
          data: {
            pembacaanId: pembacaan.id,
          },
        })
        await recordAudit(tx, {
          userId,
          aksi: "VERIFIKASI_V3_MASSAL",
          entitas: "LaporanHarianPetugas",
          entitasId: l.id,
          perubahan: {
            sebelum: {
              verif3At: l.verif3At,
              pembacaanId: l.pembacaanId,
            },
            sesudah: {
              verif3At: kini,
              verif3ById: userId,
              pembacaanId: pembacaan.id,
              meterVerifId: meterId,
            },
          },
          ...auditMeta,
        })
      })
      hasil.berhasil++
    } catch (err) {
      gagal(l, (err as Error).message.slice(0, 200))
    }
  }

  // id yang diminta tapi tidak ketemu sama sekali.
  const ketemu = new Set(laporan.map((l) => l.id))
  for (const id of ids) {
    if (!ketemu.has(id)) {
      hasil.gagal++
      hasil.masalah.push({
        id,
        nomorLangganan: "?",
        status: "GAGAL",
        pesan: "Laporan tidak ditemukan",
      })
    }
  }

  return hasil
}
