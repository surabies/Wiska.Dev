/**
 * Root layout aplikasi PETUGAS "Tirtawening Petugas" — padanan `PetugasApp` +
 * `GerbangPetugas` di lib/app/. Memasang tema, area aman, status bar, dan
 * MEMULIHKAN sesi petugas SEBELUM layar pertama tampil.
 *
 * BEDA MENDASAR dari aplikasi publik: di sana login opsional dan gagal-pulih
 * hanya berarti beranda tampil anonim. Di sini login WAJIB — tanpa token
 * tidak ada rute untuk dibaca — jadi gerbang mengarahkan ke layar masuk.
 *
 * `pulihkan()` TIDAK menyentuh jaringan. Itu disengaja: petugas harus bisa
 * membuka aplikasi dan bekerja dengan rute yang sudah ter-cache walau sedang
 * tanpa sinyal. Keabsahan token teruji sendiri pada request pertama yang
 * berhasil menembus jaringan (401 → sesi berakhir).
 */
import '../global.css';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalHost } from '@rn-primitives/portal';
import { ApiClient, hydrateApiOverride } from '@workspace/mobile-core';
import { SesiPengguna } from '@/features/shared/SesiPengguna';
import { ThemeProvider, useTheme } from '@/components';
import { siapkanCadangan } from '@/features/pencatat/lib/BackupLokal';
import { cerminkan, hydrateCermin } from '@/features/pencatat/lib/CerminLokal';
import 'react-native-reanimated';
import { configureReanimatedLogger } from 'react-native-reanimated';

/**
 * MODE KETAT REANIMATED DIMATIKAN — dan hanya itu yang dimatikan.
 *
 * Mode ketat memperingatkan setiap kali `.value` sebuah shared value dibaca
 * atau ditulis SELAMA render. Peringatan itu berguna kalau yang melanggar
 * adalah kode kita. Di sini bukan: pelanggarnya react-native-css-interop
 * (mesin di balik NativeWind), tepatnya `processTransition` yang dipanggil
 * `applyStyles` untuk SETIAP View ber-className. Jejaknya tidak pernah
 * menyentuh satu pun berkas kita.
 *
 * Akibatnya konsol dibanjiri peringatan identik sejak aplikasi start,
 * sehingga peringatan yang SUNGGUHAN penting tenggelam — itu kerugian
 * nyatanya, bukan bug-nya sendiri: keduanya tidak mengubah perilaku apa pun
 * dan tidak pernah muncul di build rilis.
 *
 * Yang kita tanggung: bila kelak kita menulis animasi Reanimated sendiri dan
 * keliru menyentuh `.value` saat render, tidak ada lagi yang menegur. Saat ini
 * seluruh animasi kita (accordion, progress, dialog) memakai
 * `useDerivedValue`/`useAnimatedStyle` sebagaimana mestinya.
 *
 * HAPUS BARIS INI setelah NativeWind/css-interop merilis perbaikannya —
 * terpasang pada nativewind 4.2.6 + react-native-reanimated 4.5.0.
 */
configureReanimatedLogger({ strict: false });

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    // Token kedaluwarsa/dicabut di tengah pemakaian: lempar kembali ke layar
    // masuk sekali saja. Dipasang di akar supaya berlaku untuk SELURUH layar,
    // bukan hanya yang kebetulan sedang terbuka.
    ApiClient.onUnauthorized = () => {
      void SesiPengguna.keluar().finally(() => router.replace('/Masuk'));
    };
    // Cadangan disiapkan SEKALI di sini, bukan di dalam catat(): penyiapan
    // ikut memindahkan isi tata letak lama, dan menjalankan itu saat petugas
    // menyimpan pembacaan pertama akan membekukan layar.
    //
    // Urutannya wajib: cermin dipulihkan SETELAH cadangan siap (ia menyalin
    // dari pohon itu), lalu dijalankan sekali supaya apa pun yang tertunda
    // ketika aplikasi terakhir ditutup ikut tersalin — tanpa petugas perlu
    // membuka layar Cadangan.
    //
    // Sengaja TIDAK ditunggu: mencatat tidak boleh menunggu penyalinan.
    void siapkanCadangan()
      .then(hydrateCermin)
      .then(() => cerminkan());
    // Override server (pengaturan-api) harus siap SEBELUM pulihkan() supaya
    // sesi yang dipulihkan langsung memakai server yang benar, bukan sempat
    // menembak produksi lalu berpindah.
    void hydrateApiOverride().then(() =>
      SesiPengguna.pulihkan().finally(() => {
        // TIDAK ADA SESI -> LANGSUNG KE LAYAR MASUK.
        //
        // Sebelumnya akar ini selalu merender aplikasi, bahkan tanpa token.
        // Akibatnya beranda menembak /rute-saya, menerima 401 berulang, dan
        // BERPUTAR SELAMANYA di "Memuat rute…" — tanpa pernah menawarkan
        // layar masuk. Handler `onUnauthorized` di atas tidak menolong: ia
        // sengaja hanya menyala bila token TERPASANG lalu ditolak
        // (kedaluwarsa), bukan saat token memang tidak pernah ada.
        //
        // Terlihat saat menguji di perangkat: setelah data aplikasi
        // dibersihkan, satu-satunya jalan ke layar masuk adalah deep link
        // manual. Petugas di lapangan tidak punya jalan itu.

        setSiap(true);
        void SplashScreen.hideAsync();
      }),
    );
    return () => {
      ApiClient.onUnauthorized = null;
    };
  }, []);

  if (!siap) return null; // Splash masih tampil.

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <TumpukanBertema />
      </ThemeProvider>
      {/* Root portal untuk overlay react-native-reusables (Dialog/Select/Menu). */}
      <PortalHost />
    </SafeAreaProvider>
  );
}

/**
 * Tumpukan layar dengan latar yang IKUT TEMA.
 *
 * Latar bawaan navigator adalah PUTIH, dan itu tidak ikut tema gelap. Selama
 * setiap layar menutupi seluruh permukaannya, tidak ada yang terlihat. Begitu
 * ada bagian yang sengaja tembus — lekukan dock, sudutnya, jalur safe-area —
 * putih itu menyembul, dan di tema gelap hasilnya pita terang yang mencolok.
 *
 * Komponen terpisah karena `useTheme` hanya bisa dibaca DI DALAM ThemeProvider,
 * sedangkan provider-nya dipasang di komponen ini juga.
 */
function TumpukanBertema() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </View>
  );
}
