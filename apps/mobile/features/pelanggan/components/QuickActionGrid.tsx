/**
 * quick-action-grid.tsx — grid shortcut layanan gaya launcher (padanan
 * widgets/quick_action_grid.dart + squircle_icon.dart): ikon squircle
 * bergradien + label. Ilustrasi PNG per-layanan di Flutter diganti glyph
 * Ionicons di dalam squircle (gradien domain tetap sama).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/components';

export interface QuickAction {
  /** Komponen ikon Lucide (mis. `ReceiptText`). */
  ikon: LucideIcon;
  label: string;
  /** Gradien dua warna atas → bawah (rumpun palet master per domain). */
  gradasi: [string, string];
  onPress: () => void;
}

export function QuickActionGrid({ aksi }: { aksi: QuickAction[] }) {
  return (
    <View style={styles.grid}>
      {aksi.map((a) => (
        <LaunchpadItem key={a.label} aksi={a} />
      ))}
    </View>
  );
}

function LaunchpadItem({ aksi }: { aksi: QuickAction }) {
  const { colors } = useTheme();
  const Ikon = aksi.ikon;
  return (
    <Pressable onPress={aksi.onPress} style={styles.item}>
      {({ pressed }) => (
        <>
          <LinearGradient
            colors={aksi.gradasi}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            // Bayangan berwarna senada ikon (alpha 0x59 ≈ 35%). boxShadow
            // lintas-platform (RN 0.76+), menggantikan shadow*/elevation.
            style={[styles.squircle, pressed && styles.pressed, { boxShadow: `0px 6px 10px ${aksi.gradasi[1]}59` }]}
          >
            <Ikon size={26} color="#FFFFFF" strokeWidth={2} />
          </LinearGradient>
          <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={2}>
            {aksi.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '25%', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  squircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  label: { fontSize: 11, textAlign: 'center', marginTop: 7, lineHeight: 13 },
});
