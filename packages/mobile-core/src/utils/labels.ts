/**
 * labels.ts — padanan `core/utils/labels.dart`.
 *
 * SATU peta label Indonesia untuk semua nilai enum API — jangan memformat
 * enum per layar. Kunci = string mentah dari API.
 */

export const labelStatusTagihan: Record<string, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  SUDAH_BAYAR: 'Lunas',
  JATUH_TEMPO: 'Jatuh Tempo',
  DIHAPUSKAN: 'Dihapuskan',
};

export const labelStatusLaporan: Record<string, string> = {
  MENUNGGU: 'Menunggu',
  DIVERIFIKASI: 'Diverifikasi',
  DITOLAK: 'Ditolak',
  DIGUNAKAN: 'Digunakan',
};

export const labelKlasifikasiPengaduan: Record<string, string> = {
  NILAI_TAGIHAN_REKENING: 'Nilai Tagihan Rekening',
  BUKAN_NILAI_TAGIHAN_REKENING: 'Bukan Nilai Tagihan Rekening',
};

/// Urutannya mengikuti urutan resmi di loket pengaduan — dipertahankan apa
/// adanya karena objek ini JUGA yang mengurutkan pilihan di formulir.
export const labelJenisPengaduan: Record<string, string> = {
  LAPOR_STAND_METER: 'Lapor Stand Meter',
  MUTASI_GOLONGAN_TARIF: 'Mutasi Gol. Tarif',
  TIDAK_MAMPU_BAYAR: 'Tidak Mampu Bayar',
  PENCATATAN_METER_TIDAK_SESUAI: 'Pencatatan Meter Tidak Sesuai',
  LONJAKAN_PEMAKAIAN_AIR: 'Melonjakan Pemakaian Air',
  GANTI_STOP_KRAN: 'Ganti Stop Kran',
  BOCOR_PIPA_DINAS: 'Bocor Pipa Dinas',
  PASANGAN_LIAR: 'Pasangan Liar',
  TIDAK_ADA_AIR: 'Tidak Ada Air',
  AIR_KERUH_BAU_BERWARNA: 'Air Keruh Bau dan Berwarna',
  PINDAH_JARINGAN: 'Pindah Jaringan',
  LAINNYA: 'Lainnya',
};

/**
 * Status pengaduan punya TIGA peta label, bukan satu — pengecualian yang
 * disengaja terhadap aturan "satu peta untuk semua enum" di atas.
 *
 * Alasannya ada di alur tiketnya sendiri: SELESAI TIDAK berarti tiket sudah
 * tutup. Petugas menandai SELESAI (wajib catatan + foto bukti), lalu PELAPOR
 * yang menutup tiket dengan mengonfirmasi — backend menolak eksplisit petugas
 * menutup sendiri (server/modules/pengaduan/pengaduan.router.ts), supaya angka
 * kepuasan tidak bisa dikarang penanganannya. Bila pelapor diam sampai batas
 * waktu, sistem yang menutup otomatis (server/modules/pengaduan/otomatis.ts).
 *
 * Label netral 'Selesai' tidak menyampaikan satu pun dari itu: warga mengira
 * urusannya sudah beres dan tidak pernah mengonfirmasi, petugas mengira
 * tiketnya sudah tutup. Karena itu labelnya dipisah menurut SIAPA yang
 * membaca, dan setiap sisi menyebut pihak yang ditunggu secara eksplisit.
 *
 * Padanan web: LABEL_STATUS_PENGADUAN_WARGA (features/public/lib/format.ts)
 * dan LABEL_STATUS_PENGADUAN_STAF (features/dashboard/lib/label.ts).
 */

/** Dibaca WARGA (mobile-publik). "Anda" di sini = pelapor. */
export const labelStatusPengaduanWarga: Record<string, string> = {
  BARU: 'Diterima',
  TERVERIFIKASI: 'Terverifikasi',
  DITUGASKAN: 'Ditugaskan ke Petugas',
  MENUJU_LOKASI: 'Petugas Menuju Lokasi',
  DIPROSES: 'Sedang Ditangani',
  MENUNGGU_PELANGGAN: 'Perlu Tanggapan Anda',
  // Lebih pendek dari padanan web-nya ("Selesai — menunggu konfirmasi Anda")
  // karena di sini ia dirender sebagai badge sempit di samping nomor tiket.
  // Bagian "selesai"-nya sudah dibawa warna badge (nada success); yang tidak
  // boleh hilang justru bagian yang menyuruh warga bertindak.
  SELESAI: 'Perlu Konfirmasi Anda',
  DITUTUP: 'Ditutup',
  DIBUKA_KEMBALI: 'Dibuka Kembali',
  DITOLAK: 'Ditolak',
};

