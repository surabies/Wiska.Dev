/**
 * bottom-dock.tsx — dock bawah aplikasi Pencatat Meter.
 *
 *   Beranda · Rute · [Scan] · Download · Upload
 *
 * REVISI — dock kini punya LEKUKAN (notch) yang mengikuti kontur lingkaran
 * Scan, dengan jarak/margin ke tepi lingkaran, dan tombol Scan dinaikkan
 * (menyembul lebih tinggi) supaya tidak terasa "mengambang" tanggung di atas
 * garis lurus seperti versi sebelumnya. Bentuk lengkung ini digambar pakai
 * `react-native-svg` (`<Svg><Path/></Svg>`) — kontur seperti ini TIDAK BISA
 * dibuat dari `View`/`borderRadius` biasa.
 *
 * KONSEKUENSI: BlurView DIHAPUS. Blur native tidak bisa di-mask mengikuti
 * path SVG sembarang di RN, jadi body dock sekarang latar SOLID
 * (`colors.card`) — tetap ikut tema terang/gelap, cuma tidak tembus pandang
 * lagi. Kalau blur wajib dipertahankan, opsinya adalah BlurView persegi biasa
 * + Svg overlay transparan cuma untuk garis tepi notch (bukan bentuk
 * dasarnya) — belum diterapkan di sini, tanyakan dulu kalau itu yang
 * diinginkan.
 *
 * Lebar dock diukur via `onLayout` (bukan diasumsikan dari `Dimensions`
 * sejak render pertama) supaya path notch presisi pas di tengah pada semua
 * ukuran layar, termasuk saat rotasi/split-screen.
 *
 * TOMBOL SCAN BUKAN TAB. Ia tidak punya layar yang ditinggali — ia mendorong
 * `/scan` ke atas tumpukan lalu kembali. Karena itu `onScan` terpisah dari
 * `onTap`, dan indeks tab tidak pernah menunjuk ke sana.
 *
 * ATURAN TANPA AKSI GANDA. Empat tujuan di dock ini TIDAK BOLEH muncul lagi
 * sebagai ubin di beranda. Kalau suatu saat ada yang menambahkannya kembali,
 * itu regresi — bukan kemudahan.
 *
 * Murni presentational: tidak tahu apa pun soal layar tujuan. Adapter di
 * `app/(tabs)/_layout.tsx` yang memetakan state navigasi ke props ini.
 */
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ScanLine, type LucideProps } from 'lucide-react-native';

import { useTheme } from '@/components';
import { MasterPalette as P } from '@/components';
import { Berat, Radius } from '@/components';

export interface DockItem {
  ikon: React.ComponentType<LucideProps>;
  label: string;
  /** Angka kecil di pojok ikon (mis. jumlah antrean menunggu upload). */
  lencana?: string | null;
}

export interface BottomDockProps {
  items: DockItem[];
  currentIndex: number;
  onTap: (index: number) => void;
  onScan: () => void;
}

/** Sisipkan tombol scan setelah item ke-`TENGAH`. */
const TENGAH = 2;
/** Tinggi baris tab. */
const TINGGI_TAB = 50;
/** Tinggi body dock (SVG), belum termasuk safe-area bawah. */
const TINGGI_BAR = 78;
/** Radius sudut kiri/kanan-atas body dock. */
const SUDUT_BAR = 18;
/** Diameter tombol Scan bulat — dinaikkan dari 66 → 72, lebih dominan. */
const DIAMETER_SCAN = 72;
/** Jarak "napas" antara tepi lingkaran Scan dan tepi lekukan dock. */
const JARAK_NOTCH = 10;
/** Radius lekukan = radius tombol + jarak napas di atas. */
const RADIUS_NOTCH = DIAMETER_SCAN / 2 + JARAK_NOTCH;
/** Seberapa tinggi tombol Scan menyembul di atas garis TOP body dock. */
const NAIK_SCAN = 34;
/** Seberapa dalam lekukan menukik (titik terendahnya). */
const DALAM_NOTCH = RADIUS_NOTCH * 0.82;

/**
 * Path SVG body dock — kurva "S" (ease-in-out) Bézier kubik, BUKAN lagi
 * subtraksi lingkaran (itu menghasilkan sudut tajam di titik pertemuan garis
 * lurus↔lingkaran — sifat geometris, bukan bug) dan BUKAN lagi konstanta
 * aproksimasi-lingkaran 0.552 yang kemarin salah pakai (bikin titik kontrol
 * overshoot / urutannya kebalik → kurva bergelombang sendiri).
 *
 * Kuncinya: tiap kurva kubik dibuat TANGEN HORIZONTAL persis di kedua
 * ujungnya (control-point pertama & terakhir sengaja diberi Y SAMA dengan
 * titik ujungnya), dan offset-X kedua control point dibatasi ≤ 0.4× jarak
 * antar-titik supaya urutannya selalu monoton (control1.x < control2.x) —
 * ini yang menjamin kurva TIDAK PERNAH overshoot/loop, secara matematis,
 * bukan coba-coba. Hasilnya: garis datar → melengkung turun mulus → dasar
 * lembah datar sebentar → melengkung naik mulus → garis datar lagi. Tidak
 * ada satu pun sudut tajam di sepanjang path.
 */
