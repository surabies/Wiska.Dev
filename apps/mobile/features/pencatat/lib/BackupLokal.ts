/**
 * backup.ts — cadangan hasil catat di penyimpanan perangkat. Padanan
 * `core/services/backup_lokal.dart`.
 *
 * KENAPA ADA, padahal sudah ada SQLite. Antrean SQLite adalah jalur kirim;
 * ini jalur SELAMAT. Bila database lokal korup atau aplikasi tidak bisa
 * dibuka sama sekali, hasil kerja sehari penuh masih tergeletak sebagai
 * berkas biasa yang bisa diambil manual. Aurora memakai pola yang sama
 * (`catatTxt` ditulis SEBELUM yakin terkirim), dan itu berkali-kali
 * menyelamatkan pencatatan yang sudah telanjur dilakukan.
 *
 * OTOMATIS, TANPA TINDAKAN MANUSIA. `catat()` di repository.ts memanggil
 * `catatLog()` lalu `simpanCatatan()` pada SETIAP penyimpanan, sebelum
 * jaringan disentuh sama sekali. Tidak ada tombol "backup sekarang" yang
 * harus diingat petugas — kalau ada, ia akan terlupakan persis di hari
 * ketika ia dibutuhkan.
 *
 * AKARNYA INTERNAL, DAN ITU DISENGAJA.
 *
 * `Paths.document` di Android berarti `/data/user/0/<paket>/files/` —
 * penyimpanan internal aplikasi, yang tidak bisa dibuka pengelola berkas
 * maupun kabel USB tanpa root. Kekurangan itu nyata, tapi ia ditebus di
 * cermin.ts, BUKAN dengan memindahkan akar ini: jalur selamat harus selalu
 * bisa ditulis, tanpa izin, tanpa bergantung pada folder yang bisa dihapus
 * atau grant yang bisa dicabut petugas. Lihat catatan panjang di `akar()`
 * tentang kenapa `/Android/media` mustahil dengan expo-file-system.
 *
 * Yang membuat isinya bisa diambil lewat kabel USB adalah cermin.ts: petugas
 * memilih folder SEKALI, dan seluruh pohon ini disalin ke sana otomatis.
 *
 * Tata letak — disusun untuk manusia yang membukanya di PC:
 * ```
 * <akar>/
 *     BACA-DULU.txt                        # penjelasan isi folder
 *     2026-07/
 *         202607_catatan.csv               # ringkasan; berkas yang diimpor ke web
 *         foto/
 *             202607_stand_00700800867.jpg
 *             202607_segel_00700800867.jpg
 *             202607_rumah_00700800867.jpg
 *         rinci/
 *             00700800867.json             # payload penuh (bahan pemulihan)
 *             00700800867.terunggah        # ada = sudah aman di server
 *     log/  catat_202607.txt  error.log
 * ```
 *
 * Folder periode `2026-07` terbaca manusia; NAMA BERKAS FOTO tetap
 * `periode_tipe_nomor.ext` karena itu kontrak yang dipakai impor dashboard
 * web untuk memetakan berkas ke pelanggan — jangan diubah tanpa mengubah
 * POLA_FOTO di packages/server/modules/laporan/laporan-harian.router.ts.
 *
 * `rinci/` TIDAK lagi diawali titik seperti `.meta` dulu. Ia memang untuk
 * mesin, tapi menyembunyikannya berarti petugas yang menyalin folder lewat
 * USB justru meninggalkan bagian yang dipakai memulihkan datanya.
 *
 * SEMUA fungsi di sini MENELAN errornya sendiri. Cadangan tidak boleh
 * menjatuhkan alur utama — gagal mencadangkan bukan gagal mencatat.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { JenisBerkas } from '@workspace/mobile-core';

const SEMUA_JENIS: JenisBerkas[] = ['stand', 'segel', 'rumah', 'video'];

/** Satu bundel cadangan: satu pelanggan pada satu periode. */
export interface BundelPembacaan {
  periode: number;
  nomorLangganan: string;
  /** Seluruh field pembacaan + metadata — bahan pemulihan ke antrean. */
  data: Record<string, unknown>;
  fotoPaths: Partial<Record<JenisBerkas, string>>;
  /** true = sudah pernah sukses diunggah (penanda `.terunggah`). */
  terunggah: boolean;
}

