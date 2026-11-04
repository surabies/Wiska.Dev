/**
 * sesi-petugas.ts — padanan `core/auth/sesi_petugas.dart`.
 *
 * Sesi login aplikasi PETUGAS — satu-satunya pemegang Bearer token. Berbeda
 * dari [SesiWarga] di aplikasi publik, login di sini WAJIB: tanpa token tidak
 * ada rute untuk dibaca, jadi akar aplikasi mengarahkan ke layar masuk.
 *
 * Kunci penyimpanan sengaja BERBEDA dari milik warga (`petugas*`). Kedua
 * aplikasi bisa terpasang di satu perangkat, dan kunci yang sama akan membuat
 * yang satu menendang sesi yang lain.
 *
 * Umur token 7 hari tanpa refresh: [pulihkan] menolak token yang sudah lewat
 * `expiresAt`, dan 401 dari server mana pun memicu `ApiClient.onUnauthorized`.
 */
import { ApiClient } from '../network/api-client';
import { ApiConfig } from '../network/api-config';
import { penyimpananAman } from './storage';

const KUNCI_TOKEN = 'petugasAccessToken';
const KUNCI_KEDALUWARSA = 'petugasExpiresAt';
const KUNCI_AKUN = 'petugasAkun';

/** Peran yang boleh memakai aplikasi petugas (cermin ROLE_GROUPS.LAPANGAN). */
const ROLE_LAPANGAN = new Set([
  'SUPER_ADMIN',
  'DIREKSI',
  'SENIOR_MANAGER',
  'MANAGER',
  'SUPERVISOR',
  'STAFF',
  'PELAKSANA',
]);

/** Akun petugas hasil login (subset payload /api/mobile/auth/login). */
export class PetugasAkun {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string | null = null,
    readonly role: string = 'STAFF',
  ) {}

  static fromJson(json: Record<string, unknown>): PetugasAkun {
    return new PetugasAkun(
      (json['id'] as string) ?? '',
      (json['name'] as string) ?? 'Petugas',
      (json['email'] as string) ?? null,
      (json['role'] as string) ?? 'STAFF',
    );
  }

  toJson(): Record<string, unknown> {
    return { id: this.id, name: this.name, email: this.email, role: this.role };
  }

  /** Peran lapangan — penentu apakah akun ini punya urusan di aplikasi ini. */
  get bolehLapangan(): boolean {
    return ROLE_LAPANGAN.has(this.role);
  }
}

class SesiPetugasImpl {
  akun: PetugasAkun | null = null;

  get sudahMasuk(): boolean {
    return this.akun != null;
  }

  /**
   * Pulihkan sesi tersimpan saat aplikasi dibuka. TIDAK memanggil jaringan —
   * petugas lapangan harus tetap bisa membuka aplikasi (dan rute yang sudah
   * ter-cache) tanpa sinyal. Validasi sesungguhnya terjadi alami pada request
   * pertama yang berhasil menembus jaringan (401 → sesi berakhir).
   */
  async pulihkan(): Promise<boolean> {
    try {
      const token = await penyimpananAman.get(KUNCI_TOKEN);
      if (token == null || token.length === 0) return false;

      const kedaluwarsa = await penyimpananAman.get(KUNCI_KEDALUWARSA);
      if (kedaluwarsa != null) {
        const batas = new Date(kedaluwarsa);
        if (!Number.isNaN(batas.getTime()) && Date.now() > batas.getTime()) {
          await this.keluar();
          return false;
        }
      }

      const akunJson = await penyimpananAman.get(KUNCI_AKUN);
      if (akunJson != null) {
        this.akun = PetugasAkun.fromJson(JSON.parse(akunJson) as Record<string, unknown>);
      }
      ApiClient.setAccessToken(token);
      return true;
    } catch {
      // Keystore rusak/tak tersedia dianggap belum login — jangan sampai
      // pintu masuk aplikasi yang crash.
      return false;
    }
  }

  /**
   * Masuk dengan username/email + password. Pesan gagal dari server SENGAJA
   * seragam (anti user-enumeration) — tampilkan apa adanya, jangan menebak
   * sebabnya untuk pengguna.
   */
  async masuk(input: { identifier: string; password: string }): Promise<PetugasAkun> {
    if (ApiConfig.isDemo) {
      return this.masukDemo(input.identifier);
    }
    const data = await ApiClient.post(`${ApiConfig.mobileAuthPath}/login`, {
      body: { identifier: input.identifier, password: input.password },
      parse: (d) => d as Record<string, unknown>,
    });
    const token = (data['accessToken'] as string) ?? '';
    const user = data['user'];
    const profil =
      user != null && typeof user === 'object'
        ? PetugasAkun.fromJson(user as Record<string, unknown>)
        : new PetugasAkun('', 'Petugas');

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

  /**
   * Keluar. Hanya token & profil yang dihapus — paket rute dan ANTREAN
   * UPLOAD tetap tinggal di perangkat. Menghapusnya di sini berarti membuang
   * hasil kerja yang belum terunggah hanya karena petugas menekan "keluar";
   * pembersihan data lokal adalah keputusan terpisah dan disengaja.
   */
  async keluar(): Promise<void> {
    this.akun = null;
    ApiClient.setAccessToken(null);
    await penyimpananAman.hapus(KUNCI_TOKEN);
    await penyimpananAman.hapus(KUNCI_KEDALUWARSA);
    await penyimpananAman.hapus(KUNCI_AKUN);
  }

  /**
   * Mode demo: tidak ada backend untuk menukar token, tapi seluruh alur UI
   * tetap harus bisa dijajal. Sesi demo TIDAK ditulis ke penyimpanan aman —
   * hilang saat aplikasi ditutup, tidak mencemari sesi asli.
   */
  private async masukDemo(identifier: string): Promise<PetugasAkun> {
    await new Promise((r) => setTimeout(r, 400));
    const profil = new PetugasAkun('demo-petugas', 'Petugas Demo', identifier, 'STAFF');
    this.akun = profil;
    return profil;
  }
}

/** Singleton — padanan `SesiPetugas.instance` di Dart. */
export const SesiPetugas = new SesiPetugasImpl();
export type SesiPetugas = SesiPetugasImpl;