function buatPathDock(lebar: number, cx: number): string {
  const s = SUDUT_BAR;
  const r = RADIUS_NOTCH;
  const t = 0;
  const dalam = DALAM_NOTCH;
  const w = r; // jarak horizontal per sisi kurva (dari mulut lekukan ke tengah)
  const off = w * 0.42; // offset control-point, < 0.5w → dijamin monoton

  const xMulaiKiri = cx - r - s;
  const xMulaiKanan = cx + r + s;

  return [
    `M0 ${s}`,
    `Q0 0 ${s} 0`,
    `H${xMulaiKiri}`,
    // turun: dari mulut lekukan (y=t) ke dasar (y=dalam), tangen horizontal di kedua ujung
    `C${cx - r + off} ${t} ${cx - off} ${dalam} ${cx} ${dalam}`,
    // naik: dari dasar kembali ke mulut lekukan sisi kanan
    `C${cx + off} ${dalam} ${cx + r - off} ${t} ${xMulaiKanan} ${t}`,
    `H${lebar - s}`,
    `Q${lebar} 0 ${lebar} ${s}`,
    `V${TINGGI_BAR}`,
    `H0 Z`,
  ].join(' ');
}

export function BottomDock({ items, currentIndex, onTap, onScan }: BottomDockProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [lebar, setLebar] = useState(() => Dimensions.get('window').width);

  const onLayoutRoot = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== lebar) setLebar(w);
  };

  const kiri = items.slice(0, TENGAH);
  const kanan = items.slice(TENGAH);
  const cx = lebar / 2;

  return (
    <View onLayout={onLayoutRoot} style={styles.root}>
      <Svg width={lebar} height={TINGGI_BAR} style={StyleSheet.absoluteFill}>
        <Path d={buatPathDock(lebar, cx)} fill={colors.card} />
      </Svg>

      <View style={styles.row}>
        {kiri.map((it, i) => (
          <Tab key={it.label} item={it} aktif={currentIndex === i} onPress={() => onTap(i)} />
        ))}
        {/* Slot kosong seukuran lekukan — tab kiri/kanan tetap flex rata,
            tombol Scan digambar terpisah di atasnya (absolute). */}
        <View style={styles.slotKosong} />
        {kanan.map((it, i) => (
          <Tab key={it.label} item={it} aktif={currentIndex === i + TENGAH} onPress={() => onTap(i + TENGAH)} />
        ))}
      </View>

      <Pressable
        onPress={onScan}
        accessibilityRole="button"
        accessibilityLabel="Scan kode pelanggan"
        style={[styles.slotScan, { left: cx - DIAMETER_SCAN / 2 }]}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={[P.emerald, P.sky600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ ...styles.bulat, borderColor: colors.card, opacity: pressed ? 0.85 : 1 }}
          >
            <ScanLine size={28} color="#FFFFFF" strokeWidth={2.1} />
          </LinearGradient>
        )}
      </Pressable>

      <View style={{ height: insets.bottom }} />
    </View>
  );
}

function Tab({ item, aktif, onPress }: { item: DockItem; aktif: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const Ikon = item.ikon;
  const warna = aktif ? colors.primary : colors.iosSecondaryLabel;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={item.label}
      style={styles.tab}
    >
      <View>
        <Ikon size={22} color={warna} />
        {item.lencana != null && item.lencana.length > 0 ? (
          <View style={[styles.lencana, { backgroundColor: colors.destructive }]}>
            <Text style={styles.lencanaTeks} numberOfLines={1}>
              {item.lencana}
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: warna, fontWeight: aktif ? Berat.semi : Berat.medium }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  row: { flexDirection: 'row', height: TINGGI_TAB, marginTop: TINGGI_BAR - TINGGI_TAB },
  tab: { flex: 1, height: TINGGI_TAB, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, textAlign: 'center' },

  // Lebar slot kosong SAMA dengan diameter notch (2×RADIUS_NOTCH) supaya
  // tab kiri/kanan tidak numpuk di bawah lengkungan.
  slotKosong: { width: RADIUS_NOTCH * 2 },

  // Tombol Scan diposisikan absolute, dihitung dari `cx` root (bukan lagi
  // ikut flex slot) — `NAIK_SCAN` yang membuatnya menyembul tinggi di atas
  // mulut lekukan.
  slotScan: { position: 'absolute', top: -NAIK_SCAN, width: DIAMETER_SCAN, height: DIAMETER_SCAN },
  bulat: {
    width: DIAMETER_SCAN,
    height: DIAMETER_SCAN,
    borderRadius: DIAMETER_SCAN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    boxShadow: '0px 8px 18px rgba(2, 132, 199, 0.38)',
  },

  lencana: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: Radius.bundar,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lencanaTeks: { color: '#FFFFFF', fontSize: 9, fontWeight: Berat.tebal },
});