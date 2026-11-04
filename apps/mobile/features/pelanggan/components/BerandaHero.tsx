/**
 * beranda-hero.tsx — header hero navy beranda (padanan widgets/beranda_hero.dart):
 * gradien gelap sudut bawah membulat, brand mark, tombol akun kanan-atas,
 * sapaan + nama, dan slot konten opsional (chip status akun).
 *
 * Riak air (CustomPainter) & orb radial versi Flutter diringkas jadi satu
 * lingkaran cahaya tipis — cukup memberi kedalaman tanpa kanvas Skia.
 */
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MasterPalette as P } from '@/components';

import { PremiumMotif } from './PremiumMotif';

// Gradien biru SKY (bukan navy/biru tua — dilarang di app ini). Sky medium →
// terang supaya tetap segar & khas Sky.
const HERO = [P.sky600, P.sky500, P.sky] as const;

export function BerandaHero({
  sapaan,
  nama,
  trailing,
  content,
  demo = false,
}: {
  sapaan: string;
  nama: string;
  trailing: ReactNode;
  content?: ReactNode;
  demo?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      {/* Motif premium: riak air + orb cahaya (padanan HeroRipplePainter lama). */}
      <PremiumMotif idPrefix="hero" tint="#FFFFFF" />
      <View style={[styles.konten, { paddingTop: insets.top + 8, paddingBottom: content == null ? 22 : 32 }]}>
        <View style={styles.baris}>
          <View style={styles.brand}>
            <Image source={require('../../assets/images/logo.png')} style={styles.brandLogo} resizeMode="contain" />
            <View style={styles.brandTeks}>
              <Text style={styles.brandKecil}>PERUMDA</Text>
              <Text style={styles.brandNama}>Tirtawening</Text>
            </View>
            {demo ? (
              <View style={styles.chip}>
                <Text style={styles.chipTeks}>MODE DEMO</Text>
              </View>
            ) : null}
          </View>
          {trailing}
        </View>

        <Text style={styles.sapaan}>{sapaan}</Text>
        <Text style={styles.nama} numberOfLines={1}>{nama}</Text>

        {content != null ? <View style={styles.contentSlot}>{content}</View> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  konten: { paddingHorizontal: 24 },
  baris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  brandLogo: { width: 40, height: 40 },
  brandTeks: { marginLeft: 10 },
  brandKecil: { fontSize: 10, fontWeight: '500', color: '#FFFFFF8C', letterSpacing: 1.5 },
  brandNama: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  chip: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFFFFF24', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF40' },
  chipTeks: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.6 },
  sapaan: { fontSize: 13, color: '#FFFFFF8C', marginTop: 24 },
  nama: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, marginTop: 3 },
  contentSlot: { marginTop: 24 },
});