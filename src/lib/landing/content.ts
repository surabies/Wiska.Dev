// Semua teks & tautan beranda PERUMDA Tirtawening ada di sini.
// Ubah teks cukup di file ini; komponen section tidak perlu disentuh.

export const BRAND = {
  nama: "PERUMDA Tirtawening",
  wilayah: "Kota Bandung",
  // Logo PNG di folder public/. Sesuaikan nama file jika berbeda.
  logo: "/logo.png",
} as const

// Rute halaman. Sesuaikan jika rute di proyekmu berbeda.
export const RUTE = {
  // Layanan utama (sudah ada)
  cekTagihan: "/cek-tagihan",
  laporMeter: "/lapor-meter",
  pengaduan: "/pengaduan",
  dasbor: "/dashboard",
  // Halaman informasi & perusahaan (BARU: buat halamannya, atau sesuaikan rutenya)
  infoGangguan: "/info-gangguan",
  tarifAir: "/tarif-air",
  caraPembayaran: "/cara-pembayaran",
  pasangBaru: "/pasang-baru",
  faq: "/faq",
  profil: "/profil",
  berita: "/berita",
  kontak: "/kontak",
  // Halaman legal (BARU: buat halamannya, atau sesuaikan rutenya)
  kebijakanPrivasi: "/kebijakan-privasi",
  syaratKetentuan: "/syarat-ketentuan",
} as const

// Tautan utama di navbar (aksi pelanggan). Dasbor petugas ditambahkan di komponen navbar.
export const NAV = [
  { label: "Cek Tagihan", href: RUTE.cekTagihan },
  { label: "Lapor Meter", href: RUTE.laporMeter },
  { label: "Pengaduan", href: RUTE.pengaduan },
] as const

// Menu dropdown navbar. Sengaja TIDAK memuat tautan yang sudah ada di NAV,
// supaya isi navbar dan dropdown tidak duplikat.
// Item yang punya `deskripsi` ditampilkan sebagai kartu.
export type TautanMenu = { label: string; href: string; deskripsi?: string }

export const MENU: { judul: string; item: readonly TautanMenu[] }[] = [
  {
    judul: "Terbaru",
    item: [
      {
        label: "Info Gangguan Air",
        href: RUTE.infoGangguan,
        deskripsi: "Lihat wilayah terdampak dan jadwal perbaikan",
      },
    ],
  },
  {
    judul: "Informasi Pelanggan",
    item: [
      { label: "Tarif Air", href: RUTE.tarifAir },
      { label: "Cara Pembayaran", href: RUTE.caraPembayaran },
      { label: "Pasang Baru", href: RUTE.pasangBaru },
      { label: "Pertanyaan Umum", href: RUTE.faq },
    ],
  },
  {
    judul: "Perusahaan",
    item: [
      { label: "Profil Perusahaan", href: RUTE.profil },
      { label: "Berita", href: RUTE.berita },
      { label: "Kontak & Kantor Layanan", href: RUTE.kontak },
    ],
  },
]

export const HERO = {
  judul: "Urusan Air Anda, Selesai dalam genggaman.",
  deskripsiAwal: "Cek tagihan, lapor angka meter, dan sampaikan",
  deskripsiTebal: "gangguan air tanpa antre.",
  deskripsiAkhir: "Setiap laporan diverifikasi petugas.",
  lencana: "Layanan Aktif · 24 Jam",
} as const

export type Fitur = {
  judul: string
  deskripsi: string
  href: string
  // Ilustrasi animasi di atas kartu (khusus 3 kartu pertama). Kosongkan untuk kartu teks.
  visual?: "tagihan" | "status" | "jaringan"
  // false = halaman belum dibuat: kartu tampil "Segera hadir" dan tidak bisa diklik.
  // Ubah ke true saat halamannya siap.
  tersedia: boolean
}

