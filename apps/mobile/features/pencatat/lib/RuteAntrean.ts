/**
 * Kunci untuk baris antrean yang TIDAK punya pasangan rute di daftar
 * pelanggan lokal — mis. hasil pulihkan cadangan.
 *
 * Berdiri di berkasnya sendiri karena dipakai dua layar sekaligus (Upload dan
 * detail rute) dan dilewatkan lewat parameter router; kalau tiap layar
 * menuliskannya sendiri, satu salah ketik akan membuat rute itu terbuka
 * kosong tanpa ada yang tahu kenapa.
 */
export const TANPA_RUTE = 'Tanpa rute';
