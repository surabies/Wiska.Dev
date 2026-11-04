/**
 * dao.ts — seluruh SQL modul Baca Meter. Padanan `rbm_dao.dart`
 * (`DataBaseHelper` + `QueryHelper` Aurora dalam satu berkas).
 *
 * Repository TIDAK menyentuh database langsung; semua lewat sini.
 */
import {
  pelangganDariJson,
  pelangganKeJson,
  ruteSayaDariJson,
  ruteSayaKeJson,
  ruteSayaDenganPelanggan,
  nomorLanggananAntrean,
  periodeAntrean,
  type CatatTertunda,
  type JenisBerkas,
  type PelangganRute,
  type RuteSaya,
} from '@workspace/mobile-core';
import { bukaDb } from './DbBacaMeter';

const KUNCI_META_PAKET = 'rbm.paket_meta';
const KUNCI_META_WAKTU = 'rbm.paket_waktu';

type BarisPelanggan = {
  data_json: string;
  sudah_dicatat: number;
  antre: number;
};

type BarisAntrean = {
  id: number;
  payload_json: string;
  foto_paths_json: string;
  foto_urls_json: string | null;
  percobaan: number | null;
  pesan_gagal: string | null;
  dibuat_pada: string | null;
};

/**
 * Bongkar satu baris pelanggan. Mengembalikan null bila JSON-nya korup —
 * pemanggil MELEWATI baris itu dan meneruskan sisanya. Inilah seluruh alasan
 * pindah dari blob tunggal ke tabel: kerusakan tidak boleh menular.
 */
function bacaBarisPelanggan(row: BarisPelanggan): PelangganRute | null {
  try {
    const p = pelangganDariJson(JSON.parse(row.data_json) as Record<string, unknown>);
    // Baris yang masih antre di outbox WAJIB tampil sudah dicatat: petugas
    // tidak boleh mencatat dua kali hanya karena laporannya belum tersinkron
    // (di Aurora ini BILL_IS_UPLOAD=1).
    const tercatat = row.sudah_dicatat === 1 || row.antre === 1;
    return tercatat === p.sudahDicatat ? p : { ...p, sudahDicatat: tercatat };
  } catch {
    return null;
  }
}

// ── Paket rute ─────────────────────────────────────────────────────────

/**
 * Simpan paket unduhan rute: GANTI seluruh isi (pola DownloadDataActivity
 * Aurora — unduhan baru adalah kebenaran baru). Satu transaksi: gagal di
 * tengah berarti paket lama tetap utuh, bukan setengah-setengah.
 */