export const FITUR = {
  judul: "Semua yang Anda butuhkan untuk urusan air.",
  item: [
    // 3 kartu pertama: dengan ilustrasi animasi
    { judul: "Cek Tagihan", deskripsi: "Lihat tagihan air Anda dengan nomor langganan 11 digit.", href: RUTE.cekTagihan, visual: "tagihan", tersedia: true },
    { judul: "Pantau Status Laporan", deskripsi: "Lihat status verifikasi laporan meter bulan ini dan perkembangan pengaduan Anda.", href: RUTE.pengaduan, visual: "status", tersedia: true },
    { judul: "Verifikasi Petugas", deskripsi: "Setiap laporan diverifikasi petugas sebelum diproses.", href: RUTE.laporMeter, visual: "jaringan", tersedia: true },
    // Kartu teks
    { judul: "Lapor Angka Meter", deskripsi: "Kirim foto stand meter bulan ini langsung dari ponsel Anda.", href: RUTE.laporMeter, tersedia: true },
    { judul: "Pengaduan Gangguan Air", deskripsi: "Sampaikan gangguan air tanpa antre dan lacak perkembangan tiketnya.", href: RUTE.pengaduan, tersedia: true },
    { judul: "Tanpa Mendaftar", deskripsi: "Gratis, tanpa mendaftar. Cukup siapkan nomor langganan di rekening air Anda.", href: RUTE.cekTagihan, tersedia: true },
    { judul: "Layanan 24 Jam", deskripsi: "Laporan dapat disampaikan kapan saja tanpa perlu antre.", href: RUTE.pengaduan, tersedia: true },
    { judul: "Foto Bukti Meter", deskripsi: "Lampirkan foto stand meter sebagai bukti laporan Anda.", href: RUTE.laporMeter, tersedia: true },
    // Masih dalam pengembangan
    { judul: "Info Gangguan Air", deskripsi: "Lihat wilayah terdampak dan jadwal perbaikan di Kota Bandung.", href: RUTE.infoGangguan, tersedia: false },
    { judul: "Cara Pembayaran", deskripsi: "Pilih kanal pembayaran rekening air yang paling dekat dengan Anda.", href: RUTE.caraPembayaran, tersedia: false },
  ] satisfies Fitur[],
  // Kartu biru besar di kanan. "\n" = pindah baris.
  rilis: {
    judul: "Pengaduan",
    deskripsi: "Ada gangguan air? Laporkan sekarang.\nSetiap laporan diverifikasi petugas.",
    href: RUTE.pengaduan,
    label: "Laporkan gangguan air lewat halaman pengaduan",
  },
} as const

// "ikon" = kunci ikon HugeIcons yang dipetakan di tooling-section.tsx
export const TOOLING = {
  judul: "Tiga langkah, selesai dalam genggaman",
  item: [
    { judul: "Siapkan nomor langganan", deskripsi: "Nomor 11 digit tertera di rekening air Anda.", href: RUTE.cekTagihan, ikon: "langganan" },
    { judul: "Kirim laporan", deskripsi: "Pilih layanan, isi data, dan lampirkan foto bila diperlukan.", href: RUTE.laporMeter, ikon: "laporan" },
    { judul: "Diverifikasi petugas", deskripsi: "Setiap laporan diverifikasi petugas. Pantau statusnya kapan saja.", href: RUTE.pengaduan, ikon: "verifikasi" },
  ],
} as const

// Satu kartu angka di section showcase.
export type ItemShowcase = {
  // Menentukan ilustrasi di kartu (lihat showcase-section.tsx)
  jenis: "pelanggan" | "kelurahan" | "kecamatan" | "rekening"
  // Angka mentah (bukan teks) agar bisa dianimasikan dan diformat "22.496"
  nilai: number
  label: string
  // Keterangan kecil opsional, mis. periode data
  catatan?: string
}

// Angka contoh dari tampilan beranda sebelumnya. Ganti dengan data server.
export const SHOWCASE = {
  judul: "Melayani Kota Bandung",
  item: [
    { jenis: "pelanggan", nilai: 22496, label: "pelanggan aktif terlayani" },
    { jenis: "kelurahan", nilai: 21, label: "kelurahan dalam cakupan" },
    { jenis: "kecamatan", nilai: 7, label: "kecamatan di Kota Bandung" },
    { jenis: "rekening", nilai: 22511, label: "rekening diterbitkan", catatan: "Juli 2026" },
  ] satisfies ItemShowcase[],
} as const

// Satu kartu di section "Mulai dalam hitungan detik".
export type ItemTemplate = {
  judul: string
  deskripsi: string
  // Rute yang ditampilkan di bagian bawah kartu.
  rute: string
  href: string
  // false = halaman belum dibuat. Kartu tampil "Segera hadir" dan tidak bisa diklik,
  // jadi tidak ada tautan mati selama pengembangan. Ubah ke true saat halaman siap.
  tersedia: boolean
}

