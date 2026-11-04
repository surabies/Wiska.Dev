/**
 * laporan-repository.ts — sumber data "Laporan Saya" + cache (padanan
 * features/public/akun/laporan_saya_repository.dart).
 *
 * GET /api/v1/pengaduan/saya — tiket yang DIBUAT akun warga yang login (dibuka
 * untuk role USER). `LaporanSayaCache` = cache satu-kali-per-sesi; tiket yang
 * sama dibaca dua tempat (blok Tiket Aktif beranda + layar Laporan Saya).
 * Di-reset saat sesi berubah (masuk/keluar) & saat pengaduan baru dikirim.
 */
import { ApiClient, ApiConfig, ComplaintTicketModel, SlaInfo } from '@workspace/mobile-core';

export interface LaporanSayaRepository {
  ambil(): Promise<ComplaintTicketModel[]>;
}

class ApiLaporanSayaRepository implements LaporanSayaRepository {
  async ambil(): Promise<ComplaintTicketModel[]> {
    const hasil = await ApiClient.getList(`${ApiConfig.v1Path}/pengaduan/saya`, {
      query: { pageSize: 50 },
      parseRow: ComplaintTicketModel.fromJson,
    });
    return hasil.rows;
  }
}

class DemoLaporanSayaRepository implements LaporanSayaRepository {
  async ambil(): Promise<ComplaintTicketModel[]> {
    await new Promise((r) => setTimeout(r, 500));
    const now = Date.now();
    const jam = (h: number) => new Date(now + h * 3600 * 1000);
    return [
      new ComplaintTicketModel(
        'saya-1',
        'TW-2607-D3M0AK',
        'TIDAK_ADA_AIR',
        'Air mati sejak semalam (demo)',
        '',
        'DITUGASKAN',
        'TINGGI',
        'Warga Demo',
        null,
        null,
        null,
        null,
        jam(-5),
        new SlaInfo(null, jam(19), 19 * 60),
        [],
        'Petugas Demo',
      ),
      new ComplaintTicketModel(
        'saya-2',
        'TW-2606-P0LKA1',
        'PENCATATAN_METER_TIDAK_SESUAI',
        'Angka meter tidak berputar (demo)',
        '',
        'DITUTUP',
        'NORMAL',
        'Warga Demo',
        null,
        null,
        null,
        null,
        new Date(now - 12 * 24 * 3600 * 1000),
      ),
    ];
  }
}

export function buatLaporanSayaRepository(): LaporanSayaRepository {
  return ApiConfig.isDemo ? new DemoLaporanSayaRepository() : new ApiLaporanSayaRepository();
}

let cacheData: ComplaintTicketModel[] | null = null;

export const LaporanSayaCache = {
  get data(): ComplaintTicketModel[] | null {
    return cacheData;
  },

  /**
   * Tiket yang MASIH BERJALAN — yang pantas menempati ruang di beranda.
   * DITUTUP/DITOLAK tinggal di layar Laporan Saya saja.
   */
  get aktif(): ComplaintTicketModel[] {
    return (cacheData ?? []).filter((t) => t.status !== 'DITUTUP' && t.status !== 'DITOLAK');
  },

  async muat(paksa = false): Promise<ComplaintTicketModel[]> {
    if (!paksa && cacheData != null) return cacheData;
    cacheData = await buatLaporanSayaRepository().ambil();
    return cacheData;
  },

  reset(): void {
    cacheData = null;
  },
};