/** Dibaca PETUGAS (mobile-gangguan). Orang ketiga — tak pernah "Anda". */
export const labelStatusPengaduanStaf: Record<string, string> = {
  BARU: 'Baru',
  TERVERIFIKASI: 'Terverifikasi',
  DITUGASKAN: 'Ditugaskan',
  MENUJU_LOKASI: 'Menuju Lokasi',
  DIPROSES: 'Sedang Ditangani',
  MENUNGGU_PELANGGAN: 'Tunggu Tanggapan Pelapor',
  SELESAI: 'Tunggu Konfirmasi Pelapor',
  DITUTUP: 'Ditutup',
  DIBUKA_KEMBALI: 'Dibuka Kembali Pelapor',
  DITOLAK: 'Ditolak',
};

/**
 * Label TOMBOL transisi status. Peta ketiga karena tombol menyatakan
 * PERBUATAN, bukan keadaan: tombol berbunyi "Tunggu Konfirmasi Pelapor"
 * terbaca seperti keterangan status, bukan seperti sesuatu yang terjadi
 * kalau ditekan.
 */
export const labelAksiStatusPengaduan: Record<string, string> = {
  BARU: 'Kembalikan ke Baru',
  TERVERIFIKASI: 'Verifikasi',
  DITUGASKAN: 'Tugaskan',
  MENUJU_LOKASI: 'Tandai Menuju Lokasi',
  DIPROSES: 'Mulai Tangani',
  MENUNGGU_PELANGGAN: 'Tunggu Tanggapan Pelapor',
  SELESAI: 'Selesaikan',
  DITUTUP: 'Tutup Tiket',
  DIBUKA_KEMBALI: 'Buka Kembali',
  DITOLAK: 'Tolak',
};

/**
 * StatusPelanggan (prisma/pelanggan.prisma) — status sambungan pada kartu
 * langganan warga & pratinjau pelanggan.
 */
export const labelStatusPelanggan: Record<string, string> = {
  AKTIF: 'Aktif',
  TUTUP_SEMENTARA: 'Tutup Sementara',
  DISEGEL: 'Disegel',
  TUTUP_SPT: 'Tutup SPT',
};

export const labelPrioritas: Record<string, string> = {
  RENDAH: 'Rendah',
  NORMAL: 'Normal',
  TINGGI: 'Tinggi',
  DARURAT: 'Darurat',
};

/**
 * KondisiCatat — LENGKAP, seluruh 22 nilai enum (prisma/tagihan.prisma), urut:
 * keadaan normal dulu, lalu kelainan meter, lalu kendala kunjungan. Singkatan
 * warisan sistem lama (BMK/BMB, TTB, MTA, DK, MB) ditampilkan apa adanya —
 * kepanjangannya tidak terdokumentasi, TIDAK dikarang.
 */
export const labelKondisiMeter: Record<string, string> = {
  NORMAL: 'Normal',
  TIDAK_DIPAKAI: 'Tidak Dipakai',
  RUMAH_KOSONG: 'Rumah Kosong',
  STAND_TEMPEL: 'Stand Tempel',
  STAND_KONSUMEN: 'Stand Konsumen',
  METER_RUSAK: 'Meter Rusak',
  METER_MATI_ADA_AIR: 'Meter Mati, Ada Air',
  METER_MUNDUR: 'Meter Mundur',
  METER_TERBALIK: 'Meter Terbalik',
  METER_DALAM_AIR: 'Meter Dalam Air',
  LOS_METER: 'Los Meter',
  MUDA_KEMBALI: 'Muda Kembali',
  BMK_BMB: 'BMK/BMB',
  TTB: 'TTB',
  MTA: 'MTA',
  DK: 'DK',
  MB: 'MB',
  TERHALANG: 'Terhalang',
  TIDAK_ADA_AIR: 'Tidak Ada Air',
  ADA_ANJING: 'Ada Anjing',
  REV_PENCATAT: 'Revisi Pencatat',
  DICABUT: 'Dicabut',
};

/** KategoriPembacaan — cara baca dilakukan (di lokasi / jarak jauh). */
export const labelKategoriPembacaan: Record<string, string> = {
  ONSITE: 'Di Lokasi (Onsite)',
  OFFSITE: 'Jarak Jauh (Offsite)',
};

/**
 * Kondisi yang MEMBOLEHKAN stand akhir < stand lalu (aturan bisnis backend;
 * selain ini, stand mundur ditolak 400).
 */
export const kondisiSahMundur: ReadonlySet<string> = new Set([
  'METER_RUSAK',
  'METER_MUNDUR',
  'METER_TERBALIK',
  'METER_MATI_ADA_AIR',
  'MUDA_KEMBALI',
  'LOS_METER',
  'DICABUT',
]);

/** Ambil label; `-` bila kode null, kode mentah bila tak ada di peta. */
export function labelDari(
  peta: Record<string, string>,
  kode: string | null | undefined,
): string {
  if (kode == null) return '-';
  return peta[kode] ?? kode;
}
