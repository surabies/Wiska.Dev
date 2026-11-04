/**
 * bottom-dock.tsx — dock bawah aplikasi Pencatat Meter.
 *
 *   Beranda · Rute · [Scan] · Download · Upload
 *
 * DOCK BERLEKUK (notch) yang mengikuti kontur lingkaran Scan, dengan jarak
 * napas ke tepi lingkaran, dan tombol Scan menyembul di atas garis dock.
 * Bentuk seperti ini TIDAK BISA dibuat dari `View` + `borderRadius`; ia
 * digambar sebagai satu path `react-native-svg`.
 *
 * KONSEKUENSI YANG DISENGAJA: BlurView dihapus. Blur native tidak bisa
 * di-mask mengikuti path SVG sembarang di React Native, jadi body dock
 * berlatar SOLID `colors.card` — tetap ikut tema terang/gelap, hanya tidak
 * tembus pandang lagi.
 *
 * Lebar diukur lewat `onLayout`, bukan diasumsikan dari `Dimensions` sejak
 * render pertama, supaya lekukannya tetap presisi di tengah pada semua ukuran
 * layar termasuk saat rotasi atau split-screen.
 *
 * Download dan Upload sengaja BERDAMPINGAN — keduanya urusan sinkronisasi
 * data, jadi dock terbaca sebagai dua kelompok (kerja | data).
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
import { Dimensions, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ScanLine, type LucideProps } from 'lucide-react-native';

import { useTheme } from './theme/ThemeContext';
import { MasterPalette as P } from './theme/Palette';
import { Berat, Radius } from './theme/Ukuran';
import { Tekan } from './Tekan';

export interface DockItem {
  ikon: React.ComponentType<LucideProps>;
  label: string;
  /** Angka kecil di pojok ikon (mis. jumlah antrean menunggu upload). */
  lencana?: string | null;
  /** Aksi kustom saat tab diketuk (opsional). */
  onPress?: () => void;
}

export interface BottomDockProps {
  items: DockItem[];
  currentIndex: number;
  onTap: (index: number) => void;
  onScan?: () => void;
  centerAction?: {
    ikon?: React.ComponentType<LucideProps>;
    label?: string;
    gradasi?: [string, string];
    onPress: () => void;
  };
}

/** Sisipkan tombol scan setelah item ke-`TENGAH`. */
const TENGAH = 2;
/** Tinggi baris tab. */
const TINGGI_TAB = 48;
/**
 * Tinggi body dock (SVG), belum termasuk safe-area bawah.
 *
 * Dipendekkan dari 78 → 66. Angka lama menyisakan 28dp ruang kosong di atas
 * baris tab — tidak dipakai apa pun, dan itu yang membuat panelnya terbaca
 * tinggi/berat. Sekarang sisanya 18dp, cukup untuk lekukan bernapas tanpa
 * menjadi lahan kosong.
 */
const TINGGI_BAR = 66;

/** Tinggi body dock (tanpa safe-area) — dipakai layar untuk menyisakan ruang. */
export const TINGGI_DOCK = 66;
/** Radius sudut kiri/kanan-atas body dock. */
const SUDUT_BAR = 18;
/** Diameter tombol Scan bulat. */
const DIAMETER_SCAN = 64;
/** Jarak "napas" antara tepi lingkaran Scan dan dinding lekukan. */
const JARAK_NOTCH = 8;
/** Radius lekukan = radius tombol + jarak napas. */
const RADIUS_NOTCH = DIAMETER_SCAN / 2 + JARAK_NOTCH;
/**
 * Seberapa tinggi tombol Scan menyembul di atas garis atas body dock.
 * Diturunkan 34 → 28: sebelumnya tombolnya duduk terlalu tinggi sehingga
 * terasa lepas dari dock-nya.
 */
const NAIK_SCAN = 28;
/** Radius peralihan dari garis lurus tepi dock ke mulut lekukan. */
const RADIUS_FILLET = 14;

