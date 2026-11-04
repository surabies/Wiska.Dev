import type {
  BenefitsContent,
  FeatureSectionContent,
  HeroContent,
  TicketingContent,
  TopEventsContent,
} from "@/types/home"

export const heroContent: HeroContent = {
  title: "URUSAN AIR DALAM GENGGAMAN",
  description:
    "Layanan digital terpadu PERUMDA Tirtawening Kota Bandung. Cek tagihan rekening air, laporkan angka meter mandiri, dan sampaikan pengaduan gangguan secara cepat, transparan, serta terverifikasi 24 jam.",
  videoSrc: "/vid/hero.mp4",
  cta: { label: "Cek Tagihan Air", href: "/cek-tagihan" },
}

export const topEventsContent: TopEventsContent = {
  title: "Layanan Unggulan Pelanggan",
  description:
    "Akses langsung seluruh kanal pelayanan mandiri dan informasi operasional air minum perpipaan Kota Bandung tanpa perlu datang ke kantor pelayanan.",
  cta: { label: "Buka Peta Kendali", href: "/peta-pengaduan" },
  events: [
    {
      id: "1",
      title: "Cek Tagihan Rekening Air",
      venue: "Layanan Mandiri 24 Jam",
      city: "Kota Bandung",
      date: "Online 24 Jam",
      price: "12 Periode",
      accentColor: "#00d8af",
    },
    {
      id: "2",
      title: "Lapor Stand Meter Mandiri",
      venue: "Pembacaan Mandiri",
      city: "Kota Bandung",
      date: "Tgl 1 - 20 Tiap Bulan",
      price: "Kirim Foto",
      accentColor: "#24afee",
    },
    {
      id: "3",
      title: "Pengaduan Gangguan & Kebocoran",
      venue: "Tim Reaksi Cepat",
      city: "Kota Bandung",
      date: "Respon Cepat",
      price: "Tiket Aduan",
      accentColor: "#f2ef1d",
    },
    {
      id: "4",
      title: "Peta Kendali Pengaduan Spasial",
      venue: "Sistem GIS Operasional",
      city: "Kota Bandung",
      date: "Live Monitoring",
      price: "Peta Digital",
      accentColor: "#4bfa94",
    },
    {
      id: "5",
      title: "Pendaftaran Sambungan Baru",
      venue: "Pelayanan Pasang Baru",
      city: "Kota Bandung",
      date: "Senin - Jumat",
      price: "Rumah & Niaga",
      accentColor: "#a783ff",
    },
    {
      id: "6",
      title: "Info Pemeliharaan & Gangguan",
      venue: "Pusat Distribusi Jaringan",
      city: "Kota Bandung",
      date: "Pembaruan Real-Time",
      price: "Jadwal Pipa",
      accentColor: "#0000fe",
    },
  ],
}

export const ticketingContent: TicketingContent = {
  title: "Kemudahan Layanan Mandiri",
  items: [
    {
      description:
        "Cek rincian tagihan rekening air dan grafik pemakaian 12 bulan terakhir dalam hitungan detik.",
    },
    {
      description:
        "Foto dan laporkan angka stand meter air sendiri dari rumah sebelum tanggal 20 agar tagihan selalu presisi.",
    },
    {
      description:
        "Laporkan titik pipa bocor atau aliran keruh di peta interaktif untuk langsung ditangani teknisi lapangan.",
    },
  ],
}

export const benefitsContent: BenefitsContent = {
  title: "Mengapa Layanan Digital Tirtawening?",
  items: [
    {
      title: "Transparansi perhitungan kubikasi pemakaian air tanpa biaya tersembunyi",
      icon: {
        src: "https://dicewebsite.cdn.prismic.io/dicewebsite/Z6tNz5bqstJ9-emG_ticket.svg",
        alt: "Transparansi Tarif",
      },
    },
    {
      title: "Kemudahan lapor mandiri dengan verifikasi foto meteran oleh staf resmi",
      icon: {
        src: "https://dicewebsite.cdn.prismic.io/dicewebsite/Z6tN2pbqstJ9-emH_friends-add.svg",
        alt: "Verifikasi Cepat",
      },
    },
    {
      title: "Tindak lanjut pengaduan kebocoran pipa oleh Tim Reaksi Cepat di lapangan",
      icon: {
        src: "https://dicewebsite.cdn.prismic.io/dicewebsite/Z6tN5pbqstJ9-emK_merch.svg",
        alt: "Reaksi Cepat",
      },
    },
  ],
}

export const featureSections: FeatureSectionContent[] = [
  {
    id: "jaringan-cakupan",
    title: "Jangkauan Jaringan Pipa Air Minum se-Kota Bandung",
    description:
      "PERUMDA Tirtawening mengalirkan air minum perpipaan ke lebih dari 170.000 sambungan pelanggan di wilayah utara, timur, barat, dan selatan Kota Bandung dengan pemantauan kualitas laboratorium berkala.",
    media: {
      type: "image",
      src: "https://images.prismic.io/dicewebsite/ahCB3LK9tuLqEFdI_b2b-partners-logo-narrow.png?auto=format%2Ccompress&fit=max&w=3840",
      alt: "Peta Jaringan Pipa Air Bandung",
      width: 1080,
      height: 1350,
    },
    mediaPosition: "right",
    cta: { label: "Buka Peta Kendali", href: "/peta-pengaduan" },
  },
  {
    id: "lapor-meter-mandiri",
    title: "Pelaporan Stand Meter Mandiri yang Akurat",
    description:
      "Cegah lonjakan tagihan tak terduga. Ambil foto stand meteran air Anda, masukkan angkanya, dan kirimkan langsung setiap tanggal 1 hingga 20. Staf verifikator kami akan memvalidasi keabsahan data sebelum tagihan diterbitkan.",
    media: {
      type: "video",
      src: "https://dicewebsite.cdn.prismic.io/dicewebsite/Z6tTHZbqstJ9-eqd_B2C_Home_Artists-1-.mp4",
    },
    mediaPosition: "left",
    cta: { label: "Lapor Meter Sekarang", href: "/lapor-meter" },
  },
  {
    id: "pengaduan-warga",
    title: "Pengaduan Kebocoran & Gangguan Aliran 24 Jam",
    description:
      "Melihat pipa dinas bocor di jalan, air mati, atau meteran air rusak? Laporkan lokasinya dengan penanda peta GPS interaktif. Tiket aduan Anda langsung masuk ke dashboard teknisi reaksi cepat.",
    media: {
      type: "video",
      src: "https://dicewebsite.cdn.prismic.io/dicewebsite/Z6tsYJbqstJ9-fMC_B2C_Home_Fans-1-.mp4",
    },
    mediaPosition: "right",
    cta: { label: "Kirim Pengaduan Air", href: "/pengaduan-air" },
  },
]
