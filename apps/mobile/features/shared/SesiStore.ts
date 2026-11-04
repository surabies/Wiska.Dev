/**
 * SesiStore.ts — Penyimpanan event perubahan sesi reaktif.
 * Memicu render ulang komponen saat login, logout, atau token berubah.
 */
import { useSyncExternalStore } from 'react';

let versi = 0;
const pendengar = new Set<() => void>();

export function tandaiSesiBerubah(): void {
  versi += 1;
  for (const l of pendengar) l();
}

export function langgananSesi(listener: () => void): () => void {
  pendengar.add(listener);
  return () => pendengar.delete(listener);
}

/** Nilai berubah tiap kali sesi berubah — pakai untuk memicu render ulang. */
export function useSesiVersi(): number {
  return useSyncExternalStore(langgananSesi, () => versi);
}
