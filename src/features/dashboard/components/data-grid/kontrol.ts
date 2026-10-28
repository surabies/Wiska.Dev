// features/dashboard/components/kontrol.ts — SATU ukuran untuk semua kendali
// bilah alat dashboard (kotak cari, dropdown saringan, tombol aksi).
//
// KENAPA ADA BERKAS INI. Tiap bilah alat dulu memilih tingginya sendiri, dan
// sebagian pilihannya bahkan tidak pernah berlaku:
//   • DataGrid memakai h-7/text-xs untuk kotak cari, tapi dropdown di
//     sebelahnya <NativeSelect className="h-7"> — className NativeSelect
//     menempel di pembungkus, bukan <select>-nya, jadi dropdown-nya tetap
//     32px di samping kotak cari 28px.
//   • Toolbar verifikasi & anomali memakai h-9 untuk semuanya, tapi
//     <SelectTrigger size="sm"> menyetel tinggi lewat `data-[size=sm]:h-7`
//     yang KESPESIFIKANNYA lebih tinggi daripada kelas `h-9` biasa — jadi
//     dropdown-nya 28px sementara kotak cari di sebelahnya benar-benar 36px.
// Dua-duanya kelihatan benar di kode dan salah di layar. Karena itu tinggi
// sekarang dikirim lewat prop `size` (yang memang bertingkat kespesifikan
// sama), bukan lewat kelas, dan nilainya ditaruh di sini supaya saringan
// berikutnya tidak perlu menebak lagi.
//
// 36px (h-9 / size="lg"), bukan 32px: sasaran sentuh. Dashboard ini dibuka
// dari ponsel di lapangan, dan itu ukuran terkecil yang masih nyaman ditekan.

/** Kotak isian (Input) — tingginya kelas biasa, aman ditimpa lewat className.
 *  Teks 16px di ponsel: di bawah itu Safari iOS MEMPERBESAR halaman begitu
 *  kolomnya disentuh dan pengguna terdampar di tata letak yang ter-zoom.
 *  Turun ke 14px baru mulai md. */
export const KELAS_ISIAN = "h-9 text-base md:text-sm"

/** Ukuran 36px untuk <Button>, <SelectTrigger>, dan <NativeSelect>. Lewat
 *  prop `size`, BUKAN className — itu satu-satunya jalur yang benar-benar
 *  berlaku pada ketiganya (lihat catatan kespesifikan di atas). */
export const UKURAN_KONTROL = "lg" as const

/** Lebar kendali saringan: sebaris berdua di ponsel, selebar isinya di layar
 *  lega. Pada <NativeSelect> kelas lebar memang mengenai pembungkusnya —
 *  itu yang diinginkan, karena <select> di dalamnya sudah w-full. */
export const KELAS_LEBAR_SARINGAN = "w-auto min-w-0 flex-1 basis-40 sm:flex-none sm:basis-auto"
