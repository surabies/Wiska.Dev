/**
 * pilihan-unggah.ts — baris antrean mana yang ditandai untuk diunggah.
 *
 * KENAPA DI LUAR KOMPONEN. Penandaannya terjadi di layar DETAIL RUTE,
 * sedangkan yang membacanya — hitungan dan tombol Kirim — ada di layar
 * UPLOAD. Keduanya entri router yang terpisah, jadi state React biasa akan
 * hilang begitu layar detail ditutup, dan justru saat kembali itulah
 * hitungannya harus sudah berubah.
 *
 * Bukan Context: konteks menuntut provider di root, dan satu-satunya yang
 * butuh nilai ini hanya dua layar yang berdekatan. Modul dengan langganan
 * memberi hasil yang sama tanpa membebani seluruh pohon.
 *
 * Isinya SENGAJA hanya di memori. Pilihan adalah niat sesaat ("kirim yang ini
 * dulu"), bukan data kerja — menuliskannya ke SQLite berarti ia bertahan
 * setelah aplikasi ditutup dan petugas mengirim sesuatu yang sudah tidak
 * diingatnya lagi.
 */
import { useSyncExternalStore } from 'react';

let terpilih: ReadonlySet<number> = new Set();
const pendengar = new Set<() => void>();

function umumkan(baru: ReadonlySet<number>): void {
  terpilih = baru;
  for (const f of pendengar) f();
}

export const PilihanUnggah = {
  baca(): ReadonlySet<number> {
    return terpilih;
  },

  alih(idAntrean: number): void {
    const baru = new Set(terpilih);
    if (baru.has(idAntrean)) baru.delete(idAntrean);
    else baru.add(idAntrean);
    umumkan(baru);
  },

  /** Centang/lepas sekelompok sekaligus — dipakai "pilih semua" satu rute. */
  aturBanyak(idAntrean: number[], pilih: boolean): void {
    const baru = new Set(terpilih);
    for (const id of idAntrean) {
      if (pilih) baru.add(id);
      else baru.delete(id);
    }
    umumkan(baru);
  },

  bersihkan(): void {
    if (terpilih.size > 0) umumkan(new Set());
  },

  /**
   * Buang id yang barisnya sudah tidak ada di antrean — mis. setelah terkirim.
   * Tanpa ini hitungan akan mengklaim memilih sesuatu yang sudah lenyap.
   */
  pangkas(idMasihAda: Iterable<number>): void {
    const ada = new Set(idMasihAda);
    const baru = new Set([...terpilih].filter((id) => ada.has(id)));
    if (baru.size !== terpilih.size) umumkan(baru);
  },

  langgan(f: () => void): () => void {
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  },
};

/** Baca pilihan secara reaktif; ikut ter-render ulang saat berubah. */
export function usePilihanUnggah(): ReadonlySet<number> {
  return useSyncExternalStore(PilihanUnggah.langgan, PilihanUnggah.baca, PilihanUnggah.baca);
}
