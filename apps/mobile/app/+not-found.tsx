import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBackground, useTheme } from '@/components';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <PremiumBackground>
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.foreground }]}>Halaman tidak ditemukan.</Text>
          <Link href="/" style={styles.link}>
            <Text style={[styles.linkText, { color: colors.systemBlue }]}>Kembali ke Beranda</Text>
          </Link>
        </View>
      </PremiumBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  link: { paddingVertical: 15 },
  linkText: { fontSize: 15, fontWeight: '600' },
});
