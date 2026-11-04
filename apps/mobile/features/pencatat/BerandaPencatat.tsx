/**
 * beranda-screen.tsx — beranda aplikasi Pencatat Meter, tab pertama.
 *
 * HALAMAN INI MEMBAWA IDENTITAS APLIKASI. Ia yang dilihat pertama dan yang
 * dipakai saat mempresentasikan aplikasi, jadi permukaannya BERWARNA menurut
 * makna yang sudah ditetapkan di `WARNA_UBIN` di bawah — bukan kaca netral.
 * Tiap kartu memakai rumpun yang menjelaskan isinya:
 *
 *   Dicatat saya    → sky, data yang sudah ada
 *   Antre kirim     → rose, yang menuntut dikirim
 *
 * Kartu cincin sengaja NETRAL. Ia kartu terbesar dan paling atas; memberinya
 * latar berwarna membuat halaman didominasi satu blok hijau dan justru
 * melemahkan dua kartu di bawahnya. Warnanya cukup dibawa busur cincin.
 *
 * MODE GELAP AKTIF. Seluruh permukaan dan teks mengambil `useTheme().colors`
 * lewat token `nada*`, yang latarnya turun ke ujung gelap rumpun dan tintanya
 * naik ke ujung terang. Hex MasterPalette langsung hanya untuk yang memang
 * sama di kedua mode: gradasi header dan busur cincin.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { File } from 'expo-file-system';
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  Clock,
  FileText,
  ListChecks,
  MapPinOff,
  Radar,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
  User,
  type LucideProps,
} from 'lucide-react-native';
import {
  ApiException,
  formatUkuranByte,
  labelPeriode,
  type CatatTertunda,
  type RuteSaya,
} from '@workspace/mobile-core';
import { MasterPalette as P, PremiumBackground, Radius, useTheme, type ThemeColors, Tekan } from '@/components';
import { daftarTertunda, jumlahTertunda, ruteSaya } from '@/features/pencatat/lib/RepositoryBacaMeter';
import { RingProgresTarget } from '@/features/pencatat/components/RingProgres';
import { LayarGradasi } from '@/features/pencatat/components/LayarGradasi';

/** Ambang peringatan antrean — nilai yang sama dipakai sejak versi Flutter. */
const AMBANG_PERHATIAN = 400;

type Ikon = React.ComponentType<LucideProps>;

/**
 * Permukaan bernada: latar + garis tepi dari satu rumpun warna, dengan
 * bayangan yang sama untuk semua kartu halaman ini. Satu fungsi supaya
 * kedalaman dan ketebalan garisnya tidak pernah berbeda antar kartu.
 */
function permukaanNetral(isDark: boolean): ViewStyle {
  return {
    backgroundColor: isDark ? '#1E293BCC' : '#FFFFFFE6',
    borderColor: isDark ? '#94A3B82E' : '#CBD5E166',
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: `0px 10px 24px rgba(15, 23, 42, ${isDark ? 0.4 : 0.1})`,
  };
}

function permukaanNada(latar: string, tinta: string): ViewStyle {
  return {
    backgroundColor: latar,
    borderColor: tinta + '2E',
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 10px 24px rgba(15, 23, 42, 0.10)',
  };
}

/**
 * Ubin "premium solid" — fill vivid + glow warna-senada di bawahnya + sedikit
 * highlight di tepi atas (simulasi gradasi tanpa expo-linear-gradient).
 * Kontras cukup di kedua tema karena warnanya selalu solid & vivid, jadi
 * TIDAK butuh cabang isDark.
 */
