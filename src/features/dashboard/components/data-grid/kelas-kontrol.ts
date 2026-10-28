// features/dashboard/components/data-grid/kelas-kontrol.ts — kelas bersama
// kontrol toolbar (kotak cari, select, tombol, rentang tanggal).
//
// DIPISAH DARI tema.ts. tema.ts mengimpor `themeQuartz` dari ag-grid-community;
// halaman yang tidak memakai AG Grid (Verifikasi Pembacaan Petugas) tidak boleh
// ikut menarik pustaka itu hanya demi tiga string kelas. File ini murni string,
// jadi aman diimpor dari mana pun. tema.ts mengekspor ulang isinya, jadi semua
// impor lama dari "../tema" tetap jalan.
//
// SATU SUMBER UNTUK TINGGI. Kotak cari dulu menyalin sebagian kelas kontrol
// dengan tangan dan meminjam KELAS_ISIAN dari kontrol.ts, sedangkan select
// memakai KELAS_KONTROL: dua sumber, jadi cepat atau lambat tingginya meleset.
// Sekarang keduanya berangkat dari KELAS_DASAR_KONTROL — tinggi, radius, bingkai,
// latar, dan ukuran huruf hanya ditulis di satu tempat.

/// Dasar SEMUA kontrol toolbar: 32px, radius --radius, permukaan --card, datar.
/// - `min-h-8` mengunci tinggi di kedua arah (komponen shadcn bisa membawa
///   `py-*`/`line-height` yang melebarkan kotak kalau cuma `h-8`).
/// - `md:text-[13px]`: Input shadcn standar membawa `md:text-sm` (14px) yang
///   TIDAK dikalahkan `text-[13px]` karena beda varian — di layar ≥768px hurufnya
///   jadi lebih besar dari select di sebelahnya.
/// - `dark:bg-card`: Input/SelectTrigger shadcn membawa `dark:bg-input/30`.
export const KELAS_DASAR_KONTROL =
  "h-8 min-h-8 rounded-md border border-border bg-card text-[13px] md:text-[13px] shadow-none dark:bg-card"

/// Tombol / select toolbar.
export const KELAS_KONTROL =
  KELAS_DASAR_KONTROL +
  " w-fit shrink-0 gap-1.5 px-2.5 font-normal transition-colors hover:bg-accent dark:hover:bg-accent data-[size=default]:h-8 data-[size=sm]:h-8"

/// Kotak isian toolbar (kotak cari). Dasarnya sama persis dengan KELAS_KONTROL.
export const KELAS_INPUT_TOOLBAR = KELAS_DASAR_KONTROL + " px-2.5 font-normal"

/// Penanda penyaring yang sedang menyaring — netral, bukan warna merek.
export const KELAS_KONTROL_AKTIF = "border-foreground/25 bg-accent dark:bg-accent"

/// Kontrol di dalam panel filter lanjutan (latar panel = --background).
export const KELAS_KONTROL_PANEL = "bg-card dark:bg-card"