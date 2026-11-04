import { Platform } from 'react-native';
/**
 * repository.ts — sumber data modul Baca Meter. Padanan
 * `features/staff/baca_meter/rute_repository.dart`.
 *
 * Alur offline-first mengikuti Aurora yang sudah terbukti di lapangan:
 *
 *   unduh paket rute → simpan SQLite → catat OFFLINE (outbox)
 *   → sinkronisasi borongan lewat POST /laporan-harian/batch
 *
 * Dua sikap yang menentukan bentuk berkas ini:
 *
 * 1. **Mencatat ≠ mengirim.** `catat()` HANYA menulis ke antrean lokal.
 *    Pengiriman adalah aksi terpisah yang disengaja petugas (menu Upload),
 *    supaya hasil kerja terlihat menumpuk di antrean dan bisa diunggah
 *    sekaligus saat sinyal/kuota memungkinkan. Ini persis model Aurora
 *    (`bill_is_upload=1`), dan ia lahir dari kenyataan lapangan: sinyal di
 *    gang sempit tidak bisa diandalkan per-pelanggan.
 *
 * 2. **Kegagalan jaringan bukan kegagalan data.** Hanya `status === 0`
 *    (transport mati) yang jatuh ke cache; 401/403/400 tetap dilempar,
 *    karena itu bukan soal sinyal dan menyembunyikannya di balik "mode
 *    offline" membuat masalah nyata jadi tak kelihatan.
 */
import { File } from 'expo-file-system';
import {
  ApiClient,
  ApiConfig,
  ApiException,
  SesiPetugas,
  laporanSayaDariJson,
  nomorLanggananAntrean,
  periodeAntrean,
  ruteSayaDariJson,
  thblDariDate,
  type CatatTertunda,
  type HasilCatat,
  type JenisBerkas,
  type LaporanSaya,
  type PelangganRute,
  type RuteSaya,
} from '@workspace/mobile-core';
import * as backup from './BackupLokal';
import { jadwalkanCermin } from './CerminLokal';
import * as dao from './DaoBacaMeter';

/**
 * Periode catat berjalan: BULAN KALENDER saat ini.
 *
 * Sengaja berbeda dari dashboard web (yang memakai periode terakhir yang
 * PUNYA data): pencatatan lapangan merekam bulan berjalan, dan closing
 * bulanan boleh tertinggal tanpa menghentikan petugas berkeliling.
 */
export function periodeCatatSekarang(): number {
  const s = new Date();
  return thblDariDate(new Date(Date.UTC(s.getFullYear(), s.getMonth(), 1)));
}

/** Batas baris per panggilan batch — dipaksakan server (max 300). */
const MAKS_PER_BATCH = 300;

/** Nama field URL di payload laporan untuk tiap jenis berkas bukti. */
const FIELD_URL: Record<JenisBerkas, string> = {
  stand: 'fotoStandUrl',
  segel: 'fotoSegelUrl',
  rumah: 'fotoRumahUrl',
  video: 'videoUrl',
};

/** true = kegagalan transport (offline), bukan penolakan server. */
function offline(err: unknown): boolean {
  return err instanceof ApiException && err.status === 0;
}

// ── Paket rute ─────────────────────────────────────────────────────────

/**
 * Unduh paket rute lalu simpan ke SQLite. Bila server tak terjangkau dan
 * cache ada, kembali dari cache — petugas tetap bisa bekerja.
 *
 * `segarkan: false` membaca cache LEBIH DULU tanpa menyentuh jaringan;
 * dipakai layar yang cuma butuh angka ringkas (portal/beranda), supaya
 * berpindah layar tidak menembak jaringan berulang kali.
 */
/** Kemajuan pengunduhan paket rute. */
export interface ProgresUnduh {
  fase: 'unduh' | 'simpan';
  selesai: number;
  total: number;
}

