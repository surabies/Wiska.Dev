// components/pwa/tangkap-prompt-awal.tsx — memuat penangkap
// `beforeinstallprompt` sedini mungkin.
//
// Kenapa perlu: Chrome menembakkan event itu segera setelah menilai halaman
// layak dipasang — pada kunjungan berulang sering kali sebelum bundel React
// selesai dijalankan. Listener di dalam useEffect() ikut terlambat dan
// event-nya hilang, sehingga tombol "Pasang" tidak pernah muncul padahal
// browser siap memasang.
//
// TIGA CARA SUDAH DICOBA, DUA GAGAL — dicatat supaya tidak diulang:
//
//   1. <script dangerouslySetInnerHTML>  -> React 19 memperingatkan setiap
//      kali halaman dimuat ("Scripts inside React components are never
//      executed when rendering on the client").
//   2. next/script + dangerouslySetInnerHTML -> peringatan SAMA, hanya
//      berpindah menunjuk ke <Script>. Yang dipermasalahkan React adalah
//      tag skripnya, bukan siapa yang merender.
//   3. next/script + src, strategy beforeInteractive -> peringatan MASIH
//      muncul; next/script tetap merender elemen <script> di pohon React.
//
// Yang dipakai sekarang: `<script async src>` biasa. React 19 memperlakukan
// skrip eksternal ber-`async` secara khusus — ia DI-HOIST ke <head> dan
// dideduplikasi, bukan dirender sebagai anak komponen, jadi tidak ada
// peringatan. Ini satu-satunya bentuk yang lolos tanpa mengorbankan
// pemuatan dini.
//
// `async` memang berarti eksekusinya tidak memblokir parser, tetapi itu
// cukup: Chrome baru menembakkan `beforeinstallprompt` setelah menilai
// halaman layak dipasang, dan penilaian itu terjadi jauh setelah skrip
// sekecil ini selesai diunduh.

/// Kunci window tempat event dititipkan. Dibaca oleh konteks-pasang.tsx.
///
/// DIKEMBARKAN di public/pwa-tangkap-prompt.js — berkas itu disajikan apa
/// adanya dan tidak bisa mengimpor konstanta TS. Bila salah satu diubah,
/// YANG LAIN WAJIB IKUT: kalau tidak, event tertangkap tapi tidak pernah
/// dipungut, dan tombol Pasang diam tanpa satu pun pesan galat.
export const KUNCI_PROMPT_AWAL = "__ajakanPasangTirtawening"

export function TangkapPromptAwal() {
  return <script async src="/pwa-tangkap-prompt.js" />
}
