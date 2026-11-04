// src/lib/server/modules/laporan/harian/LaporanHarianRute.service.ts —
// Rute Baca Meter (RBM) petugas dan penyusunan urutan kunjungan di lapangan.
import { prisma } from "@db"
import { BadRequestError, ForbiddenError } from "../../../lib/Galat"
import { periodeToDate, dateToPeriode } from "../../../lib/Periode"
import { recordAudit } from "../../../lib/Audit"
import type { SessionUser } from "../../../lib/Sesi"
import type {
  RuteSayaQuery,
  SusunUrutInput,
  AuditMeta,
} from "./LaporanHarian.schema"

// ── Rute Baca Meter (RBM) petugas — dipakai aplikasi mobile pencatat.
// Terdaftar SEBELUM /:id supaya "rute-saya" tidak tertelan param id.
//
// Alurnya: akun User (token) → Pencatat (jembatan userId) → Rute yang
// ditugaskan (pencatat.ruteId, diatur dari dashboard web lewat
// PATCH /pencatat/:id) → seluruh pelanggan rute itu, dilengkapi stand
// resmi terakhir (prefill stand lalu), pemakaian lalu (dasar peringatan
// deviasi), dan status sudah/belum dicatat pada periode berjalan. Respons
// ini sekaligus "paket unduhan rute" yang di-cache aplikasi untuk kerja
// offline di lapangan.
export async function ambilRuteSaya(query: RuteSayaQuery, user: SessionUser) {
  // Default periode = bulan kalender berjalan: pencatatan lapangan merekam
  // bulan berjalan (beda dari dashboard yang memakai periode terakhir
  // ber-data — closing bulanan boleh tertinggal, rute tidak).
  const periode = query.periode ?? dateToPeriode(new Date())

  const pencatat = await prisma.pencatat.findUnique({
    where: { userId: user.id },
    include: {
      // Rute yang dipetakan admin (many-to-many BERURUT lewat PenugasanRute,
      // halaman Pemetaan Rute). Satu pencatat bisa memegang banyak rute;
      // urutannya menentukan urutan kerja di lapangan.
      penugasanRute: {
        orderBy: { urutan: "asc" },
        include: {
          rute: {
            select: {
              id: true,
              kode: true,
              seksiCater: { select: { kode: true, nama: true } },
            },
          },
        },
      },
    },
  })
  if (!pencatat || !pencatat.isAktif) {
    throw new BadRequestError(
      "Akun Anda belum tertaut ke data Pencatat aktif — minta admin menautkannya di menu Pencatat dashboard web."
    )
  }

  // Jumlah laporan yang DIA catat pada periode ini (lintas rute — pindah
  // rute di tengah bulan tidak menghilangkan hasil kerjanya) — angka
  // "hasil kerja saya" di beranda aplikasi.
  const dicatatSaya = await prisma.laporanHarianPetugas.count({
    where: { periode, pencatatId: pencatat.id },
  })

  // Belum ditugaskan rute = bukan error: rute dipetakan admin di halaman
  // Pemetaan Rute dashboard (PenugasanRute). Aplikasi menampilkan keadaan
  // "belum ditugaskan — hubungi admin", bukan layar gagal.
  const penugasan = pencatat.penugasanRute
  if (penugasan.length === 0) {
    return {
      pencatat: { id: pencatat.id, namaLapangan: pencatat.namaLapangan },
      rute: null,
      rutes: [],
      periode,
      target: 0,
      terbaca: 0,
      dicatatSaya,
      // Belum punya rute sama sekali — sebabnya penugasan, bukan daftar catat.
      daftarBelumTerbit: false,
      pelanggan: [],
    }
  }

  const ruteIds = penugasan.map((pg) => pg.ruteId)
  // Peta rute → { kode, seksiCater, urutan kerja } untuk memberi label per
  // baris pelanggan dan mengurutkan lintas rute.
  const ruteInfo = new Map(
    penugasan.map((pg) => [
      pg.ruteId,
      {
        kode: pg.rute.kode,
        seksiCater: pg.rute.seksiCater,
        urutan: pg.urutan,
      },
    ])
  )

  // DAFTAR KERJANYA DITENTUKAN DAFTAR CATAT PERIODE ITU, bukan isi tabel
  // Pelanggan.
  //
  // Sebelumnya baris di bawah hanya menyaring `ruteId`, dan itu keliru dengan
  // cara yang terukur: tabel Pelanggan bersifat AKUMULATIF — ia menampung
  // semua yang pernah ada. Pada data ini 22.630 pelanggan masih memegang
  // ruteId sementara daftar catat periode berjalan hanya 22.522; selisih 99
  // seluruhnya sambungan yang SUDAH DICABUT (51 TUTUP_SEMENTARA, 47
  // TUTUP_SPT, 1 belum pasti). Akibatnya tiap petugas menerima 6-19 rumah
  // yang tidak perlu didatangi lagi, dan angka targetnya menggelembung
  // sebanyak itu — persis alasan model DaftarCatat dibuat: "tidak ada satu
  // pun tabel yang bisa menjawab siapa saja yang harus dicatat bulan ini".
  //
  // PENUGASAN RUTE TETAP DIBACA HIDUP (`ruteIds` dari PenugasanRute hari
  // ini), bukan dari snapshot pencatat di daftar catat. Dua-duanya perlu:
  // daftar catat menentukan SIAPA yang harus dicatat bulan ini, PenugasanRute
  // menentukan OLEH SIAPA — sehingga rute yang dialihkan di tengah bulan
  // langsung sampai ke petugas barunya tanpa menunggu bulan depan.
  const anggotaDaftar = await prisma.daftarCatat.findMany({
    where: { periode, pelanggan: { ruteId: { in: ruteIds } } },
    select: { pelangganId: true },
  })
  const idDaftar = anggotaDaftar.map((d) => d.pelangganId)

  // Daftar kosong punya DUA sebab yang berbeda jauh akibatnya: daftar catat
  // bulan ini memang belum diterbitkan (admin belum menjalankan "buka bulan
  // baru"), atau rute petugas ini yang kebetulan tidak punya anggota.
  // Dibedakan supaya aplikasi bisa berkata "daftar kerja bulan ini belum
  // terbit, hubungi admin" alih-alih menampilkan layar kosong yang terbaca
  // seperti kerusakan. Query tambahannya HANYA jalan saat kosong.
  const daftarBelumTerbit =
    idDaftar.length === 0 &&
    (await prisma.daftarCatat.count({ where: { periode } })) === 0

  const pelanggan = await prisma.pelanggan.findMany({
    // TIDAK ADA penyaringan status: seluruh status (DISEGEL, TUTUP_SEMENTARA,
    // TUTUP_SPT) tetap masuk buku rute — petugas tetap lewat dan statusnya
    // ditampilkan di baris. Dulu `CABUT_PERMANEN` dikecualikan di sini, tapi
    // status itu sudah dihapus: di PDAM tidak ada pencabutan selamanya.
    // Yang mengeluarkan sebuah sambungan dari buku rute BUKAN statusnya,
    // melainkan ketidakhadirannya di daftar catat periode ini — aturan yang
    // sama persis dengan closing & buka bulan baru.
    where: { id: { in: idDaftar }, ruteId: { in: ruteIds }, deletedAt: null },
    // Urutan kunjungan DALAM rute (noUrutRute); urutan ANTAR rute diterapkan
    // di bawah mengikuti PenugasanRute.urutan.
    orderBy: [
      { noUrutRute: { sort: "asc", nulls: "last" } },
      { nomorLangganan: "asc" },
    ],
    select: {
      id: true,
      nomorLangganan: true,
      nama: true,
      alamat: true,
      rt: true,
      rw: true,
      status: true,
      notelp: true,
      geoLat: true,
      geoLong: true,
      noUrutRute: true,
      /// Dasar "No Urut DPM" yang dihitung di bawah — bukan untuk ditampilkan
      /// mentah.
      nomorPersil: true,
      ruteId: true,
      tarifGolongan: { select: { kodeAsli: true } },
      meter: {
        where: { isAktif: true },
        take: 1,
        select: { id: true, nomorMeter: true },
      },
    },
  })
  // Urutkan lintas rute: rute sesuai urutan kerja, lalu noUrutRute dalam rute.
  pelanggan.sort((a, b) => {
    const ua = ruteInfo.get(a.ruteId!)?.urutan ?? 0
    const ub = ruteInfo.get(b.ruteId!)?.urutan ?? 0
    if (ua !== ub) return ua - ub
    const na = a.noUrutRute ?? Number.MAX_SAFE_INTEGER
    const nb = b.noUrutRute ?? Number.MAX_SAFE_INTEGER
    if (na !== nb) return na - nb
    return a.nomorLangganan.localeCompare(b.nomorLangganan)
  })

  const meterIds = pelanggan.flatMap((p) => p.meter.map((m) => m.id))
  // Jendela riwayat: 6 bulan ke belakang dari periode berjalan — cukup untuk
  // memilih 3 pembacaan resmi terakhir per meter (pola period1..period3
  // Aurora: bahan jawaban petugas saat pelanggan menanyakan riwayatnya),
  // tanpa menyeret seluruh histori bertahun-tahun.
  const batasRiwayat = periodeToDate(periode)
  batasRiwayat.setMonth(batasRiwayat.getMonth() - 6)
  const pelangganIds = pelanggan.map((p) => p.id)
  const [bacaanResmi, laporanPeriode, tagihanTerakhir] = await Promise.all([
    meterIds.length
      ? prisma.pembacaanMeter.findMany({
          where: {
            meterId: { in: meterIds },
            periode: { gte: batasRiwayat },
          },
          orderBy: [{ meterId: "asc" }, { periode: "desc" }],
          select: {
            meterId: true,
            periode: true,
            standLalu: true,
            standAkhir: true,
            pemakaianM3: true,
            tanggalCatat: true,
          },
        })
      : Promise.resolve([]),
    prisma.laporanHarianPetugas.findMany({
      where: {
        periode,
        nomorLangganan: { in: pelanggan.map((p) => p.nomorLangganan) },
      },
      select: {
        id: true,
        nomorLangganan: true,
        standAkhir: true,
        kondisi: true,
        tanggalCatat: true,
      },
    }),
    // Komponen tetap tagihan (beban + admin) dari tagihan RESMI terakhir tiap
    // pelanggan — bahan estimasi total di layar catat (air progresif + beban
    // + admin, pola calculateTagihan Aurora). Per-tagihan, bukan per-golongan
    // (sumber CSV beabeban/beaadmin), jadi diambil dari riwayat pelanggan itu
    // sendiri; pelanggan tanpa tagihan sebelumnya → null (estimasi jatuh ke
    // air-saja). Terurut periode desc, elemen pertama = paling baru.
    pelangganIds.length
      ? prisma.tagihan.findMany({
          where: { pelangganId: { in: pelangganIds } },
          orderBy: [{ pelangganId: "asc" }, { periode: "desc" }],
          /// `periode` + `totalTagihan` ikut diambil untuk keperluan KEDUA:
          /// menempelkan nominal tagihan ke tiap baris riwayat pembacaan.
          /// Petugas ditanyai "bulan lalu bayar berapa?" di depan rumah, dan
          /// tanpa angka ini ia hanya bisa menyebut pemakaian m³ — bukan yang
          /// ditanyakan.
          select: {
            pelangganId: true,
            periode: true,
            totalTagihan: true,
            beaBeban: true,
            beaAdmin: true,
          },
        })
      : Promise.resolve([]),
  ])
  // Kelompokkan per meter; baris sudah terurut periode desc, jadi elemen
  // pertama = pembacaan resmi terakhir (prefill stand lalu).
  const riwayatPerMeter = new Map<string, typeof bacaanResmi>()
  for (const b of bacaanResmi) {
    const daftar = riwayatPerMeter.get(b.meterId) ?? []
    if (daftar.length < 3) riwayatPerMeter.set(b.meterId, [...daftar, b])
  }
  const laporanPerNomor = new Map(
    laporanPeriode.map((l) => [l.nomorLangganan, l])
  )
  // Ambil hanya tagihan terbaru per pelanggan (baris terurut periode desc).
  const biayaTetapPerPelanggan = new Map<
    string,
    { beaBeban: number; beaAdmin: number }
  >()
  /// Nominal tagihan per (pelanggan, periode) — dicocokkan ke baris riwayat
  /// lewat PERIODE, bukan lewat `Tagihan.pembacaanId`. Relasi itu memang ada
  /// dan lebih tepat secara model, tetapi baris warisan impor Aurora tidak
  /// semuanya membawanya; mencocokkan lewat periode bekerja untuk keduanya.
  const totalTagihanPerPeriode = new Map<string, number>()
  for (const t of tagihanTerakhir) {
    if (!biayaTetapPerPelanggan.has(t.pelangganId)) {
      biayaTetapPerPelanggan.set(t.pelangganId, {
        beaBeban: t.beaBeban,
        beaAdmin: t.beaAdmin,
      })
    }
    const kunci = `${t.pelangganId}|${dateToPeriode(t.periode)}`
    if (!totalTagihanPerPeriode.has(kunci)) {
      totalTagihanPerPeriode.set(kunci, t.totalTagihan)
    }
  }

  // Nomor urut fallback dihitung PER RUTE, bukan lintas seluruh beban kerja:
  // pelanggan tanpa noUrutRute harus bernomor 1..n di dalam rutenya sendiri
  // (petugas membaca "urutan 1 dari rute R-042"), bukan posisinya di daftar
  // datar gabungan semua rute. `pelanggan` sudah terurut (rute, lalu
  // noUrutRute), jadi baris tiap rute kontigu — cukup hitung berjalan per rute.
  // NO URUT DPM — urutan menurut hirarki data, dihitung dari nomor persil.
  //
  // Ini ANGKA KEDUA, dan sengaja bukan pengganti `urutan`. Aplikasi lama
  // menampilkan keduanya berdampingan karena artinya memang berbeda:
  // urut DPM menyusun sambungan menurut struktur wilayah (nomor persil
  // berbentuk kode-rute + blok + urut, mis. CD104010003), sedangkan urut
  // pencatatan menyusunnya menurut cara petugas benar-benar berjalan. Yang
  // dipakai mengurutkan buku rute adalah yang kedua; yang pertama untuk
  // dicocokkan dengan berkas DPM dan aplikasi lama.
  //
  // Dihitung di sini, tidak disimpan sebagai kolom: ia turunan murni dari
  // nomorPersil, dan kolom turunan hanya menambah satu hal lagi yang bisa
  // basi tanpa membeli apa pun.
  const urutDpm = new Map<string, number>()
  for (const [ruteId] of ruteInfo) {
    const anggota = pelanggan
      .filter((p) => p.ruteId === ruteId)
      .sort(
        (a, b) =>
          (a.nomorPersil ?? "").localeCompare(b.nomorPersil ?? "") ||
          a.nomorLangganan.localeCompare(b.nomorLangganan)
      )
    anggota.forEach((p, i) => urutDpm.set(p.id, i + 1))
  }

  const urutPerRute = new Map<string, number>()
  const rows = pelanggan.map((p) => {
    const meter = p.meter[0] ?? null
    const riwayat = (meter ? riwayatPerMeter.get(meter.id) : undefined) ?? []
    const bacaan = riwayat[0]
    const laporan = laporanPerNomor.get(p.nomorLangganan)
    const biayaTetap = biayaTetapPerPelanggan.get(p.id) ?? null
    const seqRute = (urutPerRute.get(p.ruteId ?? "") ?? 0) + 1
    urutPerRute.set(p.ruteId ?? "", seqRute)
    return {
      pelangganId: p.id,
      nomorLangganan: p.nomorLangganan,
      nama: p.nama,
      alamat: p.alamat,
      rt: p.rt,
      rw: p.rw,
      status: p.status,
      notelp: p.notelp,
      geoLat: p.geoLat,
      geoLong: p.geoLong,
      golonganTarif: p.tarifGolongan?.kodeAsli ?? null,
      /// Rute asal baris — mobile mengelompokkan daftar per rute sesuai
      /// urutan kerja.
      ruteId: p.ruteId,
      ruteKode: ruteInfo.get(p.ruteId!)?.kode ?? null,
      /// Urutan kunjungan RBM; fallback ke posisi DALAM RUTE (bukan lintas
      /// semua rute) untuk data lama yang belum punya noUrutRute.
      urutan: p.noUrutRute ?? seqRute,
      noUrutRute: p.noUrutRute,
      /// Urutan menurut hirarki data (nomor persil) — angka yang sama dengan
      /// "No Urut DPM" di aplikasi lama. Ditampilkan berdampingan dengan
      /// `urutan`, bukan menggantikannya.
      noUrutDpm: urutDpm.get(p.id) ?? null,
      meterId: meter?.id ?? null,
      nomorMeter: meter?.nomorMeter ?? null,
      /// Jam kunjungan terakhir yang tercatat — DASAR urutan rute di
      /// lapangan, jadi petugas bisa melihat sendiri kenapa sebuah rumah ada
      /// di posisi itu. Null bila belum pernah ada pembacaan resmi.
      waktuCatatTerakhir: bacaan?.tanggalCatat?.toISOString() ?? null,
      standLalu: bacaan?.standAkhir ?? null,
      pemakaianLalu: bacaan?.pemakaianM3 ?? null,
      /// Komponen tetap tagihan terakhir (null bila pelanggan belum pernah
      /// ditagih) — mobile menambahkannya ke estimasi uang air progresif.
      beaBeban: biayaTetap?.beaBeban ?? null,
      beaAdmin: biayaTetap?.beaAdmin ?? null,
      /// Maks. 3 pembacaan resmi terakhir, terbaru dulu (period1..period3
      /// di Aurora) — di-cache aplikasi untuk ditunjukkan ke pelanggan
      /// saat ada sengketa tagihan di lapangan.
      riwayat: riwayat.map((r) => ({
        periode: dateToPeriode(r.periode),
        standLalu: r.standLalu,
        standAkhir: r.standAkhir,
        pemakaianM3: r.pemakaianM3,
        /// Null bila periode itu belum/tidak pernah ditagih — dan itu keadaan
        /// yang wajar, bukan galat: pembacaan lebih dulu ada daripada
        /// tagihannya. Aplikasi menampilkannya sebagai "—", bukan "Rp 0".
        totalTagihan:
          totalTagihanPerPeriode.get(`${p.id}|${dateToPeriode(r.periode)}`) ??
          null,
      })),
      sudahDicatat: !!laporan,
      laporan: laporan
        ? {
            id: laporan.id,
            standAkhir: laporan.standAkhir,
            kondisi: laporan.kondisi,
            tanggalCatat: laporan.tanggalCatat,
          }
        : null,
    }
  })

  // Ringkasan per rute (urut kerja) — target = jumlah pelanggan rute,
  // terbaca = yang sudah dicatat periode ini. Header aplikasi memakai ini.
  const rutes = penugasan.map((pg) => {
    const barisRute = rows.filter((r) => r.ruteId === pg.ruteId)
    return {
      id: pg.ruteId,
      kode: pg.rute.kode,
      seksiCater: pg.rute.seksiCater,
      urutan: pg.urutan,
      target: barisRute.length,
      terbaca: barisRute.filter((r) => r.sudahDicatat).length,
    }
  })

  return {
    pencatat: { id: pencatat.id, namaLapangan: pencatat.namaLapangan },
    // `rute` (tunggal, rute pertama) dipertahankan untuk kompatibilitas
    // aplikasi versi lama; `rutes` adalah daftar penuh yang dibaca versi baru.
    rute: rutes[0]
      ? {
          id: rutes[0].id,
          kode: rutes[0].kode,
          seksiCater: rutes[0].seksiCater,
        }
      : null,
    rutes,
    periode,
    target: rows.length,
    terbaca: rows.filter((r) => r.sudahDicatat).length,
    dicatatSaya,
    daftarBelumTerbit,
    pelanggan: rows,
  }
}

