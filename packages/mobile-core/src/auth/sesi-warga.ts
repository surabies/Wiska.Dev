/**
 * sesi-warga.ts — padanan `core/auth/sesi_warga.dart`.
 *
 * Sesi login warga di aplikasi PUBLIK (role USER). Login/daftar TETAP OPSIONAL:
 * `pulihkan()` hanya memulihkan sesi tersimpan diam-diam di awal (tanpa memaksa
 * layar login) — kalau tak ada token, aplikasi jalan dalam keadaan anonim.
 *
 * `flutter_secure_storage` digantikan `penyimpananAman` — SecureStore
 * (Keystore/Keychain) di native, `localStorage` di web (SecureStore tak ada
 * di web). Lihat storage.ts.
 */
import { ApiClient } from '../network/api-client';
import { ApiConfig } from '../network/api-config';
import { penyimpananAman } from './storage';

const KUNCI_TOKEN = 'wargaAccessToken';
const KUNCI_KEDALUWARSA = 'wargaExpiresAt';
const KUNCI_AKUN = 'wargaAkun';

/**
 * Akun warga hasil daftar/masuk (subset payload /api/mobile/auth/login).
 * Role selalu 'USER': akun ini hasil pendaftaran mandiri lewat
 * POST /api/public/auth/register.
 */
export class WargaAkun {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string | null = null,
  ) {}

  static fromJson(json: Record<string, unknown>): WargaAkun {
    return new WargaAkun(
      (json['id'] as string) ?? '',
      (json['name'] as string) ?? 'Warga',
      (json['email'] as string) ?? null,
    );
  }

  toJson(): Record<string, unknown> {
    return { id: this.id, name: this.name, email: this.email };
  }
}

class SesiWargaImpl {
  akun: WargaAkun | null = null;

  get sudahMasuk(): boolean {
    return this.akun != null;
  }

  /**
   * Pulihkan sesi tersimpan saat aplikasi dibuka. TIDAK memanggil jaringan.
   * Mengembalikan true bila sesi valid dipulihkan.
   */
  async pulihkan(): Promise<boolean> {
    try {
      const token = await penyimpananAman.get(KUNCI_TOKEN);
      const kedaluwarsa = await penyimpananAman.get(KUNCI_KEDALUWARSA);
      const akunJson = await penyimpananAman.get(KUNCI_AKUN);
      if (token == null || token.length === 0) return false;
      if (kedaluwarsa != null) {
        const batas = new Date(kedaluwarsa);
        if (!Number.isNaN(batas.getTime()) && Date.now() > batas.getTime()) {
          await this.keluar();
          return false;
        }
      }
      if (akunJson != null) {
        this.akun = WargaAkun.fromJson(JSON.parse(akunJson) as Record<string, unknown>);
      }
      ApiClient.setAccessToken(token);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Daftar akun baru (POST /api/public/auth/register, tanpa login) lalu
   * LANGSUNG masuk dengan kredensial yang sama — pengguna tidak perlu mengetik
   * ulang di layar terpisah.
   *
   * `nomorLangganan` WAJIB: akun warga selalu lahir tertaut minimal satu nomor
   * langganan, yang otomatis jadi langganan UTAMA (biodatanya tampil di
   * beranda).
   */
  async daftar(input: {
    nama: string;
    email: string;
    password: string;
    nomorLangganan: string;
  }): Promise<WargaAkun> {
    if (ApiConfig.isDemo) {
      return this.masukDemo(input.nama, input.email);
    }
    await ApiClient.post(`${ApiConfig.publicPath}/auth/register`, {
      body: {
        nama: input.nama,
        email: input.email,
        password: input.password,
        nomorLangganan: input.nomorLangganan,
      },
      parse: () => undefined,
    });
    return this.masuk({ identifier: input.email, password: input.password });
  }

  /**
   * Masuk dengan akun yang sudah ada. Pesan gagal dari server SENGAJA seragam
   * (anti user-enumeration) — tampilkan apa adanya.
   */
  async masuk(input: { identifier: string; password: string }): Promise<WargaAkun> {
    if (ApiConfig.isDemo) {
      return this.masukDemo('Warga Demo', input.identifier);
    }
    const data = await ApiClient.post(`${ApiConfig.mobileAuthPath}/login`, {
      body: { identifier: input.identifier, password: input.password },
      parse: (d) => d as Record<string, unknown>,
    });
    const token = (data['accessToken'] as string) ?? '';
    const user = data['user'];
    const profil =
      user != null && typeof user === 'object'
        ? WargaAkun.fromJson(user as Record<string, unknown>)
        : new WargaAkun('', 'Warga');

    ApiClient.setAccessToken(token);
    this.akun = profil;
    await penyimpananAman.set(KUNCI_TOKEN, token);
    const expiresAt = data['expiresAt'];
    if (typeof expiresAt === 'string') {
      await penyimpananAman.set(KUNCI_KEDALUWARSA, expiresAt);
    }
    await penyimpananAman.set(KUNCI_AKUN, JSON.stringify(profil.toJson()));
    return profil;
  }

  async keluar(): Promise<void> {
    this.akun = null;
    ApiClient.setAccessToken(null);
    await penyimpananAman.hapus(KUNCI_TOKEN);
    await penyimpananAman.hapus(KUNCI_KEDALUWARSA);
    await penyimpananAman.hapus(KUNCI_AKUN);
  }

  /**
   * Mode demo: tidak ada backend untuk menukar token, tapi seluruh alur UI
   * tetap harus bisa dijajal. Sesi demo TIDAK ditulis ke secure storage —
   * hilang saat app ditutup, tidak mencemari sesi asli.
   */
  private async masukDemo(nama: string, email?: string | null): Promise<WargaAkun> {
    await new Promise((r) => setTimeout(r, 400));
    const profil = new WargaAkun('demo-warga', nama, email ?? null);
    this.akun = profil;
    return profil;
  }
}

/** Singleton — padanan `SesiWarga.instance` di Dart. */
export const SesiWarga = new SesiWargaImpl();
export type SesiWarga = SesiWargaImpl;