/**
 * Warna ubin — RUMPUN MEMBAWA MAKNA, bukan dipilih agar meriah.
 *
 * Susunan lama memakai empat hue yang berpencar tanpa aturan (sky, teal, rose,
 * emerald, lalu rose lagi) dengan tingkat terang campur aduk 500/600/700. Dua
 * ubin sama-sama merah padahal hanya satu yang genting, dan tetangga yang
 * bertabrakan membuat grid terbaca acak. Komentar di atasnya bahkan mengklaim
 * warnanya "disatukan memakai warna primer tema" — yang tidak pernah benar.
 *
 * Aturannya sekarang:
 *   sky     — melihat data yang sudah ada
 *   rose    — menuntut perhatian
 *   emerald — menjaga keselamatan data
 *   slate   — BELUM ADA (lihat UbinSegera)
 *
 * Ubin sehaluan diletakkan bersebelahan dan turun satu anak tangga
 * (600 lalu 700), sehingga iramanya terbaca sengaja. Semua tetap di dalam 5
 * rumpun palet resmi; lihat aturan di components/theme/palette.ts.
 */
const WARNA_UBIN = {
  riwayat: [P.sky300, P.sky600],
  infoTagihan: [P.sky, P.sky700],
  notifikasi: [P.rose300, P.rose600],
  anomali: [P.rose400, P.rose700],
  cadangan: [P.emerald400, P.emerald600],
  /// Satu pasang untuk semua yang belum jadi — lihat UbinSegera.
  segera: [P.slate200, P.slate300],
} as const satisfies Record<string, readonly [string, string]>;

/**
 * Gradasi terang -> gelap DALAM SATU RUMPUN, rentangnya lebar (mis.
 * sky300 -> sky600) — bukan dua anak tangga bersebelahan. Rentang lebar itu
 * yang memberi kesan bervolume; dua tangga berdampingan nyaris rata dan
 * ujung-ujungnya tetap nilai resmi palette.ts.
 */
type WarnaUbin = readonly [string, string];

/** Tinta ikon & label di ubin "segera" — kontras rendah, sengaja. */
const WARNA_TINTA_SEGERA = P.slate600;

/**
 * Warna ubin aktif — DISATUKAN memakai warna primer tema aplikasi (bukan 4
 * hue berbeda seperti sebelumnya), supaya ubin terasa "satu keluarga" dengan
 * header/brand, gaya launcher (Windows tile / iOS shortcut): kotak berwarna
 * solid, ikon & label putih di dalamnya.
 */

