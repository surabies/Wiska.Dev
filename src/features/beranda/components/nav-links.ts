// features/beranda/components/nav-links.ts — satu daftar tautan layanan
// publik, dipakai header desktop, sheet mobile, dan footer. Ubah di sini,
// ketiganya ikut.
//
// `nonaktif` — dimatikan SEMENTARA (efisiensi biaya langganan database:
// aplikasi saat ini hanya mengisi data induk Pelanggan, tabel Meter/
// Tagihan/DaftarCatat sengaja tidak diisi, lihat packages/db/prisma/
// RESET-DAN-SEED.md). Halaman & API cek-tagihan TIDAK dihapus — hanya
// pintu masuknya yang ditandai tidak bisa diklik (kursor "not-allowed").
// Hapus flag ini untuk mengaktifkan kembali.
export const NAV_LAYANAN = [
  {
    href: "/cek-tagihan",
    label: "Cek Tagihan",
    deskripsi: "Lihat tagihan & riwayat 12 periode",
    nonaktif: true,
  },
  {
    href: "/lapor-meter",
    label: "Lapor Meter",
    deskripsi: "Kirim angka meter + foto bukti",
    nonaktif: false,
  },
  {
    href: "/pengaduan",
    label: "Pengaduan",
    deskripsi: "Laporkan gangguan & lacak tiket",
    nonaktif: false,
  },
] as const