export async function ruteSaya(
  opsi: { segarkan?: boolean; onProgres?: (p: ProgresUnduh) => void } = {},
): Promise<RuteSaya> {
  const segarkan = opsi.segarkan ?? true;
  if (!segarkan) {
    const tersimpan = await dao.bacaPaket();
    if (tersimpan != null) return tersimpan;
  }

  try {
    // Fase unduh tidak punya kemajuan per-byte (ApiClient mengembalikan JSON
    // utuh), jadi yang dilaporkan hanya "sedang berlangsung" — cukup untuk
    // membedakannya dari fase simpan yang justru bisa dihitung.
    opsi.onProgres?.({ fase: 'unduh', selesai: 0, total: 0 });
    const data = await ApiClient.get(`${ApiConfig.v1Path}/laporan-harian/rute-saya`, {
      parse: (d) => d as Record<string, unknown>,
    });
    const kini = new Date();
    const paket = ruteSayaDariJson(data, {
      diunduhPada: kini,
      periodeCadangan: periodeCatatSekarang(),
    });
    await dao.simpanPaket(paket, kini, (selesai, total) =>
      opsi.onProgres?.({ fase: 'simpan', selesai, total }),
    );
    // Baca balik lewat DAO supaya status antrean lokal langsung diterapkan
    // ke baris yang sudah dicatat tapi belum terkirim. `dariCache: false`
    // WAJIB disebut: pembacaan balik ini terjadi tepat setelah unduhan yang
    // BERHASIL, dan default DAO akan menandainya seolah disajikan dari
    // simpanan — membuat lencana "Tersimpan" menyala selamanya.
    return (await dao.bacaPaket({ dariCache: false })) ?? paket;
  } catch (err) {
    if (!offline(err)) throw err;
    const tersimpan = await dao.bacaPaket();
    if (tersimpan == null) throw err;
    return tersimpan;
  }
}

export function cari(kueri: string): Promise<PelangganRute[]> {
  return dao.cari(kueri);
}

export function ambilPelanggan(nomorLangganan: string): Promise<PelangganRute | null> {
  return dao.ambilPelanggan(nomorLangganan);
}

/** Batas `pelangganIds` di server (susunUrutSchema). */
const MAKS_URUT_SEKALI = 2000;

/**
 * Pindahkan satu rumah ke posisi lain dalam urutan kunjungan rutenya.
 *
 * DIKIRIM SEBAGAI DAFTAR PENUH, bukan "pindahkan A ke posisi 5" — itu memang
 * kontrak servernya, dan alasannya: hasil akhirnya tidak lagi bergantung pada
 * urutan sampainya permintaan kalau petugas menggeser beberapa rumah
 * berturut-turut selagi sinyalnya putus-putus.
 *
 * WAJIB ONLINE, dan itu disengaja. Urutan rute adalah data bersama — ia
 * mengubah buku rute untuk semua orang yang melihatnya, termasuk kantor.
 * Mengantrekannya secara lokal berarti dua petugas bisa menyusun ulang rute
 * yang sama tanpa saling tahu, lalu yang terkirim belakangan diam-diam
 * menghapus kerja yang satunya.
 */
