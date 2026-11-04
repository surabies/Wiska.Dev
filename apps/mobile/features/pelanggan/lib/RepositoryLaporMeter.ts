/**
 * repository.ts — sumber data Lapor Meter Mandiri (padanan
 * features/public/lapor_meter/lapor_meter_repository.dart).
 *
 * Laporan SELALU masuk berstatus MENUNGGU; periode ditentukan server (bulan
 * berjalan). Server MEWAJIBKAN foto meter (menolak 400 tanpa field `foto`) —
 * digagalkan lebih awal di sini dengan pesan sama supaya pengguna tak menunggu
 * upload yang pasti ditolak. Foto dikirim sebagai berkas multipart (uri).
 */
import { Platform } from 'react-native';
import { jendelaLaporMandiri } from '@workspace/domain/lapor-mandiri';
import { ApiClient, ApiConfig, ApiException, LaporMeterReceipt, thblDariDate } from '@workspace/mobile-core';

export interface KirimLaporMeterInput {
  nomorLangganan: string;
  standDilaporkan: number;
  namaPelapor: string;
  nomorPelapor: string;
  /** URI foto meter yang sudah dikompres. Wajib. */
  fotoUri: string | null;
  /** Koordinat GPS saat laporan dibuat, untuk deteksi anomali lokasi oleh petugas. Opsional — dikirim jika izin lokasi diberikan. */
  latitude: number | null;
  longitude: number | null;
}

export interface LaporMeterRepository {
  kirim(input: KirimLaporMeterInput): Promise<LaporMeterReceipt>;
}

class ApiLaporMeterRepository implements LaporMeterRepository {
  async kirim(input: KirimLaporMeterInput): Promise<LaporMeterReceipt> {
    // Jendela tanggal 1-25 digagalkan lebih awal di sini, pola yang sama
    // dengan pemeriksaan foto di bawah: server menolak dengan kalimat yang
    // SAMA PERSIS, dan menunggu unggahan foto selesai hanya untuk ditolak
    // memboroskan kuota data warga. Yang MENEGAKKAN aturan tetap server —
    // jam perangkat bisa saja diubah.
    const jendela = jendelaLaporMandiri();
    if (!jendela.boleh) {
      throw new ApiException(400, 'BAD_REQUEST', jendela.pesan);
    }
    if (input.fotoUri == null) {
      throw new ApiException(400, 'BAD_REQUEST', 'Foto meter wajib dilampirkan sebagai bukti.');
    }
    const form = new FormData();
    form.append('nomorLangganan', input.nomorLangganan);
    form.append('standDilaporkan', String(input.standDilaporkan));
    form.append('namaPelapor', input.namaPelapor);
    form.append('nomorPelapor', input.nomorPelapor);
    if (input.latitude != null && input.longitude != null) {
      form.append('latitude', String(input.latitude));
      form.append('longitude', String(input.longitude));
    }
    form.append('foto', await lampiranFoto(input.fotoUri));

    return ApiClient.postMultipart(`${ApiConfig.publicPath}/lapor-meter`, {
      form,
      parse: (data) => LaporMeterReceipt.fromJson((data as Record<string, unknown>) ?? {}),
    });
  }
}

/**
 * Bentuk lampiran `foto` berbeda antara web dan native:
 * - Native (iOS/Android): FormData RN menerima objek `{ uri, name, type }`
 *   dan menanganinya sendiri sebagai file upload.
 * - Web (Expo web): FormData adalah implementasi browser standar — objek
 *   `{ uri, name, type }` TIDAK dikenali sebagai file, cuma di-`toString()`
 *   jadi "[object Object]", sehingga server selalu melihat field `foto`
 *   kosong dan menolak 400 walau pengguna sudah memilih foto. Di web, `uri`
 *   perlu di-fetch dulu jadi Blob asli sebelum di-append.
 */
async function lampiranFoto(uri: string): Promise<Blob> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.blob();
  }
  return { uri, name: 'meter.jpg', type: 'image/jpeg' } as unknown as Blob;
}

class DemoLaporMeterRepository implements LaporMeterRepository {
  async kirim(input: KirimLaporMeterInput): Promise<LaporMeterReceipt> {
    // input.latitude / input.longitude diabaikan di mode demo, tapi tetap
    // divalidasi lewat type checking agar tidak drift dari ApiLaporMeterRepository.
    await new Promise((r) => setTimeout(r, 700));
    const now = new Date();
    return new LaporMeterReceipt(
      thblDariDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))),
      input.standDilaporkan,
      'MENUNGGU',
      'Laporan meter Anda terkirim dan sedang menunggu verifikasi petugas.',
    );
  }
}

export function buatLaporMeterRepository(): LaporMeterRepository {
  return ApiConfig.isDemo ? new DemoLaporMeterRepository() : new ApiLaporMeterRepository();
}