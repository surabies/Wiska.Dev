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
import { periodeToDate } from "../../lib/periode"

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
  /// Ambang anomali (%) — dibaca pemanggil dari Konfigurasi.
  ambangAnomali: number
  sertakanAnomali: boolean
}

function anomali(persentase: number | null, ambang: number): boolean {
  if (persentase === null) return false
  return persentase > ambang || persentase < -ambang
}

export async function verifikasiMassal(opsi: Opsi): Promise<HasilVerifMassal> {
  const { ids, ring, userId, ambangAnomali, sertakanAnomali } = opsi
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
    where: { pelangganId: { in: pelangganIds }, isAktif: true },
    select: { id: true, pelangganId: true },
  })
  const meterAktif = new Map(meter.map((m) => [m.pelangganId, m.id]))

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
        const meterId =
          l.meterVerifId ??
          (l.pelangganId ? meterAktif.get(l.pelangganId) : undefined)
        if (!meterId) {
          lewati(
            l,
            "Tidak ada meter aktif untuk pelanggan ini — pilih meternya lewat V1 satuan",
          )
          continue
        }
        await prisma.laporanHarianPetugas.update({
          where: { id: l.id },
          data: {
            verif1At: new Date(),
            verif1ById: userId,
            meterVerifId: meterId,
            // Tidak ada koreksi: stand & pemakaian dibiarkan apa adanya,
            // aturan tagih diterapkan nanti di V3.
            verifiedAt: null,
            verifiedById: null,
          },
        })
        hasil.berhasil++
        continue
      }

      if (ring === 2) {
        if (!l.verif1At) {
          lewati(l, "Menunggu V1")
          continue
        }
        if (l.verif2At) {
          lewati(l, "V2 sudah terisi")
          continue
        }
        await prisma.laporanHarianPetugas.update({
          where: { id: l.id },
          data: { verif2At: new Date(), verif2ById: userId },
        })
        hasil.berhasil++
        continue
      }

      // ring === 3 — satu-satunya tempat PembacaanMeter resmi lahir.
      if (!l.verif1At || !l.verif2At) {
        lewati(l, "Menunggu V1 dan V2")
        continue
      }
      if (l.verif3At) {
        lewati(l, "V3 sudah terisi")
        continue
      }
      if (!l.meterVerifId) {
        lewati(l, "Meter tujuan belum dipilih di V1")
        continue
      }

      const standAkhir = l.standAkhirRevisi ?? l.standAkhir
      const pemakaianRiil = Math.max(0, standAkhir - l.standAwal)
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
        l.pemakaianTagihVerif !== null ? "OVERRIDE_MANUAL" : null

      const kini = new Date()
      await prisma.$transaction(async (tx) => {
        const pembacaan = await tx.pembacaanMeter.create({
          data: {
            meterId: l.meterVerifId!,
            periode: periodeToDate(l.periode),
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
            verif3At: kini,
            verif3ById: userId,
            isVerified: true,
            verifiedAt: kini,
            verifiedById: userId,
            pembacaanId: pembacaan.id,
          },
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
