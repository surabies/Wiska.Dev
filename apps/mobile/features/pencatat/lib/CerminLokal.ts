/**
 * cermin.ts — menyalin folder cadangan ke tempat yang DIPILIH PETUGAS, supaya
 * hasil kerja bisa diambil lewat kabel USB.
 *
 * KENAPA MENCERMIN, BUKAN MEMINDAHKAN AKARNYA.
 *
 * Percobaan pertama menaruh akar cadangan langsung di
 * `/Android/media/<paket>/`. Itu GAGAL di perangkat, dan bukan karena Android:
 * expo-file-system memeriksa izinnya sendiri lewat `File.canWrite()`
 * (expo-modules-core, FilePermissionService.kt), dan pada path yang BELUM ADA
 * pemeriksaan itu selalu false — sementara `create()` memvalidasi izin pada
 * path yang hendak dibuatnya. Jerat ayam-telur: di luar `filesDir`/`cacheDir`,
 * URI `file://` tidak pernah bisa membuat berkas atau folder baru. Yang
 * dikecualikan hanya content URI (SAF), yang melewati pemeriksaan itu
 * seluruhnya.
 *
 * Maka pembagiannya:
 *   - `backup.ts` tetap menulis ke penyimpanan internal. Itu JALUR SELAMAT:
 *     selalu bisa ditulis, tanpa izin, tanpa bergantung pilihan siapa pun.
 *   - modul ini MENCERMINKAN pohon itu ke folder SAF pilihan petugas.
 *
 * Jalur selamat tidak boleh bergantung pada izin yang bisa dicabut atau folder
 * yang bisa dihapus/di-rename. Kalau cerminnya hilang, pencatatan tetap
 * tercatat — hanya salinannya yang tertunda sampai foldernya dipilih ulang.
 *
 * SEKALI PILIH, SETERUSNYA OTOMATIS. `Directory.pickDirectoryAsync()` di
 * Android mengambil izin PERSISTEN (`takePersistableUriPermission`, lihat
 * FilePickerContract.kt), jadi grant-nya bertahan lintas restart aplikasi.
 * Setelah folder dipilih satu kali, petugas tidak perlu menyentuh apa pun
 * lagi.
 */
import { Directory, File } from 'expo-file-system';
import { akarDirektori, catatError } from './BackupLokal';
import { bacaMeta, simpanMeta } from './DaoBacaMeter';

const KUNCI_FOLDER = 'cerminFolderUri';

/** Jeda sebelum mencermin setelah penyimpanan terakhir. */
const JEDA_DEBOUNCE_MS = 5000;

let folder: Directory | null = null;
/** Cermin berjalan satu per satu — dua penyalinan serentak akan saling tabrak. */
let sedangJalan = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export interface HasilCermin {
  disalin: number;
  dilewati: number;
  /** null = sukses. Berisi pesan bila cermin tidak bisa dijalankan. */
  galat: string | null;
}

// ── Folder tujuan ──────────────────────────────────────────────────────

/**
 * Pulihkan folder cermin dari penyimpanan lokal, lalu BUKTIKAN masih bisa
 * dipakai. Grant SAF bisa hilang tanpa pemberitahuan: petugas menghapus
 * foldernya, memformat kartu SD, atau mencabut izin lewat setelan. Menyimpan
 * URI-nya saja lalu berasumsi ia masih sah akan membuat cermin gagal diam-diam
 * setiap kali — persis kegagalan yang modul ini ada untuk mencegahnya.
 */
export async function hydrateCermin(): Promise<void> {
  folder = null;
  try {
    const uri = await bacaMeta(KUNCI_FOLDER);
    if (uri == null || uri.length === 0) return;
    const d = new Directory(uri);
    // list() menyentuh content provider sungguhan — inilah buktinya, bukan
    // `exists` yang bisa saja menjawab dari tebakan bentuk URI.
    d.list();
    folder = d;
  } catch (e) {
    folder = null;
    await catatError(`folder cermin tidak lagi bisa dipakai, perlu dipilih ulang: ${String(e)}`);
  }
}

/** URI folder cermin untuk ditampilkan; null = belum dipilih / tidak sah. */
export function folderCerminUri(): string | null {
  return folder?.uri ?? null;
}

/**
 * Buka pemilih folder bawaan Android. Kembalikan URI terpilih, atau null bila
 * petugas membatalkan.
 */
