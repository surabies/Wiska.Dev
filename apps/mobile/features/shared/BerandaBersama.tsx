/**
 * BerandaBersama.tsx — Halaman Beranda Bersama Enterprise (Unified Enterprise Portal).
 * Menampilkan identitas akun yang sedang login, kartu ringkasan dinamis sesuai peran,
 * serta katalog layanan lengkap yang mewah, elegan, dan berkelas.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  Camera,
  CheckCircle2,
  Clock,
  CloudDownload,
  CloudUpload,
  CreditCard,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  Layers,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareWarning,
  PhoneCall,
  Radar,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import {
  MasterPalette as P,
  PremiumBackground,
  StatusBadge,
  useTheme,
  MacAppIcon,
} from '@/components';
import { LAYOUT } from '@/lib/layout';
import { jumlahTertunda, ruteSaya } from '@/features/pencatat/lib/RepositoryBacaMeter';
import { tiketSaya, type TiketStaf } from '@/features/pengaduan/lib/RepositoryGangguan';
import { LanggananSayaCache } from '@/features/pelanggan/lib/RepositoryLangganan';
import { LaporanSayaCache } from '@/features/pelanggan/lib/RepositoryLaporanWarga';
import { SesiPengguna, useSesiPengguna, type TipePeran } from './SesiPengguna';

interface ItemLayanan {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: 'PENCATAT' | 'GANGGUAN' | 'PELANGGAN';
  ikon: LucideIcon;
  gradasi: [string, string];
  rute: string;
  badge?: string;
}

const DAFTAR_LAYANAN: ItemLayanan[] = [
  // ── Rumpun Pencatat ───────────────────────────────────────────────
  {
    id: 'rute',
    judul: 'Rute Baca Meter',
    deskripsi: 'Daftar pelanggan & urutan jalan',
    kategori: 'PENCATAT',
    ikon: MapPin,
    gradasi: [P.teal, P.teal600],
    rute: '/Rute',
  },
  {
    id: 'catat',
    judul: 'Catat Stand Meter',
    deskripsi: 'Input angka stand & foto bukti',
    kategori: 'PENCATAT',
    ikon: Gauge,
    gradasi: [P.teal400, P.teal700],
    rute: '/Catat',
  },
  {
    id: 'scan',
    judul: 'Scan Meter OCR',
    deskripsi: 'Deteksi otomatis angka meter AI',
    kategori: 'PENCATAT',
    ikon: Camera,
    gradasi: [P.sky300, P.sky600],
    rute: '/Scan',
    badge: 'AI',
  },
  {
    id: 'riwayat',
    judul: 'Riwayat Catat',
    deskripsi: 'Arsip bacaan meter tersimpan',
    kategori: 'PENCATAT',
    ikon: Clock,
    gradasi: [P.sky300, P.sky600],
    rute: '/Riwayat',
  },
  {
    id: 'unduh',
    judul: 'Unduh Rute',
    deskripsi: 'Sinkronisasi offline ke perangkat',
    kategori: 'PENCATAT',
    ikon: CloudDownload,
    gradasi: [P.emerald, P.emerald600],
    rute: '/Unduh',
  },
  {
    id: 'upload',
    judul: 'Unggah Data',
    deskripsi: 'Kirim antrean hasil catat ke server',
    kategori: 'PENCATAT',
    ikon: CloudUpload,
    gradasi: [P.rose, P.rose700],
    rute: '/Upload',
  },
  {
    id: 'anomali',
    judul: 'Daftar Anomali',
    deskripsi: 'Deteksi lonjakan & deviasi pemakaian',
    kategori: 'PENCATAT',
    ikon: Radar,
    gradasi: [P.rose400, P.rose700],
    rute: '/Anomali',
  },
  {
    id: 'cadangan',
    judul: 'Cadangan Lokal',
    deskripsi: 'Pencadangan database SQLite lokal',
    kategori: 'PENCATAT',
    ikon: ShieldCheck,
    gradasi: [P.emerald400, P.emerald600],
    rute: '/Cadangan',
  },

  // ── Rumpun Gangguan & Pengaduan ───────────────────────────────────
  {
    id: 'tiket-teknisi',
    judul: 'Tiket Penugasan',
    deskripsi: 'Penanganan gangguan lapangan teknisi',
    kategori: 'GANGGUAN',
    ikon: Wrench,
    gradasi: [P.rose300, P.rose600],
    rute: '/Tiket',
  },
  {
    id: 'lapor-aduan',
    judul: 'Lapor Pengaduan',
    deskripsi: 'Laporan kebocoran pipa & air mati',
    kategori: 'GANGGUAN',
    ikon: MessageSquareWarning,
    gradasi: [P.rose400, P.rose700],
    rute: '/Pengaduan',
    badge: '24 Jam',
  },
  {
    id: 'lacak-tiket',
    judul: 'Lacak Tiket',
    deskripsi: 'Pantau status perbaikan & chat staf',
    kategori: 'GANGGUAN',
    ikon: Search,
    gradasi: [P.teal, P.teal600],
    rute: '/LacakTiket',
  },

  // ── Rumpun Pelanggan ──────────────────────────────────────────────
  {
    id: 'cek-tagihan',
    judul: 'Cek Tagihan Air',
    deskripsi: 'Informasi tagihan rekening berjalan',
    kategori: 'PELANGGAN',
    ikon: ReceiptText,
    gradasi: [P.sky, P.sky700],
    rute: '/CekTagihan',
  },
  {
    id: 'info-tagihan',
    judul: 'Info Rekening',
    deskripsi: 'Rincian tarif air, denda, & meter',
    kategori: 'PELANGGAN',
    ikon: FileText,
    gradasi: [P.sky300, P.sky700],
    rute: '/InfoTagihan',
  },
  {
    id: 'lapor-meter',
    judul: 'Lapor Mandiri',
    deskripsi: 'Catat angka meter mandiri bulanan',
    kategori: 'PELANGGAN',
    ikon: Gauge,
    gradasi: [P.emerald400, P.emerald700],
    rute: '/LaporMeter',
  },
  {
    id: 'kelola-langganan',
    judul: 'Kelola Langganan',
    deskripsi: 'Tambah & atur nomor sambungan',
    kategori: 'PELANGGAN',
    ikon: CreditCard,
    gradasi: [P.teal, P.teal700],
    rute: '/KelolaLangganan',
  },
  {
    id: 'laporan-saya',
    judul: 'Laporan Saya',
    deskripsi: 'Riwayat pengaduan akun terdaftar',
    kategori: 'PELANGGAN',
    ikon: Ticket,
    gradasi: [P.rose300, P.rose600],
    rute: '/LaporanSaya',
  },
];

/**
 * Filter otomatis menu launcher berdasarkan peran pengguna:
 * - DIREKSI / SENIOR_MANAGER / MANAGER / SUPER_ADMIN: Modul pemantauan & informasi
 * - SUPERVISOR: Pengawasan lapangan & tiket
 * - STAFF / PELAKSANA:
 *     - Teknisi: Tiket penugasan, pelacakan, dan aduan
 *     - Pencatat: Rute, catat stand, scan AI, riwayat, unduh, unggah, anomali, cadangan
 * - WARGA / PELANGGAN: Cek tagihan, info rekening, lapor mandiri, lapor gangguan, kelola sambungan
 * - TAMU: Layanan publik (tagihan, rekening, lapor gangguan, lacak tiket)
 */
