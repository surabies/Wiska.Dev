/**
 * repository.ts — sumber data layar Cek Tagihan (padanan
 * features/public/cek_tagihan/cek_tagihan_repository.dart).
 *
 * `buatCekTagihanRepository()` memilih implementasi: mode demo (data contoh
 * in-memory) bila `EXPO_PUBLIC_DEMO=true`, selain itu menembak backend.
 */
import {
  ApiClient,
  ApiConfig,
  ApiException,
  BillModel,
  CekTagihanResult,
  CustomerInfo,
  dateDariThbl,
} from '@workspace/mobile-core';

export interface CekTagihanRepository {
  /**
   * Verifikasi identitas cukup nomor langganan PERSIS 11 digit (exact match).
   * Pesan gagal dari server sengaja seragam untuk nomor tak dikenal — jangan
   * membeda-bedakan sebabnya di UI.
   */
  cekTagihan(nomorLangganan: string): Promise<CekTagihanResult>;
}

class ApiCekTagihanRepository implements CekTagihanRepository {
  cekTagihan(nomorLangganan: string): Promise<CekTagihanResult> {
    return ApiClient.post(`${ApiConfig.publicPath}/cek-tagihan`, {
      body: { nomorLangganan },
      parse: (data) => CekTagihanResult.fromJson((data as Record<string, unknown>) ?? {}),
    });
  }
}

/** Data contoh: nomor langganan demo `00000100119`. */
class DemoCekTagihanRepository implements CekTagihanRepository {
  static readonly nomorDemo = '00000100119';

  async cekTagihan(nomorLangganan: string): Promise<CekTagihanResult> {
    await new Promise((r) => setTimeout(r, 600));
    if (nomorLangganan !== DemoCekTagihanRepository.nomorDemo) {
      // Meniru pesan seragam server.
      throw new ApiException(
        404,
        'NOT_FOUND',
        'Data pelanggan tidak ditemukan. Periksa kembali nomor langganan Anda.',
      );
    }

    const sekarang = new Date();
    // Bulan berjalan dalam thbl (komponen LOKAL, seperti DateTime(y, m) di Dart).
    const bulanIni = sekarang.getFullYear() * 100 + (sekarang.getMonth() + 1);

    const periodeMundur = (n: number): number => {
      const d = dateDariThbl(bulanIni);
      const mundur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
      return mundur.getUTCFullYear() * 100 + (mundur.getUTCMonth() + 1);
    };

    const tagihan = (mundur: number, pemakaian: number, status: string): BillModel => {
      const periode = periodeMundur(mundur);
      const hargaAir = pemakaian * 7200;
      const total = hargaAir + 25000 + 5000 + Math.trunc((hargaAir * 25) / 100);
      const awalBulan = dateDariThbl(periode);
      return new BillModel({
        periode,
        status,
        totalTagihan: total,
        pemakaianM3: pemakaian,
        jmlHargaAir: hargaAir,
        beaBeban: 25000,
        beaAdmin: 5000,
        airKotor: Math.trunc((hargaAir * 25) / 100),
        lainLain: 0,
        denda: status === 'JATUH_TEMPO' ? 10000 : 0,
        tanggalJatuhTempo: new Date(
          Date.UTC(awalBulan.getUTCFullYear(), awalBulan.getUTCMonth() + 1, 20),
        ),
        tanggalBayar:
          status === 'SUDAH_BAYAR'
            ? new Date(Date.UTC(awalBulan.getUTCFullYear(), awalBulan.getUTCMonth() + 1, 12))
            : null,
        standLalu: 1180 - pemakaian * (mundur + 1),
        standAkhir: 1180 - pemakaian * mundur,
      });
    };

    const daftar = [
      tagihan(0, 18, 'BELUM_BAYAR'),
      tagihan(1, 21, 'JATUH_TEMPO'),
      tagihan(2, 17, 'SUDAH_BAYAR'),
      tagihan(3, 19, 'SUDAH_BAYAR'),
      tagihan(4, 16, 'SUDAH_BAYAR'),
      tagihan(5, 20, 'SUDAH_BAYAR'),
    ];

    return new CekTagihanResult(
      new CustomerInfo(
        DemoCekTagihanRepository.nomorDemo,
        'ASEP SURYADI',
        'Jl. Badak Singa No. ** (disamarkan)',
        '03',
        '05',
        'AKTIF',
        '2A2',
      ),
      daftar,
      daftar.filter((t) => t.menunggak).reduce((n, t) => n + t.totalTagihan, 0),
    );
  }
}

export function buatCekTagihanRepository(): CekTagihanRepository {
  return ApiConfig.isDemo ? new DemoCekTagihanRepository() : new ApiCekTagihanRepository();
}