/**
 * Seberapa jauh dock MENJANGKAU DI ATAS body-nya sendiri.
 *
 * `TINGGI_DOCK` hanya menyebut tinggi body, padahal tombol Scan menyembul
 * `NAIK_SCAN` di atasnya dan lekukannya menyisakan `JARAK_NOTCH` lagi.
 * Layar yang cuma menyisakan ruang setinggi body akan tetap tertimpa:
 * barisnya lolos dari bar, lalu tertabrak tombol yang melayang di atasnya.
 *
 * Ditemukan saat ubin beranda diperbesar — labelnya masuk ke pita ini dan
 * tertutup tombol Scan, padahal paddingnya "sudah" melebihi TINGGI_DOCK.
 */
export const JANGKAUAN_SCAN = NAIK_SCAN + JARAK_NOTCH;

/**
 * Opasitas body dock.
 *
 * Versi ber-BlurView dulu membuat dock menyatu dengan halaman di belakangnya.
 * Blur itu hilang saat bentuknya pindah ke path SVG — blur native tidak bisa
 * di-mask mengikuti path sembarang — dan penggantinya, `card` PEKAT, membuat
 * dock terbaca sebagai lempengan putih yang ditempel di atas halaman. Paling
 * kentara di Rute dan Beranda, yang latarnya bergradasi lembut: lekukannya
 * jadi menonjol karena batas putih-vs-latar itu tegas sekali.
 *
 * Menurunkan opasitas mengembalikan kesan menyatu tanpa perlu blur. Nilainya
 * ditahan cukup tinggi supaya teks tab tetap terbaca saat daftar tergulir di
 * belakangnya — ini dock kerja lapangan, bukan etalase.
 */
const OPASITAS_DOCK = 1.0;

/** Pusat lingkaran Scan, relatif garis atas body dock. */
const PUSAT_SCAN_Y = -NAIK_SCAN + DIAMETER_SCAN / 2;
/**
 * Path SVG body dock — BUSUR LINGKARAN SUNGGUHAN, bukan lagi kurva Bézier.
 *
 * KENAPA DIGANTI. Versi sebelumnya memakai kurva "S" Bézier kubik yang
 * dioptimalkan agar mulus tanpa sudut tajam. Mulus memang, tapi kurva Bézier
 * BUKAN busur lingkaran: ia hanya menyentuh jarak yang benar di dua titik —
 * mulut lekukan dan dasarnya. Di antara keduanya ia justru MENINDIH lingkaran
 * Scan sampai 4,9dp, sehingga bahan dock menonjol masuk ke bahu tombol. Itulah
 * kenapa lekukannya terlihat tidak mengikuti bulatan.
 *
 * Sekarang lekukannya adalah busur berpusat PERSIS di pusat lingkaran Scan
 * dengan radius `RADIUS_NOTCH`. Karena itu definisi lingkaran konsentris,
 * jaraknya ke tepi tombol TEPAT `JARAK_NOTCH` di seluruh kelilingnya — bukan
 * hasil penyetelan, melainkan sifat geometrinya.
 *
 * Dua busur kecil ber-radius `RADIUS_FILLET` menyambungkan garis lurus tepi
 * dock ke mulut lekukan. Tanpa keduanya, garis lurus bertemu busur cekung
 * dalam sudut tajam — sifat geometris yang dulu jadi alasan memilih Bézier.
 * Fillet menyelesaikannya tanpa mengorbankan ketepatan busur utamanya.
 */
function buatPathDock(lebar: number, cx: number, tinggi: number): string {
  const s = SUDUT_BAR;
  const r = RADIUS_NOTCH;
  const f = RADIUS_FILLET;
  const cy = PUSAT_SCAN_Y;

  // Pusat fillet kiri: menyinggung garis y=0 dari bawah (jadi y = f) DAN
  // menyinggung luar lingkaran lekukan (jarak antar pusat = r + f).
  const dxFillet = Math.sqrt((r + f) ** 2 - (f - cy) ** 2);
  // Titik singgung fillet <-> lekukan, pada garis penghubung kedua pusat.
  const tx = (-dxFillet * r) / (r + f);
  const ty = cy + ((f - cy) * r) / (r + f);

  return [
    `M0 ${s}`,
    `Q0 0 ${s} 0`,
    `H${cx - dxFillet}`,
    // fillet kiri: cembung, searah jarum jam di layar
    `A${f} ${f} 0 0 1 ${cx + tx} ${ty}`,
    // lekukan: cekung, melewati dasar, berlawanan jarum jam di layar
    `A${r} ${r} 0 0 0 ${cx - tx} ${ty}`,
    // fillet kanan
    `A${f} ${f} 0 0 1 ${cx + dxFillet} 0`,
    `H${lebar - s}`,
    `Q${lebar} 0 ${lebar} ${s}`,
    `V${tinggi}`,
    `H0 Z`,
  ].join(' ');
}

