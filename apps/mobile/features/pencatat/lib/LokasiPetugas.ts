/**
 * lokasi.ts — pembungkus GPS untuk alur catat meter. Padanan
 * `core/services/lokasi_service.dart` (geolocator → expo-location).
 *
 * Dipakai layar catat untuk dua hal:
 *   1. menyimpan posisi petugas saat menyimpan (`latCatat`/`longCatat`), dan
 *   2. menampilkan jarak live ke titik pelanggan (`tv_range_location` Aurora).
 *
 * Jarak yang MENGIKAT tetap dihitung server (PostGIS `ST_DistanceSphere`) dari
 * pasangan koordinat yang dikirim. Angka di layar hanya umpan balik supaya
 * petugas tahu ia berdiri di tempat yang benar — bukan bukti.
 */
import * as Location from 'expo-location';

export interface Posisi {
  latitude: number;
  longitude: number;
  /** Akurasi horizontal (meter); null bila perangkat tidak melaporkannya. */
  akurasi: number | null;
}

function dariExpo(p: Location.LocationObject): Posisi {
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    akurasi: p.coords.accuracy ?? null,
  };
}

/** Layanan lokasi perangkat menyala? */
export async function layananAktif(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * Posisi saat ini. null = layanan mati, izin ditolak, atau sensor tak
 * menjawab — layar yang memutuskan cara menagihnya ke pengguna.
 */
export async function posisiSekarang(): Promise<Posisi | null> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return null;

    let izin = await Location.getForegroundPermissionsAsync();
    if (!izin.granted && izin.canAskAgain) {
      izin = await Location.requestForegroundPermissionsAsync();
    }
    if (!izin.granted) return null;

    try {
      return dariExpo(
        await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      );
    } catch {
      // Timeout/gangguan sensor: pakai posisi terakhir yang diketahui. Posisi
      // semenit lalu jauh lebih berguna daripada tidak ada bukti kehadiran
      // sama sekali — petugasnya toh belum berpindah rumah dalam semenit.
      const terakhir = await Location.getLastKnownPositionAsync();
      return terakhir == null ? null : dariExpo(terakhir);
    }
  } catch {
    return null;
  }
}

/**
 * Pantau posisi untuk jarak live. Mengembalikan fungsi pembatal — WAJIB
 * dipanggil saat layar ditutup, kalau tidak GPS terus menyala dan menghabisi
 * baterai petugas di tengah rute.
 */
export async function pantauPosisi(
  onPosisi: (p: Posisi) => void,
): Promise<() => void> {
  try {
    const izin = await Location.getForegroundPermissionsAsync();
    if (!izin.granted) return () => {};
    const langganan = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (p) => onPosisi(dariExpo(p)),
    );
    return () => langganan.remove();
  } catch {
    return () => {};
  }
}

const JARI_BUMI_M = 6371008.8;

/**
 * Jarak meter antara dua koordinat (haversine). geolocator menyediakan ini
 * bawaan; expo-location tidak, jadi dihitung sendiri di sini.
 */
export function jarakMeter(
  lat1: number,
  long1: number,
  lat2: number,
  long2: number,
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLong = rad(long2 - long1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLong / 2) ** 2;
  return 2 * JARI_BUMI_M * Math.asin(Math.min(1, Math.sqrt(a)));
}
