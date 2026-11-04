/**
 * tarif.ts — master tarif air untuk ESTIMASI di layar catat. Padanan
 * `features/staff/baca_meter/tarif_repository.dart` (unduhan
 * `download_watertarif.php` + `calculateTagihan()` Aurora).
 *
 * ESTIMASI, BUKAN TAGIHAN. Angka resmi selalu dihitung server saat closing —
 * perangkat tidak pernah menentukan rupiah. Gunanya sama dengan di Aurora:
 * petugas bisa menjawab "kira-kira berapa tagihan saya bulan ini?" saat
 * ditanya pelanggan di depan meter, tanpa menjanjikan angka final.
 */
import { ApiClient, ApiConfig, ApiException } from '@workspace/mobile-core';
import { bacaMeta, simpanMeta } from './DaoBacaMeter';

const KUNCI_CACHE = 'rbm.tarif';

export interface BlokTarifMobile {
  blok: number;
  batasAwalM3: number;
  /** null = blok terakhir (tanpa batas atas). */
  batasAkhirM3: number | null;
  hargaPerM3: number;
}

export interface TarifGolonganMobile {
  /** Kode yang sama dengan `PelangganRute.golonganTarif` (mis. "2A2"). */
  kodeAsli: string;
  blok: BlokTarifMobile[];
}

type Json = Record<string, unknown>;
const bulat = (v: unknown, bawaan = 0) => (typeof v === 'number' ? Math.trunc(v) : bawaan);

function blokDariJson(json: Json): BlokTarifMobile {
  return {
    blok: bulat(json['blok']),
    batasAwalM3: bulat(json['batasAwalM3']),
    batasAkhirM3: typeof json['batasAkhirM3'] === 'number' ? Math.trunc(json['batasAkhirM3']) : null,
    hargaPerM3: bulat(json['hargaPerM3']),
  };
}

export function tarifDariJson(json: Json): TarifGolonganMobile {
  const mentah = Array.isArray(json['blokTarif']) ? json['blokTarif'] : [];
  const blok = mentah
    .filter((x): x is Json => x != null && typeof x === 'object')
    .map(blokDariJson)
    .sort((a, b) => a.blok - b.blok);
  return { kodeAsli: typeof json['kodeAsli'] === 'string' ? json['kodeAsli'] : '', blok };
}

/**
 * Estimasi uang air PROGRESIF — logika yang sama dengan `calculateTagihan()`
 * Aurora: tiap blok konsumsi dikenai harganya sendiri, BUKAN seluruh
 * pemakaian dikali harga blok tertinggi. Salah di sini berarti petugas
 * menyebut angka yang jauh meleset di depan pelanggan.
 *
 * null = golongan tarif tidak dikenal / pemakaian tidak valid.
 */
export function estimasiUangAir(
  tarif: TarifGolonganMobile | null,
  pemakaianM3: number,
): number | null {
  if (tarif == null || tarif.blok.length === 0 || pemakaianM3 <= 0) return null;
  let total = 0;
  for (const b of tarif.blok) {
    // Blok "11–20 m³" (batasAwal 11, batasAkhir 20) menampung 10 m³:
    // pemakaian di atas batasAwal-1 sampai batasAkhir.
    const dasar = b.batasAwalM3 - 1;
    if (pemakaianM3 <= dasar) break;
    const atas = b.batasAkhirM3 ?? pemakaianM3;
    const kena = Math.min(pemakaianM3, atas) - dasar;
    if (kena > 0) total += kena * b.hargaPerM3;
  }
  return total;
}

/** Cache dalam memori — dibuang saat [unduhTarif] dipanggil. */
let dalamMemori: Map<string, TarifGolonganMobile> | null = null;

/**
 * Tarif per kodeAsli. Urutan sumber: memori → server (sekaligus menyegarkan
 * cache) → cache SQLite. Peta KOSONG bila semuanya gagal: estimasi tinggal
 * tidak tampil, dan alur catat sama sekali tidak terganggu — angka rupiah
 * bukan syarat mencatat stand.
 */
export async function semuaTarif(): Promise<Map<string, TarifGolonganMobile>> {
  if (dalamMemori != null) return dalamMemori;

  if (!ApiConfig.isDemo) {
    try {
      const hasil = await ApiClient.getList(`${ApiConfig.v1Path}/tarif`, {
        // hanyaAktif: hanya blok yang berlaku sekarang. Tanpa ini, golongan
        // yang pernah berganti tarif membawa blok generasi lama (nomor blok
        // ganda) dan estimasi progresifnya salah hitung.
        query: { pageSize: 100, hanyaAktif: true },
        parseRow: tarifDariJson,
      });
      if (hasil.rows.length > 0) {
        const peta = new Map(hasil.rows.map((t) => [t.kodeAsli, t]));
        await simpanMeta(KUNCI_CACHE, JSON.stringify(hasil.rows));
        dalamMemori = peta;
        return peta;
      }
    } catch (err) {
      if (!(err instanceof ApiException)) throw err;
      // offline / belum berhak — jatuh ke cache di bawah.
    }
  }

  try {
    const mentah = await bacaMeta(KUNCI_CACHE);
    if (mentah != null) {
      const daftar = (JSON.parse(mentah) as unknown[])
        .filter((x): x is Json => x != null && typeof x === 'object')
        .map(tarifDariJson);
      dalamMemori = new Map(daftar.map((t) => [t.kodeAsli, t]));
      return dalamMemori;
    }
  } catch {
    // cache korup — relakan; estimasi hilang, pencatatan jalan terus.
  }

  dalamMemori = new Map();
  return dalamMemori;
}

export async function tarifUntukGolongan(
  kodeAsli: string | null,
): Promise<TarifGolonganMobile | null> {
  if (kodeAsli == null) return null;
  return (await semuaTarif()).get(kodeAsli) ?? null;
}

/**
 * Paksa unduh ulang master tarif (abaikan cache memori) — dipakai layar
 * Download Data. Mengembalikan jumlah golongan yang akhirnya tersedia.
 */
export async function unduhTarif(): Promise<number> {
  dalamMemori = null;
  return (await semuaTarif()).size;
}