export async function pindahkanUrutan(
  pelanggan: PelangganRute,
  posisiBaru: number,
  anggotaRute: PelangganRute[],
): Promise<void> {
  const ruteId = pelanggan.ruteId;
  if (ruteId == null) {
    throw new Error('Rute pelanggan ini tidak dikenali, jadi urutannya tidak bisa diubah.');
  }

  // Urutkan dari keadaan yang SEKARANG tampak di daftar, bukan dari urutan
  // apa pun yang kebetulan dioper pemanggil: nomor yang diketik petugas
  // merujuk pada posisi yang ia lihat di layar.
  const terurut = [...anggotaRute].sort((a, b) => {
    if (a.urutan == null && b.urutan == null) return a.nomorLangganan.localeCompare(b.nomorLangganan);
    if (a.urutan == null) return 1;
    if (b.urutan == null) return -1;
    return a.urutan - b.urutan;
  });

  if (terurut.length > MAKS_URUT_SEKALI) {
    throw new Error(
      `Rute ini berisi ${terurut.length} sambungan, melebihi batas ${MAKS_URUT_SEKALI} yang bisa disusun ulang sekali jalan. Laporkan ke admin.`,
    );
  }

  const dari = terurut.findIndex((p) => p.id === pelanggan.id);
  if (dari < 0) {
    throw new Error('Rumah ini tidak ada di daftar rute yang tersimpan di perangkat.');
  }

  // Posisi yang diketik petugas berbasis 1 dan dijepit ke rentang yang sah —
  // "0" atau angka yang melebihi jumlah rumah adalah salah ketik, bukan
  // alasan menolak seluruh perubahan.
  const ke = Math.min(Math.max(Math.trunc(posisiBaru), 1), terurut.length) - 1;
  if (ke === dari) return;

  const susun = [...terurut];
  const [dipindah] = susun.splice(dari, 1);
  if (dipindah == null) return;
  susun.splice(ke, 0, dipindah);

  const pelangganIds = susun.map((p) => p.id);
  await ApiClient.post(`${ApiConfig.v1Path}/laporan-harian/rute-saya/urutan`, {
    body: { ruteId, pelangganIds },
    parse: () => null,
  });
  // Cache lokal menyusul HANYA setelah server menerima: kalau permintaannya
  // gagal, daftar di layar harus tetap menunjukkan keadaan yang sebenarnya
  // berlaku, bukan susunan yang cuma ada di perangkat ini.
  await dao.perbaruiUrutan(pelangganIds);
}

/**
 * Stand resmi terakhir (prefill "stand lalu"). Prefer nilai dari paket rute
 * yang sudah dihitung server; jatuh ke riwayat PembacaanMeter hanya bila
 * paketnya tidak memuatnya.
 */
export async function standTerakhir(pelanggan: PelangganRute): Promise<number | null> {
  if (pelanggan.standLalu != null) return pelanggan.standLalu;
  if (pelanggan.riwayat.length > 0) return pelanggan.riwayat[0]!.standAkhir;
  try {
    const riwayat = await ApiClient.getList(`${ApiConfig.v1Path}/pembacaan`, {
      query: { pelangganId: pelanggan.id, pageSize: 1 },
      parseRow: (row) => row,
    });
    const baris = riwayat.rows[0];
    const nilai = baris?.['standAkhir'];
    return typeof nilai === 'number' ? Math.trunc(nilai) : null;
  } catch (err) {
    if (offline(err)) return null; // offline: yang hilang cuma prefill.
    throw err;
  }
}

// ── Simpan hasil catat ─────────────────────────────────────────────────

export interface InputCatat {
  pelanggan: PelangganRute;
  periode: number;
  standAwal: number;
  standAkhir: number;
  kondisi: string;
  kategori?: string;
  fotoPaths?: Partial<Record<JenisBerkas, string>>;
  latCatat?: number | null;
  longCatat?: number | null;
  isSegel?: boolean | null;
  usulanPerubahan?: string | null;
  usulanNoUrut?: number | null;
  notelpBaru?: string | null;
}

/**
 * Simpan hasil catat ke antrean upload. Mengembalikan `tersimpanOffline`
 * SELALU — lihat catatan sikap #1 di kepala berkas.
 *
 * `pemakaian` dan `jarakMeter` TIDAK ikut dikirim: server yang menghitungnya
 * (aturan keras). `pencatatId` juga tidak — server membacanya dari token,
 * karena client tidak boleh menyebut identitasnya sendiri.
 */
