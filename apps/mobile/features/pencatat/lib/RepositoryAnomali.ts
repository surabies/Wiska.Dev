/**
 * repository.ts — sumber data modul Anomali (penyelia anomali).
 *
 * OFFLINE-FIRST, SAMA SEPERTI BACA METER. Daftar anomali diunduh SEKALI lalu
 * dilayani dari SQLite; berpindah layar TIDAK menembak jaringan lagi. Ini
 * bukan sekadar soal kecepatan: daftarnya ribuan baris, dan penyelia bekerja
 * di gang-gang yang sinyalnya tidak bisa diandalkan.
 *
 * BERBEDA DARI MODUL BACA METER dalam dua hal, dan bedanya disengaja:
 *
 * 1. **Tidak ada rute, tidak ada target.** Penyelia anomali menerima SELURUH
 *    daftar sambungan yang meternya berbulan-bulan tidak terbaca, lalu
 *    memilih sendiri mana yang didatangi. Keberhasilannya diukur dari
 *    turunnya jumlah anomali per bulan — bukan dari berapa rumah dikunjungi.
 *
 * 2. **Kunjungan dikirim SATU PER SATU, bukan lewat antrean borongan.**
 *    Baca meter menumpuk ratusan catatan lalu mengunggahnya sekaligus karena
 *    petugas menyusuri rute padat. Kunjungan anomali jumlahnya sedikit dan
 *    tersebar; menunda pengirimannya hanya menambah risiko hilang tanpa
 *    membeli kenyamanan apa pun.
 */
import { File } from 'expo-file-system';
import { ApiClient, ApiConfig, ApiException, type JenisBerkas } from '@workspace/mobile-core';
import type { KategoriAnomali } from '@workspace/domain/anomali';
import * as dao from './DaoAnomali';

export interface BarisAnomali {
  pelangganId: string;
  nomorLangganan: string;
  nama: string;
  alamat: string | null;
  kategori: KategoriAnomali;
  kondisiTerakhir: string;
  bulanBerturut: number;
  m3TanpaDasar: number;
  skor: number;
  jumlahRekTunggak: number;
  prioritas: boolean;
  ruteKode: string | null;
  /// Wilayah & urutan jalan. Opsional secara sengaja: perangkat yang daftarnya
  /// diunduh SEBELUM server mengirim field ini tetap bisa dibaca — barisnya
  /// hanya tidak ikut tersaring wilayah sampai diunduh ulang.
  kelurahan?: string | null;
  rt?: string | null;
  rw?: string | null;
  noUrutRute?: number | null;
  kunjunganTerakhir: { periode: number; hasil: string; dikunjungiAt: string } | null;
}

export interface DaftarAnomali {
  ambangBulan: number;
  total: number;
  prioritas: number;
  perKategori: Record<KategoriAnomali, number>;
  baris: BarisAnomali[];
  /** true = dilayani dari SQLite, bukan dari jaringan barusan. */
  dariLokal?: boolean;
  diunduhPada?: Date | null;
}

export type HasilKunjungan =
  | 'BERTEMU_TERBACA'
  | 'BERTEMU_TIDAK_TERBACA'
  | 'TETAP_TERKUNCI'
  | 'KOSONG_TERKONFIRMASI'
  | 'METER_DIPINDAH'
  | 'PERLU_GANTI_METER'
  | 'USUL_TUTUP_SEMENTARA'
  | 'ALAMAT_TIDAK_DITEMUKAN';

export interface KirimKunjunganInput {
  pelangganId: string;
  nomorLangganan: string;
  periode: number;
  kategori: KategoriAnomali;
  bulanBerturut: number;
  m3TanpaDasar: number;
  hasil: HasilKunjungan;
  /** Wajib bila hasil BERTEMU_TERBACA — server menolak tanpanya. */
  standDitemukan?: number;
  /** Berkas bukti lokal per slot; diunggah lebih dulu lalu ditukar URL. */
  fotoPaths?: Partial<Record<JenisBerkas, string>>;
  /** null = tidak diperiksa; true/false = kondisi segel yang ditemukan. */
  isSegel?: boolean | null;
  latitude?: number;
  longitude?: number;
  catatan?: string;
}

export interface HasilKirim {
  id: string;
  masukAntreanVerifikasi: boolean;
  pesan: string;
}

/** Nama field URL di payload kunjungan untuk tiap jenis berkas bukti. */
const FIELD_URL: Partial<Record<JenisBerkas, string>> = {
  stand: 'fotoUrl',
  segel: 'fotoSegelUrl',
  rumah: 'fotoRumahUrl',
};

/** true = kegagalan transport (offline), bukan penolakan server. */
function offline(err: unknown): boolean {
  return err instanceof ApiException && err.status === 0;
}

export interface OpsiDaftar {
  hanyaPrioritas?: boolean;
  kategori?: KategoriAnomali | null;
  kueri?: string | null;
  /** Periode berjalan — dipakai menyembunyikan yang sudah dikunjungi. */
  periode?: number | null;
  /** Persempit ke satu kelurahan. null = semua. */
  kelurahan?: string | null;
  /** Persempit ke satu RW dalam kelurahan terpilih. null = semua. */
  rw?: string | null;
  /**
   * true = tarik ulang dari server lalu ganti isi lokal. Bawaannya FALSE:
   * layar hanya membaca lokal, dan mengunduh adalah tindakan yang disengaja
   * petugas lewat menu Unduh Data atau tarik-untuk-segarkan.
   */
  segarkan?: boolean;
}

/**
 * Daftar anomali. Bawaannya membaca SQLite; jaringan hanya disentuh bila
 * diminta menyegarkan, atau bila perangkat ini memang belum pernah mengunduh.
 */