export async function simpanPaket(
  paket: RuteSaya,
  diunduhPada?: Date,
  /**
   * Dipanggil tiap kelipatan baris tersimpan. Menulis 2.400-an pelanggan satu
   * per satu adalah bagian TERLAMA dari "unduh", dan tanpa laporan ini layar
   * hanya memutar spinner selama itu — tak bisa dibedakan dari macet.
   */
  onProgres?: (selesai: number, total: number) => void,
): Promise<void> {
  const db = await bukaDb();
  const { pelanggan: _abaikan, ...meta } = ruteSayaKeJson(paket) as Record<string, unknown>;
  const metaJson = JSON.stringify(meta);
  const waktu = (diunduhPada ?? new Date()).toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pelanggan_rute');
    // Dilaporkan per 50 baris, bukan tiap baris: 2.400 pembaruan state akan
    // membuat layar sendiri jadi hambatannya.
    const LANGKAH = 50;
    let ke = 0;
    for (const p of paket.pelanggan) {
      await db.runAsync(
        `INSERT INTO pelanggan_rute
           (nomor_langganan, pelanggan_id, nama, alamat, rute_kode, urutan, periode, sudah_dicatat, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.nomorLangganan,
        p.id,
        p.nama,
        p.alamat,
        p.ruteKode,
        p.urutan,
        paket.periode,
        p.sudahDicatat ? 1 : 0,
        JSON.stringify(pelangganKeJson(p)),
      );
      ke++;
      if (ke % LANGKAH === 0) onProgres?.(ke, paket.pelanggan.length);
    }
    onProgres?.(paket.pelanggan.length, paket.pelanggan.length);
    await db.runAsync(
      'INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)',
      KUNCI_META_PAKET,
      metaJson,
    );
    await db.runAsync('INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)', KUNCI_META_WAKTU, waktu);
  });
}

/** Baca paket dari lokal. null = belum pernah mengunduh rute di perangkat ini. */
/**
 * Baca paket rute dari SQLite.
 *
 * `dariCache` menandai bahwa isi ini DISAJIKAN TANPA menyentuh server, dan
 * itulah yang dipakai UI untuk memberi tahu petugas bahwa angkanya mungkin
 * sudah basi. Bisa ditimpa karena pemanggil yang BARU SAJA berhasil mengunduh
 * juga membaca balik lewat sini (supaya status antrean lokal ikut diterapkan)
 * — dan tanpa penimpaan itu penandanya mustahil bernilai false, sehingga
 * lencananya menyala selamanya bahkan sesudah penyegaran yang sukses.
 */
export async function bacaPaket(opsi: { dariCache?: boolean } = {}): Promise<RuteSaya | null> {
  const db = await bukaDb();
  const meta = await db.getFirstAsync<{ nilai: string }>(
    'SELECT nilai FROM meta WHERE kunci = ? LIMIT 1',
    KUNCI_META_PAKET,
  );
  if (meta == null) return null;

  const rows = await db.getAllAsync<BarisPelanggan>(`
    SELECT p.data_json,
           p.sudah_dicatat,
           EXISTS(SELECT 1 FROM antrean_laporan a
                  WHERE a.nomor_langganan = p.nomor_langganan) AS antre
    FROM pelanggan_rute p
    ORDER BY p.urutan IS NULL, p.urutan, p.nomor_langganan
  `);

  const pelanggan: PelangganRute[] = [];
  for (const row of rows) {
    const p = bacaBarisPelanggan(row);
    if (p != null) pelanggan.push(p);
  }

  const waktu = await db.getFirstAsync<{ nilai: string }>(
    'SELECT nilai FROM meta WHERE kunci = ? LIMIT 1',
    KUNCI_META_WAKTU,
  );

  let paketMeta: Record<string, unknown>;
  try {
    paketMeta = JSON.parse(meta.nilai) as Record<string, unknown>;
  } catch {
    return null; // meta korup — perlakukan seperti belum pernah mengunduh.
  }

  const diunduh = waktu == null ? null : new Date(waktu.nilai);
  const dasar = ruteSayaDariJson(
    { ...paketMeta, pelanggan: [] },
    {
      diunduhPada: diunduh != null && !Number.isNaN(diunduh.getTime()) ? diunduh : null,
      dariCache: opsi.dariCache ?? true,
    },
  );
  return ruteSayaDenganPelanggan(dasar, pelanggan);
}

/**
 * Terapkan urutan kunjungan baru ke cache lokal setelah server menerimanya.
 *
 * DUA TEMPAT DIPERBARUI, dan itu bukan kelalaian desain melainkan konsekuensi
 * bentuk tabelnya: kolom `urutan` yang dipakai ORDER BY, dan `urutan` di dalam
 * `data_json` yang dibaca `pelangganDariJson`. Memperbarui salah satu saja
 * menghasilkan daftar yang tersusun benar tapi menampilkan nomor lama di
 * badge-nya — atau sebaliknya, dan keduanya membuat petugas mengira aplikasi
 * mengabaikan perubahannya.
 *
 * Dikerjakan lokal alih-alih mengunduh ulang rute: urutan finalnya sudah
 * dihitung di sini untuk dikirim, jadi mengunduh ulang seluruh penugasan
 * (bisa ribuan baris) hanya untuk mendapat angka yang sudah kita ketahui
 * adalah ongkos sinyal yang tidak perlu di lapangan.
 */
export async function perbaruiUrutan(pelangganIds: string[]): Promise<void> {
  const db = await bukaDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < pelangganIds.length; i++) {
      const id = pelangganIds[i];
      if (id == null) continue;
      const urutan = i + 1;
      await db.runAsync(
        `UPDATE pelanggan_rute
            SET urutan = ?,
                data_json = json_set(data_json, '$.urutan', ?)
          WHERE pelanggan_id = ?`,
        urutan,
        urutan,
        id,
      );
    }
  });
}

/** Tandai satu pelanggan tercatat (setelah laporan masuk antrean/terkirim). */
export async function tandaiDicatat(nomorLangganan: string): Promise<void> {
  const db = await bukaDb();
  await db.runAsync(
    'UPDATE pelanggan_rute SET sudah_dicatat = 1 WHERE nomor_langganan = ?',
    nomorLangganan,
  );
}

/**
 * Pencarian lokal ala `pencarianData` Aurora: nama / nomor langganan /
 * alamat lewat SATU kotak cari. Berfungsi penuh saat offline — itu memang
 * intinya, karena di lapangan sinyal adalah kemewahan.
 */
export async function cari(kueri: string): Promise<PelangganRute[]> {
  const db = await bukaDb();
  const q = `%${kueri.trim()}%`;
  const rows = await db.getAllAsync<BarisPelanggan>(
    `SELECT data_json,
            sudah_dicatat,
            EXISTS(SELECT 1 FROM antrean_laporan a
                   WHERE a.nomor_langganan = pelanggan_rute.nomor_langganan) AS antre
     FROM pelanggan_rute
     WHERE nama LIKE ? OR nomor_langganan LIKE ? OR alamat LIKE ?
     ORDER BY urutan IS NULL, urutan, nomor_langganan
     LIMIT 100`,
    q,
    q,
    q,
  );
  const hasil: PelangganRute[] = [];
  for (const row of rows) {
    const p = bacaBarisPelanggan(row);
    if (p != null) hasil.push(p);
  }
  return hasil;
}

/** Satu pelanggan menurut nomor langganan — layar catat dibuka lewat ini. */
export async function ambilPelanggan(nomorLangganan: string): Promise<PelangganRute | null> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<BarisPelanggan>(
    `SELECT data_json,
            sudah_dicatat,
            EXISTS(SELECT 1 FROM antrean_laporan a
                   WHERE a.nomor_langganan = pelanggan_rute.nomor_langganan) AS antre
     FROM pelanggan_rute WHERE nomor_langganan = ? LIMIT 1`,
    nomorLangganan,
  );
  return row == null ? null : bacaBarisPelanggan(row);
}

// ── Antrean offline (outbox) ───────────────────────────────────────────

export async function tambahAntrean(entri: CatatTertunda): Promise<void> {
  const db = await bukaDb();
  // UNIQUE(nomor_langganan, periode) ON CONFLICT REPLACE di skema — catat
  // ulang pelanggan yang sama menimpa antrean lamanya.
  await db.runAsync(
    `INSERT INTO antrean_laporan
       (nomor_langganan, periode, payload_json, foto_paths_json, dibuat_pada)
     VALUES (?, ?, ?, ?, ?)`,
    nomorLanggananAntrean(entri),
    periodeAntrean(entri),
    JSON.stringify(entri.payload),
    JSON.stringify(entri.fotoPaths),
    entri.dibuatPada.toISOString(),
  );
}

export async function daftarAntrean(): Promise<CatatTertunda[]> {
  const db = await bukaDb();
  const rows = await db.getAllAsync<BarisAntrean>('SELECT * FROM antrean_laporan ORDER BY id');
  const hasil: CatatTertunda[] = [];
  for (const row of rows) {
    try {
      const dibuat = new Date(row.dibuat_pada ?? '');
      hasil.push({
        idAntrean: row.id,
        payload: JSON.parse(row.payload_json) as Record<string, unknown>,
        fotoPaths: JSON.parse(row.foto_paths_json) as Partial<Record<JenisBerkas, string>>,
        fotoUrls: JSON.parse(row.foto_urls_json ?? '{}') as Partial<Record<JenisBerkas, string>>,
        dibuatPada: Number.isNaN(dibuat.getTime()) ? new Date() : dibuat,
        percobaan: row.percobaan ?? 0,
        pesanGagal: row.pesan_gagal,
      });
    } catch {
      // Satu baris korup dilewati; sisa antrean tetap bisa diunggah.
      continue;
    }
  }
  return hasil;
}

/** Satu baris antrean sebagaimana dibutuhkan LAYAR UNGGAH. */
export interface RingkasAntrean {
  idAntrean: number;
  nomorLangganan: string;
  periode: number;
  nama: string;
  /** null = pelanggannya tidak ada di daftar rute lokal (mis. hasil pulihkan cadangan). */
  ruteKode: string | null;
  /** Jumlah berkas yang dilampirkan baris ini. */
  jumlahBerkas: number;
  /** Berapa di antaranya yang SUDAH aman di server. */
  berkasTerunggah: number;
  percobaan: number;
  pesanGagal: string | null;
}

/**
 * Antrean + kode rutenya, lewat LEFT JOIN ke daftar pelanggan lokal.
 *
 * Rute TIDAK disimpan di baris antrean (payload laporan tidak membawanya),
 * jadi ia diambil dari tabel pelanggan. LEFT, bukan INNER: baris hasil
 * pulihkan-cadangan bisa saja tidak punya pasangan di daftar rute, dan baris
 * itu justru yang paling tidak boleh hilang dari layar unggah.
 */
export async function daftarAntreanRingkas(): Promise<RingkasAntrean[]> {
  const db = await bukaDb();
  const rows = await db.getAllAsync<{
    id: number;
    nomor_langganan: string;
    periode: number;
    foto_paths_json: string;
    foto_urls_json: string | null;
    percobaan: number | null;
    pesan_gagal: string | null;
    nama: string | null;
    rute_kode: string | null;
  }>(
    `SELECT a.id, a.nomor_langganan, a.periode, a.foto_paths_json, a.foto_urls_json,
            a.percobaan, a.pesan_gagal, p.nama, p.rute_kode
       FROM antrean_laporan a
       LEFT JOIN pelanggan_rute p ON p.nomor_langganan = a.nomor_langganan
      ORDER BY p.rute_kode, a.id`,
  );
  const hitung = (teks: string | null): number => {
    try {
      return Object.values(JSON.parse(teks ?? '{}') as Record<string, string>).filter(Boolean).length;
    } catch {
      return 0;
    }
  };
  return rows.map((r) => ({
    idAntrean: r.id,
    nomorLangganan: r.nomor_langganan,
    periode: r.periode,
    nama: r.nama ?? r.nomor_langganan,
    ruteKode: r.rute_kode,
    jumlahBerkas: hitung(r.foto_paths_json),
    berkasTerunggah: hitung(r.foto_urls_json),
    percobaan: r.percobaan ?? 0,
    pesanGagal: r.pesan_gagal,
  }));
}

/**
 * Catat SATU berkas yang berhasil diunggah, seketika setelah URL-nya diterima.
 *
 * Ditulis per berkas, bukan sekali di akhir: seluruh gunanya adalah bertahan
 * dari sinyal yang putus DI TENGAH baris, dan menunda penulisannya sampai
 * semua foto selesai akan membuang persis kasus yang mau diselamatkan.
 */
export async function simpanFotoUrl(
  idAntrean: number,
  jenis: JenisBerkas,
  url: string,
): Promise<void> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<{ foto_urls_json: string | null }>(
    'SELECT foto_urls_json FROM antrean_laporan WHERE id = ?',
    idAntrean,
  );
  let peta: Record<string, string> = {};
  try {
    peta = JSON.parse(row?.foto_urls_json ?? '{}') as Record<string, string>;
  } catch {
    peta = {};
  }
  peta[jenis] = url;
  await db.runAsync('UPDATE antrean_laporan SET foto_urls_json = ? WHERE id = ?', JSON.stringify(peta), idAntrean);
}

export async function hapusAntrean(id: number): Promise<void> {
  const db = await bukaDb();
  await db.runAsync('DELETE FROM antrean_laporan WHERE id = ?', id);
}

/**
 * Catat kegagalan per baris (dari respons per-record /batch). Baris TETAP di
 * antrean beserta pesannya — hasil kerja yang ditolak server harus kelihatan,
 * bukan menghilang diam-diam.
 */
export async function tandaiGagal(id: number, pesan: string): Promise<void> {
  const db = await bukaDb();
  await db.runAsync(
    'UPDATE antrean_laporan SET percobaan = percobaan + 1, pesan_gagal = ? WHERE id = ?',
    pesan,
    id,
  );
}

export async function jumlahAntrean(): Promise<number> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM antrean_laporan');
  return row?.n ?? 0;
}

// ── Meta kunci-nilai ───────────────────────────────────────────────────

export async function simpanMeta(kunci: string, nilai: string): Promise<void> {
  const db = await bukaDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)', kunci, nilai);
}

export async function bacaMeta(kunci: string): Promise<string | null> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<{ nilai: string }>(
    'SELECT nilai FROM meta WHERE kunci = ? LIMIT 1',
    kunci,
  );
  return row?.nilai ?? null;
}

/**
 * Hapus paket rute — TIDAK menyentuh antrean. Unduh ulang boleh membuang
 * daftar pelanggan, tapi tidak boleh membuang hasil catat yang belum sampai
 * server.
 */
export async function hapusPaket(): Promise<void> {
  const db = await bukaDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pelanggan_rute');
    await db.runAsync('DELETE FROM meta WHERE kunci IN (?, ?)', KUNCI_META_PAKET, KUNCI_META_WAKTU);
  });
}

/** Statistik penyimpanan lokal untuk layar Unduh Data / Cadangan. */
export async function statistikLokal(): Promise<{ pelanggan: number; antrean: number; tercatat: number }> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<{ pelanggan: number; tercatat: number }>(
    'SELECT COUNT(*) AS pelanggan, COALESCE(SUM(sudah_dicatat), 0) AS tercatat FROM pelanggan_rute',
  );
  return {
    pelanggan: row?.pelanggan ?? 0,
    tercatat: row?.tercatat ?? 0,
    antrean: await jumlahAntrean(),
  };
}