export async function catat(input: InputCatat): Promise<HasilCatat> {
  const { pelanggan } = input;
  const payload: Record<string, unknown> = {
    nomorLangganan: pelanggan.nomorLangganan,
    pelangganId: pelanggan.id,
    periode: input.periode,
    standAwal: input.standAwal,
    standAkhir: input.standAkhir,
    kondisi: input.kondisi,
    kategori: input.kategori ?? 'ONSITE',
    pemakaianLalu: pelanggan.pemakaianLalu,
    tanggalCatat: new Date().toISOString(),
  };
  if (pelanggan.nomorMeter != null) payload['nomorMeter'] = pelanggan.nomorMeter;
  if (input.latCatat != null) payload['latCatat'] = input.latCatat;
  if (input.longCatat != null) payload['longCatat'] = input.longCatat;
  if (input.isSegel != null) payload['isSegel'] = input.isSegel;
  if (input.usulanPerubahan) payload['usulanPerubahan'] = input.usulanPerubahan;
  if (input.usulanNoUrut != null) payload['usulanNoUrut'] = input.usulanNoUrut;
  // Pembaruan No. HP dari lapangan (bill_nohp Aurora) — server yang
  // menerapkannya ke Pelanggan.notelp.
  if (input.notelpBaru) payload['notelpBaru'] = input.notelpBaru;

  const fotoPaths = input.fotoPaths ?? {};

  // Jejak log DULU (pola Aurora: catatTxt sebelum yakin terkirim) — apa pun
  // nasib jaringan dan database berikutnya, angkanya sudah tercatat.
  await backup.catatLog({
    periode: input.periode,
    nomorLangganan: pelanggan.nomorLangganan,
    standAkhir: String(input.standAkhir),
    kondisi: input.kondisi,
    petugas: SesiPetugas.akun?.name,
    longlat:
      input.latCatat != null && input.longCatat != null
        ? `${input.longCatat},${input.latCatat}`
        : null,
  });

  await dao.tambahAntrean({
    idAntrean: null,
    payload,
    fotoPaths,
    fotoUrls: {},
    dibuatPada: new Date(),
    percobaan: 0,
    pesanGagal: null,
  });

  // Bundel cadangan (INDEPENDEN dari SQLite) — sumber pemulihan bila DB lokal
  // korup, sekaligus bahan ekspor→impor di web.
  await backup.simpanCatatan({
    periode: input.periode,
    nomorLangganan: pelanggan.nomorLangganan,
    data: {
      ...payload,
      ruteKode: pelanggan.ruteKode,
      namaPetugas: SesiPetugas.akun?.name ?? null,
      dibuatPada: new Date().toISOString(),
    },
  });

  // Cermin ke folder pilihan petugas — ditunda dan TIDAK ditunggu, jadi
  // tombol simpan tetap ringan. Lihat catatan di cermin.ts.
  jadwalkanCermin();

  return 'tersimpanOffline';
}

// ── Antrean → sinkronisasi batch ───────────────────────────────────────

/**
 * null = berkas lokal sudah tidak ada (cache picker dibersihkan OS). Laporan
 * tetap dikirim TANPA berkas itu — kehilangan satu foto tidak boleh
 * membatalkan pencatatan yang angkanya sudah benar.
 */
async function unggahBerkas(input: {
  nomorLangganan: string;
  periode: number;
  jenis: JenisBerkas;
  path: string;
}): Promise<string | null> {
  const berkas = new File(input.path);
  if (!berkas.exists) return null;

  const form = new FormData();
  form.append('nomorLangganan', input.nomorLangganan);
  form.append('periode', String(input.periode));
  form.append('jenis', input.jenis);
  // Objek `File` expo-file-system, BUKAN bentuk `{uri, name, type}` khas RN.
  // Bentuk lama itu gagal di Android sejak New Architecture (bridgeless):
  // modul jaringan melempar "Network request failed" SEBELUM ada satu byte
  // pun keluar, sehingga log server bersih dan aplikasi salah menyimpulkan
  // sinyal putus. `File` SDK 57 mengimplementasikan antarmuka Blob, jadi
  // FormData menerimanya langsung — inilah cara yang didokumentasikan.
  // Server tetap memvalidasi isinya lewat magic bytes dan memilih sendiri
  // nama akhirnya, jadi nama di sini hanya penanda bagi parser multipart.
  form.append('foto', berkas, berkas.name);

  const hasil = await ApiClient.postMultipart(`${ApiConfig.v1Path}/laporan-harian/foto`, {
    form,
    parse: (d) => d as Record<string, unknown>,
  });
  const url = hasil['url'];
  return typeof url === 'string' ? url : null;
}

