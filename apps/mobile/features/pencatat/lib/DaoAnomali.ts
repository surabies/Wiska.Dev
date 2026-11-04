/**
 * dao.ts — seluruh SQL modul Anomali. Pola dan alasannya sama persis dengan
 * `features/baca-meter/dao.ts`, dan memang sengaja: keduanya berbagi SATU
 * berkas SQLite (`wipel_petugas.db`), jadi satu unduhan menghasilkan satu
 * perangkat yang siap kerja penuh — bukan dua modul dengan cache sendiri
 * yang bisa saling bertentangan.
 *
 * Repository TIDAK menyentuh database langsung; semua lewat sini.
 */
import { bukaDb } from '@/features/pencatat/lib/DbBacaMeter';
import type { BarisAnomali, DaftarAnomali } from './RepositoryAnomali';

const KUNCI_META = 'anomali.meta';
const KUNCI_WAKTU = 'anomali.waktu';

type BarisTabel = { data_json: string };

/**
 * Bongkar satu baris. null bila JSON-nya korup — pemanggil MELEWATI baris itu
 * dan meneruskan sisanya. Inilah seluruh alasan memakai tabel alih-alih satu
 * blob JSON: kerusakan satu baris tidak boleh menular ke 5.000 tetangganya.
 */
function baca(row: BarisTabel): BarisAnomali | null {
  try {
    return JSON.parse(row.data_json) as BarisAnomali;
  } catch {
    return null;
  }
}

/** Ringkasan yang ikut disimpan bersama daftar (ambang, hitungan kategori). */
export interface MetaAnomali {
  ambangBulan: number;
  perKategori: Record<string, number>;
}

/**
 * Simpan hasil unduhan: GANTI seluruh isi. Satu transaksi — gagal di tengah
 * berarti daftar lama tetap utuh, bukan setengah terisi.
 *
 * `kunjungan_terkirim` TIDAK ikut terhapus: itu jejak kerja petugas, dan
 * unduhan baru tidak boleh membuatnya seolah belum pernah berkunjung.
 */
/** 16 kolom — dijaga sejajar dengan daftar kolom di `simpanDaftar`. */
const PLACEHOLDER_BARIS = `(${new Array(16).fill('?').join(', ')})`;

/**
 * Baris per pernyataan INSERT.
 *
 * Sebelumnya tiap baris disisipkan sendiri-sendiri, jadi menyimpan satu
 * unduhan berarti ~4.500 panggilan terpisah ke SQLite — dan panggilan itulah,
 * bukan penulisannya, yang membuat tarik-untuk-menyegarkan berputar lama
 * sekali seolah menggantung. Menyisipkan berkelompok memangkasnya menjadi
 * puluhan.
 *
 * 50 dipilih supaya 50 x 16 = 800 parameter, aman di bawah batas 999 milik
 * SQLite lawas. Menaikkannya lagi nyaris tidak menambah kecepatan: yang mahal
 * sudah hilang di lompatan pertama.
 */
const BARIS_PER_SISIPAN = 50;

function* potong<T>(baris: T[], ukuran: number): Generator<T[]> {
  for (let i = 0; i < baris.length; i += ukuran) yield baris.slice(i, i + ukuran);
}

export async function simpanDaftar(daftar: DaftarAnomali, diunduhPada?: Date): Promise<void> {
  const db = await bukaDb();
  const meta: MetaAnomali = { ambangBulan: daftar.ambangBulan, perKategori: daftar.perKategori };
  const waktu = (diunduhPada ?? new Date()).toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM anomali');
    for (const potongan of potong(daftar.baris, BARIS_PER_SISIPAN)) {
      await db.runAsync(
        `INSERT INTO anomali
           (pelanggan_id, nomor_langganan, nama, alamat, kategori, bulan_berturut,
            m3_tanpa_dasar, skor, jml_rek_tunggak, prioritas, rute_kode,
            kelurahan, rt, rw, no_urut_rute, data_json)
         VALUES ${potongan.map(() => PLACEHOLDER_BARIS).join(', ')}`,
        ...potongan.flatMap((b) => [
          b.pelangganId,
          b.nomorLangganan,
          b.nama,
          b.alamat,
          b.kategori,
          b.bulanBerturut,
          b.m3TanpaDasar,
          b.skor,
          b.jumlahRekTunggak,
          b.prioritas ? 1 : 0,
          b.ruteKode,
          b.kelurahan ?? null,
          b.rt ?? null,
          b.rw ?? null,
          b.noUrutRute ?? null,
          JSON.stringify(b),
        ]),
      );
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)',
      KUNCI_META,
      JSON.stringify(meta),
    );
    await db.runAsync('INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)', KUNCI_WAKTU, waktu);
  });
}