export function BerandaPencatatScreen({
  onBukaAkun,
  onBukaRiwayat,
  onBukaInfoTagihan,
  onBukaNotifikasi,
  onBukaCadangan,
  onBukaAnomali,
}: {
  onBukaAkun: () => void;
  onBukaRiwayat: () => void;
  onBukaInfoTagihan: () => void;
  onBukaNotifikasi: () => void;
  onBukaCadangan: () => void;
  onBukaAnomali: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [tertunda, setTertunda] = useState(0);
  const [byteFoto, setByteFoto] = useState(0);
  const [memuat, setMemuat] = useState(false);
  // MEMBEDAKAN "belum selesai memuat" DARI "sudah, tapi tidak dapat apa-apa".
  //
  // Sebelumnya keduanya sama-sama `paket == null`, dan layar menampilkan
  // "Memuat rute…" beserta spinner. Jadi jaringan putus, sesi habis, dan
  // periode yang memang belum punya daftar kerja SEMUANYA terlihat seperti
  // aplikasi yang sedang bekerja — padahal ia sudah menyerah. Petugas
  // menunggu sesuatu yang tidak akan pernah datang.
  const [sudahDicoba, setSudahDicoba] = useState(false);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  /**
   * `paksa` true = tarik ulang dari server (pull-to-refresh); false = baca
   * cache lokal. Navigasi biasa TIDAK menembak jaringan: paket rute sudah
   * diunduh, dan menariknya ulang tiap kali berpindah layar adalah persis
   * yang membuat aplikasi terasa berat di sinyal lemah.
   */
  const muat = useCallback(async (paksa = false) => {
    setMemuat(true);
    try {
      // Galatnya DITANGKAP, bukan ditelan: pesannya dipakai layar untuk
      // menjelaskan apa yang terjadi, bukan sekadar jadi null diam-diam.
      let galat: string | null = null;
      const [hasilPaket, hasilAntre, isiAntrean] = await Promise.all([
        ruteSaya({ segarkan: paksa }).catch((e: unknown): RuteSaya | null => {
          galat = ApiException.is(e) ? e.message : 'Tidak dapat menghubungi server.';
          return null;
        }),
        jumlahTertunda().catch(() => 0),
        daftarTertunda().catch((): CatatTertunda[] => []),
      ]);
      setGalatMuat(galat);
      /*
        PENYEGARAN YANG GAGAL TIDAK BOLEH MENGOSONGKAN LAYAR.

        Sebelumnya `hasilPaket` dipasang apa adanya, termasuk null saat
        gagal — sehingga menekan tombol segarkan dan tidak dapat jawaban
        MENGHAPUS daftar kerja, cincin progres, dan identitas petugas di
        header, menggantinya dengan "Gagal memuat daftar kerja". Data yang
        sudah benar di layar hilang justru karena mencoba memperbaruinya, dan
        satu-satunya jalan mengembalikannya adalah berpindah layar lalu
        kembali (yang membaca cache lagi).

        null di sini SELALU berarti galat — `ruteSaya()` mengembalikan objek,
        bukan null, saat petugas memang belum punya rute. Jadi menahan nilai
        lama aman: yang ditahan adalah data terakhir yang sah.
      */
      if (hasilPaket != null) setPaket(hasilPaket);
      setTertunda(hasilAntre);
      setByteFoto(hitungByteFoto(isiAntrean));
    } finally {
      setSudahDicoba(true);
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(false);
  }, [muat]);

  useFocusEffect(
    useCallback(() => {
      void muat(false);
    }, [muat]),
  );

  const adaRute = paket?.ruteKode != null;

  const subjudul =
    paket == null
      ? sudahDicoba
        ? 'Tidak ada daftar kerja'
        : 'Memuat rute…'
      : [
          paket.namaPencatat,
          paket.rutes.length > 0 ? `${paket.rutes.length} rute` : null,
          labelPeriode(paket.periode),
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <PremiumBackground>
    <LayarGradasi
      judul="Pencatat Meter"
      subjudul={subjudul}
      latarTransparan
      kiri={
        // E5 — menggantikan tombol kembali ke Portal, yang sudah dihapus.
        <Tekan
          onPress={onBukaAkun}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Akun"
          style={({ pressed }) => [gaya.tombolAkun, pressed && gaya.ditekan]}
        >
          <User size={18} color="#FFFFFF" />
        </Tekan>
      }
      kanan={
        <View style={gaya.aksiKanan}>
          {/* "Tersimpan", BUKAN "Offline" — lihat catatan panjang di
              daftar-rute-screen.tsx. `dariCache` cuma menandai bahwa barisnya
              dibaca dari SQLite, yang justru jalur normal beranda: ia memanggil
              muat(false) supaya membuka aplikasi tidak menunggu jaringan.
              Warnanya ikut diturunkan dari nada bahaya ke netral: ini keterangan
              asal data, bukan peringatan. */}
          {paket?.dariCache ? (
            <View style={[gaya.lencanaOffline, { backgroundColor: colors.muted }]}>
              <Text style={[gaya.lencanaOfflineTeks, { color: colors.mutedForeground }]}>
                Tersimpan
              </Text>
            </View>
          ) : null}
          <Tekan
            onPress={() => void muat(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Segarkan"
            style={({ pressed }) => pressed && gaya.ditekan}
          >
            <RotateCw size={18} color="#FFFFFF" />
          </Tekan>
        </View>
      }
      onSegarkan={() => void muat(true)}
      sedangMuat={memuat}
    >
      {/* Sticky — halaman ini sengaja TIDAK bisa discroll (permintaan
          eksplisit), jadi padding & gap yang biasanya datang dari
          ScrollView di LayarGradasi harus dipasang manual di sini. */}
      <View style={gaya.isi}>
        {/* Penyegaran gagal TAPI data lama masih ada: beri tahu tanpa
            menyingkirkan apa pun. Bila datanya memang tidak ada, keadaan
            kosong di bawah yang menjelaskan — pita ini tidak perlu. */}
        {galatMuat != null && paket != null ? (
          <View
            style={[
              gaya.spanduk,
              { backgroundColor: colors.nadaBahayaLatar, borderColor: colors.nadaBahayaTinta + '26' },
            ]}
          >
            <TriangleAlert size={18} color={colors.nadaBahayaTinta} />
            <Text style={[gaya.spandukTeks, { color: colors.nadaBahayaTinta }]}>
              <Text style={gaya.spandukTebal}>Gagal menyegarkan.</Text>
              {` ${galatMuat} Angka di bawah dari simpanan terakhir.`}
            </Text>
          </View>
        ) : null}

        {/* ── R1 + C1: cincin progres beserta legend dan kaki target ── */}
        <View style={[gaya.kartuRing, permukaanNetral(isDark)]}>
          {paket == null && !sudahDicoba ? (
            <ActivityIndicator color={colors.primary} style={gaya.pemuatRing} />
          ) : paket == null ? (
            <View style={gaya.kosongRute}>
              <MapPinOff size={34} color={colors.mutedForeground} />
              <Text style={[gaya.kosongJudul, { color: colors.foreground }]}>
                {galatMuat != null ? 'Gagal memuat daftar kerja' : 'Belum ada daftar kerja'}
              </Text>
              <Text style={[gaya.kosongIsi, { color: colors.mutedForeground }]}>
                {galatMuat ??
                  'Periode ini belum punya daftar catat untuk Anda. Daftar kerja diterbitkan admin lewat dashboard (menu Closing -> Buka bulan baru). Tarik-segarkan halaman ini setelahnya.'}
              </Text>
            </View>
          ) : !adaRute ? (
            <View style={gaya.kosongRute}>
              <MapPinOff size={34} color={colors.mutedForeground} />
              <Text style={[gaya.kosongJudul, { color: colors.foreground }]}>
                Belum ada rute ditugaskan
              </Text>
              <Text style={[gaya.kosongIsi, { color: colors.mutedForeground }]}>
                Rute pencatatan dipetakan admin ke tiap petugas di dashboard web (menu Pencatat).
                Hubungi admin bila rute Anda belum muncul, lalu tarik-segarkan halaman ini.
              </Text>
            </View>
          ) : (
            /* Dua kolom SAMA LEBAR: cincin di kiri, angkanya di kanan.
               Keduanya `flex: 1`, jadi pembagiannya tetap separuh-separuh di
               lebar layar mana pun — bukan cincin berukuran tetap yang
               menyisakan ruang tak seimbang di sebelahnya. */
            <View style={gaya.isiRing}>
              <View style={gaya.kolomRing}>
                <RingProgresTarget
                  terbaca={paket.terbaca}
                  target={paket.target}
                  ukuran={128}
                  tinta={colors.foreground}
                  redup={colors.mutedForeground}
                  jalur={colors.muted}
                />
              </View>
              <View style={gaya.rincianRing}>
                <ItemLegend
                  warna={P.emerald600}
                  nilai={paket.terbaca}
                  label="Sudah"
                  colors={colors}
                />
                <ItemLegend
                  warna={colors.muted}
                  garisTepi={colors.border}
                  nilai={Math.max(0, paket.target - paket.terbaca)}
                  label="Belum"
                  colors={colors}
                />
                <Text style={[gaya.kakiRing, { color: colors.mutedForeground }]}>
                  Target Baca {paket.target}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── M4: kartu metrik blok bernada. Menampilkan angka, TIDAK diketuk. ── */}
        <View style={gaya.metrik}>
          {/* sky — data yang sudah ada; rose — yang menuntut dikirim. Rumpun
              yang sama dengan ubin peluncur di bawah, sehingga seluruh halaman
              memakai satu kosakata warna. */}
          <View
            style={[gaya.selMetrik, permukaanNada(colors.nadaBiruLatar, colors.nadaBiruTinta)]}
          >
            <Text style={[gaya.metrikNilai, { color: colors.nadaBiruTinta }]}>
              {paket?.dicatatSaya ?? 0}
            </Text>
            <Text style={[gaya.metrikLabel, { color: colors.nadaBiruRedup }]}>Dicatat saya</Text>
          </View>
          <View
            style={[gaya.selMetrik, permukaanNada(colors.nadaBahayaLatar, colors.nadaBahayaTinta)]}
          >
            <Text style={[gaya.metrikNilai, { color: colors.nadaBahayaTinta }]}>{tertunda}</Text>
            <Text style={[gaya.metrikLabel, { color: colors.nadaBahayaTinta + 'BF' }]}>
              Antre kirim
            </Text>
          </View>
        </View>

        {/* ── S1: spanduk penyimpanan ── */}
        <SpandukPenyimpanan jumlahAntrean={tertunda} totalByteFoto={byteFoto} />

        {/* ── Launcher 8 ubin (2 baris × 4 kolom) — 5 aktif + 3 "segera
              hadir", satu grid, satu ukuran, margin antar-baris SAMA
              dengan gap antar-card lain di halaman ini (isiSticky gap:12)
              supaya iramanya konsisten, gaya launcher iOS/Windows. ── */}
        {/* Urutannya mengikuti maknanya, bukan sebaliknya: pasangan sehaluan
            bersebelahan supaya gridnya terbaca berpasangan. Yang belum jadi
            dikumpulkan di ujung, sehingga bagian yang bisa ditekan tidak
            terpotong oleh ubin mati di tengahnya. */}
        <View style={gaya.gridUbin}>
          <View style={gaya.barisUbin}>
            <Ubin ikon={Clock} label="Riwayat" warna={WARNA_UBIN.riwayat} onPress={onBukaRiwayat} />
            <Ubin ikon={FileText} label="Info tagihan" warna={WARNA_UBIN.infoTagihan} onPress={onBukaInfoTagihan} />
            <Ubin ikon={Bell} label="Notifikasi" warna={WARNA_UBIN.notifikasi} onPress={onBukaNotifikasi} />
            <Ubin ikon={Radar} label="Anomali" warna={WARNA_UBIN.anomali} onPress={onBukaAnomali} />
          </View>
          <View style={gaya.barisUbin}>
            <Ubin ikon={ShieldCheck} label="Cadangan" warna={WARNA_UBIN.cadangan} onPress={onBukaCadangan} />
            <UbinSegera ikon={ArrowLeftRight} label="Pindah Rute" />
            <UbinSegera ikon={ListChecks} label="Cek Ulang" />
            <UbinSegera ikon={Banknote} label="Ubah Tarif" />
          </View>
        </View>
      </View>
    </LayarGradasi>
    </PremiumBackground>
  );
}

// ── Kepingan ──────────────────────────────────────────────────────────

function ItemLegend({
  warna,
  garisTepi,
  tinta,
  redup,
  nilai,
  label,
  colors,
}: {
  warna: string;
  garisTepi?: string;
  /** Tinta mengikuti kartu tempat legend ini duduk. */
  tinta?: string;
  redup?: string;
  nilai: number;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <View style={gaya.legendItem}>
      <View
        style={[
          gaya.legendTitik,
          {
            backgroundColor: warna,
            borderWidth: garisTepi ? StyleSheet.hairlineWidth : 0,
            borderColor: garisTepi,
          },
        ]}
      />
      <Text style={[gaya.legendNilai, { color: tinta ?? colors.foreground }]}>{nilai}</Text>
      <Text style={[gaya.legendLabel, { color: redup ?? colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

/** S1 — blok bernada dengan ikon perisai. Bukan tombol. */
function SpandukPenyimpanan({
  jumlahAntrean,
  totalByteFoto,
}: {
  jumlahAntrean: number;
  totalByteFoto: number;
}) {
  const { colors } = useTheme();
  const aman = jumlahAntrean === 0;
  const perhatian = jumlahAntrean >= AMBANG_PERHATIAN;

  // Nada peringatan memakai rumpun Rose — di palet master, peringatan dan
  // bahaya satu rumpun (tidak ada amber). Lihat catatan di palette.ts.
  const latar = perhatian ? colors.nadaBahayaLatar : colors.nadaHijauLatar;
  const tinta = perhatian ? colors.nadaBahayaTinta : colors.nadaHijauTinta;

  const judul = aman
    ? 'Penyimpanan aman.'
    : perhatian
      ? 'Segera upload — antrean menumpuk.'
      : 'Antrean menunggu upload.';
  const rincian = aman
    ? ' Tidak ada hasil catat yang menunggu diunggah.'
    : ` ${jumlahAntrean} laporan · ${formatUkuranByte(totalByteFoto)} menunggu diunggah.`;

  return (
    <View style={[gaya.spanduk, { backgroundColor: latar, borderColor: tinta + '26' }]}>
      {perhatian ? (
        <TriangleAlert size={18} color={tinta} />
      ) : (
        <ShieldCheck size={18} color={tinta} />
      )}
      <Text style={[gaya.spandukTeks, { color: tinta }]}>
        <Text style={gaya.spandukTebal}>{judul}</Text>
        {rincian}
      </Text>
    </View>
  );
}

/**
 * Ubin "Lainnya" — gaya launcher iOS: ikon dalam kotak kaca, label di bawah.
 * Ukuran & efek kaca DISAMAKAN dengan
 * `apps/mobile-publik/components/glass-panel.tsx` (latar semi-translusen +
 * hairline border + bayangan lembut) dan `quick-action-grid.tsx` (ukuran
 * kotak 56). SATU pengecualian yang SENGAJA TIDAK disamakan: radius sudut —
 * publik pakai 20 (superellipse iOS), di sini tetap `Radius.kontrol` seperti
 * elemen lain di app ini, atas permintaan eksplisit.
 *
 * CATATAN TEKNIS — kenapa style Pressable statis, bukan fungsi/array
 * `({pressed}) => [...]`: pola array dengan entri boolean (`pressed && x`)
 * pada Pressable/View di RN Android (Fabric, versi repo ini) terbukti gagal
 * menerapkan properti seperti width persen & flex — kotak jadi sekadar
 * sebesar konten dan/atau teksnya hilang total. `quick-action-grid.tsx` sudah
 * lebih dulu memecahkannya dengan style objek statis + warna tekan lewat
 * children-as-function ke elemen turunan, bukan ke Pressable/View pembungkus
 * itu sendiri. Jangan kembalikan ke pola array+boolean di sini.
 */
/**
 * Ubin pintasan — MENGIKUTI POLA mobile-publik/features/beranda/
 * quick-action-grid.tsx: squircle 56x56 bergradasi, label di bawahnya.
 *
 * Sebelumnya kotaknya memenuhi lebar kolom (aspectRatio 1 pada seperempat
 * layar ≈ 84px). Dua barisnya jadi setinggi hampir separuh layar, dan baris
 * bawah berikut labelnya tertimbun dock beserta tombol scan yang mengambang.
 * Ukuran tetap 56 membuat gridnya ringkas, dan sebagai efek samping kedua
 * aplikasi kini terasa berasal dari keluarga yang sama.
 *
 * Bayangan senada ikon (alpha 0x59) juga diambil dari sana. Yang dulu membuat
 * ubin petugas terlihat tua bukan bayangan berwarnanya, melainkan garis putih
 * inset ala Aero yang menyertainya — itu yang dibuang, bukan warnanya.
 */
function Ubin({
  ikon: IkonUbin,
  label,
  warna,
  onPress,
}: {
  ikon: Ikon;
  label: string;
  warna: WarnaUbin;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tekan onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={gaya.ubin}>
      {({ pressed }) => (
        <>
          <LinearGradient
            colors={warna}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[gaya.ubinKotak, pressed && gaya.ubinDitekan, { boxShadow: `0px 6px 10px ${warna[1]}59` }]}
          >
            <IkonUbin size={34} color="#FFFFFF" strokeWidth={2} />
          </LinearGradient>
          <Text numberOfLines={2} style={[gaya.ubinNama, { color: colors.foreground }]}>
            {label}
          </Text>
        </>
      )}
    </Tekan>
  );
}

/**
 * Ubin untuk fitur yang BELUM ADA.
 *
 * Sebelumnya ia dirender identik dengan Ubin yang aktif — warna sama pekat,
 * ikon dan label putih yang sama — hanya tanpa onPress. Tiga ubin terlihat
 * berfungsi penuh lalu diam saat ditekan, tanpa satu pun petunjuk kenapa, dan
 * petugas menyimpulkan aplikasinya rusak.
 *
 * Bedanya kini terlihat sebelum disentuh: squircle slate pucat tanpa bayangan
 * berwarna, ikon berkontras rendah, dan kata "Segera" di bawah namanya.
 */
function UbinSegera({ ikon: IkonUbin, label }: { ikon: Ikon; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={gaya.ubin}>
      <LinearGradient
        colors={WARNA_UBIN.segera}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={gaya.ubinKotak}
      >
        <IkonUbin size={34} color={P.slate600} strokeWidth={2} />
      </LinearGradient>
      <Text numberOfLines={2} style={[gaya.ubinNama, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={gaya.ubinSegeraLabel}>Segera</Text>
    </View>
  );
}

/**
 * Total ukuran foto bukti yang masih tersimpan lokal di seluruh antrean.
 * Berkas yang sudah hilang (cache dibersihkan OS) diabaikan — angka ini
 * menjawab "berapa besar yang menunggu diunggah", bukan "berapa yang pernah
 * ada".
 */
function hitungByteFoto(antrean: CatatTertunda[]): number {
  let total = 0;
  for (const entri of antrean) {
    for (const path of Object.values(entri.fotoPaths)) {
      if (!path) continue;
      try {
        const berkas = new File(path);
        if (berkas.exists) total += berkas.size ?? 0;
      } catch {
        continue;
      }
    }
  }
  return total;
}

// ── Gaya ── Nilai dari features/beranda.md; warna dari useTheme().

const gaya = StyleSheet.create({
  layar: { flex: 1 },
  /*
    DULU `gulir={false}` + padding manual: beranda dirancang sebagai dasbor
    satu layar yang diam. Dua hal membatalkan pilihan itu.

    Pertama, tanpa ScrollView tidak ada RefreshControl — halaman ini tidak bisa
    ditarik untuk menyegarkan, padahal `onSegarkan` sudah dioper ke LayarGradasi
    dan TAMPAK tersambung. Prop itu diam-diam tidak pernah dipakai.

    Kedua, isinya ternyata TIDAK selalu muat. Begitu pita "gagal menyegarkan"
    muncul, baris ubin bawah terdorong ke balik dock yang mengambang dan tidak
    bisa dijangkau sama sekali.

    Sekarang cangkangnya yang menggulir, jadi padding sisi dan ruang dock
    datang dari sana — jangan dipasang lagi di sini, nanti dobel. Tidak ada
    `flex` vertikal: `kartuRing` tidak memerlukannya, dan `flex: 1` di anak
    baris hanya membagi lebar.
  */
  isi: { gap: 12 },
  ditekan: { opacity: 0.7 },
  aksiKanan: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  tombolAkun: {
    width: 32,
    height: 32,
    borderRadius: Radius.bundar,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  lencanaOffline: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  lencanaOfflineTeks: { fontSize: 11, fontWeight: '600' },


  kartuRing: {
    borderRadius: Radius.kartu,
    padding: 16,
    alignItems: 'center',
  },
  pemuatRing: { height: 160 },
  kosongRute: { alignItems: 'center', gap: 10 },
  kosongJudul: { fontSize: 15, fontWeight: '600' },
  kosongIsi: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  isiRing: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Dua kolom `flex: 1` = separuh-separuh. Cincin dipusatkan di kolomnya
  // sendiri supaya tetap di tengah paruh kiri berapa pun lebar layarnya.
  kolomRing: { flex: 1, alignItems: 'center' },
  rincianRing: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendTitik: { width: 11, height: 11, borderRadius: 6 },
  legendNilai: { fontSize: 13, fontWeight: '600' },
  legendLabel: { fontSize: 12 },
  kakiRing: { fontSize: 12, marginTop: 2 },

  // gap 12 = irama yang sama dengan grid ubin dan jarak antar-kartu halaman.
  // Dulu 10 di sini dan 12 di sana — selisih yang tak pernah disengaja.
  metrik: { flexDirection: 'row', gap: 12 },
  // Latar, garis tepi, dan bayangan datang dari `permukaanNada()`; yang
  // tersisa di sini hanya geometri.
  selMetrik: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.kontrol,
  },
  metrikNilai: { fontSize: 22, fontWeight: '500' },
  metrikLabel: { fontSize: 12, marginTop: 2 },

  // Warnanya berganti menurut keadaan: emerald aman, rose menuntut perhatian.
  spanduk: {
    borderRadius: Radius.kontrol,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0px 10px 24px rgba(15, 23, 42, 0.10)',
  },
  spandukTeks: { flex: 1, fontSize: 12, lineHeight: 17 },
  spandukTebal: { fontWeight: '600' },

  // Baris launcher: 4 kolom flex:1 + gap 12 — TEKNIK SAMA PERSIS dengan
  // `metrik` (kartu Dicatat saya/Antre kirim) di atas, supaya "margin"-nya
  // konsisten satu halaman, sesuai permintaan eksplisit.
  // Gaya launcher (Windows tile / iOS shortcut): kotak persegi berwarna
  // solid, ikon + label SAMA-SAMA di dalam kotak (bukan lagi label di luar).
  // Ukuran & irama diambil dari mobile-publik quick-action-grid.tsx supaya
  // kedua aplikasi terasa satu keluarga. `flexWrap` menggantikan dua baris
  // yang dulu ditulis terpisah: 4 kolom jatuh sendiri dari lebar 25%.
  // DUA BARIS EKSPLISIT dengan sel `flex: 1` — bukan `flexWrap` + `width:'25%'`.
  //
  // MASALAH LAMA: sel selebar 25% dengan isinya DIPUSATKAN, sementara kotak
  // ikon dipatok 56 dp. Kotak itu mengambang di tengah sel selebar ~90 dp
  // (393,8 dp layar − 32 dp padding, dibagi 4), menyisakan ~17 dp kosong di
  // ujung kiri ubin pertama dan ujung kanan ubin terakhir — barisnya terlihat
  // lebih sempit daripada kartu di atasnya, dan jarak antar-ubin jadi menganga.
  //
  // SEKARANG: sel `flex: 1` + `gap`, dan kotaknya mengisi selnya penuh
  // (`width:'100%'` + `aspectRatio:1`). Empat kolom membagi habis lebar yang
  // tersedia, jadi tepi kiri-kanan otomatis sejajar dengan kartu di atas TANPA
  // perhitungan apa pun, dan kerapatannya merata: ubin ~81 dp dengan jarak 12
  // dp, bukan 56 dp dengan jarak 46 dp.
  //
  // Ukuran itu juga mengembalikan `Radius.ubin` ke maksud aslinya: tokennya
  // ditulis untuk kotak ~84 px pada rasio ikon iOS ~22%, padahal pada kotak
  // 56 dp ia jadi 32% dan terbaca terlalu bulat.
  //
  // `flexWrap` sengaja ditinggalkan: empat kolom kini dijamin oleh struktur,
  // bukan oleh kebetulan lebar layar.
  gridUbin: { gap: 12 },
  barisUbin: { flexDirection: 'row', gap: 12 },
  ubin: { flex: 1, alignItems: 'center' },
  ubinSegeraLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: P.slate500,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Mengisi selnya penuh, bukan lebar tetap — itulah yang membuat tepi baris
  // rata dengan kartu di atasnya. `aspectRatio: 1` menjaga bentuknya tetap
  // persegi berapa pun lebar layarnya.
  ubinKotak: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.ubin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Hanya KOTAKNYA yang meredup saat ditekan, bukan sel berikut labelnya.
  ubinDitekan: { opacity: 0.85 },
  // Label DI LUAR kotak, memakai warna teks tema — inilah yang membedakan
  // ikon peluncur iOS dari ubin Windows berlabel putih di dalam.
  ubinNama: { marginTop: 7, fontSize: 11, textAlign: 'center', lineHeight: 13 },
});