// ── Petugas menyusun ulang urutan kunjungan rutenya sendiri ──────────────
//
// KENAPA LANGSUNG BERLAKU, BUKAN LEWAT PERSETUJUAN. Urutan kunjungan bukan
// data induk — ia catatan cara berjalan, dan satu-satunya orang yang tahu
// jalannya adalah yang berjalan. Aplikasi lama pun begitu, dan itulah
// kebiasaan yang mau ditiru. Menahannya di antrean persetujuan berarti
// petugas bekerja dengan urutan yang dia sendiri tahu keliru sampai ada
// supervisor sempat menekan tombol.
//
// KENAPA TIDAK BUTUH KOLOM "TERKUNCI". Sebelumnya urutan ini punya lawan:
// penyegaran otomatis dari urutan baris berkas impor. Mekanisme itu SUDAH
// DICABUT (premisnya keliru — kedua berkas sumber ternyata terurut menurut
// nomor langganan, bukan menurut jalan). Karena tidak ada lagi proses yang
// menulis noUrutRute di belakang layar, susunan petugas tidak bisa tertimpa,
// dan penanda kunci hanya akan jadi kolom yang tidak menjaga apa pun.
//
// YANG DIJAGA: petugas hanya boleh menyusun rute YANG DITUGASKAN KEPADANYA,
// dan hanya pelanggan di dalam rute itu. Tanpa penjagaan ini seorang petugas
// bisa mengacak buku rute rekannya lewat panggilan API biasa.
export async function susunUrutRuteSaya(
  input: SusunUrutInput,
  user: SessionUser,
  auditMeta: AuditMeta
) {
  const { ruteId, pelangganIds } = input
  const { ipAddress, userAgent } = auditMeta

  const pencatat = await prisma.pencatat.findUnique({
    where: { userId: user.id },
    select: { id: true, namaLapangan: true },
  })
  if (!pencatat)
    throw new BadRequestError("Akun Anda belum tertaut ke data Pencatat.")

  const penugasan = await prisma.penugasanRute.findFirst({
    where: { ruteId, pencatatId: pencatat.id },
    select: { ruteId: true },
  })
  if (!penugasan) throw new ForbiddenError("Rute ini bukan penugasan Anda.")

  // Anggota rute dibaca dari database, bukan dipercaya dari kiriman:
  // id asing dalam daftar tidak boleh ikut ternomori.
  const anggota = await prisma.pelanggan.findMany({
    where: { ruteId, deletedAt: null },
    select: { id: true },
  })
  const sah = new Set(anggota.map((a) => a.id))
  const berurut = pelangganIds.filter((id) => sah.has(id))
  const asing = pelangganIds.length - berurut.length

  // Yang tidak disebut pengirim tetap dinomori, di ekor, mengikuti urutan
  // lamanya — daftar yang tidak lengkap tidak boleh menghapus urutan
  // pelanggan yang kebetulan tidak ikut terkirim.
  const disebut = new Set(berurut)
  const sisa = anggota.filter((a) => !disebut.has(a.id)).map((a) => a.id)
  const final = [...berurut, ...sisa]

  const UKURAN = 200
  for (let i = 0; i < final.length; i += UKURAN) {
    await prisma.$transaction(
      final.slice(i, i + UKURAN).map((id, j) =>
        prisma.pelanggan.update({
          where: { id },
          data: { noUrutRute: i + j + 1 },
        })
      )
    )
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      userId: user.id,
      aksi: "SUSUN_URUT_RUTE",
      entitas: "Rute",
      entitasId: ruteId,
      perubahan: {
        oleh: pencatat.namaLapangan,
        jumlah: final.length,
        diabaikan: asing,
      },
      ipAddress,
      userAgent,
    })
  })

  return { ruteId, dinomori: final.length, diabaikan: asing }
}
