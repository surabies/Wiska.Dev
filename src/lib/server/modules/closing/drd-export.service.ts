// server/modules/closing/drd-export.service.ts — EKSPOR DRD RESMI.
//
// INI YANG MEMBALIK POSISI APLIKASI. Selama ini aplikasi MENGONSUMSI
// ProgresCater dari Aurora. Dengan berkas ini, aplikasi MEMPRODUKSINYA —
// sehingga sistem lain mengambil data DARI sini, bukan sebaliknya. Tanpa
// jalur ekspor, klaim "aplikasi ini jadi rujukan" tidak punya wujud teknis.
//
// FORMATNYA SENGAJA MENIRU ProgresCater-PW5.csv PERSIS (85 kolom, pemisah
// `;`, urutan sama). Bukan karena format itu bagus, tapi karena konsumen di
// luar sudah membacanya — meniru urutan kolomnya membuat aplikasi ini bisa
// menggantikan Aurora tanpa satu pun sistem hilir diubah.
//
// HANYA PERIODE TERKUNCI YANG BOLEH DIEKSPOR. Berkas ini beredar sebagai
// dokumen resmi; mengekspor periode yang masih berjalan berarti menerbitkan
// angka yang besok bisa berubah, dan salinan yang sudah terlanjur dikirim
// tidak bisa ditarik kembali.
//
// KOLOM YANG BELUM TERISI ditulis kosong, TIDAK dikarang — daftar lengkapnya
// ada di `KOLOM_BELUM_TERISI` di bawah supaya konsumen tahu persis apa yang
// belum tersedia, bukan menebak dari berkas kosong.

import { prisma } from "@db"
import { BadRequestError, ConflictError } from "../../lib/errors"
import { periodeToDate } from "../../lib/periode"

/// Urutan kolom ProgresCater-PW5.csv, diverifikasi terhadap berkas nyata
/// periode 202601–202606. JANGAN diubah urutannya — konsumen membacanya
/// berdasarkan posisi.
const KOLOM = [
  "thbl",
  "nolg",
  "nprs",
  "nama",
  "almt",
  "trp",
  "namatrp",
  "ukr",
  "tmss",
  "ketcatat",
  "stml",
  "stma",
  "pakai_drd",
  "blok_m3",
  "jmlhargaair",
  "beabeban",
  "beaadmin",
  "airkotor",
  "lainlain",
  "tjtg",
  "pakailalu",
  "blok_m3lalu",
  "wiladmkode",
  "wiladmnama",
  "kdkec",
  "namakec",
  "kdkel",
  "namakel",
  "rw",
  "rt",
  "caterseksikode",
  "caterseksinama",
  "rute_kode",
  "pencatat",
  "wildistkode",
  "wildistnama",
  "wilseksikode",
  "wilseksinama",
  "zonakode",
  "zonanama",
  "obid",
  "obnama",
  "gbid",
  "gbnama",
  "isovb",
  "ps",
  "mbr",
  "ismbr",
  "kd_merkmeter",
  "ukmeter",
  "nometer",
  "nosegelmeter",
  "tglpasangmeter",
  "umurmeterthn",
  "umurmeterbln",
  "umurmeterhari",
  "umurmeterkode",
  "umurmeternama",
  "notelp",
  "potensialpenagihan",
  "potensialcater",
  "durasi",
  "jamgilirstart",
  "jamgilirend",
  "waktugilir",
  "pb",
  "pk",
  "jmlreknunggak",
  "tagnunggak",
  "jmlreknunggakkode",
  "jmlreknunggaknama",
  "nominalnunggakkode",
  "nominalnunggaknama",
  "blokm3nama",
  "nominalkode",
  "nominalnama",
  "kondisimeterkode",
  "kondisimeternama",
  "wpkode",
  "dmakode",
  "mutasikode",
  "mutasinama",
  "kategorialkode",
  "kategorialnama",
  "tglcatat",
] as const

/// Kolom yang aplikasi ini BELUM punya sumbernya. Ditulis kosong dan
/// diumumkan lewat header respons `X-DRD-Kolom-Kosong`, supaya konsumen
/// tidak menyangka datanya nol padahal sebenarnya belum ada.
export const KOLOM_BELUM_TERISI = [
  "tmss",
  "isovb",
  "ps",
  "potensialpenagihan",
  "potensialcater",
  "pb",
  "pk",
  "jmlreknunggakkode",
  "jmlreknunggaknama",
  "nominalnunggakkode",
  "nominalnunggaknama",
  "blokm3nama",
  "nominalkode",
  "nominalnama",
  "kondisimeterkode",
  "kondisimeternama",
  "wpkode",
  "kategorialkode",
  "kategorialnama",
] as const