/**
 * Unggah berkas satu baris, lalu kembalikan payload berisi URL-nya.
 *
 * MELEWATI yang sudah terunggah (`entri.fotoUrls`) — inilah yang membuat
 * percobaan ulang murah. Tiap keberhasilan ditulis ke antrean SEKETIKA, jadi
 * sinyal yang putus di tengah baris tetap meninggalkan jejak.
 *
 * `jenisDipilih` membatasi jenis berkas yang dikerjakan putaran ini, sehingga
 * petugas bisa mengamankan foto stand dulu sebelum menyentuh yang lain.
 */
async function payloadDenganBerkas(
  entri: CatatTertunda,
  jenisDipilih: JenisBerkas[] | null,
  onBerkas?: (jenis: JenisBerkas) => void,
): Promise<Record<string, unknown>> {
  const hasil = { ...entri.payload };

  // URL dari percobaan sebelumnya langsung dipasang — tanpa menyentuh jaringan.
  for (const [jenis, url] of Object.entries(entri.fotoUrls) as [JenisBerkas, string][]) {
    const field = FIELD_URL[jenis];
    if (field != null && url) hasil[field] = url;
  }

  for (const [jenis, path] of Object.entries(entri.fotoPaths) as [JenisBerkas, string][]) {
    const field = FIELD_URL[jenis];
    if (field == null || !path) continue;
    if (entri.fotoUrls[jenis]) continue; // sudah aman di server
    if (jenisDipilih != null && !jenisDipilih.includes(jenis)) continue;

    let url: string | null = null;
    try {
      url = await unggahBerkas({
        nomorLangganan: nomorLanggananAntrean(entri),
        periode: periodeAntrean(entri),
        jenis,
        path,
      });
    } catch (err) {
      // Offline → biarkan pemanggil menghentikan seluruh proses (baris ini
      // belum siap). Penolakan server atas SATU berkas tidak boleh
      // menyandera laporannya.
      if (offline(err)) throw err;
      await backup.catatError(`unggah ${jenis} ${nomorLanggananAntrean(entri)}: ${String(err)}`);
    }
    if (url != null) {
      hasil[field] = url;
      if (entri.idAntrean != null) await dao.simpanFotoUrl(entri.idAntrean, jenis, url);
      entri.fotoUrls[jenis] = url;
    }
    onBerkas?.(jenis);
  }
  return hasil;
}

export interface HasilKirim {
  terkirim: number;
  gagal: number;
  /** true = berhenti karena jaringan mati, bukan karena ditolak server. */
  terhentiOffline: boolean;
  /** Berkas yang berhasil diunggah putaran ini (mode berkas-saja memakainya). */
  berkasTerunggah: number;
}

/** Kemajuan yang dilaporkan ke layar SELAMA pengiriman berlangsung. */
export interface ProgresKirim {
  fase: 'berkas' | 'kirim';
  selesai: number;
  total: number;
  /** Baris yang sedang dikerjakan — supaya petugas tahu ini bergerak. */
  keterangan: string;
}

export interface OpsiKirim {
  /**
   * Baris yang dikerjakan. Kosong/undefined = seluruh antrean.
   * Dipakai layar unggah untuk mengirim satu rute, atau baris pilihan sendiri.
   */
  idAntrean?: number[];
  /**
   * Jenis berkas yang diunggah putaran ini. undefined = semua.
   * Petugas di sinyal buruk mengamankan `['stand']` dulu — foto yang paling
   * menentukan — lalu menyusul sisanya saat sinyal membaik.
   */
  jenisFoto?: JenisBerkas[];
  /**
   * true = HANYA unggah berkas, jangan kirim batch teksnya.
   *
   * Kenapa dipisah: server menolak laporan yang sudah tersimpan sebagai
   * DUPLIKAT tanpa memperbaruinya, jadi batch teks hanya boleh dikirim SEKALI
   * dan harus membawa URL yang sudah selengkap mungkin. Mode ini menumpuk
   * berkas dulu; pengiriman teksnya dilakukan belakangan dalam satu langkah.
   */
  hanyaBerkas?: boolean;
  onProgres?: (p: ProgresKirim) => void;
}

