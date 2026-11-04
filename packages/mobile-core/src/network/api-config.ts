/**
 * api-config.ts — konfigurasi koneksi ke backend web (Next.js + Hono).
 * Padanan `core/network/api_config.dart`.
 *
 * URL produksi TERTANAM di kode (`URL_PRODUKSI`) — build produksi tidak perlu
 * flag apa pun. Untuk menunjuk backend lain (dev lokal / staging), timpa lewat
 * env Expo saat build/start:
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000 npx expo start
 *
 * MODE DEMO (data contoh in-memory, tanpa backend) diaktifkan EKSPLISIT:
 *   EXPO_PUBLIC_DEMO=true npx expo start
 * Padanan `--dart-define=DEMO=true` di Flutter. Produksi tetap jadi bawaan
 * bila env tidak diisi.
 *
 * Catatan Expo: hanya variabel berawalan `EXPO_PUBLIC_` yang di-inline ke
 * bundel klien — sama seperti `String.fromEnvironment` di Dart yang menetap
 * saat kompilasi. Itu sebabnya OVERRIDE di bawah tidak bisa dipakai untuk
 * mengganti server di app yang sudah ter-install (lihat overrideRuntime).
 *
 * OVERRIDE RUNTIME (khusus mobile-petugas — lihat features/pengaturan/).
 * `EXPO_PUBLIC_API_BASE_URL` di atas menetap saat build, jadi tidak berguna
 * untuk teknisi yang perlu mengarahkan app yang SUDAH ter-install ke server
 * lokal. `overrideRuntime` di bawah adalah state di memori yang dipulihkan
 * dari `penyimpananAman` (SecureStore) saat boot lewat `hydrateApiOverride()`,
 * dan diubah lewat `setApiOverride()` — hanya dipanggil dari layar
 * pengaturan-api milik mobile-petugas yang tersembunyi & dijaga kode akses
 * server. mobile-publik/mobile-gangguan tidak pernah memanggil kedua fungsi
 * itu, jadi `overrideRuntime` di proses mereka selalu tetap null.
 */
import { penyimpananAman } from '../auth/storage';

/** URL produksi resmi (backend ter-deploy di Vercel). */
const URL_PRODUKSI = 'https://tirtawening.vercel.app';

/** URL lokal default untuk development */
const URL_DEV_LOCAL = 'http://localhost:3000';

/** Penimpa opsional saat build (dev/staging). Kosong = pakai produksi. */
const OVERRIDE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/** Aktif hanya bila `EXPO_PUBLIC_DEMO=true`. */
const DEMO = process.env.EXPO_PUBLIC_DEMO === 'true';

/** Kunci penyimpanan aman untuk override runtime (khusus mobile-petugas). */
const KUNCI_API_OVERRIDE = 'petugasApiBaseUrlOverride';

/** State di memori — null = tidak ada override runtime aktif. */
let overrideRuntime: string | null = null;

function defaultUrl(): string {
  if (OVERRIDE.length > 0) {
    return OVERRIDE;
  }
  return typeof __DEV__ !== 'undefined' && __DEV__ ? URL_DEV_LOCAL : URL_PRODUKSI;
}

export const ApiConfig = {
  /**
   * Base URL efektif:
   * 1. Jika ada override runtime tersimpan (mobile-petugas) -> pakai itu.
   * 2. Jika EXPO_PUBLIC_API_BASE_URL diisi di .env -> Pakai OVERRIDE.
   * 3. Jika mode Development (__DEV__) -> Fallback ke localhost:3000.
   * 4. Jika mode Production -> Fallback ke URL_PRODUKSI.
   */
  get baseUrl(): string {
    if (overrideRuntime != null && overrideRuntime.length > 0) {
      return overrideRuntime;
    }
    return defaultUrl();
  },

  /** true = repository memakai data demo in-memory (bukan menembak backend). */
  get isDemo(): boolean {
    return DEMO;
  },

  /** true = baseUrl efektif BUKAN URL produksi resmi — dipakai indikator UI. */
  get bukanProduksi(): boolean {
    return ApiConfig.baseUrl !== URL_PRODUKSI;
  },

  /** Endpoint publik (tanpa login): cek tagihan, lapor meter, pengaduan. */
  publicPath: '/api/public',

  /** Endpoint bisnis (wajib Bearer token): modul petugas. */
  v1Path: '/api/v1',

  /** Pintu masuk mobile (tanpa token): tukar kredensial → Bearer token. */
  mobileAuthPath: '/api/mobile/auth',

  /** Verifikasi kode akses layar pengaturan-api (mobile-petugas). */
  devAccessPath: '/api/mobile/dev-access',
} as const;

/**
 * Pulihkan override runtime dari penyimpanan aman. Panggil sekali di root
 * layout mobile-petugas SEBELUM layar pertama tampil, di samping
 * `SesiPetugas.pulihkan()`.
 */
export async function hydrateApiOverride(): Promise<void> {
  try {
    const v = await penyimpananAman.get(KUNCI_API_OVERRIDE);
    overrideRuntime = v != null && v.length > 0 ? v : null;
  } catch {
    overrideRuntime = null;
  }
}

/**
 * Ganti override runtime. `url = null` menghapus override (kembali ke
 * default produksi/build-time). Dipanggil HANYA dari layar pengaturan-api
 * mobile-petugas, setelah kode akses server terverifikasi.
 */
export async function setApiOverride(url: string | null): Promise<void> {
  overrideRuntime = url != null && url.length > 0 ? url : null;
  if (overrideRuntime != null) {
    await penyimpananAman.set(KUNCI_API_OVERRIDE, overrideRuntime);
  } else {
    await penyimpananAman.hapus(KUNCI_API_OVERRIDE);
  }
}
