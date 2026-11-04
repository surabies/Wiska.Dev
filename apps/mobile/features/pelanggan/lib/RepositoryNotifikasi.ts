/**
 * repository.ts — inbox notifikasi in-app petugas. Padanan bagian inbox
 * `core/services/notifikasi_service.dart`.
 *
 * PENDAFTARAN TOKEN PUSH TIDAK DIPORT. Versi Flutter mendaftarkan token
 * Firebase ke `POST /perangkat/token`; di sini push belum dipasang karena
 * butuh kredensial FCM/APNs dan build development client tersendiri. Inbox-nya
 * tetap berfungsi penuh — ia dibaca dari server, bukan dari push. Endpoint
 * `/perangkat/token` sudah ada di backend dan tinggal dipanggil begitu push
 * dikonfigurasi.
 */
import { ApiClient, ApiConfig } from '@workspace/mobile-core';

export interface Notifikasi {
  id: string;
  judul: string;
  isi: string;
  jenis: string | null;
  dibaca: boolean;
  createdAt: Date | null;
}

type Json = Record<string, unknown>;

function dariJson(json: Json): Notifikasi {
  const teks = (v: unknown) => (typeof v === 'string' ? v : null);
  const waktu = teks(json['createdAt']);
  const d = waktu == null ? null : new Date(waktu);
  return {
    id: teks(json['id']) ?? '',
    judul: teks(json['judul']) ?? '(tanpa judul)',
    isi: teks(json['isi']) ?? teks(json['pesan']) ?? '',
    jenis: teks(json['jenis']),
    // Server bisa menandai terbaca lewat `dibaca` atau `readAt`; keduanya
    // diterima supaya layar tidak bergantung pada satu bentuk saja.
    dibaca: json['dibaca'] === true || teks(json['readAt']) != null,
    createdAt: d != null && !Number.isNaN(d.getTime()) ? d : null,
  };
}

export async function daftarNotifikasi(): Promise<Notifikasi[]> {
  const hasil = await ApiClient.getList(`${ApiConfig.v1Path}/notifikasi`, {
    query: { pageSize: 100 },
    parseRow: dariJson,
  });
  return hasil.rows;
}

export function tandaiDibaca(id: string): Promise<void> {
  return ApiClient.patch(`${ApiConfig.v1Path}/notifikasi/${id}/baca`, {
    parse: () => undefined,
  });
}

export function tandaiSemuaDibaca(): Promise<void> {
  return ApiClient.post(`${ApiConfig.v1Path}/notifikasi/baca-semua`, {
    parse: () => undefined,
  });
}