// ── Akar penyimpanan ───────────────────────────────────────────────────

let akarTersimpan: Directory | null = null;

/**
 * Akar cadangan: `<document>/tirtawening/backup/`.
 *
 * PERNAH DICOBA DIPINDAH ke `/Android/media/<paket>/` supaya terlihat lewat
 * kabel USB. Itu MUSTAHIL dengan expo-file-system, dan bukan karena Android
 * melarang: pemeriksa izinnya sendiri memakai `File.canWrite()`
 * (expo-modules-core, FilePermissionService.kt), yang pada path BELUM ADA
 * selalu false — sementara `create()` memvalidasi izin pada path yang hendak
 * dibuatnya. Di luar `filesDir`/`cacheDir`, URI `file://` tidak pernah bisa
 * membuat apa pun. Terbukti dua kali di perangkat sungguhan.
 *
 * Jalan keluarnya ada di cermin.ts: folder pilihan petugas lewat SAF, yang
 * memakai content URI dan melewati pemeriksaan itu seluruhnya. Akar di sini
 * tetap internal dan itu DISENGAJA — jalur selamat tidak boleh bergantung
 * pada izin yang bisa dicabut atau folder yang bisa dihapus petugas.
 */
function akar(): Directory {
  if (akarTersimpan == null) {
    akarTersimpan = new Directory(Paths.document, 'tirtawening', 'backup');
  }
  return akarTersimpan;
}

/**
 * Akar cadangan sebagai Directory — dipakai cermin.ts untuk menyalin seluruh
 * pohon ke folder pilihan petugas. Sengaja dibuka alih-alih membocorkan
 * struktur foldernya: cermin cukup tahu "salin apa adanya dari sini".
 */
export function akarDirektori(): Directory {
  return akar();
}

