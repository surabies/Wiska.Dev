/**
 * bill.ts — padanan `core/models/bill_model.dart`.
 *
 * Dipakai oleh dua sumber dengan bentuk sedikit berbeda:
 *  - POST /api/public/cek-tagihan → `periode` sudah integer thbl, tanpa
 *    `id`/`nominalTunggak` (sengaja tidak dibuka ke publik);
 *  - GET /api/v1/tagihan → `periode` ISO DateTime, `nominalTunggak` STRING
 *    berisi BigInt (bisa ratusan juta — jangan parse number biasa).
 *
 * Model dibuat `class` (bukan interface) agar getter turunan `sudahLunas`,
 * `menunggak`, `labelPeriodeTagihan` ikut terbawa persis seperti versi Dart.
 */
import { labelPeriode, thblDariIso } from '../utils/formatters';

type Json = Record<string, unknown>;

const angka = (raw: unknown): number =>
  typeof raw === 'number' ? Math.trunc(raw) : 0;

const angkaOpsional = (raw: unknown): number | null =>
  typeof raw === 'number' ? Math.trunc(raw) : null;

const tanggal = (raw: unknown): Date | null =>
  typeof raw === 'string' ? parseTanggal(raw) : null;

function parseTanggal(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePeriode(raw: unknown): number {
  if (typeof raw === 'number') return Math.trunc(raw);
  if (typeof raw === 'string') return thblDariIso(raw);
  return 0;
}

/** Satu baris tagihan air (model `Tagihan` backend). */
export class BillModel {
  readonly id: string | null;

  /** Selalu integer thbl (202605 = Mei 2026), apa pun bentuk aslinya. */
  readonly periode: number;

  /** BELUM_BAYAR | SUDAH_BAYAR | JATUH_TEMPO | DIHAPUSKAN. */
  readonly status: string;

  /** Uang dalam rupiah bulat (number biasa) — hanya `nominalTunggak` BigInt. */
  readonly totalTagihan: number;
  readonly pemakaianM3: number | null;
  readonly jmlHargaAir: number | null;
  readonly beaBeban: number | null;
  readonly beaAdmin: number | null;
  readonly airKotor: number | null;
  readonly lainLain: number | null;
  readonly denda: number | null;

  readonly tanggalJatuhTempo: Date | null;
  readonly tanggalBayar: Date | null;
  readonly standLalu: number | null;
  readonly standAkhir: number | null;
  readonly nominalTunggak: bigint | null;

  constructor(init: {
    id?: string | null;
    periode: number;
    status: string;
    totalTagihan: number;
    pemakaianM3?: number | null;
    jmlHargaAir?: number | null;
    beaBeban?: number | null;
    beaAdmin?: number | null;
    airKotor?: number | null;
    lainLain?: number | null;
    denda?: number | null;
    tanggalJatuhTempo?: Date | null;
    tanggalBayar?: Date | null;
    standLalu?: number | null;
    standAkhir?: number | null;
    nominalTunggak?: bigint | null;
  }) {
    this.id = init.id ?? null;
    this.periode = init.periode;
    this.status = init.status;
    this.totalTagihan = init.totalTagihan;
    this.pemakaianM3 = init.pemakaianM3 ?? null;
    this.jmlHargaAir = init.jmlHargaAir ?? null;
    this.beaBeban = init.beaBeban ?? null;
    this.beaAdmin = init.beaAdmin ?? null;
    this.airKotor = init.airKotor ?? null;
    this.lainLain = init.lainLain ?? null;
    this.denda = init.denda ?? null;
    this.tanggalJatuhTempo = init.tanggalJatuhTempo ?? null;
    this.tanggalBayar = init.tanggalBayar ?? null;
    this.standLalu = init.standLalu ?? null;
    this.standAkhir = init.standAkhir ?? null;
    this.nominalTunggak = init.nominalTunggak ?? null;
  }

  get sudahLunas(): boolean {
    return this.status === 'SUDAH_BAYAR';
  }

  get menunggak(): boolean {
    return this.status === 'BELUM_BAYAR' || this.status === 'JATUH_TEMPO';
  }

  get labelPeriodeTagihan(): string {
    return labelPeriode(this.periode);
  }

  static fromJson(json: Json): BillModel {
    const rawTunggak = json['nominalTunggak'];
    let nominalTunggak: bigint | null = null;
    if (typeof rawTunggak === 'string') {
      try {
        nominalTunggak = BigInt(rawTunggak);
      } catch {
        nominalTunggak = null;
      }
    }
    return new BillModel({
      id: (json['id'] as string) ?? null,
      periode: parsePeriode(json['periode']),
      status: (json['status'] as string) ?? 'BELUM_BAYAR',
      totalTagihan: angka(json['totalTagihan']),
      pemakaianM3: angkaOpsional(json['pemakaianM3']),
      jmlHargaAir: angkaOpsional(json['jmlHargaAir']),
      beaBeban: angkaOpsional(json['beaBeban']),
      beaAdmin: angkaOpsional(json['beaAdmin']),
      airKotor: angkaOpsional(json['airKotor']),
      lainLain: angkaOpsional(json['lainLain']),
      denda: angkaOpsional(json['denda']),
      tanggalJatuhTempo: tanggal(json['tanggalJatuhTempo']),
      tanggalBayar: tanggal(json['tanggalBayar']),
      standLalu: angkaOpsional(json['standLalu']),
      standAkhir: angkaOpsional(json['standAkhir']),
      nominalTunggak,
    });
  }
}

/**
 * Identitas pelanggan pada hasil cek tagihan publik. Alamat sudah disamarkan
 * server — tampilkan apa adanya.
 */
export class CustomerInfo {
  constructor(
    readonly nomorLangganan: string,
    readonly nama: string,
    readonly alamat: string | null = null,
    readonly rt: string | null = null,
    readonly rw: string | null = null,
    readonly status: string | null = null,
    readonly tarifGolongan: string | null = null,
  ) {}

  static fromJson(json: Json): CustomerInfo {
    const tarif = json['tarifGolongan'];
    let tarifGolongan: string | null = null;
    if (tarif != null && typeof tarif === 'object') {
      const t = tarif as Json;
      const kode = t['kodeAsli'] ?? t['kode'];
      tarifGolongan = kode != null ? String(kode) : null;
    } else if (tarif != null) {
      tarifGolongan = String(tarif);
    }
    return new CustomerInfo(
      (json['nomorLangganan'] as string) ?? '',
      (json['nama'] as string) ?? '',
      (json['alamat'] as string) ?? null,
      json['rt'] != null ? String(json['rt']) : null,
      json['rw'] != null ? String(json['rw']) : null,
      (json['status'] as string) ?? null,
      tarifGolongan,
    );
  }
}

/** Hasil lengkap POST /api/public/cek-tagihan. */
export class CekTagihanResult {
  constructor(
    readonly pelanggan: CustomerInfo,
    /** Maksimal 12 periode terakhir (kebijakan server). */
    readonly tagihan: BillModel[],
    readonly totalTunggakan: number,
  ) {}

  static fromJson(json: Json): CekTagihanResult {
    const rows = json['tagihan'];
    const pelangganRaw = (json['pelanggan'] as Json) ?? {};
    return new CekTagihanResult(
      CustomerInfo.fromJson(pelangganRaw),
      Array.isArray(rows)
        ? rows
            .filter((x): x is Json => x != null && typeof x === 'object')
            .map(BillModel.fromJson)
        : [],
      angka(json['totalTunggakan']),
    );
  }
}