export interface OpsiBaca {
  hanyaPrioritas?: boolean;
  kategori?: string | null;
  /** Cari nama / nomor langganan / alamat lewat satu kotak, ala Aurora. */
  kueri?: string | null;
  /** Sembunyikan yang sudah dikunjungi pada periode ini. */
  periode?: number | null;
  /** Persempit ke satu kelurahan. null = semua. */
  kelurahan?: string | null;
  /** Persempit ke satu RW dalam kelurahan terpilih. null = semua. */
  rw?: string | null;
  /** Persempit ke satu rute baca meter. null = semua. */
  ruteKode?: string | null;
  /** Batas baris yang dikembalikan — daftar ribuan tidak perlu dirender utuh. */
  batas?: number;
}

/**
 * Baca daftar dari lokal. null = perangkat ini belum pernah mengunduh anomali,
 * yang berbeda maknanya dari "sudah mengunduh tapi hasilnya kosong".
 *
 * PENYARINGAN DIKERJAKAN SQLITE, bukan JavaScript. Menyaring 5.000 baris di
 * memori setiap kali petugas mengetuk chip adalah persis sumber rasa berat
 * yang membuat daftar ini perlu dipindahkan ke lokal sejak awal.
 */
/**
 * Predikat penyaring — SATU definisi dipakai daftar DAN hitungan wilayah.
 *
 * Sebelumnya hitungan kelurahan/RW dihitung dari seluruh tabel, jadi menyaring
 * "Rumah Dikunci" (369 baris) tetap menampilkan kelurahan beserta angka dari
 * SELURUH 4.528 anomali. Petugas lalu memilih kelurahan yang katanya berisi
 * puluhan, dan mendapat daftar kosong. Dua tempat menghitung hal yang sama
 * dengan aturan berbeda selalu berakhir begitu; karena itu aturannya sekarang
 * hanya ditulis di sini.
 *
 * `abaikan` melepas syarat tertentu — dipakai saat menghitung pilihan yang
 * SEDANG dipilih itu sendiri: hitungan kelurahan tidak boleh dipersempit oleh
 * kelurahan yang sedang aktif, kalau tidak setiap kelurahan lain jadi 0.
 */
function bangunSyarat(
  opsi: OpsiBaca,
  abaikan: { kelurahan?: boolean; rw?: boolean } = {},
): { syarat: string[]; arg: (string | number)[] } {
  const syarat: string[] = [];
  const arg: (string | number)[] = [];

  if (opsi.hanyaPrioritas) syarat.push('a.prioritas = 1');
  if (opsi.kategori) {
    syarat.push('a.kategori = ?');
    arg.push(opsi.kategori);
  }
  if (opsi.kelurahan && !abaikan.kelurahan) {
    syarat.push('a.kelurahan = ?');
    arg.push(opsi.kelurahan);
  }
  if (opsi.rw && !abaikan.rw) {
    syarat.push('a.rw = ?');
    arg.push(opsi.rw);
  }
  if (opsi.ruteKode) {
    syarat.push('a.rute_kode = ?');
    arg.push(opsi.ruteKode);
  }
  const kueri = opsi.kueri?.trim();
  if (kueri) {
    syarat.push('(a.nama LIKE ? OR a.nomor_langganan LIKE ? OR a.alamat LIKE ?)');
    const q = `%${kueri}%`;
    arg.push(q, q, q);
  }
  if (opsi.periode != null) {
    syarat.push(
      'NOT EXISTS (SELECT 1 FROM kunjungan_terkirim k WHERE k.pelanggan_id = a.pelanggan_id AND k.periode = ?)',
    );
    arg.push(opsi.periode);
  }
  return { syarat, arg };
}

