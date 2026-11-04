/**
 * repository.ts — sumber data Lapor Pengaduan & Lacak Tiket (padanan
 * features/public/pengaduan/lapor_pengaduan_repository.dart).
 */
import {
  ApiClient,
  ApiConfig,
  ApiException,
  ComplaintDraft,
  ComplaintReceipt,
  LacakTiketResult,
  SlaInfo,
  TicketTimelineEntry,
} from '@workspace/mobile-core';

export interface LaporPengaduanRepository {
  /**
   * Kirim pengaduan baru. Nomor langganan (bila diisi) TIDAK diverifikasi
   * server. BOCOR_PIPA_DINAS wajib koordinat (server menolak 422 tanpa itu).
   * `fotoUri`/`videoUri` opsional → bila salah satu diisi, dikirim multipart.
   */
  kirim(
    draft: ComplaintDraft,
    media?: { fotoUri?: string | null; videoUri?: string | null },
  ): Promise<ComplaintReceipt>;

  /** Lacak status tiket (nomor tiket = kunci pembawa, tanpa verifikasi lain). */
  lacak(nomorTiket: string): Promise<LacakTiketResult>;

  /** Pelapor konfirmasi selesai + menilai. SELESAI → DITUTUP. */
  konfirmasi(nomorTiket: string, input: { rating: number; komentar?: string }): Promise<string>;

  /** Pelapor menyatakan belum beres. SELESAI → DIBUKA_KEMBALI. */
  bukaKembali(nomorTiket: string, alasan: string): Promise<string>;

  /** Kirim pesan CHAT ke petugas pada thread tiket. */
  kirimChat(nomorTiket: string, pesan: string): Promise<void>;
}

const jalur = (nomorTiket: string) =>
  `${ApiConfig.publicPath}/pengaduan/${nomorTiket.trim().toUpperCase()}`;

