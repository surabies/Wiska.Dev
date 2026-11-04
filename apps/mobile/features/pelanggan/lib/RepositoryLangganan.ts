/**
 * repository.ts — langganan tertaut akun warga (padanan
 * features/public/langganan/langganan_warga_repository.dart).
 *
 * Berisi model (LanggananWargaModel, PelangganRingkas), repository (API /v1
 * yang wajib token, + demo), dan `LanggananSayaCache` — cache in-memory yang
 * dipakai layar lain (Cek Tagihan/Lapor Meter/Pengaduan) untuk prefill nomor
 * UTAMA secara sinkron tanpa menunggu jaringan.
 */
import { ApiClient, ApiConfig, ApiException } from '@workspace/mobile-core';

type Json = Record<string, unknown>;

/** Satu nomor langganan tertaut akun (GET /api/v1/langganan-saya). */
export class LanggananWargaModel {
  constructor(
    readonly id: string,
    readonly isUtama: boolean,
    readonly nomorLangganan: string,
    readonly nama: string,
    readonly alamat: string,
    readonly rt: string | null,
    readonly rw: string | null,
    readonly status: string,
    readonly golonganKode: string | null,
    readonly golonganKategori: string | null,
    readonly jumlahTagihanBelumBayar: number,
    readonly totalTunggakan: number,
  ) {}

