/**
 * SesiPengguna.ts — Manajemen sesi pengguna terpadu untuk aplikasi mobile.
 * Mendukung seluruh peran: Petugas Pencatat, Teknisi Gangguan, Supervisor, Warga, dan Tamu.
 *
 * Menggantikan dikotomi SesiPetugas vs SesiWarga menjadi satu sesi terpadu,
 * sekaligus tetap menyinkronkan ke instance warisan agar repositori yang ada tetap berfungsi.
 */
import { useSyncExternalStore } from 'react';
import {
  ApiClient,
  ApiConfig,
  PetugasAkun,
  SesiPetugas,
  SesiWarga,
  WargaAkun,
  penyimpananAman,
} from '@workspace/mobile-core';
import { MasterPalette as P } from '@/components/theme/Palette';
import { langgananSesi, tandaiSesiBerubah, useSesiVersi } from './SesiStore';

const KUNCI_TOKEN = 'sesiAccessToken';
const KUNCI_KEDALUWARSA = 'sesiExpiresAt';
const KUNCI_PENGGUNA = 'sesiPenggunaProfil';

export type TipePeran = 'PENCATAT' | 'TEKNISI' | 'SUPERVISOR' | 'WARGA' | 'TAMU';

export interface ProfilPengguna {
  id: string;
  name: string;
  email: string | null;
  role: string;
  nik?: string | null;
  nip?: string | null;
  nomorPelanggan?: string | null;
  jenisAkun?: 'PETUGAS' | 'PELANGGAN' | null;
  jabatan?: string | null;
  telepon?: string | null;
  divisiKode?: string | null;
  subBagianKode?: string | null;
}

export interface InfoPeran {
  tipe: TipePeran;
  label: string;
  sublabel: string;
  gradasi: [string, string];
  tinta: string;
  latar: string;
}

function tentukanPeran(user: ProfilPengguna | null): InfoPeran {
  if (!user) {
    return {
      tipe: 'TAMU',
      label: 'Tamu / Pengunjung',
      sublabel: 'Akses publik terbatas',
      gradasi: [P.slate600, P.slate800],
      tinta: P.slate300,
      latar: P.slate900,
    };
  }

  const role = (user.role ?? '').toUpperCase();
  const subBagianKode = (user.subBagianKode ?? '').toUpperCase();
  const divisiKode = (user.divisiKode ?? '').toUpperCase();
  const jenisAkun = user.jenisAkun;
  const nama = (user.name ?? '').toLowerCase();
  const email = (user.email ?? '').toLowerCase();
  const jabatan = (user.jabatan ?? '').toLowerCase();

  // Warga / Pelanggan jika jenisAkun === PELANGGAN atau role USER tanpa NIP/jabatan petugas
  if (jenisAkun === 'PELANGGAN' || (role === 'USER' && !user.nip)) {
    return {
      tipe: 'WARGA',
      label: user.nomorPelanggan ? `Pelanggan #${user.nomorPelanggan}` : 'Pelanggan Tirtawening',
      sublabel: user.name || 'Layanan Rekening & Mandiri',
      gradasi: [P.sky, P.sky700],
      tinta: P.sky200,
      latar: P.sky900,
    };
  }

  if (role === 'SUPERVISOR' || role === 'SUPER_ADMIN' || role === 'MANAGER' || role === 'SENIOR_MANAGER' || role === 'DIREKSI') {
    const labelEksekutif =
      role === 'DIREKSI'
        ? 'Direksi Perumda'
        : role === 'SENIOR_MANAGER'
        ? 'Senior Manager'
        : role === 'MANAGER'
        ? 'Manager Operasional'
        : role === 'SUPER_ADMIN'
        ? 'Super Admin'
        : 'Supervisor Operasional';

    return {
      tipe: 'SUPERVISOR',
      label: labelEksekutif,
      sublabel: user.jabatan ?? 'Pengawasan Catat & Operasional',
      gradasi: role === 'SUPERVISOR' ? [P.teal600, P.teal900] : [P.sky600, P.sky950],
      tinta: role === 'SUPERVISOR' ? P.teal : P.sky300,
      latar: role === 'SUPERVISOR' ? P.teal900 : P.sky950,
    };
  }

  // Teknisi / Distribusi / Perpipaan berdasarkan Sub Bagian & Divisi
  if (
    subBagianKode.includes('PERPI') ||
    subBagianKode.includes('PROD') ||
    subBagianKode.includes('MEKANIK') ||
    divisiKode === 'TEHNIK' ||
    email.includes('teknisi') ||
    nama.includes('teknisi') ||
    jabatan.includes('teknisi') ||
    jabatan.includes('perpipaan')
  ) {
    return {
      tipe: 'TEKNISI',
      label: user.jabatan ?? 'Teknisi Gangguan & Distribusi',
      sublabel: 'Penanganan Lapangan & SLA',
      gradasi: [P.rose400, P.rose700],
      tinta: P.rose300,
      latar: P.rose900,
    };
  }

  // Petugas Pembaca Meter (Pelaksana Divisi Pelayanan / Cater)
  return {
    tipe: 'PENCATAT',
    label: user.jabatan ?? 'Petugas Pembaca Meter',
    sublabel: user.nip ? `NIP: ${user.nip} • ${user.subBagianKode ?? 'Wilayah 4'}` : 'Pembacaan Meter Lapangan',
    gradasi: [P.teal, P.teal700],
    tinta: P.teal100,
    latar: P.teal900,
  };
}

