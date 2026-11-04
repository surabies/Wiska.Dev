/**
 * meter-reading.ts — padanan `core/models/meter_reading_model.dart`.
 *
 * Menyatukan dua bentuk API (laporan mandiri pelanggan & laporan harian
 * petugas). Dipakai layar Lapor Meter (kirim) & Laporan Saya (daftar bacaan).
 */
import { labelPeriode, thblDariIso } from '../utils/formatters';

type Json = Record<string, unknown>;

export type SumberBacaan = 'mandiri' | 'harian';

const angka = (raw: unknown): number => (typeof raw === 'number' ? Math.trunc(raw) : 0);
const angkaOpsional = (raw: unknown): number | null => (typeof raw === 'number' ? Math.trunc(raw) : null);
const desimal = (raw: unknown): number | null => (typeof raw === 'number' ? raw : null);
const tanggal = (raw: unknown): Date | null => {
  if (typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};
const periodeThbl = (raw: unknown): number => {
  if (typeof raw === 'number') return Math.trunc(raw);
  if (typeof raw === 'string') return thblDariIso(raw);
  return 0;
};
const namaAlamat = (json: Json, kunci: 'nama' | 'alamat'): string | null => {
  const p = json['pelanggan'];
  if (p != null && typeof p === 'object') {
    const v = (p as Json)[kunci];
    if (typeof v === 'string') return v;
  }
  return null;
};

/** Satu bacaan meter (laporan mandiri / harian). */
export class MeterReadingModel {
  constructor(
    readonly id: string,
    readonly sumber: SumberBacaan,
    readonly nomorLangganan: string,
    readonly periode: number,
    readonly standAkhir: number,
    readonly status: string,
    readonly namaPelanggan: string | null = null,
    readonly alamatPelanggan: string | null = null,
    readonly standAwal: number | null = null,
    readonly pemakaian: number | null = null,
    readonly persentase: number | null = null,
    readonly kondisi: string | null = null,
    readonly fotoUrl: string | null = null,
    readonly namaPelapor: string | null = null,
    readonly nomorPelapor: string | null = null,
    readonly tanggalCatat: Date | null = null,
  ) {}

  get pemakaianTerhitung(): number | null {
    return this.pemakaian ?? (this.standAwal == null ? null : this.standAkhir - this.standAwal);
  }

  /** Lonjakan/penurunan ekstrem menurut ambang server (default 50%). */
  anomali(ambang: number): boolean {
    return this.persentase != null && Math.abs(this.persentase) > ambang;
  }

  get labelPeriodeBacaan(): string {
    return labelPeriode(this.periode);
  }

  static fromLaporanMandiriJson(json: Json): MeterReadingModel {
    return new MeterReadingModel(
      (json['id'] as string) ?? '',
      'mandiri',
      (json['nomorLangganan'] as string) ?? '',
      periodeThbl(json['periode']),
      angka(json['standDilaporkan']),
      (json['status'] as string) ?? 'MENUNGGU',
      namaAlamat(json, 'nama'),
      namaAlamat(json, 'alamat'),
      angkaOpsional(json['standLalu']),
      null,
      desimal(json['persentase']),
      null,
      (json['fotoUrl'] as string) ?? null,
      (json['namaPelapor'] as string) ?? null,
      (json['nomorPelapor'] as string) ?? null,
      tanggal(json['createdAt']),
    );
  }

  static fromLaporanHarianJson(json: Json): MeterReadingModel {
    return new MeterReadingModel(
      (json['id'] as string) ?? '',
      'harian',
      (json['nomorLangganan'] as string) ?? '',
      periodeThbl(json['periode']),
      angka(json['standAkhir']),
      (json['statusVerif'] as string) ?? 'MENUNGGU',
      namaAlamat(json, 'nama') ?? ((json['namaPelanggan'] as string) ?? null),
      namaAlamat(json, 'alamat') ?? ((json['alamatPelanggan'] as string) ?? null),
      angkaOpsional(json['standAwal']),
      angkaOpsional(json['pemakaian']),
      desimal(json['persentase']),
      (json['kondisi'] as string) ?? null,
      (json['fotoStandUrl'] as string) ?? null,
      null,
      null,
      tanggal(json['tanggalCatat'] ?? json['createdAt']),
    );
  }

  copyWith(patch: { status?: string }): MeterReadingModel {
    return new MeterReadingModel(
      this.id,
      this.sumber,
      this.nomorLangganan,
      this.periode,
      this.standAkhir,
      patch.status ?? this.status,
      this.namaPelanggan,
      this.alamatPelanggan,
      this.standAwal,
      this.pemakaian,
      this.persentase,
      this.kondisi,
      this.fotoUrl,
      this.namaPelapor,
      this.nomorPelapor,
      this.tanggalCatat,
    );
  }
}

/** Tanda terima POST /api/public/lapor-meter. */
export class LaporMeterReceipt {
  constructor(
    readonly periode: number,
    readonly standDilaporkan: number,
    readonly status: string,
    readonly pesan: string,
  ) {}

  static fromJson(json: Json): LaporMeterReceipt {
    return new LaporMeterReceipt(
      periodeThbl(json['periode']),
      angka(json['standDilaporkan']),
      (json['status'] as string) ?? 'MENUNGGU',
      (json['pesan'] as string) ??
        'Laporan meter Anda terkirim dan sedang menunggu verifikasi petugas.',
    );
  }
}