/**
 * Kirim antrean lewat endpoint batch.
 *
 * Kontraknya PER-RECORD, bukan semua-atau-gagal: satu baris bermasalah tidak
 * boleh membatalkan ratusan baris lain yang sudah susah payah dicatat.
 * `TERSIMPAN` dan `DUPLIKAT` sama-sama berarti server sudah memegang laporan
 * itu — DUPLIKAT terjadi saat unggah ulang setelah sinyal putus sebelum
 * respons pertama sampai, jadi memperlakukannya sebagai kegagalan akan
 * membuat baris yang sudah aman menetap selamanya di antrean.
 */
export async function kirimTertunda(opsi: OpsiKirim = {}): Promise<HasilKirim> {
  const semua = await dao.daftarAntrean();
  const pilih = opsi.idAntrean != null && opsi.idAntrean.length > 0 ? new Set(opsi.idAntrean) : null;
  const antre = pilih == null ? semua : semua.filter((e) => e.idAntrean != null && pilih.has(e.idAntrean));
  const kosong: HasilKirim = { terkirim: 0, gagal: 0, terhentiOffline: false, berkasTerunggah: 0 };
  if (antre.length === 0) return kosong;

  const jenisFoto = opsi.jenisFoto ?? null;
  let berkasTerunggah = 0;

  // Tahap 1 — unggah berkas tiap baris. Nama di server deterministik, jadi
  // unggah ulang MENIMPA alih-alih menggandakan. Sinyal putus di tengah:
  // berhenti, dan antrean tetap utuh untuk percobaan berikutnya.
  const siap: CatatTertunda[] = [];
  const payloads: Record<string, unknown>[] = [];
  let terhentiOffline = false;
  try {
    for (const entri of antre) {
      opsi.onProgres?.({
        fase: 'berkas',
        selesai: siap.length,
        total: antre.length,
        keterangan: nomorLanggananAntrean(entri),
      });
      payloads.push(
        await payloadDenganBerkas(entri, jenisFoto, () => {
          berkasTerunggah++;
        }),
      );
      siap.push(entri);
    }
    opsi.onProgres?.({ fase: 'berkas', selesai: siap.length, total: antre.length, keterangan: '' });
  } catch (err) {
    if (!offline(err)) throw err;
    terhentiOffline = true;
    if (siap.length === 0) return { ...kosong, terhentiOffline: true, berkasTerunggah };
  }

  // Mode berkas-saja berhenti di sini — teksnya belum dikirim, antrean utuh.
  if (opsi.hanyaBerkas) return { terkirim: 0, gagal: 0, terhentiOffline, berkasTerunggah };

  // Tahap 2 — panggilan batch, dipecah maks. 300 baris. Petugas yang seharian
  // offline bisa membawa ratusan baris; sinyal putus di tengah tetap aman
  // karena baris yang belum terjawab tidak disentuh.
  const perRecord: Record<string, unknown>[] = [];
  try {
    for (let awal = 0; awal < payloads.length; awal += MAKS_PER_BATCH) {
      opsi.onProgres?.({
        fase: 'kirim',
        selesai: awal,
        total: payloads.length,
        keterangan: `${Math.min(awal + MAKS_PER_BATCH, payloads.length)} dari ${payloads.length}`,
      });
      const potong = payloads.slice(awal, awal + MAKS_PER_BATCH);
      const hasil = await ApiClient.post(`${ApiConfig.v1Path}/laporan-harian/batch`, {
        body: { laporan: potong },
        parse: (d) => d as Record<string, unknown>,
      });
      const daftar = hasil['hasil'];
      if (Array.isArray(daftar)) {
        for (const r of daftar) {
          if (r != null && typeof r === 'object') perRecord.push(r as Record<string, unknown>);
        }
      }
    }
    opsi.onProgres?.({ fase: 'kirim', selesai: payloads.length, total: payloads.length, keterangan: '' });
  } catch (err) {
    if (!offline(err)) throw err;
    terhentiOffline = true;
    if (perRecord.length === 0) return { ...kosong, terhentiOffline: true, berkasTerunggah };
    // Sebagian batch sempat terjawab — proses yang sudah ada.
  }

  let terkirim = 0;
  let gagal = 0;
  for (let i = 0; i < siap.length; i++) {
    const entri = siap[i]!;
    const jawaban = i < perRecord.length ? perRecord[i] : undefined;
    const status = typeof jawaban?.['status'] === 'string' ? (jawaban['status'] as string) : null;

    if (status === 'TERSIMPAN' || status === 'DUPLIKAT') {
      if (entri.idAntrean != null) await dao.hapusAntrean(entri.idAntrean);
      await dao.tandaiDicatat(nomorLanggananAntrean(entri));
      await backup.tandaiTerunggah(periodeAntrean(entri), nomorLanggananAntrean(entri));
      terkirim++;
      continue;
    }
    // Baris tanpa jawaban (batch terputus) TIDAK ditandai gagal — ia belum
    // pernah sampai, dan menuliskan pesan gagal padanya akan berbohong.
    if (jawaban === undefined) continue;

    const pesan =
      typeof jawaban['pesan'] === 'string' ? (jawaban['pesan'] as string) : 'Baris ditolak server.';
    if (entri.idAntrean != null) await dao.tandaiGagal(entri.idAntrean, pesan);
    await backup.catatError(`batch gagal ${nomorLanggananAntrean(entri)}: ${pesan}`);
    gagal++;
  }
  return { terkirim, gagal, terhentiOffline, berkasTerunggah };
}

