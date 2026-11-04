/**
 * ruang-dock.tsx — berapa ruang yang harus disisakan di bawah isi layar.
 *
 * KENAPA PERLU KONTEKS. Dock bawah kini MENGAMBANG di atas konten
 * (`position: absolute`), bukan lagi duduk di sampingnya sebagai baris flex.
 * Itu syarat supaya lekukannya terlihat seperti lubang sungguhan: halaman
 * mengalir sampai dasar layar, jadi yang tampak lewat lekukan adalah gradasi
 * dan isi halaman itu sendiri — bukan sepetak warna datar yang tepinya
 * ketahuan.
 *
 * Konsekuensinya, layar tidak lagi disusutkan React Navigation, dan baris
 * terakhir daftar akan bersembunyi di balik dock kalau tidak ada yang
 * menyisakan ruang. Nilainya disebar lewat konteks, bukan konstanta yang
 * di-impor di mana-mana, karena hanya layar DI DALAM tab yang punya dock:
 * catat meter, kunjungan anomali, riwayat, dan kawan-kawan tidak punya, dan
 * memberi mereka padding hantu sama buruknya dengan tidak memberi sama sekali.
 *
 * Bawaannya 0 — layar di luar tab tidak perlu tahu apa-apa soal dock.
 */
import { createContext, useContext, type ReactNode } from 'react';

const KonteksRuangDock = createContext(0);

export function RuangDockProvider({ nilai, children }: { nilai: number; children: ReactNode }) {
  return <KonteksRuangDock.Provider value={nilai}>{children}</KonteksRuangDock.Provider>;
}

/**
 * Tinggi dock yang menutupi bagian bawah layar, dalam dp. 0 bila layar ini
 * tidak berada di dalam tab.
 */
export function useRuangDock(): number {
  return useContext(KonteksRuangDock);
}
