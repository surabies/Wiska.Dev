/**
 * rbm.ts — model modul Baca Meter (RBM), padanan
 * `features/staff/baca_meter/rbm_models.dart`.
 *
 * Dipakai bertiga: repository (jaringan), DAO (SQLite lokal), dan layar.
 * Karena paket rute DI-CACHE di perangkat untuk kerja offline, setiap model
 * di sini wajib bolak-balik JSON tanpa kehilangan apa pun — `dariJson` dan
 * `keJson` harus tetap sepasang. Baris yang lolos dari salah satunya akan
 * hilang diam-diam saat petugas kehilangan sinyal, dan itu berarti hasil
 * kerja sehari penuh.
 */

type Json = Record<string, unknown>;

const teks = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const teksWajib = (v: unknown, bawaan = ''): string => (typeof v === 'string' ? v : bawaan);
const bulat = (v: unknown): number | null => (typeof v === 'number' ? Math.trunc(v) : null);
const bulatWajib = (v: unknown, bawaan = 0): number => (typeof v === 'number' ? Math.trunc(v) : bawaan);
const pecahan = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const objek = (v: unknown): Json | null => (v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const larik = (v: unknown): Json[] =>
  Array.isArray(v) ? v.filter((x): x is Json => x != null && typeof x === 'object' && !Array.isArray(x)) : [];
const tanggal = (v: unknown): Date | null => {
  if (typeof v !== 'string' || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ── Riwayat pembacaan resmi ────────────────────────────────────────────

/**
 * Satu pembacaan resmi masa lalu (unsur `riwayat` di paket rute) — padanan
 * period1..period3 Aurora: bahan menjawab pelanggan yang menanyakan riwayat
 * pemakaiannya di tempat, tanpa sinyal.
 */
export interface RiwayatBacaan {
  periode: number;
  standLalu: number | null;
  standAkhir: number | null;
  pemakaianM3: number | null;
  /**
   * Nominal tagihan periode itu (rupiah penuh). null = periode tersebut belum
   * atau tidak pernah ditagih — keadaan wajar, karena pembacaan meter selalu
   * lebih dulu ada daripada tagihannya. Ditampilkan "—", BUKAN "Rp 0":
   * keduanya berarti hal yang sangat berbeda bagi pelanggan yang bertanya.
   */
  totalTagihan: number | null;
}

export function riwayatDariJson(json: Json): RiwayatBacaan {
  return {
    periode: bulatWajib(json['periode']),
    standLalu: bulat(json['standLalu']),
    standAkhir: bulat(json['standAkhir']),
    pemakaianM3: bulat(json['pemakaianM3']),
    totalTagihan: bulat(json['totalTagihan']),
  };
}

// ── Pelanggan pada rute ────────────────────────────────────────────────

/** Ringkasan laporan periode berjalan yang menempel di baris pelanggan. */
export interface LaporanRingkas {
  id: string | null;
  standAkhir: number | null;
  kondisi: string | null;
  tanggalCatat: string | null;
}

/**
 * Satu pelanggan pada rute baca meter petugas. Bentuknya mengikuti baris
 * `GET /laporan-harian/rute-saya`.
 */
export interface PelangganRute {
  /** pelangganId di backend. */
  id: string;
  nomorLangganan: string;
  nama: string;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
  nomorMeter: string | null;
  /** Meter aktif terpasang — kunci riwayat pembacaan. */
  meterId: string | null;
  ruteId: string | null;
  ruteKode: string | null;
  /** Nomor urut tampil (server sudah memberi fallback bila noUrutRute kosong). */
  urutan: number | null;
  /** Urutan kunjungan RBM resmi (Pelanggan.noUrutRute; null = belum diatur). */
  noUrutRute: number | null;
  /**
   * Urutan menurut hirarki data (nomor persil) — "No Urut DPM" di aplikasi
   * lama. Ditampilkan BERDAMPINGAN dengan `urutan`, bukan menggantikannya:
   * urut DPM menyusun menurut struktur wilayah, urut kunjungan menyusun
   * menurut cara petugas benar-benar berjalan. Keduanya memang beda.
   */
  noUrutDpm: number | null;
  /**
   * Jam kunjungan terakhir yang tercatat (ISO). INILAH dasar urutan rute di
   * lapangan — ditampilkan supaya petugas bisa melihat sendiri kenapa sebuah
   * rumah ada di posisi itu. null = belum pernah ada pembacaan resmi.
   */
  waktuCatatTerakhir: string | null;
  /** Stand resmi bulan lalu — prefill & dasar hitung pemakaian. */
  standLalu: number | null;
  /** Pemakaian bulan lalu (m³) — dasar peringatan deviasi di layar catat. */
  pemakaianLalu: number | null;
  /** StatusPelanggan (AKTIF/DISEGEL/…) — DITAMPILKAN, tidak dipakai menyaring. */
  status: string | null;
  notelp: string | null;
  golonganTarif: string | null;
  geoLat: number | null;
  geoLong: number | null;
  /**
   * Komponen tetap tagihan terakhir (Rupiah). null = pelanggan belum pernah
   * ditagih → estimasi jatuh ke uang air saja.
   */
  beaBeban: number | null;
  beaAdmin: number | null;
  /** Maks. 3 pembacaan resmi terakhir, terbaru dulu. */
  riwayat: RiwayatBacaan[];
  /** Sudah dicatat pada periode berjalan (laporan terkirim ATAU masih antre). */
  sudahDicatat: boolean;
  laporan: LaporanRingkas | null;
}

export function pelangganDariJson(json: Json, ruteKodeBawaan?: string | null): PelangganRute {
  const laporanMentah = objek(json['laporan']);
  return {
    id: teks(json['pelangganId']) ?? teksWajib(json['id']),
    nomorLangganan: teksWajib(json['nomorLangganan']),
    nama: teksWajib(json['nama']),
    alamat: teks(json['alamat']),
    rt: teks(json['rt']),
    rw: teks(json['rw']),
    nomorMeter: teks(json['nomorMeter']),
    meterId: teks(json['meterId']),
    ruteId: teks(json['ruteId']),
    // Per-baris `ruteKode` (rute-saya multi-rute) menang; parameter hanya
    // cadangan untuk paket lama yang masih satu rute.
    ruteKode: teks(json['ruteKode']) ?? ruteKodeBawaan ?? null,
    urutan: bulat(json['urutan']),
    noUrutRute: bulat(json['noUrutRute']),
    noUrutDpm: bulat(json['noUrutDpm']),
    waktuCatatTerakhir: teks(json['waktuCatatTerakhir']),
    standLalu: bulat(json['standLalu']),
    pemakaianLalu: bulat(json['pemakaianLalu']),
    status: teks(json['status']),
    notelp: teks(json['notelp']),
    golonganTarif: teks(json['golonganTarif']),
    geoLat: pecahan(json['geoLat']),
    geoLong: pecahan(json['geoLong']),
    beaBeban: bulat(json['beaBeban']),
    beaAdmin: bulat(json['beaAdmin']),
    riwayat: larik(json['riwayat']).map(riwayatDariJson),
    sudahDicatat: json['sudahDicatat'] === true,
    laporan: laporanMentah
      ? {
          id: teks(laporanMentah['id']),
          standAkhir: bulat(laporanMentah['standAkhir']),
          kondisi: teks(laporanMentah['kondisi']),
          tanggalCatat: teks(laporanMentah['tanggalCatat']),
        }
      : null,
  };
}

/**
 * Bentuk JSON untuk cache lokal. Sengaja memakai kunci `pelangganId` yang
 * sama dengan server supaya paket hasil cache bisa dibaca ulang lewat
 * [pelangganDariJson] tanpa cabang khusus.
 */
export function pelangganKeJson(p: PelangganRute): Json {
  return {
    pelangganId: p.id,
    nomorLangganan: p.nomorLangganan,
    nama: p.nama,
    alamat: p.alamat,
    rt: p.rt,
    rw: p.rw,
    nomorMeter: p.nomorMeter,
    meterId: p.meterId,
    ruteId: p.ruteId,
    ruteKode: p.ruteKode,
    urutan: p.urutan,
    noUrutRute: p.noUrutRute,
    noUrutDpm: p.noUrutDpm,
    waktuCatatTerakhir: p.waktuCatatTerakhir,
    standLalu: p.standLalu,
    pemakaianLalu: p.pemakaianLalu,
    status: p.status,
    notelp: p.notelp,
    golonganTarif: p.golonganTarif,
    geoLat: p.geoLat,
    geoLong: p.geoLong,
    beaBeban: p.beaBeban,
    beaAdmin: p.beaAdmin,
    riwayat: p.riwayat,
    sudahDicatat: p.sudahDicatat,
    laporan: p.laporan,
  };
}

// ── Rute ───────────────────────────────────────────────────────────────

/** Ringkasan satu rute dalam beban kerja pencatat (rute-saya multi-rute). */
export interface RuteRingkas {
  id: string;
  kode: string;
  seksiCater: string | null;
  urutan: number;
  target: number;
  terbaca: number;
}

export function ruteRingkasDariJson(json: Json): RuteRingkas {
  const seksi = objek(json['seksiCater']);
  return {
    id: teksWajib(json['id']),
    kode: teksWajib(json['kode']),
    seksiCater: seksi ? teks(seksi['nama']) : null,
    urutan: bulatWajib(json['urutan']),
    target: bulatWajib(json['target']),
    terbaca: bulatWajib(json['terbaca']),
  };
}

export function ruteRingkasKeJson(r: RuteRingkas): Json {
  return {
    id: r.id,
    kode: r.kode,
    seksiCater: r.seksiCater == null ? null : { nama: r.seksiCater },
    urutan: r.urutan,
    target: r.target,
    terbaca: r.terbaca,
  };
}

/**
 * Paket rute petugas: identitas rute + target periode + daftar pelanggan.
 * Inilah yang diunduh dari server dan di-cache di perangkat.
 *
 * Sejak pemetaan rute many-to-many, satu pencatat bisa memegang BANYAK rute
 * ([rutes], urut kerja). [pelanggan] adalah daftar DATAR lintas semua rute,
 * sudah terurut (urutan rute, lalu noUrutRute) oleh server.
 */
export interface RuteSaya {
  /** null = akun belum ditugaskan rute. Itu keadaan sah, BUKAN error. */
  ruteKode: string | null;
  rutes: RuteRingkas[];
  /** Nama seksi cater rute PERTAMA — konteks wilayah di header. */
  seksiCater: string | null;
  periode: number;
  /** Target pencatatan = jumlah pelanggan rute pada periode ini. */
  target: number;
  terbaca: number;
  pelanggan: PelangganRute[];
  /**
   * Jumlah laporan yang DICATAT PENCATAT INI pada periode berjalan — lintas
   * rute, sehingga pindah rute di tengah bulan tidak menghapus hasil kerja.
   */
  dicatatSaya: number;
  namaPencatat: string | null;
  /** Kunci filter `pencatatId` di GET /laporan-harian (layar Riwayat). */
  pencatatId: string | null;
  /** Kapan paket ini diunduh (waktu perangkat). */
  diunduhPada: Date | null;
  /** true = dibaca dari cache lokal karena server tak terjangkau. */
  dariCache: boolean;
}

export function ruteSayaDariJson(
  json: Json,
  opsi: { diunduhPada?: Date | null; dariCache?: boolean; periodeCadangan?: number } = {},
): RuteSaya {
  // Daftar rute (multi). Jatuh ke `rute` tunggal supaya cache paket versi
  // lama tetap terbaca setelah aplikasi diperbarui.
  const rutes = larik(json['rutes']).map(ruteRingkasDariJson);
  const ruteTunggal = objek(json['rute']);
  const kode = rutes.length > 0 ? rutes[0]!.kode : ruteTunggal ? teks(ruteTunggal['kode']) : null;
  const seksi =
    rutes.length > 0
      ? rutes[0]!.seksiCater
      : ruteTunggal
        ? (() => {
            const s = objek(ruteTunggal['seksiCater']);
            return s ? teks(s['nama']) : null;
          })()
        : null;
  const pencatat = objek(json['pencatat']);
  const rows = larik(json['pelanggan']).map((row) => pelangganDariJson(row, kode));
  return {
    ruteKode: kode,
    rutes,
    seksiCater: seksi,
    periode: bulat(json['periode']) ?? opsi.periodeCadangan ?? 0,
    target: bulat(json['target']) ?? rows.length,
    terbaca: bulat(json['terbaca']) ?? rows.filter((p) => p.sudahDicatat).length,
    pelanggan: rows,
    dicatatSaya: bulatWajib(json['dicatatSaya']),
    namaPencatat: pencatat ? teks(pencatat['namaLapangan']) : null,
    pencatatId: pencatat ? teks(pencatat['id']) : null,
    diunduhPada: opsi.diunduhPada ?? null,
    dariCache: opsi.dariCache ?? false,
  };
}

export function ruteSayaKeJson(r: RuteSaya): Json {
  return {
    rute:
      r.ruteKode == null
        ? null
        : { kode: r.ruteKode, seksiCater: r.seksiCater == null ? null : { nama: r.seksiCater } },
    rutes: r.rutes.map(ruteRingkasKeJson),
    pencatat:
      r.namaPencatat == null && r.pencatatId == null
        ? null
        : { namaLapangan: r.namaPencatat, id: r.pencatatId },
    periode: r.periode,
    target: r.target,
    terbaca: r.terbaca,
    dicatatSaya: r.dicatatSaya,
    pelanggan: r.pelanggan.map(pelangganKeJson),
  };
}

/** Salin paket dengan daftar pelanggan baru; `terbaca` ikut dihitung ulang. */
export function ruteSayaDenganPelanggan(r: RuteSaya, rows: PelangganRute[]): RuteSaya {
  return { ...r, pelanggan: rows, terbaca: rows.filter((p) => p.sudahDicatat).length };
}

// ── Riwayat hasil catat saya ───────────────────────────────────────────

/** ANTRE = masih di perangkat; sisanya status verifikasi di server. */
export type StatusVerifLaporan = 'ANTRE' | 'MENUNGGU' | 'DIVERIFIKASI' | 'DITOLAK';

/**
 * Satu baris riwayat hasil catat AKUN INI — padanan `tv_today_reading` +
 * daftar read Aurora, ditambah status verifikasi berjenjang yang tidak
 * dimiliki Aurora.
 */
export interface LaporanSaya {
  id: string | null;
  nomorLangganan: string;
  namaPelanggan: string | null;
  periode: number;
  standAwal: number | null;
  standAkhir: number | null;
  pemakaian: number | null;
  kondisi: string | null;
  tanggalCatat: Date | null;
  statusVerif: StatusVerifLaporan;
  catatanVerif: string | null;
  /** Pesan server saat baris antrean ditolak (hanya statusVerif ANTRE). */
  pesanGagal: string | null;
}

/**
 * Dari baris GET /laporan-harian. Status verifikasi TURUNAN dengan aturan
 * yang sama persis dengan server: MENUNGGU = verifiedAt null; DIVERIFIKASI =
 * isVerified; DITOLAK = verifiedAt terisi tanpa isVerified.
 */
export function laporanSayaDariJson(json: Json): LaporanSaya {
  const isVerified = json['isVerified'] === true;
  const verifiedAt = json['verifiedAt'];
  return {
    id: teks(json['id']),
    nomorLangganan: teksWajib(json['nomorLangganan']),
    namaPelanggan: teks(json['namaPelanggan']),
    periode: bulatWajib(json['periode']),
    standAwal: bulat(json['standAwal']),
    standAkhir: bulat(json['standAkhir']),
    pemakaian: bulat(json['pemakaian']),
    kondisi: teks(json['kondisi']),
    tanggalCatat: tanggal(json['tanggalCatat']),
    statusVerif: isVerified ? 'DIVERIFIKASI' : verifiedAt == null ? 'MENUNGGU' : 'DITOLAK',
    catatanVerif: teks(json['catatanVerif']),
    pesanGagal: null,
  };
}

/** Dicatat hari ini menurut jam perangkat — penanda "hasil kerja hari ini". */
export function dicatatHariIni(l: LaporanSaya): boolean {
  const t = l.tanggalCatat;
  if (t == null) return false;
  const kini = new Date();
  return (
    t.getFullYear() === kini.getFullYear() &&
    t.getMonth() === kini.getMonth() &&
    t.getDate() === kini.getDate()
  );
}

// ── Antrean offline ────────────────────────────────────────────────────

/** Jenis berkas bukti yang boleh menempel pada satu catatan. */
export type JenisBerkas = 'stand' | 'segel' | 'rumah' | 'video';

/**
 * Satu entri antrean offline: payload laporan siap kirim + path berkas lokal
 * yang belum terunggah.
 */
export interface CatatTertunda {
  /** id baris antrean di SQLite (null sebelum tersimpan). */
  idAntrean: number | null;
  payload: Json;
  fotoPaths: Partial<Record<JenisBerkas, string>>;
  /**
   * URL berkas yang SUDAH berhasil diunggah, per jenis. Ditulis segera tiap
   * satu berkas sampai di server, sehingga percobaan kirim berikutnya
   * melewatinya alih-alih mengunggah ulang dari nol.
   */
  fotoUrls: Partial<Record<JenisBerkas, string>>;
  dibuatPada: Date;
  /**
   * Berapa kali sudah dicoba kirim + pesan gagal terakhir dari server —
   * bahan layar antrean, supaya baris bermasalah KELIHATAN alih-alih
   * menghilang diam-diam.
   */
  percobaan: number;
  pesanGagal: string | null;
}

export function nomorLanggananAntrean(e: CatatTertunda): string {
  return teksWajib(e.payload['nomorLangganan']);
}

export function periodeAntrean(e: CatatTertunda): number {
  return bulatWajib(e.payload['periode']);
}

/** Hasil kirim catat. Model Aurora: catat = SIMPAN LOKAL, kirim menyusul. */
export type HasilCatat = 'terkirim' | 'tersimpanOffline';