function saringLayananSesuaiPeran(role: string | undefined, tipePeran: TipePeran): ItemLayanan[] {
  const r = (role ?? '').toUpperCase();

  // Manajemen & Eksekutif (Senior Manager, Manager, Direksi, Super Admin)
  if (['DIREKSI', 'SENIOR_MANAGER', 'MANAGER', 'SUPER_ADMIN'].includes(r)) {
    return DAFTAR_LAYANAN.filter((item) =>
      ['rute', 'anomali', 'lacak-tiket', 'riwayat', 'cek-tagihan', 'info-tagihan', 'upload'].includes(item.id)
    );
  }

  // Supervisor Operasional
  if (r === 'SUPERVISOR' || tipePeran === 'SUPERVISOR') {
    return DAFTAR_LAYANAN.filter((item) =>
      ['rute', 'anomali', 'tiket-teknisi', 'riwayat', 'upload', 'cadangan', 'lacak-tiket'].includes(item.id)
    );
  }

  // Staff / Pelaksana
  if (r === 'STAFF' || r === 'PELAKSANA') {
    if (tipePeran === 'TEKNISI') {
      return DAFTAR_LAYANAN.filter((item) =>
        ['tiket-teknisi', 'lacak-tiket', 'riwayat', 'lapor-aduan'].includes(item.id)
      );
    }
    // Default Petugas Pencatat Meter
    return DAFTAR_LAYANAN.filter((item) =>
      ['rute', 'catat', 'scan', 'riwayat', 'unduh', 'upload', 'anomali', 'cadangan'].includes(item.id)
    );
  }

  // Pelanggan / Warga
  if (tipePeran === 'WARGA' || r === 'USER') {
    return DAFTAR_LAYANAN.filter((item) =>
      ['cek-tagihan', 'info-tagihan', 'lapor-meter', 'lapor-aduan', 'lacak-tiket', 'kelola-langganan', 'laporan-saya'].includes(item.id)
    );
  }

  // Tamu (Belum Login)
  return DAFTAR_LAYANAN.filter((item) =>
    ['cek-tagihan', 'info-tagihan', 'lapor-aduan', 'lacak-tiket'].includes(item.id)
  );
}