export function jumlahTertunda(): Promise<number> {
  return dao.jumlahAntrean();
}

export function daftarTertunda(): Promise<CatatTertunda[]> {
  return dao.daftarAntrean();
}

/** Antrean beserta rute & kemajuan berkasnya — bahan layar unggah. */
export function ringkasTertunda(): Promise<dao.RingkasAntrean[]> {
  return dao.daftarAntreanRingkas();
}

/**
 * Hapus satu baris antrean — HANYA dari layar antrean, atas keputusan sadar
 * petugas. Itu hasil kerja yang belum terunggah; baris pelanggannya kembali
 * berstatus belum dibaca.
 */
export function hapusTertunda(idAntrean: number): Promise<void> {
  return dao.hapusAntrean(idAntrean);
}

// ── Riwayat hasil catat saya ───────────────────────────────────────────

/** Baris antrean ditampilkan sebagai riwayat berstatus ANTRE. */
async function antreSebagaiRiwayat(): Promise<LaporanSaya[]> {
  const antre = await dao.daftarAntrean();
  return antre.map((entri) => {
    const p = entri.payload;
    const bulat = (v: unknown) => (typeof v === 'number' ? Math.trunc(v) : null);
    const tgl = typeof p['tanggalCatat'] === 'string' ? new Date(p['tanggalCatat']) : null;
    return {
      id: null,
      nomorLangganan: nomorLanggananAntrean(entri),
      namaPelanggan: null,
      periode: periodeAntrean(entri),
      standAwal: bulat(p['standAwal']),
      standAkhir: bulat(p['standAkhir']),
      pemakaian: null,
      kondisi: typeof p['kondisi'] === 'string' ? (p['kondisi'] as string) : null,
      tanggalCatat: tgl != null && !Number.isNaN(tgl.getTime()) ? tgl : null,
      statusVerif: 'ANTRE' as const,
      catatanVerif: null,
      pesanGagal: entri.pesanGagal,
    };
  });
}

