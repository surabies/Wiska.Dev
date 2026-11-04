import { Platform } from 'react-native';
/**
 * db.ts — pembuka SQLite lokal, pondasi kerja offline aplikasi petugas.
 * Padanan `core/db/database_lokal.dart` (sqflite → expo-sqlite).
 *
 * KENAPA SQLITE, BUKAN SECURE-STORE/ASYNC-STORAGE. Paket rute berisi ratusan
 * baris dan antrean offline berisi hasil kerja SEHARIAN petugas. Sebagai satu
 * blob JSON, gagal parse = SEMUANYA hilang; sebagai baris tabel, satu baris
 * korup tidak menular ke tetangganya. Aurora bertahan bertahun-tahun di
 * lapangan dengan pola ini, dan alasannya persis itu.
 *
 * Query per-domain TIDAK ada di sini — lihat `dao.ts`.
 */
import * as SQLite from 'expo-sqlite';

const NAMA_BERKAS = 'wipel_petugas.db';

/**
 * Versi skema. Naikkan HANYA bersama cabang migrasi di [migrasi]; menaikkan
 * tanpa cabang berarti perangkat lama berhenti di versi lamanya tanpa
 * peringatan apa pun.
 */
const VERSI = 4;

let koneksi: SQLite.SQLiteDatabase | null = null;
let sedangDibuka: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Buka (sekali) database lokal. Aman dipanggil serentak: pemanggil kedua
 * menunggu promise yang sama alih-alih membuka koneksi kedua — dua koneksi
 * ke berkas yang sama adalah jalan pintas menuju "database is locked".
 */
export function bukaDb(): Promise<SQLite.SQLiteDatabase> {
  if (koneksi != null) return Promise.resolve(koneksi);
  if (sedangDibuka != null) return sedangDibuka;

  sedangDibuka = (async () => {
    const db = await SQLite.openDatabaseAsync(NAMA_BERKAS);
    await migrasi(db);
    koneksi = db;
    sedangDibuka = null;
    return db;
  })().catch((err) => {
    sedangDibuka = null;
    throw err;
  });

  return sedangDibuka;
}

/**
 * Nama SELURUH tabel skema terkini. Dipakai [pastikanSkema] untuk mendeteksi
 * perangkat yang penanda versinya sudah maju tetapi tabelnya tidak ada.
 */
const TABEL_TERKINI = [
  'pelanggan_rute',
  'antrean_laporan',
  'meta',
  'anomali',
  'kunjungan_terkirim',
] as const;

async function migrasi(db: SQLite.SQLiteDatabase): Promise<void> {
  // WAL: pembacaan tidak memblokir penulisan. Petugas menggulir daftar rute
  // sambil antrean menulis di belakang — tanpa ini keduanya saling menunggu.
  await db.execAsync('PRAGMA journal_mode = WAL');

  const baris = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versiSekarang = baris?.user_version ?? 0;
  if (versiSekarang >= VERSI) {
    await pastikanSkema(db);
    return;
  }

  // SATU TRANSAKSI untuk seluruh migrasi, TERMASUK penaikan user_version.
  //
  // Tanpa ini keduanya adalah dua penulisan terpisah, dan sebuah perangkat
  // bisa berhenti di keadaan mustahil dipulihkan: penanda versi sudah naik
  // sementara tabelnya gagal dibuat. Cabang di atas lalu memulangkan lebih
  // awal selamanya, dan setiap query ke tabel yang hilang melempar
  // "no such table" — persis kegagalan yang pernah terjadi di lapangan pada
  // modul anomali. Di dalam transaksi, penanda versi hanya ikut tersimpan
  // bila SEMUA DDL-nya tersimpan.
  await db.withTransactionAsync(async () => {
    await jalankanMigrasi(db, versiSekarang);
    await db.execAsync(`PRAGMA user_version = ${VERSI}`);
  });
}

/**
 * Jaring pengaman untuk perangkat yang TERLANJUR rusak oleh bug di atas
 * (penanda versi sudah 2, tabel anomali tidak pernah ada). Menaikkan VERSI
 * tidak menolong mereka — versinya sudah lebih tinggi. Satu-satunya jalan
 * pulih adalah memeriksa tabelnya sendiri, bukan percaya pada penandanya.
 *
 * Murah: satu query ke `sqlite_master` saat buka, dan DDL hanya dijalankan
 * bila memang ada yang hilang. Hanya menolong tabel yang HILANG — migrasi
 * yang mengubah bentuk tabel (ALTER) tetap wajib punya cabang bernomor.
 */