export async function bacaDaftar(opsi: OpsiBaca = {}): Promise<DaftarAnomali | null> {
  const db = await bukaDb();
  const metaRow = await db.getFirstAsync<{ nilai: string }>(
    'SELECT nilai FROM meta WHERE kunci = ? LIMIT 1',
    KUNCI_META,
  );
  if (metaRow == null) return null;

  let meta: MetaAnomali;
  try {
    meta = JSON.parse(metaRow.nilai) as MetaAnomali;
  } catch {
    return null; // meta korup — perlakukan seperti belum pernah mengunduh.
  }

  const { syarat, arg } = bangunSyarat(opsi);
  const where = syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '';
  const batas = opsi.batas ?? 300;

  const total = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM anomali a ${where}`,
    ...arg,
  );
  const prioritas = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM anomali a ${where}${where ? ' AND' : ' WHERE'} a.prioritas = 1`,
    ...arg,
  );
  /**
   * URUTAN MENGIKUTI PENYARINGNYA, dan itu disengaja.
   *
   * Tanpa penyaring wilayah, urutan terbaik adalah paparan (skor): petugas
   * memindai dari atas dan mengerjakan yang kerugiannya paling besar.
   *
   * Begitu ia mempersempit ke satu kelurahan / RW / rute, pertanyaannya
   * berubah dari "mana yang paling parah" menjadi "bagaimana menyusuri ini
   * tanpa bolak-balik". Maka urutannya pindah ke urutan baca meter
   * (rute + no_urut_rute) — jalur yang sudah terbukti dipakai pencatat tiap
   * bulan. Skor tetap jadi pemutus untuk baris yang tidak punya nomor urut.
   */
  const menyusuriWilayah = opsi.kelurahan != null || opsi.rw != null || opsi.ruteKode != null;
  const urutan = menyusuriWilayah
    ? `ORDER BY a.rute_kode IS NULL, a.rute_kode,
               a.no_urut_rute IS NULL, a.no_urut_rute,
               a.skor DESC`
    : 'ORDER BY a.skor DESC, a.nomor_langganan';

  const rows = await db.getAllAsync<BarisTabel>(
    `SELECT a.data_json FROM anomali a ${where} ${urutan} LIMIT ?`,
    ...arg,
    batas,
  );

  const baris: BarisAnomali[] = [];
  for (const row of rows) {
    const b = baca(row);
    if (b != null) baris.push(b);
  }

  return {
    ambangBulan: meta.ambangBulan,
    total: total?.n ?? baris.length,
    prioritas: prioritas?.n ?? 0,
    perKategori: meta.perKategori as DaftarAnomali['perKategori'],
    baris,
    dariLokal: true,
    diunduhPada: await waktuUnduh(),
  };
}

export interface OpsiWilayah {
  nilai: string;
  jumlah: number;
}

/**
 * Kelurahan (dan RW di dalamnya) yang BENAR-BENAR ada di daftar tersimpan,
 * DAN yang lolos penyaring yang sedang aktif — bukan daftar wilayah kota,
 * bukan pula hitungan seluruh tabel.
 *
 * Perbedaannya penting. Dengan penyaring "Rumah Dikunci" (369 dari 4.528),
 * hitungan seluruh tabel akan menawarkan kelurahan berisi puluhan sambungan
 * yang ternyata tak satu pun berkategori DK — petugas memilihnya dan mendapat
 * daftar kosong. Kelurahan tanpa satu pun baris yang cocok kini tidak
 * ditawarkan sama sekali.
 */