/** Riwayat versi offline: antrean + baris paket yang sudah tercatat. */
async function riwayatLokal(periode: number): Promise<LaporanSaya[]> {
  const antre = await antreSebagaiRiwayat();
  const nomorAntre = new Set(antre.map((a) => a.nomorLangganan));
  const paket = await dao.bacaPaket();
  const dariPaket: LaporanSaya[] = [];
  for (const p of paket?.pelanggan ?? []) {
    if (!p.sudahDicatat || nomorAntre.has(p.nomorLangganan)) continue;
    const tgl = p.laporan?.tanggalCatat != null ? new Date(p.laporan.tanggalCatat) : null;
    dariPaket.push({
      id: p.laporan?.id ?? null,
      nomorLangganan: p.nomorLangganan,
      namaPelanggan: p.nama,
      periode,
      standAwal: p.standLalu,
      standAkhir: p.laporan?.standAkhir ?? null,
      pemakaian: null,
      kondisi: p.laporan?.kondisi ?? null,
      tanggalCatat: tgl != null && !Number.isNaN(tgl.getTime()) ? tgl : null,
      statusVerif: 'MENUNGGU',
      catatanVerif: null,
      pesanGagal: null,
    });
  }
  return [...antre, ...dariPaket];
}

/**
 * Seluruh hasil catat akun ini pada periode berjalan: baris antrean lokal
 * (ANTRE) + laporan di server beserta status verifikasinya. Offline →
 * dibangun dari cache lokal.
 */
export async function riwayatSaya(): Promise<LaporanSaya[]> {
  const periode = periodeCatatSekarang();
  try {
    let pencatatId = (await dao.bacaPaket())?.pencatatId ?? null;
    // Instal baru tanpa cache: unduh paket dulu — sekaligus untuk tahu
    // pencatatId, kunci filter di server.
    pencatatId ??= (await ruteSaya()).pencatatId;
    if (pencatatId == null) return riwayatLokal(periode);

    const hasil = await ApiClient.getList(`${ApiConfig.v1Path}/laporan-harian`, {
      query: { pencatatId, periode, pageSize: 300 },
      parseRow: laporanSayaDariJson,
    });
    // Baris yang masih antre belum ada di server — digabung supaya riwayat
    // berarti SELURUH hasil kerja, terkirim atau belum.
    return [...(await antreSebagaiRiwayat()), ...hasil.rows];
  } catch (err) {
    if (!offline(err)) throw err;
    return riwayatLokal(periode);
  }
}

// ── Pemulihan dari cadangan ────────────────────────────────────────────

/**
 * Kembalikan hasil catat dari bundel cadangan ke antrean upload — penyelamat
 * bila database lokal korup sehingga antreannya hilang. Hanya bundel yang
 * BELUM terunggah dan TIDAK sudah ada di antrean yang dipulihkan.
 */
export async function pulihkanDariCadangan(): Promise<number> {
  const bundel = await backup.daftarBundel();
  if (bundel.length === 0) return 0;

  const antre = await dao.daftarAntrean();
  const nomorAntre = new Set(antre.map(nomorLanggananAntrean));

  let dipulihkan = 0;
  for (const b of bundel) {
    if (b.terunggah || nomorAntre.has(b.nomorLangganan)) continue;
    // Buang metadata non-payload sebelum dikembalikan jadi payload laporan.
    const { ruteKode: _r, namaPetugas: _n, dibuatPada: _d, ...payload } = b.data;
    await dao.tambahAntrean({
      idAntrean: null,
      payload,
      fotoPaths: b.fotoPaths,
      fotoUrls: {},
      dibuatPada: new Date(),
      percobaan: 0,
      pesanGagal: null,
    });
    dipulihkan++;
  }
  return dipulihkan;
}

export { statistikLokal, hapusPaket } from './DaoBacaMeter';
export { lokasiFolder, daftarBundel, daftarCsvCatatan, simpanSalinanFoto } from './BackupLokal';
