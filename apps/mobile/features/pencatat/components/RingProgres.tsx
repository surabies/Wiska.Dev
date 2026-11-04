/**
 * ring-progres.tsx — cincin progres target pencatatan.
 *
 * Chart magnitude bagian-dari-keutuhan: SL yang SUDAH dicatat terhadap total
 * target rute.
 *
 * IDENTITAS TIDAK BERGANTUNG WARNA SEMATA — angka persentase dan kata
 * "terbaca" selalu ada di tengah cincin. Petugas membaca layar ini di bawah
 * matahari, kadang dengan mata yang tidak membedakan hijau dan abu dengan
 * baik; sebuah busur tanpa angka tidak memberi tahu apa pun.
 *
 * Teks tengah sengaja `View` beroverlay DI ATAS `Svg`, bukan `SvgText` di
 * dalamnya: dengan cara ini penskalaan font sistem dan pembaca layar tetap
 * bekerja, dua hal yang hilang begitu teks pindah ke dalam SVG.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Berat, MasterPalette as P } from '@/components';

/**
 * Ukuran bawaan; jari-jari dan tebal berskala dari rasio yang sama, jadi
 * bentuknya identik pada ukuran berapa pun — yang berubah cuma besarnya.
 */
const UKURAN_BAKU = 160;
const RASIO_JARI = 68 / 160;
const RASIO_TEBAL = 14 / 160;

export function RingProgresTarget({
  terbaca,
  target,
  ukuran = UKURAN_BAKU,
  tinta,
  redup,
  jalur,
}: {
  /** SL yang sudah dicatat pada periode berjalan. */
  terbaca: number;
  /** Total SL target rute. */
  target: number;
  /** Sisi bingkai dalam dp. */
  ukuran?: number;
  /**
   * Warna teks persentase, label, dan jalur cincin.
   *
   * DIWAJIBKAN datang dari pemanggil, bukan dipatok di sini: kartu tempat
   * cincin ini duduk bisa berlatar apa saja, dan latar itu berbeda antara
   * mode terang dan gelap. Versi sebelumnya mematok Slate 900 — tak terlihat
   * begitu kartunya berlatar gelap.
   */
  tinta: string;
  redup: string;
  jalur: string;
}) {
  const rasio = target === 0 ? 0 : Math.min(1, Math.max(0, terbaca / target));
  const persen = Math.round(rasio * 100);

  const JARI = ukuran * RASIO_JARI;
  const TEBAL = ukuran * RASIO_TEBAL;
  const keliling = 2 * Math.PI * JARI;
  // strokeDasharray menggambar busur; sisanya dibiarkan kosong. Rotasi -90°
  // memindahkan titik mulai dari jam 3 ke jam 12, searah jarum jam.
  const panjangBusur = keliling * rasio;
  const tengah = ukuran / 2;
  // Teks ikut berskala supaya proporsinya di dalam cincin tetap sama.
  const ukuranPersen = Math.round(ukuran * (30 / 160));
  const ukuranLabel = Math.round(ukuran * (12 / 160));

  return (
    <View style={{ width: ukuran, height: ukuran }}>
      <Svg width={ukuran} height={ukuran}>
        <Defs>
          <LinearGradient id="isiRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={P.emerald400} />
            <Stop offset="1" stopColor={P.emerald600} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={tengah}
          cy={tengah}
          r={JARI}
          stroke={jalur}
          strokeWidth={TEBAL}
          fill="none"
        />
        {rasio > 0 ? (
          <Circle
            cx={tengah}
            cy={tengah}
            r={JARI}
            stroke="url(#isiRing)"
            strokeWidth={TEBAL}
            strokeLinecap="round"
            strokeDasharray={`${panjangBusur} ${keliling}`}
            fill="none"
            transform={`rotate(-90 ${tengah} ${tengah})`}
          />
        ) : null}
      </Svg>
      <View style={[styles.tengah, { width: ukuran, height: ukuran }]} pointerEvents="none">
        <Text
          style={[styles.persen, { fontSize: ukuranPersen, lineHeight: ukuranPersen * 1.14, color: tinta }]}
        >
          {persen}%
        </Text>
        <Text style={[styles.label, { fontSize: ukuranLabel, color: redup }]}>terbaca</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tengah: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  persen: { fontWeight: Berat.medium },
  label: {},
});