export async function daftarAnomali(opsi: OpsiDaftar = {}): Promise<DaftarAnomali> {
  const saring = {
    hanyaPrioritas: opsi.hanyaPrioritas,
    kategori: opsi.kategori,
    kueri: opsi.kueri,
    periode: opsi.periode,
    kelurahan: opsi.kelurahan,
    rw: opsi.rw,
  };

  if (!opsi.segarkan) {
    const lokal = await dao.bacaDaftar(saring);
    if (lokal != null) return lokal;
    // Belum pernah mengunduh — turun ke jaringan sekali, lalu simpan.
  }

  try {
    await unduhAnomali();
  } catch (err) {
    if (!offline(err)) throw err;
    const lokal = await dao.bacaDaftar(saring);
    if (lokal == null) throw err;
    return lokal;
  }
  return (await dao.bacaDaftar(saring)) ?? kosong();
}

function kosong(): DaftarAnomali {
  return {
    ambangBulan: 3,
    total: 0,
    prioritas: 0,
    perKategori: { TERKUNCI: 0, DIDUGA_KOSONG: 0, METER_RUSAK: 0 },
    baris: [],
    dariLokal: true,
    diunduhPada: null,
  };
}

/**
 * Tarik SELURUH daftar dari server lalu ganti isi lokal. Sengaja tanpa
 * penyaring: yang disimpan adalah daftar utuh, dan penyaringan dikerjakan
 * SQLite setelahnya — supaya mengetuk chip "Tanpa tunggakan" tidak berarti
 * mengunduh ulang.
 */
export async function unduhAnomali(): Promise<DaftarAnomali> {
  const data = await ApiClient.get(`${ApiConfig.v1Path}/anomali`, {
    parse: (d) => d as DaftarAnomali,
  });
  const kini = new Date();
  await dao.simpanDaftar(data, kini);
  return { ...data, dariLokal: false, diunduhPada: kini };
}

/** Satu baris dari lokal — layar kunjungan dibuka lewat ini. */
export function ambilBaris(pelangganId: string): Promise<BarisAnomali | null> {
  return dao.ambilBaris(pelangganId);
}

/**
 * Kelurahan & RW yang ada di daftar tersimpan, untuk mengisi penyaring.
 * Dilayani SQLite — tidak pernah menyentuh jaringan.
 */
export function wilayahAnomali(opsi: OpsiDaftar = {}) {
  return dao.wilayahTersedia({
    hanyaPrioritas: opsi.hanyaPrioritas,
    kategori: opsi.kategori,
    kueri: opsi.kueri,
    periode: opsi.periode,
    kelurahan: opsi.kelurahan,
    rw: opsi.rw,
  });
}

export function statistikLokal() {
  return dao.statistik();
}

export function waktuUnduhAnomali() {
  return dao.waktuUnduh();
}

/**
 * Unggah satu berkas bukti. Memakai endpoint yang SAMA dengan pencatatan
 * rutin — foto meter adalah foto meter, tidak ada alasan punya dua jalur
 * penyimpanan yang harus dirawat terpisah.
 *
 * null = berkas lokal sudah tidak ada (cache picker dibersihkan OS).
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
  form.append('foto', berkas, berkas.name);

  const hasil = await ApiClient.postMultipart(`${ApiConfig.v1Path}/laporan-harian/foto`, {
    form,
    parse: (d) => d as Record<string, unknown>,
  });
  const url = hasil['url'];
  return typeof url === 'string' ? url : null;
}

export async function kirimKunjungan(input: KirimKunjunganInput): Promise<HasilKirim> {
  if (input.hasil === 'BERTEMU_TERBACA' && input.standDitemukan == null) {
    // Digagalkan di sini dengan pesan yang SAMA seperti server — supaya
    // petugas tahu sebelum menunggu perjalanan jaringan yang pasti ditolak.
    throw new ApiException(
      400,
      'BAD_REQUEST',
      'Hasil "Bertemu & meter terbaca" harus disertai angka meter — itu satu-satunya gunanya.',
    );
  }

  // Foto diunggah LEBIH DULU, lalu URL-nya ikut di badan kunjungan. Kegagalan
  // satu foto TIDAK membatalkan kunjungan: hasil lapangan yang sudah benar
  // tidak boleh hangus karena satu berkas gagal naik.
  const urlFoto: Record<string, string> = {};
  for (const [jenis, path] of Object.entries(input.fotoPaths ?? {}) as [JenisBerkas, string][]) {
    const field = FIELD_URL[jenis];
    if (field == null || !path) continue;
    try {
      const url = await unggahBerkas({
        nomorLangganan: input.nomorLangganan,
        periode: input.periode,
        jenis,
        path,
      });
      if (url != null) urlFoto[field] = url;
    } catch (err) {
      // Offline → hentikan seluruh proses; kunjungannya belum siap dikirim
      // dan isian layar tetap utuh supaya petugas bisa mencoba lagi.
      if (offline(err)) throw err;
    }
  }

  const hasil = await ApiClient.post<HasilKirim>(`${ApiConfig.v1Path}/anomali/kunjungan`, {
    body: {
      pelangganId: input.pelangganId,
      periode: input.periode,
      kategori: input.kategori,
      bulanBerturut: input.bulanBerturut,
      m3TanpaDasar: input.m3TanpaDasar,
      hasil: input.hasil,
      standDitemukan: input.standDitemukan,
      isSegel: input.isSegel ?? undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      catatan: input.catatan,
      ...urlFoto,
    },
    parse: (d) => d as HasilKirim,
  });

  // Baris ini langsung hilang dari daftar lokal — petugas tidak perlu
  // mengunduh ulang hanya untuk melihat pekerjaannya berkurang satu.
  await dao.tandaiDikunjungi(input.pelangganId, input.periode, input.hasil);
  return hasil;
}
