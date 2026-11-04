/**
 * complaint-ticket.ts — padanan `core/models/complaint_ticket_model.dart`.
 *
 * `nomorTiket` berformat TW-YYMM-XXXXXX dengan 6 karakter terakhir ACAK —
 * tampilkan apa adanya, jangan disusun sendiri. `transisiTersedia`,
 * `bisaDinilai`, `bisaDibukaKembali`, `sla` semuanya DIHITUNG SERVER — jangan
 * menyalin aturannya ke client.
 */

type Json = Record<string, unknown>;

const tanggal = (raw: unknown): Date | null => {
  if (typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const namaDari = (raw: unknown): string | null => {
  if (raw != null && typeof raw === 'object') {
    const name = (raw as Json)['name'];
    return typeof name === 'string' ? name : null;
  }
  return null;
};

/**
 * Objek SLA — DIHITUNG SERVER, jangan dihitung ulang di client. `sisaMenit`
 * negatif = lewat tenggat; `terjeda` = jam SLA berhenti karena menunggu
 * pelapor.
 */
export class SlaInfo {
  constructor(
    readonly targetResponsAt: Date | null = null,
    readonly targetSelesaiAt: Date | null = null,
    readonly sisaMenit: number | null = null,
    readonly melanggar = false,
    readonly responsTerlambat = false,
    readonly terjeda = false,
  ) {}

  static fromJson(json: Json): SlaInfo {
    return new SlaInfo(
      tanggal(json['targetResponsAt']),
      tanggal(json['targetSelesaiAt']),
      typeof json['sisaMenit'] === 'number' ? Math.trunc(json['sisaMenit']) : null,
      json['melanggar'] === true,
      json['responsTerlambat'] === true,
      json['terjeda'] === true,
    );
  }
}

/** Tiket pengaduan (model `Pengaduan` backend). */
export class ComplaintTicketModel {
  constructor(
    readonly id: string,
    readonly nomorTiket: string,
    readonly jenis: string,
    readonly judul: string,
    readonly deskripsi: string,
    readonly status: string,
    readonly prioritas: string,
    readonly pelapor: string,
    readonly kontakPelapor: string | null = null,
    readonly alamatKejadian: string | null = null,
    readonly nomorLangganan: string | null = null,
    readonly fotoUrl: string | null = null,
    readonly createdAt: Date | null = null,
    readonly sla: SlaInfo | null = null,
    readonly transisiTersedia: string[] = [],
    readonly ditugaskanKe: string | null = null,
  ) {}

  get lewatSla(): boolean {
    return this.sla?.melanggar ?? false;
  }

  static fromJson(json: Json): ComplaintTicketModel {
    const sla = json['sla'];
    const transisi = json['transisiTersedia'];
    return new ComplaintTicketModel(
      (json['id'] as string) ?? '',
      (json['nomorTiket'] as string) ?? '',
      (json['jenis'] as string) ?? 'LAINNYA',
      (json['judul'] as string) ?? '',
      (json['deskripsi'] as string) ?? '',
      (json['status'] as string) ?? 'BARU',
      (json['prioritas'] as string) ?? 'NORMAL',
      (json['pelapor'] as string) ?? '',
      (json['kontakPelapor'] as string) ?? null,
      (json['alamatKejadian'] as string) ?? null,
      (json['nomorLangganan'] as string) ?? null,
      (json['fotoUrl'] as string) ?? null,
      tanggal(json['createdAt']),
      sla != null && typeof sla === 'object' ? SlaInfo.fromJson(sla as Json) : null,
      Array.isArray(transisi) ? transisi.filter((x): x is string => typeof x === 'string') : [],
      namaDari(json['ditugaskanKe']),
    );
  }

  copyWith(patch: { status?: string; transisiTersedia?: string[] }): ComplaintTicketModel {
    return new ComplaintTicketModel(
      this.id,
      this.nomorTiket,
      this.jenis,
      this.judul,
      this.deskripsi,
      patch.status ?? this.status,
      this.prioritas,
      this.pelapor,
      this.kontakPelapor,
      this.alamatKejadian,
      this.nomorLangganan,
      this.fotoUrl,
      this.createdAt,
      this.sla,
      patch.transisiTersedia ?? this.transisiTersedia,
      this.ditugaskanKe,
    );
  }
}

/**
 * Data isian form pengaduan publik (POST /api/public/pengaduan).
 * BOCOR_PIPA_DINAS wajib menyertakan koordinat — server menolak 422 tanpa itu.
 */
export class ComplaintDraft {
  constructor(
    readonly klasifikasi: string,
    readonly jenis: string,
    readonly judul: string,
    readonly deskripsi: string,
    readonly pelapor: string,
    readonly kontakPelapor: string,
    readonly alamatKejadian: string | null = null,
    readonly nomorLangganan: string | null = null,
    readonly lat: number | null = null,
    readonly lng: number | null = null,
  ) {}

  /** Body JSON (dipakai saat TANPA foto). */
  toJson(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      klasifikasi: this.klasifikasi,
      jenis: this.jenis,
      judul: this.judul,
      deskripsi: this.deskripsi,
      pelapor: this.pelapor,
      kontakPelapor: this.kontakPelapor,
    };
    if (this.alamatKejadian) body['alamatKejadian'] = this.alamatKejadian;
    if (this.nomorLangganan) body['nomorLangganan'] = this.nomorLangganan;
    if (this.lat != null && this.lng != null) {
      body['koordinat'] = { lat: this.lat, lng: this.lng };
    }
    return body;
  }

  /**
   * Bentuk multipart (dipakai saat foto dilampirkan): server membaca koordinat
   * sebagai DUA field skalar `lat`/`lng` di form-data, bukan objek bersarang —
   * lihat `bacaBodyPengaduan()` di publik.router.ts.
   */
  toMultipartMap(): Record<string, string> {
    const map: Record<string, string> = {
      klasifikasi: this.klasifikasi,
      jenis: this.jenis,
      judul: this.judul,
      deskripsi: this.deskripsi,
      pelapor: this.pelapor,
      kontakPelapor: this.kontakPelapor,
    };
    if (this.alamatKejadian) map['alamatKejadian'] = this.alamatKejadian;
    if (this.nomorLangganan) map['nomorLangganan'] = this.nomorLangganan;
    if (this.lat != null) map['lat'] = `${this.lat}`;
    if (this.lng != null) map['lng'] = `${this.lng}`;
    return map;
  }
}

/**
 * Satu entri linimasa PUBLIK tiket (riwayat dengan isPublik=true saja —
 * catatan internal tidak pernah keluar dari server).
 */
export class TicketTimelineEntry {
  constructor(
    readonly aksi: string,
    readonly statusKe: string | null = null,
    readonly catatan: string | null = null,
    readonly olehNama: string | null = null,
    readonly fotoUrl: string | null = null,
    readonly createdAt: Date | null = null,
  ) {}

  static fromJson(json: Json): TicketTimelineEntry {
    return new TicketTimelineEntry(
      (json['aksi'] as string) ?? '',
      (json['statusKe'] as string) ?? null,
      (json['catatan'] as string) ?? null,
      (json['olehNama'] as string) ?? null,
      (json['fotoUrl'] as string) ?? null,
      tanggal(json['createdAt']),
    );
  }
}

/**
 * Hasil GET /api/public/pengaduan/:nomorTiket — status + linimasa publik.
 * `bisaDinilai`/`bisaDibukaKembali` dihitung server; jangan menyalin aturannya
 * ke client.
 */
export class LacakTiketResult {
  constructor(
    readonly nomorTiket: string,
    readonly jenis: string,
    readonly judul: string,
    readonly status: string,
    readonly prioritas: string,
    readonly createdAt: Date | null = null,
    readonly selesaiAt: Date | null = null,
    readonly catatanPenyelesaian: string | null = null,
    readonly ditugaskanKe: string | null = null,
    readonly riwayat: TicketTimelineEntry[] = [],
    readonly sla: SlaInfo | null = null,
    readonly bisaDinilai = false,
    readonly bisaDibukaKembali = false,
    /** Percakapan masih dibuka (tiket belum DITUTUP) — dihitung server. */
    readonly bisaChat = false,
    /** Batas pelapor konfirmasi SELESAI; lewat ini tiket ditutup otomatis. */
    readonly konfirmasiBatasAt: Date | null = null,
    /** Foto bukti hasil pekerjaan dari petugas. */
    readonly fotoPenyelesaianUrl: string | null = null,
  ) {}

  static fromJson(json: Json): LacakTiketResult {
    const riwayat = json['riwayat'];
    const sla = json['sla'];
    return new LacakTiketResult(
      (json['nomorTiket'] as string) ?? '',
      (json['jenis'] as string) ?? 'LAINNYA',
      (json['judul'] as string) ?? '',
      (json['status'] as string) ?? 'BARU',
      (json['prioritas'] as string) ?? 'NORMAL',
      tanggal(json['createdAt']),
      tanggal(json['selesaiAt']),
      (json['catatanPenyelesaian'] as string) ?? null,
      namaDari(json['ditugaskanKe']),
      Array.isArray(riwayat)
        ? riwayat
            .filter((x): x is Json => x != null && typeof x === 'object')
            .map(TicketTimelineEntry.fromJson)
        : [],
      sla != null && typeof sla === 'object' ? SlaInfo.fromJson(sla as Json) : null,
      json['bisaDinilai'] === true,
      json['bisaDibukaKembali'] === true,
      json['bisaChat'] === true,
      tanggal(json['konfirmasiBatasAt']),
      (json['fotoPenyelesaianUrl'] as string) ?? null,
    );
  }
}

/** Balasan POST /api/public/pengaduan. */
export class ComplaintReceipt {
  constructor(
    readonly nomorTiket: string,
    readonly targetSelesaiAt: Date | null,
    readonly pesan: string,
  ) {}

  static fromJson(json: Json): ComplaintReceipt {
    return new ComplaintReceipt(
      (json['nomorTiket'] as string) ?? '',
      tanggal(json['targetSelesaiAt']),
      (json['pesan'] as string) ??
        'Pengaduan Anda diterima dan masuk antrean penanganan.',
    );
  }
}