export const TEMPLATE = {
  judul: "Mulai dalam hitungan detik",
  deskripsi: "Layanan pelanggan PERUMDA Tirtawening langsung dari ponsel Anda, tanpa antre.",
  deploy: { label: "Laporkan gangguan", href: RUTE.pengaduan },
  semua: { label: "Lapor angka meter", href: RUTE.laporMeter },
  item: [
    // Sudah tersedia
    { judul: "Cek Tagihan", deskripsi: "Lihat tagihan air dengan nomor langganan 11 digit.", rute: RUTE.cekTagihan, href: RUTE.cekTagihan, tersedia: true },
    { judul: "Lapor Angka Meter", deskripsi: "Kirim foto stand meter dan pantau status verifikasinya.", rute: RUTE.laporMeter, href: RUTE.laporMeter, tersedia: true },
    { judul: "Pengaduan Gangguan Air", deskripsi: "Sampaikan gangguan air dan lacak perkembangan tiketnya.", rute: RUTE.pengaduan, href: RUTE.pengaduan, tersedia: true },
    // Masih dalam pengembangan (ubah tersedia: true jika halamannya sudah dibuat)
    { judul: "Info Gangguan Air", deskripsi: "Lihat wilayah terdampak dan jadwal perbaikan.", rute: RUTE.infoGangguan, href: RUTE.infoGangguan, tersedia: false },
    { judul: "Cara Pembayaran", deskripsi: "Pilih kanal pembayaran rekening air yang paling dekat dengan Anda.", rute: RUTE.caraPembayaran, href: RUTE.caraPembayaran, tersedia: false },
    { judul: "Pasang Baru", deskripsi: "Ajukan sambungan baru dan ikuti tahapan prosesnya.", rute: RUTE.pasangBaru, href: RUTE.pasangBaru, tersedia: false },
  ] satisfies ItemTemplate[],
} as const

export const CTA = {
  judul: "Ada gangguan air?",
  utama: { label: "Laporkan gangguan", href: RUTE.pengaduan },
  kedua: { label: "Lapor angka meter", href: RUTE.laporMeter },
} as const

// Satu tautan di footer.
export type TautanFooter = {
  label: string
  href: string
  // true = buka di tab baru (akun media sosial / situs luar)
  eksternal?: boolean
  // false = halaman/akun belum tersedia: tampil sebagai teks biasa (tidak bisa diklik).
  // Isi href lalu ubah ke true saat siap.
  tersedia: boolean
}

export const FOOTER: {
  kolom: { judul: string; tautan: readonly TautanFooter[] }[]
  berlangganan: { judul: string; labelEmail: string; placeholder: string; tombol: string; deskripsi: string }
  hakCipta: string
} = {
  kolom: [
    {
      judul: "Layanan",
      tautan: [
        { label: "Cek Tagihan", href: RUTE.cekTagihan, tersedia: true },
        { label: "Lapor Angka Meter", href: RUTE.laporMeter, tersedia: true },
        { label: "Pengaduan", href: RUTE.pengaduan, tersedia: true },
        { label: "Info Gangguan Air", href: RUTE.infoGangguan, tersedia: false },
      ],
    },
    {
      judul: "Informasi Pelanggan",
      tautan: [
        { label: "Tarif Air", href: RUTE.tarifAir, tersedia: false },
        { label: "Cara Pembayaran", href: RUTE.caraPembayaran, tersedia: false },
        { label: "Pasang Baru", href: RUTE.pasangBaru, tersedia: false },
        { label: "Pertanyaan Umum", href: RUTE.faq, tersedia: false },
      ],
    },
    {
      judul: "Tentang Perumda",
      tautan: [
        { label: "Profil Perusahaan", href: RUTE.profil, tersedia: false },
        { label: "Berita", href: RUTE.berita, tersedia: false },
        { label: "Kontak & Kantor Layanan", href: RUTE.kontak, tersedia: false },
        { label: "Dasbor Petugas", href: RUTE.dasbor, tersedia: true },
        // Akun media sosial: isi href dengan URL akun resmi, lalu ubah tersedia: true
        { label: "Instagram", href: "", eksternal: true, tersedia: false },
        { label: "Facebook", href: "", eksternal: true, tersedia: false },
        { label: "YouTube", href: "", eksternal: true, tersedia: false },
      ],
    },
    {
      judul: "Legal",
      tautan: [
        { label: "Kebijakan Privasi", href: RUTE.kebijakanPrivasi, tersedia: false },
        { label: "Syarat dan Ketentuan", href: RUTE.syaratKetentuan, tersedia: false },
      ],
    },
  ],
  berlangganan: {
    judul: "Berlangganan informasi layanan",
    labelEmail: "Masukkan email Anda",
    placeholder: "email@anda.com",
    tombol: "Langganan",
    deskripsi: "Dapatkan kabar gangguan air, jadwal perbaikan, dan pengumuman layanan.",
  },
  hakCipta: "PERUMDA Tirtawening Kota Bandung. Seluruh hak dilindungi.",
}