export async function pilihFolderCermin(): Promise<string | null> {
  const dipilih = await Directory.pickDirectoryAsync();
  folder = dipilih;
  await simpanMeta(KUNCI_FOLDER, dipilih.uri);
  return dipilih.uri;
}

export async function lupakanFolderCermin(): Promise<void> {
  folder = null;
  await simpanMeta(KUNCI_FOLDER, '');
}

// ── Penyalinan ─────────────────────────────────────────────────────────

function mimeDari(nama: string): string {
  const n = nama.toLowerCase();
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.mp4')) return 'video/mp4';
  if (n.endsWith('.csv')) return 'text/csv';
  if (n.endsWith('.json')) return 'application/json';
  if (n.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

/**
 * Subfolder bernama [nama] di dalam [induk] — dicari dulu, dibuat hanya bila
 * belum ada.
 *
 * `createDirectory` SAF TIDAK idempoten: memanggilnya untuk nama yang sudah
 * ada menghasilkan folder kedua bernama "nama (1)". Sesudah beberapa kali
 * mencermin, tujuannya akan penuh salinan berlapis.
 */
function pastikanSubfolder(induk: Directory, nama: string): Directory {
  for (const entri of induk.list()) {
    if (entri instanceof Directory && entri.name === nama) return entri;
  }
  return induk.createDirectory(nama);
}

function cariBerkas(induk: Directory, nama: string): File | null {
  for (const entri of induk.list()) {
    if (entri instanceof File && entri.name === nama) return entri;
  }
  return null;
}

async function salinIsiFolder(sumber: Directory, tujuan: Directory, hasil: HasilCermin): Promise<void> {
  for (const entri of sumber.list()) {
    // Berkas sementara `.nama.tmp` milik tulisAtomik: setengah jadi menurut
    // definisi, dan tidak ada gunanya di salinan.
    if (entri.name.startsWith('.')) continue;

    if (entri instanceof Directory) {
      await salinIsiFolder(entri, pastikanSubfolder(tujuan, entri.name), hasil);
      continue;
    }

    const ukuranSumber = entri.size ?? 0;
    const sudahAda = cariBerkas(tujuan, entri.name);
    // Foto tidak pernah berubah setelah ditulis; CSV berubah tiap simpan.
    // Membandingkan ukuran memisahkan keduanya tanpa perlu hash.
    if (sudahAda != null && (sudahAda.size ?? -1) === ukuranSumber) {
      hasil.dilewati++;
      continue;
    }

    const isi = await entri.bytes();
    const tujuanBerkas = sudahAda ?? tujuan.createFile(entri.name, mimeDari(entri.name));
    tujuanBerkas.write(isi);
    hasil.disalin++;
  }
}

/**
 * Salin seluruh pohon cadangan ke folder cermin. Aman dipanggil berulang:
 * berkas yang ukurannya sudah sama dilewati.
 */
export async function cerminkan(): Promise<HasilCermin> {
  const hasil: HasilCermin = { disalin: 0, dilewati: 0, galat: null };
  if (folder == null) {
    hasil.galat = 'Folder cadangan belum dipilih.';
    return hasil;
  }
  if (sedangJalan) {
    hasil.galat = 'Penyalinan sedang berjalan.';
    return hasil;
  }

  sedangJalan = true;
  try {
    await salinIsiFolder(akarDirektori(), folder, hasil);
  } catch (e) {
    hasil.galat = String(e);
    // Folder bisa saja lenyap di tengah jalan. Dilupakan supaya layar Cadangan
    // meminta petugas memilih ulang, alih-alih gagal diam-diam selamanya.
    folder = null;
    await catatError(`cermin gagal setelah ${hasil.disalin} berkas: ${String(e)}`);
  } finally {
    sedangJalan = false;
  }
  return hasil;
}

/**
 * Jadwalkan cermin beberapa detik setelah aktivitas terakhir. Dipanggil dari
 * `catat()` pada SETIAP penyimpanan.
 *
 * Ditunda, bukan langsung: petugas menyimpan puluhan pembacaan beruntun, dan
 * menyalin seluruh pohon di tiap penyimpanan akan membuat tombol simpan terasa
 * berat. Timer disetel ulang tiap panggilan, jadi penyalinan terjadi sekali
 * setelah ia berhenti sejenak — dan `catat()` tidak pernah menunggunya.
 */
export function jadwalkanCermin(): void {
  if (folder == null) return;
  if (timer != null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void cerminkan();
  }, JEDA_DEBOUNCE_MS);
}