/** Direktori sub-folder, dibuat bila belum ada. */
function dir(...bagian: string[]): Directory {
  const d = new Directory(akar(), ...bagian);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** 202607 -> "2026-07". Nama folder periode yang terbaca manusia. */
function labelPeriode(periode: number): string {
  const s = String(periode);
  return s.length === 6 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

/**
 * Path folder cadangan untuk ditunjukkan ke petugas — dalam bentuk yang bisa
 * ia cari sendiri di pengelola berkas, bukan URI `file:///`.
 */
export function lokasiFolder(): string | null {
  try {
    return akar().uri.replace(/^file:\/\//, '');
  } catch {
    return null;
  }
}

// ── Penyiapan & migrasi (dipanggil sekali saat boot) ───────────────────

const ISI_BACA_DULU = [
  'CADANGAN PENCATATAN — TIRTAWENING',
  '',
  'Folder ini ditulis OTOMATIS oleh aplikasi petugas setiap kali sebuah',
  'pembacaan disimpan. Tidak perlu menekan tombol apa pun.',
  '',
  'Isi tiap folder periode (contoh 2026-07):',
  '  <periode>_catatan.csv  ringkasan semua pembacaan periode itu.',
  '                         INI berkas yang diimpor di dashboard web,',
  '                         menu Impor cadangan -> tab Catatan.',
  '  foto/                  bukti stand meter, segel, dan rumah.',
  '                         Diimpor di tab Foto, satu jenis per unggahan.',
  '  rinci/                 data mentah per pelanggan. Jangan dihapus:',
  '                         inilah yang dipakai memulihkan pekerjaan bila',
  '                         aplikasi bermasalah.',
  '',
  'Nama berkas foto (periode_tipe_nomor.jpg) menentukan pemetaan ke',
  'pelanggan saat diimpor. JANGAN diubah namanya.',
  '',
  'Folder ini adalah SALINAN yang dibuat aplikasi. Sumber aslinya ada di',
  'dalam aplikasi dan tidak bisa dibuka dari luar; salinan inilah yang',
  'dimaksudkan untuk diambil.',
  '',
  'Menyalin ke PC: sambungkan kabel USB, pilih mode transfer berkas,',
  'lalu salin seluruh folder ini.',
  '',
].join('\r\n');

/**
 * Siapkan folder cadangan dan pindahkan isi akar lama bila ada. Dipanggil
 * SEKALI dari app/_layout.tsx saat boot.
 *
 * Kenapa di boot dan bukan di dalam `akar()`: akar lama ada di penyimpanan
 * internal dan akar baru di volume eksternal, jadi pemindahannya bukan rename
 * murah melainkan salin-lalu-hapus. Menjalankan itu di tengah `catat()` akan
 * membekukan penyimpanan pertama petugas setelah pembaruan aplikasi.
 */
export async function siapkanCadangan(): Promise<void> {
  try {
    const tujuan = akar();
    await tulisAtomik(new File(tujuan, 'BACA-DULU.txt'), ISI_BACA_DULU);
    await migrasiTataLetak(tujuan);
  } catch (e) {
    await catatError(`siapkan cadangan: ${String(e)}`);
  }
}

/**
 * Naikkan tata letak LAMA ke tata letak baru, DI TEMPAT (akarnya sama).
 *
 * Lama:  <akar>/stand/202607_stand_007…jpg   <akar>/.meta/202607/007….json
 * Baru:  <akar>/2026-07/foto/…               <akar>/2026-07/rinci/…
 *
 * Idempoten: berkas yang sudah ada di tujuan dilewati, dan folder lama baru
 * dihapus setelah isinya benar-benar pindah — kalau proses mati di tengah,
 * sumbernya masih utuh dan migrasi terulang dengan aman di boot berikutnya.
 *
 * Tanpa ini, perangkat yang sudah dipakai sebelum pembaruan akan menyimpan
 * hasil kerjanya di folder yang tidak lagi dibaca siapa pun — terlantar tanpa
 * gejala apa pun.
 */
async function migrasiTataLetak(akarKini: Directory): Promise<void> {
  let dipindah = 0;
  const periodeTersentuh = new Set<number>();
  try {
    // Foto: <akar>/<jenis>/<periode>_<jenis>_<nomor>.<ext>
    for (const jenis of SEMUA_JENIS) {
      const asal = new Directory(akarKini, jenis);
      if (!asal.exists) continue;
      for (const f of asal.list()) {
        if (!(f instanceof File)) continue;
        const m = /^(\d{6})_/.exec(f.name);
        if (!m) continue;
        const periode = Number(m[1]);
        const ke = new File(dir(labelPeriode(periode), 'foto'), f.name);
        if (!ke.exists) {
          await f.move(ke, { overwrite: false });
          dipindah++;
        }
        periodeTersentuh.add(periode);
      }
      if (asal.list().length === 0) asal.delete();
    }

    // Rincian: <akar>/.meta/<periode>/<nomor>.json | .terunggah
    const metaLama = new Directory(akarKini, '.meta');
    if (metaLama.exists) {
      for (const p of metaLama.list()) {
        if (!(p instanceof Directory)) continue;
        const periode = Number.parseInt(p.name, 10);
        if (!Number.isFinite(periode)) continue;
        for (const f of p.list()) {
          if (!(f instanceof File)) continue;
          const ke = new File(dir(labelPeriode(periode), 'rinci'), f.name);
          if (!ke.exists) {
            await f.move(ke, { overwrite: false });
            dipindah++;
          }
        }
        periodeTersentuh.add(periode);
        if (p.list().length === 0) p.delete();
      }
      if (metaLama.list().length === 0) metaLama.delete();
    }

    // CSV lama diregenerasi dari rincian yang baru pindah, bukan disalin:
    // menyalinnya hanya menduplikasi berkas yang sebentar lagi ditimpa.
    const catatanLama = new Directory(akarKini, 'catatan');
    if (catatanLama.exists) catatanLama.delete();
    for (const periode of periodeTersentuh) {
      await tulisCsvCatatan(periode);
    }

    if (dipindah > 0) {
      await catatError(`migrasi tata letak: ${dipindah} berkas dinaikkan ke folder per periode`);
    }
  } catch (e) {
    await catatError(`migrasi tata letak gagal setelah ${dipindah} berkas: ${String(e)}`);
  }
}

// ── Foto bukti ─────────────────────────────────────────────────────────

function namaBerkas(periode: number, jenis: JenisBerkas, nomor: string): string {
  return `${periode}_${jenis}_${nomor}.${jenis === 'video' ? 'mp4' : 'jpg'}`;
}

function berkasFoto(periode: number, jenis: JenisBerkas, nomor: string): File {
  return new File(dir(labelPeriode(periode), 'foto'), namaBerkas(periode, jenis, nomor));
}

/**
 * Salin foto/video bukti ke folder periode. Cache image picker bisa
 * dibersihkan OS kapan saja, jadi SALINAN INI yang jadi path utama dan yang
 * kelak diunggah. Kembalikan path salinan, atau null bila gagal.
 */
export async function simpanSalinanFoto(input: {
  jenis: JenisBerkas;
  periode: number;
  nomorLangganan: string;
  sumberPath: string;
}): Promise<string | null> {
  const tujuan = berkasFoto(input.periode, input.jenis, input.nomorLangganan);
  try {
    const sumber = new File(input.sumberPath);
    if (!sumber.exists) {
      await catatError(`salinan foto: sumber hilang ${input.jenis} ${input.nomorLangganan}`);
      return null;
    }

    /*
      SALIN KE BERKAS SEMENTARA DULU, baru pindahkan ke tempatnya.

      Versi sebelumnya menghapus tujuan lalu menyalin ke sana. Di antara dua
      langkah itu ada jeda: bila aplikasi mati persis di situ — baterai habis,
      OS membunuh proses karena memori — cadangan LAMA sudah hilang sementara
      yang baru belum ada. Pemindahan bersifat atomik di satu volume, jadi
      berkas tujuan selalu berisi salinan utuh, entah yang lama atau yang baru.
    */
    const sementara = new File(tujuan.parentDirectory, `.${tujuan.name}.tmp`);
    if (sementara.exists) sementara.delete();
    await sumber.copy(sementara);

    // Salinan kosong lebih berbahaya daripada tidak ada salinan: ia terlihat
    // seperti bukti yang ada padahal isinya nol byte.
    if (!sementara.exists || (sementara.size ?? 0) <= 0) {
      if (sementara.exists) sementara.delete();
      await catatError(`salinan foto: hasil kosong ${input.jenis} ${input.nomorLangganan}`);
      return null;
    }

    await sementara.move(tujuan, { overwrite: true });
    return tujuan.uri;
  } catch (e) {
    await catatError(`salinan foto gagal ${input.jenis} ${input.nomorLangganan}: ${String(e)}`);
    return null;
  }
}

export function uriFotoCadangan(
  periode: number,
  jenis: JenisBerkas,
  nomorLangganan: string,
): string | null {
  try {
    const berkas = berkasFoto(periode, jenis, nomorLangganan);
    return berkas.exists && (berkas.size ?? 0) > 0 ? berkas.uri : null;
  } catch {
    return null;
  }
}

/**
 * Hasil catat yang tersimpan untuk satu pelanggan pada satu periode — angka
 * dan foto yang cadangannya masih ada. null = belum pernah dicatat di
 * perangkat ini.
 */
export async function bacaCatatanTersimpan(
  periode: number,
  nomorLangganan: string,
): Promise<{ data: Record<string, unknown>; foto: Partial<Record<JenisBerkas, string>> } | null> {
  try {
    const berkas = new File(dirRinci(periode), `${nomorLangganan}.json`);
    if (!berkas.exists) return null;
    const data = JSON.parse(await berkas.text()) as Record<string, unknown>;

    const foto: Partial<Record<JenisBerkas, string>> = {};
    for (const jenis of SEMUA_JENIS) {
      const uri = uriFotoCadangan(periode, jenis, nomorLangganan);
      if (uri != null) foto[jenis] = uri;
    }
    return { data, foto };
  } catch {
    return null;
  }
}

/**
 * Tulis isi berkas secara ATOMIK: berkas sementara dulu, lalu dipindahkan.
 *
 * `delete()` lalu `create()` lalu `write()` menyisakan jendela waktu ketika
 * berkasnya tidak ada atau masih kosong. Untuk CSV catatan yang ditulis ulang
 * setiap kali petugas menyimpan, jendela itu dilalui ratusan kali sehari —
 * dan satu kali saja aplikasi mati di dalamnya, seluruh ringkasan periode itu
 * lenyap. Pemindahan menggantikan isi berkas dalam satu langkah.
 */
async function tulisAtomik(berkas: File, isi: string): Promise<void> {
  const sementara = new File(berkas.parentDirectory, `.${berkas.name}.tmp`);
  if (sementara.exists) sementara.delete();
  sementara.create({ intermediates: true, overwrite: true });
  sementara.write(isi);
  // `move()` mengembalikan Promise (lihat NativeFileSystem.types.d.ts) —
  // versi sebelumnya tidak menunggunya, jadi "atomik" hanya benar di atas
  // kertas: pemanggil bisa lanjut dan membaca berkas tujuan sebelum
  // pemindahannya selesai.
  await sementara.move(berkas, { overwrite: true });
}

// ── Rincian pembacaan (pemulihan) + CSV catatan (impor teks) ───────────

function dirRinci(periode: number): Directory {
  return dir(labelPeriode(periode), 'rinci');
}

/**
 * Tulis rincian pembacaan — SELURUH field + metadata — lalu regenerasi CSV
 * catatan periode itu supaya ringkasan teksnya selalu sinkron.
 */
export async function simpanCatatan(input: {
  periode: number;
  nomorLangganan: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const berkas = new File(dirRinci(input.periode), `${input.nomorLangganan}.json`);
    await tulisAtomik(berkas, JSON.stringify(input.data, null, 2));
    await tulisCsvCatatan(input.periode);
  } catch (e) {
    /*
      Kegagalannya tetap TIDAK menjatuhkan alur catat — itu inti berkas ini.
      Tapi sebelumnya ia juga tidak meninggalkan jejak apa pun: cadangan bisa
      gagal berhari-hari tanpa seorang pun tahu, dan baru ketahuan justru saat
      cadangan itu dibutuhkan. Sekarang dicatat ke error.log.
    */
    await catatError(`simpan catatan ${input.nomorLangganan}: ${String(e)}`);
  }
}

/**
 * Kolom CSV catatan — HARUS mencerminkan apa yang benar-benar direkam.
 *
 * Tiga kolom sebelumnya hilang padahal datanya ada di rincian JSON, jadi CSV
 * yang selama ini diekspor menggambarkan pencatatan secara tidak utuh:
 *
 *   - `kategori`   — ONSITE / lainnya, penentu bagaimana pembacaan itu dibaca
 *                    verifikator. Tanpa ini semua baris terlihat setara.
 *   - `usulanNoUrut` — usulan perubahan urutan rute dari lapangan; kalau tidak
 *                    ikut terekspor, usulannya hilang begitu antrean terkirim.
 *   - `pelangganId`  — satu-satunya kunci yang stabil untuk mencocokkan baris
 *                    ke pelanggan saat diimpor kembali ke web.
 *
 * `foto` bukan berasal dari rincian: ia diisi saat menulis baris, berisi
 * daftar jenis foto yang cadangannya benar-benar ADA di perangkat. Itu yang
 * membuat CSV bisa dipakai memeriksa kelengkapan bukti tanpa membuka
 * foldernya satu per satu.
 */
const KOLOM_CSV = [
  'periode',
  'nomorLangganan',
  'pelangganId',
  'nomorMeter',
  'ruteKode',
  'standAwal',
  'standAkhir',
  'pemakaianLalu',
  'kondisi',
  'kategori',
  'isSegel',
  'usulanPerubahan',
  'usulanNoUrut',
  'notelpBaru',
  'latCatat',
  'longCatat',
  'namaPetugas',
  'tanggalCatat',
  'foto',
] as const;

/**
 * Eskape satu sel CSV (RFC 4180): bungkus tanda kutip bila mengandung
 * koma/kutip/baris-baru, dan gandakan kutip di dalamnya. Alamat pelanggan
 * memang berisi koma — tanpa ini berkasnya bergeser kolom saat diimpor.
 */
function selCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Regenerasi `<periode>/<periode>_catatan.csv` dari seluruh rincian periode itu. */
async function tulisCsvCatatan(periode: number): Promise<void> {
  const rinciDir = dirRinci(periode);
  if (!rinciDir.exists) return;

  const baris: string[] = [KOLOM_CSV.map(selCsv).join(',')];
  for (const entri of rinciDir.list()) {
    if (!(entri instanceof File) || !entri.name.endsWith('.json')) continue;
    try {
      const d = JSON.parse(await entri.text()) as Record<string, unknown>;
      const nomor = String(d['nomorLangganan'] ?? entri.name.replace(/\.json$/, ''));
      // Diisi di sini, bukan dibaca dari rincian: yang penting bukan foto apa
      // yang DIKLAIM ada, melainkan cadangan mana yang benar-benar tersimpan.
      const foto = SEMUA_JENIS.filter((j) => uriFotoCadangan(periode, j, nomor) != null).join(' ');
      baris.push(KOLOM_CSV.map((k) => selCsv(k === 'foto' ? foto : d[k])).join(','));
    } catch {
      continue; // rincian korup — lewati barisnya, jangan gagalkan berkasnya.
    }
  }

  await tulisAtomik(
    new File(dir(labelPeriode(periode)), `${periode}_catatan.csv`),
    `${baris.join('\r\n')}\r\n`,
  );
}

/**
 * Tandai satu pembacaan sudah aman di server (penanda kosong `.terunggah`) —
 * pemulihan memakainya untuk melewati yang sudah terunggah.
 */
export async function tandaiTerunggah(periode: number, nomorLangganan: string): Promise<void> {
  try {
    const penanda = new File(dirRinci(periode), `${nomorLangganan}.terunggah`);
    if (!penanda.exists) {
      penanda.create({ overwrite: true });
      penanda.write('');
    }
  } catch {
    // ditelan.
  }
}

/**
 * Seluruh bundel cadangan di perangkat (layar Cadangan & pemulihan).
 * Dibangun dari rincian; foto ditemukan lewat konvensi nama.
 */
export async function daftarBundel(): Promise<BundelPembacaan[]> {
  try {
    const root = akar();
    if (!root.exists) return [];

    const hasil: BundelPembacaan[] = [];
    for (const entriPeriode of root.list()) {
      if (!(entriPeriode instanceof Directory)) continue;
      if (!/^\d{4}-\d{2}$/.test(entriPeriode.name)) continue;
      const periode = Number.parseInt(entriPeriode.name.replace('-', ''), 10);
      if (!Number.isFinite(periode)) continue;

      const rinciDir = new Directory(entriPeriode, 'rinci');
      if (!rinciDir.exists) continue;

      for (const entri of rinciDir.list()) {
        if (!(entri instanceof File) || !entri.name.endsWith('.json')) continue;
        const nomor = entri.name.replace(/\.json$/, '');
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(await entri.text()) as Record<string, unknown>;
        } catch {
          continue; // rincian korup — lewati.
        }
        const fotoPaths: Partial<Record<JenisBerkas, string>> = {};
        for (const jenis of SEMUA_JENIS) {
          const f = berkasFoto(periode, jenis, nomor);
          if (f.exists) fotoPaths[jenis] = f.uri;
        }
        hasil.push({
          periode,
          nomorLangganan: nomor,
          data,
          fotoPaths,
          terunggah: new File(rinciDir, `${nomor}.terunggah`).exists,
        });
      }
    }
    hasil.sort((a, b) => b.periode - a.periode);
    return hasil;
  } catch {
    return [];
  }
}

/**
 * Berkas CSV catatan yang siap dibagikan (terbaru dulu) — bahan impor di
 * dashboard web.
 *
 * Berbagi lewat expo-sharing tetap disediakan sebagai jalan pintas (kirim
 * satu periode lewat WhatsApp saat petugas tidak sedang di kantor), tapi ia
 * bukan lagi SATU-SATUNYA jalan keluar seperti dulu: seluruh folder sekarang
 * tersalin lewat kabel USB, foto dan semuanya.
 */
export function daftarCsvCatatan(): { nama: string; uri: string; periode: number }[] {
  try {
    const root = akar();
    if (!root.exists) return [];
    const hasil: { nama: string; uri: string; periode: number }[] = [];
    for (const p of root.list()) {
      if (!(p instanceof Directory) || !/^\d{4}-\d{2}$/.test(p.name)) continue;
      const periode = Number.parseInt(p.name.replace('-', ''), 10);
      const f = new File(p, `${periode}_catatan.csv`);
      if (f.exists) hasil.push({ nama: f.name, uri: f.uri, periode });
    }
    return hasil.sort((a, b) => b.periode - a.periode);
  } catch {
    return [];
  }
}

// ── Log lapangan ───────────────────────────────────────────────────────

/**
 * Satu baris pipe-delimited per penyimpanan catat — log cepat-baca:
 * `nomor|stand|kondisi|petugas|longlat|waktu|`.
 *
 * Ditulis SEBELUM laporan masuk antrean, mengikuti Aurora: apa pun nasib
 * jaringan (dan database) berikutnya, angka yang sudah dibaca petugas sudah
 * tercatat di suatu tempat.
 */
export async function catatLog(input: {
  periode: number;
  nomorLangganan: string;
  standAkhir: string;
  kondisi: string;
  petugas?: string | null;
  longlat?: string | null;
}): Promise<void> {
  try {
    const berkas = new File(dir('log'), `catat_${input.periode}.txt`);
    const baris = [
      input.nomorLangganan,
      input.standAkhir,
      input.kondisi,
      input.petugas ?? '',
      input.longlat ?? '',
      new Date().toISOString(),
      '',
    ].join('|');
    tambahBaris(berkas, `${baris}\n`);
  } catch {
    // ditelan.
  }
}

export async function catatError(pesan: string): Promise<void> {
  try {
    tambahBaris(new File(dir('log'), 'error.log'), `${new Date().toISOString()} ${pesan}\n`);
  } catch {
    // ditelan.
  }
}

/**
 * Tambah di akhir berkas. `File.write()` SDK 57 selalu menimpa, jadi mode
 * append dibuat manual lewat baca-gabung-tulis. Log lapangan berumur satu
 * periode dan hanya berisi baris pendek, sehingga biayanya tidak berarti —
 * tapi jangan pakai pola ini untuk berkas yang tumbuh besar.
 */
function tambahBaris(berkas: File, baris: string): void {
  if (!berkas.exists) {
    berkas.create({ intermediates: true, overwrite: true });
    berkas.write(baris);
    return;
  }
  berkas.write(baris, { encoding: 'utf8', append: true });
}
