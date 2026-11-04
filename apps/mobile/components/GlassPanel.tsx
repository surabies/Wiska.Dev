/**
 * glass-panel.tsx — KARTU. Namanya masih "GlassPanel" karena dipakai di
 * puluhan tempat, tapi isinya bukan lagi panel kaca.
 *
 * PADANAN LANGSUNG `Card` di packages/ui/src/components/card.tsx, yang
 * kelasnya: rounded-xl, bg-card, ring-1 ring-foreground/10, dan padding
 * vertikal sebesar variabel card-spacing yang di sana bernilai spacing(4).
 *
 * (Kelas-kelas di atas sengaja TIDAK ditulis sebagai satu string utuh.
 * Tailwind memindai seluruh isi berkas .tsx termasuk komentar; menulis
 * bentuk properti arbitrernya apa adanya membuat Tailwind men-generate
 * utility sungguhan dari komentar ini, dan CSS-nya menghasilkan
 * `var(--spacing(4))` yang gagal diurai NativeWind saat bundling.)
 *
 * Diterjemahkan ke React Native: sudut SIKU (`--radius: 0`, jadi `rounded-xl`
 * pun ikut nol), latar `card` yang solid, dan satu cincin setebal rambut
 * berwarna foreground beropasitas 10% — bukan `border`. Padding baku 16 =
 * `spacing(4)`.
 *
 * YANG SENGAJA DIBUANG, dan kenapa:
 *   - `borderRadius: 20` → dashboard web bersudut tajam. Sudut membulat 20px
 *     adalah satu hal yang paling membuat aplikasi ini terlihat berasal dari
 *     keluarga yang berbeda.
 *   - Latar semi-translusen `#FFFFFFE6` di atas gradien → kontras teks turun
 *     dan warnanya tidak pernah persis `card`. Web memakai latar solid.
 *   - `boxShadow` berlapis → web tidak memakai bayangan pada Card sama
 *     sekali; pemisahan permukaan dikerjakan oleh cincin.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Tekan } from './Tekan';

import { useTheme } from './theme/ThemeContext';
import { Radius, Spasi } from './theme/Ukuran';

export interface GlassPanelProps {
  children: ReactNode;
  padding?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function GlassPanel({ children, padding = Spasi.lg, onPress, style }: GlassPanelProps) {
  const { colors } = useTheme();

  const panelStyle: ViewStyle = {
    padding,
    backgroundColor: colors.card,
    borderColor: colors.border,
  };

  if (onPress) {
    return (
      <Tekan
        onPress={onPress}
        style={({ pressed }) => [styles.panel, panelStyle, style, pressed && styles.pressed]}
      >
        {children}
      </Tekan>
    );
  }
  return <View style={[styles.panel, panelStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: Radius.kartu,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.9 },
});