/// Kode ukuran meter untuk kolom `ukr` — kebalikan peta di pbpk.service.ts.
const KODE_UKURAN: Record<string, string> = {
  INCH_HALF: "A",
  INCH_1: "C",
  INCH_1_HALF: "D",
  INCH_2: "E",
  INCH_3: "F",
  INCH_4: "G",
}
const LABEL_UKURAN: Record<string, string> = {
  INCH_HALF: "1/2",
  INCH_1: "1",
  INCH_1_HALF: "1 1/2",
  INCH_2: "2",
  INCH_3: "3",
  INCH_4: "4",
}

const UKURAN_BATCH = 2000

/// Nilai apa pun -> teks aman untuk CSV berpemisah `;`. Titik koma dan
/// newline di dalam data dibuang, bukan di-quote: berkas asli dari Aurora
/// juga tidak memakai kutip, dan menambahkannya justru bisa mematahkan
/// pembaca hilir yang mengurai dengan split(";") sederhana.
function sel(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v)
    .replace(/[;\r\n]/g, " ")
    .trim()
}

function tanggal(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ""
}

export interface RingkasEksporDrd {
  periode: number
  baris: number
  totalTagihan: number
  totalM3: number
  kolomKosong: readonly string[]
}

/// Membangun berkas DRD periode tersebut. Mengembalikan teks CSV utuh —
/// 22 ribu baris x 85 kolom sekitar 10 MB, masih wajar untuk satu unduhan.
export async function eksporDrd(
  periodeThbl: number,
): Promise<{ csv: string; ringkas: RingkasEksporDrd }> {
  const periodeRow = await prisma.periodePenagihan.findUnique({
    where: { periode: periodeThbl },
  })
  if (!periodeRow) {
    throw new BadRequestError(
      `Periode ${periodeThbl} belum pernah ditutup — belum ada DRD resmi untuk diekspor.`,
    )
  }
  if (periodeRow.status !== "TERKUNCI") {
    throw new ConflictError(
      `Periode ${periodeThbl} tidak terkunci. DRD hanya boleh diekspor dari periode yang sudah ditutup — angka periode berjalan masih bisa berubah, sedangkan berkas yang sudah dikirim tidak bisa ditarik kembali.`,
    )
  }

  const periode = periodeToDate(periodeThbl)
  const baris: string[] = [KOLOM.join(";")]
  let totalTagihan = 0
  let totalM3 = 0
  let jumlah = 0

  for (let lewati = 0; ; lewati += UKURAN_BATCH) {
    const kelompok = await prisma.tagihan.findMany({
      where: { periode },
      orderBy: { pelanggan: { nomorLangganan: "asc" } },
      skip: lewati,
      take: UKURAN_BATCH,
      select: {
        pemakaianM3: true,
        jmlHargaAir: true,
        beaBeban: true,
        beaAdmin: true,
        airKotor: true,
        lainLain: true,
        totalTagihan: true,
        jumlahRekTunggak: true,
        nominalTunggak: true,
        pembacaan: {
          select: {
            standLalu: true,
            standAkhir: true,
            blokTarif: true,
            pemakaianLalu: true,
            blokTarifLalu: true,
            kondisi: true,
            kategori: true,
            tanggalCatat: true,
            pencatat: { select: { namaLapangan: true } },
            meter: {
              select: {
                nomorMeter: true,
                nomorSegel: true,
                merkKode: true,
                ukuran: true,
                tanggalPasang: true,
                umurTahun: true,
                umurBulan: true,
                umurHari: true,
              },
            },
          },
        },
        pelanggan: {
          select: {
            nomorLangganan: true,
            nomorPersil: true,
            nama: true,
            alamat: true,
            rt: true,
            rw: true,
            notelp: true,
            isMBR: true,
            kodeMBR: true,
            objekBayar: true,
            statusPasokanAir: true,
            jamGilirMulai: true,
            jamGilirSelesai: true,
            polaGilir: true,
            tarifGolongan: { select: { kode: true, nama: true } },
            golonganBesar: { select: { kode: true, nama: true } },
            dma: { select: { kode: true } },
            zona: { select: { kode: true, nama: true } },
            kecamatan: { select: { kode: true, nama: true } },
            kelurahan: { select: { kode: true, nama: true } },
            rute: {
              select: {
                kode: true,
                seksiCater: {
                  select: {
                    kode: true,
                    nama: true,
                    wilayahDist: {
                      select: {
                        kode: true,
                        nama: true,
                        wilayahAdm: { select: { kode: true, nama: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (kelompok.length === 0) break

    for (const t of kelompok) {
      const p = t.pelanggan
      const b = t.pembacaan
      const m = b?.meter
      const seksi = p.rute?.seksiCater
      const dist = seksi?.wilayahDist
      const adm = dist?.wilayahAdm

      totalTagihan += t.totalTagihan
      totalM3 += t.pemakaianM3
      jumlah++

      const nilai: Record<(typeof KOLOM)[number], unknown> = {
        thbl: periodeThbl,
        nolg: p.nomorLangganan,
        nprs: p.nomorPersil,
        nama: p.nama,
        almt: p.alamat,
        // Kode golongan dikembalikan ke bentuk sumber ("GOL_2A3" -> "2A3")
        // supaya berkas ini bisa dibaca konsumen lama tanpa penyesuaian.
        trp: p.tarifGolongan?.kode.replace(/^GOL_/, "") ?? "",
        namatrp: p.tarifGolongan?.nama ?? "",
        ukr: m ? (KODE_UKURAN[m.ukuran] ?? "") : "",
        tmss: "",
        ketcatat: b?.kondisi ?? "",
        stml: b?.standLalu ?? "",
        stma: b?.standAkhir ?? "",
        pakai_drd: t.pemakaianM3,
        blok_m3: b?.blokTarif ?? "",
        jmlhargaair: t.jmlHargaAir,
        beabeban: t.beaBeban,
        beaadmin: t.beaAdmin,
        airkotor: t.airKotor,
        lainlain: t.lainLain,
        tjtg: t.totalTagihan,
        pakailalu: b?.pemakaianLalu ?? "",
        blok_m3lalu: b?.blokTarifLalu ?? "",
        wiladmkode: adm?.kode ?? "",
        wiladmnama: adm?.nama ?? "",
        kdkec: p.kecamatan?.kode ?? "",
        namakec: p.kecamatan?.nama ?? "",
        kdkel: p.kelurahan?.kode ?? "",
        namakel: p.kelurahan?.nama ?? "",
        rw: p.rw ?? "",
        rt: p.rt ?? "",
        caterseksikode: seksi?.kode ?? "",
        caterseksinama: seksi?.nama ?? "",
        rute_kode: p.rute?.kode ?? "",
        pencatat: b?.pencatat?.namaLapangan ?? "",
        wildistkode: dist?.kode ?? "",
        wildistnama: dist?.nama ?? "",
        wilseksikode: "",
        wilseksinama: "",
        zonakode: p.zona?.kode ?? "",
        zonanama: p.zona?.nama ?? "",
        obid: p.objekBayar ?? "",
        obnama: p.objekBayar ?? "",
        gbid: p.golonganBesar?.kode ?? "",
        gbnama: p.golonganBesar?.nama ?? "",
        isovb: "",
        ps: "",
        mbr: p.kodeMBR ?? "",
        ismbr: p.isMBR ? "1" : "0",
        kd_merkmeter: m?.merkKode ?? "",
        ukmeter: m ? (LABEL_UKURAN[m.ukuran] ?? "") : "",
        nometer: m?.nomorMeter ?? "",
        nosegelmeter: m?.nomorSegel ?? "",
        tglpasangmeter: tanggal(m?.tanggalPasang ?? null),
        umurmeterthn: m?.umurTahun ?? "",
        umurmeterbln: m?.umurBulan ?? "",
        umurmeterhari: m?.umurHari ?? "",
        umurmeterkode: "",
        umurmeternama: "",
        notelp: p.notelp ?? "",
        potensialpenagihan: "",
        potensialcater: "",
        durasi:
          p.statusPasokanAir === "PENUH"
            ? "24"
            : p.statusPasokanAir
              ? "< 12"
              : "",
        jamgilirstart: p.jamGilirMulai
          ? p.jamGilirMulai.toISOString().slice(11, 16)
          : "",
        jamgilirend: p.jamGilirSelesai
          ? p.jamGilirSelesai.toISOString().slice(11, 16)
          : "",
        waktugilir: p.polaGilir ?? "",
        pb: "",
        pk: "",
        jmlreknunggak: t.jumlahRekTunggak,
        // BigInt nullable -> "0", bukan kosong: nol tunggakan adalah fakta,
        // beda dari "belum diketahui".
        tagnunggak: (t.nominalTunggak ?? BigInt(0)).toString(),
        jmlreknunggakkode: "",
        jmlreknunggaknama: "",
        nominalnunggakkode: "",
        nominalnunggaknama: "",
        blokm3nama: "",
        nominalkode: "",
        nominalnama: "",
        kondisimeterkode: "",
        kondisimeternama: "",
        wpkode: "",
        dmakode: p.dma?.kode ?? "",
        // mutasikode/nama mengikuti kesepakatan master STI: 3 = pelanggan
        // aktif. Nilai lain baru bermakna kalau ada mutasi pada periode ini,
        // dan itu belum dilacak per-periode di sini.
        mutasikode: "3",
        mutasinama: "PELANGGAN AKTIF",
        kategorialkode: "",
        kategorialnama: "",
        tglcatat: tanggal(b?.tanggalCatat ?? null),
      }

      baris.push(KOLOM.map((k) => sel(nilai[k])).join(";"))
    }

    if (kelompok.length < UKURAN_BATCH) break
  }

  if (jumlah === 0) {
    throw new BadRequestError(
      `Periode ${periodeThbl} terkunci tapi tidak punya satu pun tagihan untuk diekspor.`,
    )
  }

  return {
    csv: baris.join("\r\n") + "\r\n",
    ringkas: {
      periode: periodeThbl,
      baris: jumlah,
      totalTagihan,
      totalM3,
      kolomKosong: KOLOM_BELUM_TERISI,
    },
  }
}
