import type {
  FooterNavGroup,
  LanguageOption,
  NavLink,
  SocialLink,
} from "@/types/site"

export const BRAND = {
  nama: "PERUMDA Tirtawening",
  wilayah: "Kota Bandung",
  logo: "/logo.png",
} as const

export const RUTE = {
  cekTagihan: "/cek-tagihan",
  laporMeter: "/lapor-meter",
  pengaduan: "/pengaduan-air",
  dasbor: "/dashboard",
  infoGangguan: "/info-gangguan",
  tarifAir: "/tarif-air",
  caraPembayaran: "/cara-pembayaran",
  pasangBaru: "/pasang-baru",
  faq: "/faq",
  profil: "/profil",
  berita: "/berita",
  kontak: "/kontak",
  kebijakanPrivasi: "/kebijakan-privasi",
  syaratKetentuan: "/syarat-ketentuan",
} as const

export const siteConfig = {
  name: "PERUMDA Tirtawening Kota Bandung",
  shortName: "Tirtawening",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  title: "PERUMDA Tirtawening Kota Bandung | Layanan Air Bersih Modern",
  description:
    "Portal resmi pelayanan air minum Kota Bandung. Cek tagihan rekening air, laporkan angka meter mandiri, dan sampaikan pengaduan secara transparan, mudah, dan terpercaya.",
  keywords: [
    "Tirtawening",
    "PERUMDA Tirtawening",
    "PDAM Kota Bandung",
    "Cek Tagihan Air",
    "Lapor Meter Mandiri",
    "Pengaduan Air Bandung",
    "Peta Kebocoran Air",
    "Air Minum Bandung",
  ],
  copyright: "© 2026 PERUMDA Tirtawening Kota Bandung.",
  trademark:
    "PERUMDA Tirtawening adalah Badan Usaha Milik Daerah (BUMD) Pemerintah Kota Bandung.",
  footerLogo: {
    src: "/logo.png",
    alt: "PERUMDA Tirtawening Kota Bandung",
    width: 200,
    height: 60,
  },
} as const

export const downloadAppLink: NavLink = {
  label: "UNDUH APP",
  href: "/#unduh-app",
}

export const mainNavLinks: NavLink[] = [
  { label: "Cek Tagihan", href: "/cek-tagihan" },
  { label: "Lapor Meter", href: "/lapor-meter" },
  { label: "Pengaduan", href: "/pengaduan-air" },
  { label: "Masuk/Daftar", href: "/login" },
]

export const footerNavGroups: FooterNavGroup[] = [
  {
    title: "Layanan Mandiri",
    links: [
      { label: "Cek Rekening & Tagihan", href: "/cek-tagihan" },
      { label: "Lapor Angka Meter", href: "/lapor-meter" },
      { label: "Sampaikan Pengaduan", href: "/pengaduan-air" },
      { label: "Peta Kendali Aduan Spasial", href: "/peta-pengaduan" },
      { label: "Informasi Gangguan Aliran", href: "/info-gangguan" },
    ],
  },
  {
    title: "Pelanggan & Tarif",
    links: [
      { label: "Struktur Tarif Air Minum", href: "/tarif-air" },
      { label: "Saluran & Cara Pembayaran", href: "/cara-pembayaran" },
      { label: "Pasang Sambungan Baru", href: "/pasang-baru" },
      { label: "Tanya Jawab (FAQ)", href: "/faq" },
      { label: "Dasbor Petugas", href: "/dashboard" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Profil & Sejarah", href: "/profil" },
      { label: "Berita & Pengumuman", href: "/berita" },
      { label: "Kontak & Kantor Cabang", href: "/kontak" },
      { label: "Login Staf", href: "/login" },
    ],
  },
]

export const legalLinks: NavLink[] = [
  { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
  { label: "Syarat & Ketentuan", href: "/syarat-ketentuan" },
  { label: "Standar Pelayanan Minimal", href: "/profil" },
]

export const socialLinks: SocialLink[] = [
  {
    label: "Instagram PERUMDA Tirtawening",
    href: "https://instagram.com/perumdatirtawening",
    platform: "instagram",
  },
  {
    label: "TikTok PERUMDA Tirtawening",
    href: "https://www.tiktok.com/@perumdatirtawening",
    platform: "tiktok",
  },
  {
    label: "LinkedIn PERUMDA Tirtawening",
    href: "https://www.linkedin.com/company/perumda-tirtawening-kota-bandung",
    platform: "linkedin",
  },
]

export const appStoreLinks: NavLink[] = [
  {
    label: "Google Play",
    href: "https://play.google.com",
    external: true,
  },
  {
    label: "App Store",
    href: "https://apple.com/app-store",
    external: true,
  },
]

export const currentLanguageLabel = "Bahasa Indonesia"

export const languages: LanguageOption[] = [
  { label: "Bahasa Indonesia", href: "/" },
  { label: "Basa Sunda", href: "/" },
  { label: "English", href: "/" },
]