class SesiPenggunaImpl {
  profil: ProfilPengguna | null = null;
  token: string | null = null;

  get sudahMasuk(): boolean {
    return this.profil != null && this.token != null;
  }

  get peran(): InfoPeran {
    return tentukanPeran(this.profil);
  }

  /**
   * Pulihkan sesi tersimpan saat aplikasi dibuka.
   */
  async pulihkan(): Promise<boolean> {
    try {
      let token = await penyimpananAman.get(KUNCI_TOKEN);
      let profilJson = await penyimpananAman.get(KUNCI_PENGGUNA);

      // Cek apakah ada sesi warisan dari SesiPetugas atau SesiWarga
      if (!token) {
        token = (await penyimpananAman.get('petugasAccessToken')) ?? (await penyimpananAman.get('wargaAccessToken'));
      }
      if (!profilJson) {
        profilJson = (await penyimpananAman.get('petugasAkun')) ?? (await penyimpananAman.get('wargaAkun'));
      }

      if (!token || !profilJson) {
        this.profil = null;
        this.token = null;
        return false;
      }

      const kedaluwarsa = await penyimpananAman.get(KUNCI_KEDALUWARSA);
      if (kedaluwarsa) {
        const batas = new Date(kedaluwarsa);
        if (!Number.isNaN(batas.getTime()) && Date.now() > batas.getTime()) {
          await this.keluar();
          return false;
        }
      }

      const profil = JSON.parse(profilJson) as ProfilPengguna;
      this.token = token;
      this.profil = profil;

      ApiClient.setAccessToken(token);

      // Sinkronkan ke modul warisan
      this.sinkronkanKeWarisan(token, profil);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Masuk satu pintu untuk semua jenis akun (pencatat, teknisi, supervisor, warga).
   */
  async masuk(input: { identifier: string; password: string }): Promise<ProfilPengguna> {
    const data = await ApiClient.post(`${ApiConfig.mobileAuthPath}/login`, {
      body: { identifier: input.identifier, password: input.password },
      parse: (d) => d as Record<string, unknown>,
    });

    const token = (data['accessToken'] as string) ?? '';
    const user = data['user'] as Record<string, unknown> | undefined;

    const profil: ProfilPengguna = {
      id: (user?.['id'] as string) ?? '',
      name: (user?.['name'] as string) ?? input.identifier,
      email: (user?.['email'] as string) ?? null,
      role: (user?.['role'] as string) ?? 'USER',
      nik: (user?.['nik'] as string) ?? null,
      nip: (user?.['nip'] as string) ?? null,
      nomorPelanggan: (user?.['nomorPelanggan'] as string) ?? null,
      jenisAkun: (user?.['jenisAkun'] as 'PETUGAS' | 'PELANGGAN') ?? null,
      jabatan: (user?.['jabatan'] as string) ?? null,
      telepon: (user?.['telepon'] as string) ?? null,
      divisiKode: (user?.['divisiKode'] as string) ?? null,
      subBagianKode: (user?.['subBagianKode'] as string) ?? null,
    };

    this.token = token;
    this.profil = profil;

    ApiClient.setAccessToken(token);

    await penyimpananAman.set(KUNCI_TOKEN, token);
    const expiresAt = data['expiresAt'];
    if (typeof expiresAt === 'string') {
      await penyimpananAman.set(KUNCI_KEDALUWARSA, expiresAt);
    }
    await penyimpananAman.set(KUNCI_PENGGUNA, JSON.stringify(profil));

    // Sinkronkan ke warisan
    this.sinkronkanKeWarisan(token, profil);

    tandaiSesiBerubah();
    return profil;
  }

  /**
   * Keluar dan bersihkan semua sesi.
   */
  async keluar(): Promise<void> {
    this.profil = null;
    this.token = null;
    ApiClient.setAccessToken(null);

    await penyimpananAman.hapus(KUNCI_TOKEN);
    await penyimpananAman.hapus(KUNCI_KEDALUWARSA);
    await penyimpananAman.hapus(KUNCI_PENGGUNA);

    await SesiPetugas.keluar().catch(() => {});
    await SesiWarga.keluar().catch(() => {});

    tandaiSesiBerubah();
  }

  private sinkronkanKeWarisan(token: string, profil: ProfilPengguna) {
    try {
      SesiPetugas.akun = new PetugasAkun(profil.id, profil.name, profil.email, profil.role);
      SesiWarga.akun = new WargaAkun(profil.id, profil.name, profil.email);
    } catch {
      // Abaikan bila sinkronisasi gagal
    }
  }
}

export const SesiPengguna = new SesiPenggunaImpl();

/**
 * Hook reaktif untuk mengakses status sesi pengguna di layar mana pun.
 */
export function useSesiPengguna() {
  const versi = useSesiVersi();

  return {
    profil: SesiPengguna.profil,
    sudahMasuk: SesiPengguna.sudahMasuk,
    peran: SesiPengguna.peran,
    versi,
  };
}
