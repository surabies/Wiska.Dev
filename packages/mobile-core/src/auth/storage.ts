/**
 * storage.ts — penyimpanan rahasia lintas-platform untuk token/sesi.
 *
 * `expo-secure-store` TIDAK punya implementasi web (Keystore/Keychain hanya
 * ada di perangkat) — memanggilnya di web melempar `...is not a function`.
 * Helper ini memakai SecureStore di native dan `localStorage` di web.
 *
 * Deteksi web via `window.localStorage` (bukan `Platform` react-native) supaya
 * paket ini tak perlu bergantung tipe react-native. Di React Native `window`
 * ada tapi `localStorage` undefined, jadi cek ini aman.
 */
import * as SecureStore from 'expo-secure-store';

const web =
  typeof window !== 'undefined' &&
  typeof (window as { localStorage?: unknown }).localStorage !== 'undefined';

export const penyimpananAman = {
  async get(kunci: string): Promise<string | null> {
    if (web) return window.localStorage.getItem(kunci);
    return SecureStore.getItemAsync(kunci);
  },

  async set(kunci: string, nilai: string): Promise<void> {
    if (web) {
      window.localStorage.setItem(kunci, nilai);
      return;
    }
    await SecureStore.setItemAsync(kunci, nilai);
  },

  async hapus(kunci: string): Promise<void> {
    if (web) {
      window.localStorage.removeItem(kunci);
      return;
    }
    await SecureStore.deleteItemAsync(kunci);
  },
};