export function BottomDock({
  items,
  currentIndex,
  onTap,
  onScan,
  centerAction,
}: BottomDockProps) {
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
      <Svg
        width={lebar}
        height={TINGGI_BAR + insets.bottom}
        style={StyleSheet.absoluteFill}
      >
        <Path
          d={buatPathDock(lebar, cx, TINGGI_BAR + insets.bottom)}
          fill={colors.card}
          fillOpacity={OPASITAS_DOCK}
        />
      </Svg>

      <View style={styles.row}>
        {kiri.map((it, i) => (
          <Tab key={it.label} item={it} aktif={currentIndex === i} onPress={() => onTap(i)} />
        ))}
        {/* Slot kosong selebar mulut lekukan — menjaga tab kiri/kanan tidak
            merangsek ke bawah lengkungan. */}
        <View style={styles.slotKosong} />
        {kanan.map((it, i) => (
          <Tab
            key={it.label}
            item={it}
            aktif={currentIndex === i + TENGAH}
            onPress={() => onTap(i + TENGAH)}
          />
        ))}
      </View>

      <Tekan
        onPress={centerAction?.onPress ?? onScan}
        accessibilityRole="button"
        accessibilityLabel={centerAction?.label ?? 'Scan kode pelanggan'}
        style={[styles.slotScan, { left: cx - DIAMETER_SCAN / 2 }]}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={centerAction?.gradasi ?? [P.emerald, P.sky600]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ ...styles.bulat, borderColor: colors.card, opacity: pressed ? 0.85 : 1 }}
          >
            {centerAction?.ikon ? (
              <centerAction.ikon size={28} color="#FFFFFF" strokeWidth={2.1} />
            ) : (
              <ScanLine size={28} color="#FFFFFF" strokeWidth={2.1} />
            )}
          </LinearGradient>
        )}
      </Tekan>

      {/*
        Hanya pengatur tinggi. Warnanya diurus path SVG yang kini digambar
        setinggi body + safe-area sekaligus — satu bentuk, satu opasitas, jadi
        tidak ada garis sambung yang terlihat di antara keduanya.
      */}
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

function Tab({ item, aktif, onPress }: { item: DockItem; aktif: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const Ikon = item.ikon;
  const warna = aktif ? colors.primary : colors.iosSecondaryLabel;

  return (
    <Tekan
      onPress={item.onPress ?? onPress}
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
      <Text
        numberOfLines={1}
        style={[styles.tabLabel, { color: warna, fontWeight: aktif ? Berat.semi : Berat.medium }]}
      >
        {item.label}
      </Text>
    </Tekan>
  );
}

const styles = StyleSheet.create({
  /*
    MENGAMBANG di atas konten, bukan baris flex di sampingnya. Ini yang
    membuat lekukannya menampilkan halaman sungguhan — gradasi dan isinya —
    alih-alih sepetak warna datar yang tepinya selalu ketahuan. Layar yang
    berada di dalam tab menyisakan ruangnya lewat `useRuangDock()`.
  */
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row', height: TINGGI_TAB, marginTop: TINGGI_BAR - TINGGI_TAB },
  tab: { flex: 1, height: TINGGI_TAB, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, textAlign: 'center' },

  /** Selebar mulut lekukan, supaya tab tidak numpuk di bawah lengkungan. */
  slotKosong: { width: RADIUS_NOTCH * 2 },

  slotScan: {
    position: 'absolute',
    top: -NAIK_SCAN,
    width: DIAMETER_SCAN,
    height: DIAMETER_SCAN,
  },
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