async function pastikanSkema(db: SQLite.SQLiteDatabase): Promise<void> {
  const daftar = TABEL_TERKINI.map((t) => `'${t}'`).join(', ');
  const hitung = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (${daftar})`,
  );
  if ((hitung?.n ?? 0) === TABEL_TERKINI.length) return;

  // Seluruh DDL ber-`IF NOT EXISTS`, jadi menjalankannya ulang tidak
  // menyentuh tabel yang sudah berisi data petugas.
  await db.withTransactionAsync(async () => {
    await jalankanMigrasi(db, 0);
  });
}

/** DDL bertahap. `dari` = versi yang sudah dimiliki perangkat. */
async function jalankanMigrasi(db: SQLite.SQLiteDatabase, dari: number): Promise<void> {
  if (dari < 1) {
    // Paket rute yang diunduh. Kolom yang DIPAKAI MENYARING/MENGURUTKAN
    // dipecah jadi kolom nyata; sisanya utuh di data_json supaya server
    // boleh menambah field tanpa memaksa migrasi skema di ribuan perangkat.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pelanggan_rute(
        nomor_langganan TEXT PRIMARY KEY,
        pelanggan_id    TEXT NOT NULL,
        nama            TEXT NOT NULL DEFAULT '',
        alamat          TEXT,
        rute_kode       TEXT,
        urutan          INTEGER,
        periode         INTEGER NOT NULL,
        sudah_dicatat   INTEGER NOT NULL DEFAULT 0,
        data_json       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pelanggan_rute_urutan ON pelanggan_rute(urutan);
      CREATE INDEX IF NOT EXISTS idx_pelanggan_rute_rute ON pelanggan_rute(rute_kode);
    `);

    // Antrean offline (outbox) hasil catat yang belum sampai server.
    // UNIQUE(nomor_langganan, periode) ON CONFLICT REPLACE menyamai
    // @@unique([nomorLangganan, periode]) di server: mencatat ulang
    // pelanggan yang sama MENIMPA antreannya, bukan menggandakannya.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS antrean_laporan(
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        nomor_langganan TEXT NOT NULL,
        periode         INTEGER NOT NULL,
        payload_json    TEXT NOT NULL,
        foto_paths_json TEXT NOT NULL DEFAULT '{}',
        percobaan       INTEGER NOT NULL DEFAULT 0,
        pesan_gagal     TEXT,
        dibuat_pada     TEXT NOT NULL,
        UNIQUE(nomor_langganan, periode) ON CONFLICT REPLACE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meta(
        kunci TEXT PRIMARY KEY,
        nilai TEXT NOT NULL
      );
    `);
  }

  if (dari < 2) await buatTabelAnomali(db);

  if (dari < 3) {
    // Tabel anomali DIPASTIKAN ADA lebih dulu. Perangkat yang terlanjur rusak
    // oleh bug penanda versi (lihat [pastikanSkema]) berhenti di versi 2
    // TANPA tabelnya, dan `ALTER TABLE` pada tabel yang tidak ada akan
    // menggagalkan seluruh transaksi — perangkat itu lalu macet lagi, kali
    // ini di versi 2. DDL-nya ber-IF NOT EXISTS, jadi memanggilnya ulang
    // tidak menyentuh data yang sudah ada.
    await buatTabelAnomali(db);
    await tambahKolomWilayah(db);
  }

  if (dari < 4) await tambahKolomFotoUrl(db);
}

/**
 * v4 — INGATAN UNGGAH FOTO.
 *
 * Sebelumnya antrean hanya menyimpan path LOKAL foto. Setiap percobaan kirim
 * mengunggah ulang seluruh fotonya dari nol, termasuk yang sudah berhasil
 * sampai di server pada percobaan sebelumnya. Untuk petugas yang membawa
 * ratusan baris di sinyal buruk, itu berarti pekerjaan yang sama diulang
 * berjam-jam dan tidak pernah selesai.
 *
 * Kolom ini menyimpan URL hasil unggah per jenis berkas, ditulis SEGERA
 * setiap satu foto berhasil. Percobaan berikutnya melewatinya.
 *
 * Aman diulang: nama berkas di server deterministik, jadi bila URL-nya
 * terlanjur hilang di sini, unggah ulang hanya MENIMPA berkas yang sama.
 */
async function tambahKolomFotoUrl(db: SQLite.SQLiteDatabase): Promise<void> {
  const kolom = await db.getAllAsync<{ name: string }>('PRAGMA table_info(antrean_laporan)');
  if (kolom.some((k) => k.name === 'foto_urls_json')) return;
  await db.execAsync(
    `ALTER TABLE antrean_laporan ADD COLUMN foto_urls_json TEXT NOT NULL DEFAULT '{}'`,
  );
}

/** DDL versi 2 — dipakai jalur migrasi DAN jaring pengaman. Idempoten. */
async function buatTabelAnomali(db: SQLite.SQLiteDatabase): Promise<void> {
  {
    // Daftar anomali yang diunduh. Alasannya SAMA dengan pelanggan_rute:
    // daftarnya ribuan baris, dan menariknya ulang tiap kali layar dibuka
    // membuat aplikasi terasa berat sekaligus tidak berguna saat sinyal mati.
    //
    // Kolom yang dipakai MENYARING dan MENGURUTKAN dipecah jadi kolom nyata;
    // sisanya utuh di data_json supaya server boleh menambah field tanpa
    // memaksa migrasi di perangkat yang sudah tersebar.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS anomali(
        pelanggan_id     TEXT PRIMARY KEY,
        nomor_langganan  TEXT NOT NULL,
        nama             TEXT NOT NULL DEFAULT '',
        alamat           TEXT,
        kategori         TEXT NOT NULL,
        bulan_berturut   INTEGER NOT NULL DEFAULT 0,
        m3_tanpa_dasar   INTEGER NOT NULL DEFAULT 0,
        skor             REAL NOT NULL DEFAULT 0,
        jml_rek_tunggak  INTEGER NOT NULL DEFAULT 0,
        prioritas        INTEGER NOT NULL DEFAULT 0,
        rute_kode        TEXT,
        data_json        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anomali_skor ON anomali(skor DESC);
      CREATE INDEX IF NOT EXISTS idx_anomali_kategori ON anomali(kategori);
      CREATE INDEX IF NOT EXISTS idx_anomali_prioritas ON anomali(prioritas);
    `);

    // Jejak kunjungan yang SUDAH terkirim, disimpan lokal supaya baris yang
    // baru saja dikerjakan langsung hilang dari daftar tanpa menunggu unduh
    // ulang. Server tetap pemegang kebenarannya; ini hanya supaya layar tidak
    // menyuruh petugas mendatangi rumah yang tadi pagi ia datangi sendiri.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS kunjungan_terkirim(
        pelanggan_id TEXT NOT NULL,
        periode      INTEGER NOT NULL,
        hasil        TEXT NOT NULL,
        dikirim_pada TEXT NOT NULL,
        PRIMARY KEY (pelanggan_id, periode)
      );
    `);
  }
}

/**
 * Versi 3 — wilayah dan urutan jalan.
 *
 * Daftar anomali diurutkan menurut paparan, dan paparan tidak mengenal
 * geografi: dua baris berurutan bisa terpisah beberapa kilometer. Empat kolom
 * ini yang membuat petugas bisa mempersempit ke satu kelurahan/RW lalu
 * menyusurinya menurut urutan baca meter, alih-alih melompat-lompat.
 *
 * SQLite tidak punya `ADD COLUMN IF NOT EXISTS`, jadi kolom yang sudah ada
 * dilewati berdasarkan `PRAGMA table_info` — bukan dengan menelan galat,
 * yang akan menyembunyikan kegagalan lain sekalian.
 */
async function tambahKolomWilayah(db: SQLite.SQLiteDatabase): Promise<void> {
  const kolom = await db.getAllAsync<{ name: string }>('PRAGMA table_info(anomali)');
  const ada = new Set(kolom.map((k) => k.name));

  const tambahan: [string, string][] = [
    ['kelurahan', 'TEXT'],
    ['rt', 'TEXT'],
    ['rw', 'TEXT'],
    ['no_urut_rute', 'INTEGER'],
  ];
  for (const [nama, tipe] of tambahan) {
    if (!ada.has(nama)) await db.execAsync(`ALTER TABLE anomali ADD COLUMN ${nama} ${tipe}`);
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_anomali_kelurahan ON anomali(kelurahan);
    CREATE INDEX IF NOT EXISTS idx_anomali_jalan ON anomali(rute_kode, no_urut_rute);
  `);
}

/**
 * Tutup koneksi — dipakai uji dan "hapus data lokal". Bukan bagian dari alur
 * normal: database tetap terbuka selama aplikasi hidup.
 */
export async function tutupDb(): Promise<void> {
  await koneksi?.closeAsync();
  koneksi = null;
}