function sapaanWaktu(): string {
  const jam = new Date().getHours();
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function BerandaBersamaScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profil, sudahMasuk, peran } = useSesiPengguna();

  // Metrik lokal per peran
  const [antreanCatat, setAntreanCatat] = useState(0);
  const [totalRute, setTotalRute] = useState(0);
  const [tiketTeknisi, setTiketTeknisi] = useState<TiketStaf[]>([]);
  const [memuatRingkasan, setMemuatRingkasan] = useState(false);

  const muatDataRingkasan = useCallback(async () => {
    setMemuatRingkasan(true);
    try {
      // Muat antrean catat lokal
      const tertunda = await jumlahTertunda().catch(() => 0);
      setAntreanCatat(tertunda);

      // Jika pencatat / supervisor: muat rute
      if (peran.tipe === 'PENCATAT' || peran.tipe === 'SUPERVISOR') {
        const paket = await ruteSaya().catch(() => null);
        if (paket) setTotalRute(paket.target);
      }

      // Jika teknisi / supervisor: muat tiket gangguan
      if (peran.tipe === 'TEKNISI' || peran.tipe === 'SUPERVISOR') {
        const daftarTiket = await tiketSaya().catch(() => []);
        setTiketTeknisi(daftarTiket);
      }

      // Jika warga: muat langganan & laporan
      if (peran.tipe === 'WARGA') {
        await LanggananSayaCache.muat(false).catch(() => {});
        await LaporanSayaCache.muat(false).catch(() => {});
      }
    } finally {
      setMemuatRingkasan(false);
    }
  }, [peran.tipe]);

  useEffect(() => {
    void muatDataRingkasan();
  }, [muatDataRingkasan]);

  // Filter layanan otomatis sesuai peran
  const layananTersaring = saringLayananSesuaiPeran(profil?.role, peran.tipe);

  const inisial = profil?.name
    ? profil.name
        .split(' ')
        .map((p: string) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TW';

  return (
    <PremiumBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. HERO IDENTITAS ENTERPRISE ──────────────────────────────── */}
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          {/* Top Bar: Brand & Aksi Cepat */}
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogoBox}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.brandPerumda}>PERUMDA</Text>
                <Text style={styles.brandNama}>TIRTAWENING</Text>
              </View>
            </View>

            <View style={styles.topAksi}>
              <Pressable
                onPress={() => router.push('/Notifikasi')}
                style={styles.iconCircle}
              >
                <Bell size={18} color="#94A3B8" />
              </Pressable>
              <Pressable
                onPress={() => router.push('/PengaturanApi')}
                style={styles.iconCircle}
              >
                <Settings size={18} color="#94A3B8" />
              </Pressable>
              <Pressable
                onPress={() => (sudahMasuk ? router.push('/Akun') : router.push('/Masuk'))}
                style={[styles.iconCircle, sudahMasuk && { borderColor: peran.tinta + '60' }]}
              >
                {sudahMasuk ? (
                  <User size={18} color={peran.tinta} />
                ) : (
                  <LogIn size={18} color="#38BDF8" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Kartu Profil & Identitas User */}
          <View style={styles.identitasBox}>
            <View style={styles.avatarRow}>
              <LinearGradient
                colors={peran.gradasi}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>{inisial}</Text>
                <View style={styles.statusDot} />
              </LinearGradient>

              <View style={styles.identitasTeks}>
                <Text style={styles.sapaan}>{sapaanWaktu()},</Text>
                <Text style={styles.namaUser} numberOfLines={1}>
                  {profil?.name ?? 'Tamu Tirtawening'}
                </Text>
                <Text style={styles.emailUser} numberOfLines={1}>
                  {profil?.email ?? 'Masuk untuk sinkronisasi cloud'}
                </Text>
                {profil?.jabatan || profil?.nomorPelanggan || profil?.nip || profil?.nik || profil?.divisiKode || profil?.subBagianKode ? (
                  <View style={styles.subIdentitasRow}>
                    {profil?.jabatan ? (
                      <Text style={styles.subIdentitasPill}>{profil.jabatan}</Text>
                    ) : null}
                    {profil?.nomorPelanggan ? (
                      <Text style={styles.subIdentitasPill}>ID: {profil.nomorPelanggan}</Text>
                    ) : null}
                    {profil?.nip ? (
                      <Text style={styles.subIdentitasPill}>NIP: {profil.nip}</Text>
                    ) : null}
                    {profil?.nik ? (
                      <Text style={styles.subIdentitasPill}>NIK: {profil.nik}</Text>
                    ) : null}
                    {profil?.divisiKode ? (
                      <Text style={styles.subIdentitasPill}>Div: {profil.divisiKode}</Text>
                    ) : null}
                    {profil?.subBagianKode ? (
                      <Text style={styles.subIdentitasPill}>Unit: {profil.subBagianKode}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            {/* Badge Peran Mewah */}
            <View style={styles.badgeRow}>
              <LinearGradient
                colors={peran.gradasi}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.roleBadge}
              >
                <Sparkles size={13} color="#FFFFFF" />
                <Text style={styles.roleBadgeText}>{peran.label.toUpperCase()}</Text>
              </LinearGradient>

              <View style={styles.serverChip}>
                <View style={styles.greenPulse} />
                <Text style={styles.serverText}>Sistem Terhubung</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* ── 2. KARTU RINGKASAN DINAMIS PER PERAN ─────────────────────── */}
          {/* Jika belum masuk: tampilkan banner ajakan login */}
          {!sudahMasuk ? (
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.kartuTamu}
            >
              <View style={styles.tamuKiri}>
                <Text style={styles.tamuJudul}>Akses Penuh Seluler</Text>
                <Text style={styles.tamuSub}>
                  Masuk dengan akun petugas atau warga untuk mengakses rute, tugas gangguan, atau riwayat tagihan Anda.
                </Text>
                <View style={styles.tamuTombolRow}>
                  <Pressable
                    onPress={() => router.push('/Masuk')}
                    style={styles.tombolMasukMini}
                  >
                    <LogIn size={15} color="#FFFFFF" />
                    <Text style={styles.tombolMasukMiniTeks}>Masuk Akun</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/Daftar')}
                    style={styles.tombolDaftarMini}
                  >
                    <Text style={styles.tombolDaftarMiniTeks}>Daftar Warga</Text>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          ) : peran.tipe === 'PENCATAT' || peran.tipe === 'SUPERVISOR' ? (
            /* Ringkasan Pencatat Meter */
            <View style={styles.ringkasanBox}>
              <Text style={[styles.seksiJudul, { color: colors.foreground }]}>Status Operasional Catat Meter</Text>
              <View style={styles.metrikGrid}>
                <View style={[styles.kartuMetrik, { backgroundColor: '#06B6D41A', borderColor: '#06B6D440' }]}>
                  <Text style={[styles.nilaiMetrik, { color: '#22D3EE' }]}>{totalRute}</Text>
                  <Text style={styles.labelMetrik}>Pelanggan Rute</Text>
                </View>
                <View style={[styles.kartuMetrik, { backgroundColor: '#F43F5E1A', borderColor: '#F43F5E40' }]}>
                  <Text style={[styles.nilaiMetrik, { color: '#FB7185' }]}>{antreanCatat}</Text>
                  <Text style={styles.labelMetrik}>Antre Unggah</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/Upload')}
                  style={[styles.kartuMetrik, { backgroundColor: '#10B9811A', borderColor: '#10B98140' }]}
                >
                  <CheckCircle2 size={24} color="#34D399" />
                  <Text style={[styles.labelMetrik, { color: '#34D399', fontWeight: '700' }]}>Kirim Data</Text>
                </Pressable>
              </View>
            </View>
          ) : peran.tipe === 'TEKNISI' ? (
            /* Ringkasan Teknisi Gangguan */
            <View style={styles.ringkasanBox}>
              <Text style={[styles.seksiJudul, { color: colors.foreground }]}>Penugasan Gangguan Aktif</Text>
              <View style={styles.metrikGrid}>
                <View style={[styles.kartuMetrik, { backgroundColor: '#F43F5E1A', borderColor: '#F43F5E40' }]}>
                  <Text style={[styles.nilaiMetrik, { color: '#FB7185' }]}>{tiketTeknisi.length}</Text>
                  <Text style={styles.labelMetrik}>Tiket Ditugaskan</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/Tiket')}
                  style={[styles.kartuMetrik, { backgroundColor: '#0284C71A', borderColor: '#0284C740', flex: 2 }]}
                >
                  <Wrench size={22} color="#38BDF8" />
                  <Text style={[styles.labelMetrik, { color: '#38BDF8', fontWeight: '700' }]}>
                    Buka Lembar Kerja Teknisi
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Ringkasan Warga / Pelanggan */
            <View style={styles.ringkasanBox}>
              <Text style={[styles.seksiJudul, { color: colors.foreground }]}>Ringkasan Layanan Anda</Text>
              <View style={styles.metrikGrid}>
                <Pressable
                  onPress={() => router.push('/CekTagihan')}
                  style={[styles.kartuMetrik, { backgroundColor: '#0284C71A', borderColor: '#0284C740' }]}
                >
                  <ReceiptText size={22} color="#38BDF8" />
                  <Text style={[styles.labelMetrik, { color: '#38BDF8', fontWeight: '700' }]}>Cek Tagihan</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/LaporanSaya')}
                  style={[styles.kartuMetrik, { backgroundColor: '#EC48991A', borderColor: '#EC489940' }]}
                >
                  <Ticket size={22} color="#F472B6" />
                  <Text style={[styles.labelMetrik, { color: '#F472B6', fontWeight: '700' }]}>Laporan Saya</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── 3. LAUNCHER MODUL OPERASIONAL (iOS Launcher Grid Ringkas) ── */}
          <View style={styles.gridLayananIos}>
            {layananTersaring.map((item) => {
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(item.rute as any)}
                  style={({ pressed }) => [
                    styles.itemIos,
                    pressed && { transform: [{ scale: 0.9 }], opacity: 0.75 },
                  ]}
                >
                  <View style={styles.iconContainerIos}>
                    <MacAppIcon ikon={item.ikon} gradasi={item.gradasi} size={54} iconSize={26} />
                    {item.badge ? (
                      <View style={styles.badgeIos}>
                        <Text style={styles.badgeIosTeks}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text
                    style={[styles.labelIos, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {item.judul}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── 4. BANNER BANTUAN OPERASIONAL 24 JAM ───────────────────────── */}
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            style={styles.bannerBantuan}
          >
            <View style={styles.bantuanIkonBox}>
              <PhoneCall size={24} color="#38BDF8" />
            </View>
            <View style={styles.bantuanInfo}>
              <Text style={styles.bantuanJudul}>Pusat Bantuan & Pengaduan 24 Jam</Text>
              <Text style={styles.bantuanSub}>
                Layanan darurat pipa bocor, air mati mendadak, atau bantuan rekening Tirtawening.
              </Text>
              <Text style={styles.bantuanNomor}>Hotline: (022) 2509030 / 2509032</Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: {
    maxWidth: LAYOUT.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderWidth: 1,
    borderColor: '#38BDF825',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.4)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF840',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: { width: 28, height: 28 },
  brandPerumda: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#38BDF8',
  },
  brandNama: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#F8FAFC',
  },
  topAksi: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF14',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identitasBox: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF0D',
    borderWidth: 1,
    borderColor: '#FFFFFF18',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  identitasTeks: { flex: 1 },
  sapaan: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  namaUser: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 1,
  },
  emailUser: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFFFFF15',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  serverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#10B9811A',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#10B98140',
  },
  greenPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  serverText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
  },
  body: {
    maxWidth: LAYOUT.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 20,
  },
  kartuTamu: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF830',
  },
  tamuKiri: { flex: 1 },
  tamuJudul: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  tamuSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 14,
  },
  tamuTombolRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tombolMasukMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tombolMasukMiniTeks: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tombolDaftarMini: {
    borderWidth: 1,
    borderColor: '#38BDF860',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tombolDaftarMiniTeks: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
  ringkasanBox: {
    gap: 10,
  },
  seksiJudul: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  seksiSub: {
    fontSize: 12,
    marginTop: 2,
  },
  metrikGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  kartuMetrik: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nilaiMetrik: {
    fontSize: 22,
    fontWeight: '800',
  },
  labelMetrik: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
  },
  subIdentitasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  subIdentitasPill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    backgroundColor: '#38BDF818',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38BDF835',
  },
  gridLayananIos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  itemIos: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  iconContainerIos: {
    position: 'relative',
    marginBottom: 7,
  },
  badgeIos: {
    position: 'absolute',
    top: -4,
    right: -6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  badgeIosTeks: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  labelIos: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: -0.2,
  },
  bannerBantuan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF825',
    marginTop: 6,
  },
  bantuanIkonBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0284C720',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bantuanInfo: { flex: 1 },
  bantuanJudul: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  bantuanSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 16,
  },
  bantuanNomor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
    marginTop: 4,
  },
});
