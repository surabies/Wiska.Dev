/**
 * catatan-layanan.tsx — catatan prosedural tenang di kaki beranda (padanan
 * widgets/catatan_layanan.dart). MEMAKAI token tema `muted` (bukan gradien
 * jenuh): isi statis & tak menuntut tindakan, jadi warna pekat dipulangkan ke
 * hal yang benar-benar berubah (tunggakan, status tiket).
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components';

export interface CatatanButir {
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  judul: string;
  isi: string;
}

export function CatatanLayanan({ butir }: { butir: CatatanButir[] }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: radius.card }]}>
      {butir.map((b, i) => (
        <View key={b.judul}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          <View style={styles.baris}>
            <Ionicons name={b.ikon} size={15} color={colors.mutedForeground} style={styles.ikon} />
            <Text style={styles.teks}>
              <Text style={[styles.judul, { color: colors.foreground }]}>{b.judul} — </Text>
              <Text style={[styles.isi, { color: colors.mutedForeground }]}>{b.isi}</Text>
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },
  baris: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, alignItems: 'flex-start' },
  ikon: { marginTop: 1, marginRight: 10 },
  teks: { flex: 1, fontSize: 12, lineHeight: 17 },
  judul: { fontWeight: '600' },
  isi: {},
});