class ApiLaporPengaduanRepository implements LaporPengaduanRepository {
  async kirim(
    draft: ComplaintDraft,
    media?: { fotoUri?: string | null; videoUri?: string | null },
  ): Promise<ComplaintReceipt> {
    const fotoUri = media?.fotoUri ?? null;
    const videoUri = media?.videoUri ?? null;

    if (fotoUri == null && videoUri == null) {
      return ApiClient.post(`${ApiConfig.publicPath}/pengaduan`, {
        body: draft.toJson(),
        parse: (data) => ComplaintReceipt.fromJson((data as Record<string, unknown>) ?? {}),
      });
    }

    const form = new FormData();
    for (const [k, v] of Object.entries(draft.toMultipartMap())) form.append(k, v);
    // RN FormData menerima objek berkas {uri,name,type}; server memilih
    // nama/ekstensi sendiri lewat magic bytes.
    if (fotoUri != null) {
      form.append('foto', { uri: fotoUri, name: 'bukti.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    if (videoUri != null) {
      form.append('video', { uri: videoUri, name: 'bukti.mp4', type: 'video/mp4' } as unknown as Blob);
    }
    return ApiClient.postMultipart(`${ApiConfig.publicPath}/pengaduan`, {
      form,
      parse: (data) => ComplaintReceipt.fromJson((data as Record<string, unknown>) ?? {}),
    });
  }

  lacak(nomorTiket: string): Promise<LacakTiketResult> {
    return ApiClient.get(jalur(nomorTiket), {
      parse: (data) => LacakTiketResult.fromJson((data as Record<string, unknown>) ?? {}),
    });
  }

  konfirmasi(nomorTiket: string, input: { rating: number; komentar?: string }): Promise<string> {
    const body: Record<string, unknown> = { rating: input.rating };
    if (input.komentar) body['komentar'] = input.komentar;
    return ApiClient.post(`${jalur(nomorTiket)}/konfirmasi`, {
      body,
      parse: (data) =>
        ((data as Record<string, unknown>)?.['pesan'] as string) ??
        'Penilaian Anda tercatat dan tiket ditutup.',
    });
  }

  bukaKembali(nomorTiket: string, alasan: string): Promise<string> {
    return ApiClient.post(`${jalur(nomorTiket)}/buka-kembali`, {
      body: { alasan },
      parse: (data) =>
        ((data as Record<string, unknown>)?.['pesan'] as string) ?? 'Tiket Anda dibuka kembali.',
    });
  }

  kirimChat(nomorTiket: string, pesan: string): Promise<void> {
    return ApiClient.post(`${jalur(nomorTiket)}/chat`, { body: { pesan }, parse: () => undefined });
  }
}

/**
 * Mode demo. Status tiket disimpan di memori supaya aksi konfirmasi/buka-kembali
 * punya sesuatu untuk diubah — pada mode API, server yang menyimpan status.
 */
class DemoLaporPengaduanRepository implements LaporPengaduanRepository {
  private status = 'SELESAI';
  private ratingDemo: number | null = null;
  private chatDemo: TicketTimelineEntry[] = [];

  async kirim(): Promise<ComplaintReceipt> {
    await tunda(700);
    // Meniru format nomor tiket server: TW-YYMM-XXXXXX (6 karakter acak).
    const abjad = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const akhiran = Array.from({ length: 6 }, () => abjad[Math.floor(Math.random() * abjad.length)]).join('');
    const sekarang = new Date();
    const yymm = `${String(sekarang.getFullYear()).slice(2)}${String(sekarang.getMonth() + 1).padStart(2, '0')}`;
    return new ComplaintReceipt(
      `TW-${yymm}-${akhiran}`,
      new Date(sekarang.getTime() + 3 * 24 * 3600 * 1000),
      'Pengaduan Anda diterima dan masuk antrean penanganan. Simpan nomor tiket untuk melacak status.',
    );
  }

  async lacak(nomorTiket: string): Promise<LacakTiketResult> {
    await tunda(600);
    const nomor = nomorTiket.trim().toUpperCase();
    if (!/^TW-\d{4}-[A-Z0-9]{6}$/.test(nomor)) {
      throw new ApiException(
        404,
        'NOT_FOUND',
        'Tiket tidak ditemukan. Periksa kembali nomor tiket Anda (format TW-YYMM-XXXXXX).',
      );
    }
    const now = Date.now();
    const jam = (h: number) => new Date(now + h * 3600 * 1000);
    const selesaiAtau = this.status === 'SELESAI' || this.status === 'DITUTUP';

    const riwayat: TicketTimelineEntry[] = [
      new TicketTimelineEntry('DIBUAT', 'BARU', 'Pengaduan diterima dan masuk antrean penanganan.', 'Sistem', null, jam(-20)),
      new TicketTimelineEntry('DITUGASKAN', 'DITUGASKAN', 'Tiket ditugaskan ke petugas lapangan.', 'Koordinator Layanan', null, jam(-16)),
      new TicketTimelineEntry('DIPROSES', 'DIPROSES', 'Petugas menuju lokasi dan mulai perbaikan.', 'Petugas Demo', null, jam(-3)),
    ];
    if (selesaiAtau) {
      riwayat.push(new TicketTimelineEntry('STATUS_DIUBAH', 'SELESAI', 'Perbaikan selesai, air kembali mengalir normal.', 'Petugas Demo', null, jam(-1)));
    }
    if (this.status === 'DITUTUP') {
      riwayat.push(new TicketTimelineEntry('DIKONFIRMASI', 'DITUTUP', 'Pelapor mengonfirmasi penanganan selesai. Tiket ditutup.', 'Pelapor', null, jam(0)));
    }
    if (this.status === 'DIBUKA_KEMBALI') {
      riwayat.push(new TicketTimelineEntry('DIBUKA_KEMBALI', 'DIBUKA_KEMBALI', 'Pelapor menyatakan masalah belum selesai.', 'Pelapor', null, jam(0)));
    }
    riwayat.push(...this.chatDemo);

    return new LacakTiketResult(
      nomor,
      'BOCOR_PIPA_DINAS',
      'Pipa bocor di depan rumah',
      this.status,
      'TINGGI',
      jam(-20),
      null,
      selesaiAtau ? 'Pipa sudah disambung ulang dan area sekitar dirapikan.' : null,
      'Petugas Demo',
      riwayat,
      new SlaInfo(null, jam(28), 28 * 60),
      this.status === 'SELESAI' && this.ratingDemo == null,
      this.status === 'SELESAI',
      this.status !== 'DITUTUP',
      this.status === 'SELESAI' ? jam(71) : null,
      null,
    );
  }

  async konfirmasi(_nomorTiket: string, input: { rating: number }): Promise<string> {
    await tunda(500);
    if (this.status !== 'SELESAI') {
      throw new ApiException(400, 'BAD_REQUEST', 'Tiket ini belum dinyatakan selesai oleh petugas, jadi belum bisa dikonfirmasi.');
    }
    this.status = 'DITUTUP';
    this.ratingDemo = input.rating;
    return 'Terima kasih. Penilaian Anda tercatat dan tiket ditutup.';
  }

  async bukaKembali(): Promise<string> {
    await tunda(500);
    if (this.status !== 'SELESAI') {
      throw new ApiException(400, 'BAD_REQUEST', 'Tiket ini masih dalam penanganan — belum ada yang perlu dibuka kembali.');
    }
    this.status = 'DIBUKA_KEMBALI';
    return 'Tiket Anda dibuka kembali dan akan ditinjau ulang petugas.';
  }

  async kirimChat(_nomorTiket: string, pesan: string): Promise<void> {
    await tunda(400);
    const now = Date.now();
    this.chatDemo.push(
      new TicketTimelineEntry('CHAT', null, pesan, 'Pelapor', null, new Date(now)),
      new TicketTimelineEntry('CHAT', null, 'Baik, pesan Anda kami terima. Petugas akan menindaklanjuti.', 'Petugas Demo', null, new Date(now + 1000)),
    );
  }
}

const tunda = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buatLaporPengaduanRepository(): LaporPengaduanRepository {
  return ApiConfig.isDemo ? new DemoLaporPengaduanRepository() : new ApiLaporPengaduanRepository();
}