export async function wilayahTersedia(
  opsi: OpsiBaca = {},
): Promise<{ kelurahan: OpsiWilayah[]; rw: OpsiWilayah[] }> {
  const db = await bukaDb();

  // Kelurahan dihitung TANPA syarat kelurahan/RW itu sendiri — kalau ikut
  // dipakai, setiap kelurahan selain yang sedang dipilih menjadi 0.
  const k = bangunSyarat(opsi, { kelurahan: true, rw: true });
  k.syarat.push("a.kelurahan IS NOT NULL", "a.kelurahan <> ''");
  const barisKelurahan = await db.getAllAsync<{ nilai: string; n: number }>(
    `SELECT a.kelurahan AS nilai, COUNT(*) AS n FROM anomali a
      WHERE ${k.syarat.join(' AND ')}
      GROUP BY a.kelurahan ORDER BY a.kelurahan`,
    ...k.arg,
  );

  // RW hanya bermakna di dalam satu kelurahan: "RW 03" ada di banyak
  // kelurahan sekaligus dan menggabungkannya menghasilkan angka yang salah.
  let barisRw: { nilai: string; n: number }[] = [];
  if (opsi.kelurahan) {
    const r = bangunSyarat(opsi, { rw: true });
    r.syarat.push("a.rw IS NOT NULL", "a.rw <> ''");
    barisRw = await db.getAllAsync<{ nilai: string; n: number }>(
      `SELECT a.rw AS nilai, COUNT(*) AS n FROM anomali a
        WHERE ${r.syarat.join(' AND ')}
        GROUP BY a.rw ORDER BY CAST(a.rw AS INTEGER), a.rw`,
      ...r.arg,
    );
  }

  return {
    kelurahan: barisKelurahan.map((r) => ({ nilai: r.nilai, jumlah: r.n })),
    rw: barisRw.map((r) => ({ nilai: r.nilai, jumlah: r.n })),
  };
}

/** Kapan daftar ini terakhir diunduh. null = belum pernah. */
export async function waktuUnduh(): Promise<Date | null> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<{ nilai: string }>(
    'SELECT nilai FROM meta WHERE kunci = ? LIMIT 1',
    KUNCI_WAKTU,
  );
  if (row == null) return null;
  const t = new Date(row.nilai);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Satu baris menurut id pelanggan — layar kunjungan dibuka lewat ini. */
export async function ambilBaris(pelangganId: string): Promise<BarisAnomali | null> {
  const db = await bukaDb();
  const row = await db.getFirstAsync<BarisTabel>(
    'SELECT data_json FROM anomali WHERE pelanggan_id = ? LIMIT 1',
    pelangganId,
  );
  return row == null ? null : baca(row);
}

/** Catat bahwa satu sambungan sudah dikunjungi pada periode ini. */
export async function tandaiDikunjungi(
  pelangganId: string,
  periode: number,
  hasil: string,
): Promise<void> {
  const db = await bukaDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO kunjungan_terkirim (pelanggan_id, periode, hasil, dikirim_pada)
     VALUES (?, ?, ?, ?)`,
    pelangganId,
    periode,
    hasil,
    new Date().toISOString(),
  );
}

/** Statistik untuk layar Unduh Data. */
export async function statistik(): Promise<{ total: number; prioritas: number; dikunjungi: number }> {
  const db = await bukaDb();
  const a = await db.getFirstAsync<{ total: number; prioritas: number }>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(prioritas), 0) AS prioritas FROM anomali',
  );
  const k = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM kunjungan_terkirim');
  return { total: a?.total ?? 0, prioritas: a?.prioritas ?? 0, dikunjungi: k?.n ?? 0 };
}

/**
 * Hapus daftar anomali — TIDAK menyentuh jejak kunjungan, sama alasannya
 * dengan `hapusPaket` di modul baca meter.
 */
export async function hapusDaftar(): Promise<void> {
  const db = await bukaDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM anomali');
    await db.runAsync('DELETE FROM meta WHERE kunci IN (?, ?)', KUNCI_META, KUNCI_WAKTU);
  });
}
