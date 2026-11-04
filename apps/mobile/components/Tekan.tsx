/**
 * tekan.tsx — pengganti `Pressable` yang gayanya TIDAK ditelan NativeWind.
 *
 * MASALAH YANG DIPERBAIKI. `Pressable` React Native menerima `style` dalam
 * bentuk FUNGSI (`({ pressed }) => ...`), dan itu idiom resmi untuk memberi
 * umpan balik tekan. Tetapi di aplikasi ini komponen React Native dibungkus
 * react-native-css-interop (NativeWind), dan bungkusan itu tidak meneruskan
 * bentuk fungsi: nilai yang dikembalikannya dibuang diam-diam.
 *
 * Yang hilang BUKAN cuma efek tekannya. Seluruh isi array ikut hilang — jadi
 * `padding`, `borderRadius`, `backgroundColor`, bahkan lebar dan tinggi tidak
 * pernah sampai ke layar. Komponennya tetap dirender, hanya saja telanjang,
 * dan tanpa satu pun pesan galat. Gejalanya di lapangan:
 *
 *   - GlassPanel yang bisa diketuk (kartu rute, kartu pelanggan) kehilangan
 *     latar, batas, dan sudutnya sehingga halaman tampak berantakan;
 *   - IconButton kehilangan seluruh bentuknya;
 *   - tombol simpan mengambang di catat-meter dan kunjungan-anomali kehilangan
 *     ukurannya sehingga tampak tidak ada dan nyaris tak bisa ditekan —
 *     terbaca sebagai "tombol simpannya tidak berfungsi".
 *
 * CARA KERJA. `Tekan` menerima `style` dalam bentuk yang SAMA (fungsi maupun
 * array), tetapi menghitungnya sendiri di JavaScript dan menyerahkan SATU
 * objek gaya yang sudah rata ke Pressable. Objek rata selamat melewati
 * interop. Keadaan tekan disimpan sendiri lewat onPressIn/onPressOut.
 *
 * Karena API-nya sama persis, memakainya cukup mengganti nama tag — tidak ada
 * pemanggil yang perlu diubah bentuknya.
 */
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type GayaTekan = StyleProp<ViewStyle> | ((keadaan: { pressed: boolean }) => StyleProp<ViewStyle>);

export interface TekanProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: GayaTekan;
  children?: React.ReactNode | ((keadaan: { pressed: boolean }) => React.ReactNode);
}

export function Tekan({ style, children, onPressIn, onPressOut, ...props }: TekanProps) {
  const [ditekan, setDitekan] = useState(false);

  const mulai = (e: GestureResponderEvent) => {
    setDitekan(true);
    onPressIn?.(e);
  };
  const selesai = (e: GestureResponderEvent) => {
    setDitekan(false);
    onPressOut?.(e);
  };

  // Diratakan MENJADI SATU OBJEK, bukan array: array pun ikut dibuang interop
  // pada sebagian komponen, dan objek rata tidak pernah bermasalah.
  const gaya = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: ditekan }) : style);

  return (
    <Pressable {...props} onPressIn={mulai} onPressOut={selesai} style={gaya}>
      {typeof children === 'function' ? children({ pressed: ditekan }) : children}
    </Pressable>
  );
}