  get alamatLengkap(): string {
    const rtRw = [
      this.rt ? `RT ${this.rt}` : null,
      this.rw ? `RW ${this.rw}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    return rtRw.length === 0 ? this.alamat : `${this.alamat} ${rtRw}`;
  }

  static fromJson(json: Json): LanggananWargaModel {
    const golongan = json['tarifGolongan'];
    const g = golongan != null && typeof golongan === 'object' ? (golongan as Json) : null;
    return new LanggananWargaModel(
      (json['id'] as string) ?? '',
      json['isUtama'] === true,
      (json['nomorLangganan'] as string) ?? '',
      (json['nama'] as string) ?? '',
      (json['alamat'] as string) ?? '',
      (json['rt'] as string) ?? null,
      (json['rw'] as string) ?? null,
      (json['status'] as string) ?? 'AKTIF',
      g ? ((g['kodeAsli'] as string) ?? null) : null,
      g ? ((g['kategori'] as string) ?? null) : null,
      typeof json['jumlahTagihanBelumBayar'] === 'number' ? Math.trunc(json['jumlahTagihanBelumBayar']) : 0,
      typeof json['totalTunggakan'] === 'number' ? json['totalTunggakan'] : 0,
    );
  }

  copyWith(patch: { isUtama?: boolean }): LanggananWargaModel {
    return new LanggananWargaModel(
      this.id,
      patch.isUtama ?? this.isUtama,
      this.nomorLangganan,
      this.nama,
      this.alamat,
      this.rt,
      this.rw,
      this.status,
      this.golonganKode,
      this.golonganKategori,
      this.jumlahTagihanBelumBayar,
      this.totalTunggakan,
    );
  }
}

/** Identitas ringkas (GET /api/public/pelanggan/:nomorLangganan) untuk pratinjau. */
export class PelangganRingkas {
  constructor(
    readonly nomorLangganan: string,
    readonly nama: string,
    readonly alamat: string,
    readonly status: string,
  ) {}

  static fromJson(json: Json): PelangganRingkas {
    return new PelangganRingkas(
      (json['nomorLangganan'] as string) ?? '',
      (json['nama'] as string) ?? '',
      (json['alamat'] as string) ?? '',
      (json['status'] as string) ?? 'AKTIF',
    );
  }
}

export interface LanggananWargaRepository {
  ambil(): Promise<LanggananWargaModel[]>;
  tambah(nomorLangganan: string): Promise<LanggananWargaModel>;
  hapus(id: string): Promise<void>;
  jadikanUtama(id: string): Promise<void>;
  pratinjau(nomorLangganan: string): Promise<PelangganRingkas>;
}

const V1_PATH = `${ApiConfig.v1Path}/langganan-saya`;

class ApiLanggananWargaRepository implements LanggananWargaRepository {
  ambil(): Promise<LanggananWargaModel[]> {
    return ApiClient.get(V1_PATH, {
      parse: (data) =>
        Array.isArray(data)
          ? data.filter((x): x is Json => x != null && typeof x === 'object').map(LanggananWargaModel.fromJson)
          : [],
    });
  }

  tambah(nomorLangganan: string): Promise<LanggananWargaModel> {
    return ApiClient.post(V1_PATH, {
      body: { nomorLangganan },
      parse: (data) => LanggananWargaModel.fromJson((data as Json) ?? {}),
    });
  }

  hapus(id: string): Promise<void> {
    return ApiClient.delete(`${V1_PATH}/${id}`, { parse: () => undefined });
  }

  jadikanUtama(id: string): Promise<void> {
    return ApiClient.patch(`${V1_PATH}/${id}/utama`, { parse: () => undefined });
  }

  pratinjau(nomorLangganan: string): Promise<PelangganRingkas> {
    return ApiClient.get(`${ApiConfig.publicPath}/pelanggan/${nomorLangganan}`, {
      parse: (data) => PelangganRingkas.fromJson((data as Json) ?? {}),
    });
  }
}

/** Demo: daftar in-memory yang bisa ditambah/dihapus (bertahan satu sesi app). */
class DemoLanggananWargaRepository implements LanggananWargaRepository {
  private static data: LanggananWargaModel[] = [
    new LanggananWargaModel('demo-1', true, '00000100119', 'Warga Demo', 'Jl. Bada************', '003', '005', 'AKTIF', '2A1', 'RUMAH_TANGGA', 1, 78500),
  ];
  private static urut = 1;

  async ambil(): Promise<LanggananWargaModel[]> {
    await tunda(400);
    return [...DemoLanggananWargaRepository.data];
  }

  async tambah(nomorLangganan: string): Promise<LanggananWargaModel> {
    await tunda(500);
    const D = DemoLanggananWargaRepository;
    if (D.data.some((l) => l.nomorLangganan === nomorLangganan)) {
      throw new ApiException(409, 'CONFLICT', 'Nomor langganan ini sudah tertaut ke akun Anda.');
    }
    const baru = new LanggananWargaModel(
      `demo-baru-${D.urut++}`,
      D.data.length === 0,
      nomorLangganan,
      'Pelanggan Demo Tambahan',
      'Jl. Cont************',
      null,
      null,
      'AKTIF',
      '2A2',
      'RUMAH_TANGGA',
      0,
      0,
    );
    D.data.push(baru);
    return baru;
  }

  async hapus(id: string): Promise<void> {
    await tunda(300);
    const D = DemoLanggananWargaRepository;
    if (D.data.length <= 1) {
      throw new ApiException(
        400,
        'BAD_REQUEST',
        'Nomor langganan terakhir tidak bisa dihapus — akun warga harus tetap tertaut ke minimal satu langganan.',
      );
    }
    const idx = D.data.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const utama = D.data[idx].isUtama;
    D.data.splice(idx, 1);
    if (utama && D.data.length > 0) D.gantiUtama(D.data[0].id);
  }

  async jadikanUtama(id: string): Promise<void> {
    await tunda(300);
    DemoLanggananWargaRepository.gantiUtama(id);
  }

  private static gantiUtama(id: string): void {
    DemoLanggananWargaRepository.data = DemoLanggananWargaRepository.data.map((l) =>
      l.copyWith({ isUtama: l.id === id }),
    );
  }

  async pratinjau(nomorLangganan: string): Promise<PelangganRingkas> {
    await tunda(400);
    if (nomorLangganan !== '00000100119' && !nomorLangganan.startsWith('000002')) {
      throw new ApiException(404, 'VERIFIKASI_GAGAL', 'Nomor langganan tidak ditemukan. Periksa kembali nomor Anda.');
    }
    return new PelangganRingkas(
      nomorLangganan,
      nomorLangganan === '00000100119' ? 'Warga Demo' : 'Pelanggan Demo Tambahan',
      'Jl. Bada************',
      'AKTIF',
    );
  }
}

const tunda = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buatLanggananWargaRepository(): LanggananWargaRepository {
  return ApiConfig.isDemo ? new DemoLanggananWargaRepository() : new ApiLanggananWargaRepository();
}

/**
 * Cache in-memory daftar langganan akun yang login — supaya kartu biodata
 * beranda tidak refetch tiap pindah tab, dan layar lain bisa prefill nomor
 * utama SECARA SINKRON. Direset saat keluar/ganti sesi.
 */
let cacheData: LanggananWargaModel[] | null = null;
const pendengar = new Set<() => void>();

export const LanggananSayaCache = {
  get data(): LanggananWargaModel[] | null {
    return cacheData;
  },

  /** Langganan utama (fallback: baris pertama) — nilai prefill formulir. */
  get utama(): LanggananWargaModel | null {
    if (cacheData == null || cacheData.length === 0) return null;
    return cacheData.find((l) => l.isUtama) ?? cacheData[0];
  },

  async muat(paksa = false): Promise<LanggananWargaModel[]> {
    if (!paksa && cacheData != null) return cacheData;
    cacheData = await buatLanggananWargaRepository().ambil();
    for (const l of pendengar) l();
    return cacheData;
  },

  set(data: LanggananWargaModel[]): void {
    cacheData = data;
    for (const l of pendengar) l();
  },

  reset(): void {
    cacheData = null;
    for (const l of pendengar) l();
  },

  subscribe(listener: () => void): () => void {
    pendengar.add(listener);
    return () => pendengar.delete(listener);
  },
};
