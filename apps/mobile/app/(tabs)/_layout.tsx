/**
 * Shell utama aplikasi mobile — empat tab di atas dock mengambang dengan tombol aksi utama di tengah.
 * DOCK BERSIFAT DINAMIS: Tombol dan aksinya menyesuaikan peran akun yang sedang masuk
 * (Pencatat, Teknisi, Supervisor, Warga, atau Tamu).
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, router, useFocusEffect } from 'expo-router';
import {
  CloudDownload,
  CloudUpload,
  Gauge,
  House,
  LogIn,
  MapPin,
  MessageSquareWarning,
  Radar,
  ReceiptText,
  ScanLine,
  Search,
  Ticket,
  User,
  Wrench,
} from 'lucide-react-native';
import {
  BottomDock,
  MasterPalette as P,
  RuangDockProvider,
  TINGGI_DOCK,
  useTheme,
  type DockItem,
} from '@/components';
import { jumlahTertunda } from '@/features/pencatat/lib/RepositoryBacaMeter';
import { useSesiPengguna } from '@/features/shared/SesiPengguna';

/** Urutan tab internal Expo Router. */
const URUTAN = ['index', 'Rute', 'Unduh', 'Upload'] as const;

/** Bentuk minimal props tabBar dari React Navigation (dipakai expo-router). */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

function DockTabBar({ state, navigation }: TabBarProps) {
  const [tertunda, setTertunda] = useState(0);
  const { peran } = useSesiPengguna();

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      jumlahTertunda()
        .then((n) => {
          if (!batal) setTertunda(n);
        })
        .catch(() => {});
      return () => {
        batal = true;
      };
    }, []),
  );

  // Buat susunan items dock dan aksi tombol tengah dinamis sesuai peran
  let items: DockItem[] = [];
  let centerAction = {
    ikon: ScanLine,
    label: 'Scan Meter',
    gradasi: [P.teal, P.teal600] as [string, string],
    onPress: () => router.push('/Scan'),
  };

  if (peran.tipe === 'TEKNISI') {
    items = [
      { ikon: House, label: 'Beranda', onPress: () => navigation.navigate('index') },
      { ikon: Wrench, label: 'Tiket Saya', onPress: () => router.push('/Tiket') },
      { ikon: Search, label: 'Lacak Aduan', onPress: () => router.push('/LacakTiket') },
      { ikon: User, label: 'Akun', onPress: () => router.push('/Akun') },
    ];
    centerAction = {
      ikon: Wrench,
      label: 'Tindak Lanjut',
      gradasi: [P.rose400, P.rose700],
      onPress: () => router.push('/Tiket'),
    };
  } else if (peran.tipe === 'WARGA') {
    items = [
      { ikon: House, label: 'Beranda', onPress: () => navigation.navigate('index') },
      { ikon: ReceiptText, label: 'Tagihan', onPress: () => router.push('/CekTagihan') },
      { ikon: Ticket, label: 'Laporan Saya', onPress: () => router.push('/LaporanSaya') },
      { ikon: User, label: 'Akun', onPress: () => router.push('/Akun') },
    ];
    centerAction = {
      ikon: MessageSquareWarning,
      label: 'Lapor Gangguan',
      gradasi: [P.sky, P.sky700],
      onPress: () => router.push('/Pengaduan'),
    };
  } else if (peran.tipe === 'SUPERVISOR') {
    items = [
      { ikon: House, label: 'Beranda', onPress: () => navigation.navigate('index') },
      { ikon: MapPin, label: 'Rute Lapangan', onPress: () => navigation.navigate('Rute') },
      { ikon: Wrench, label: 'Tiket Gangguan', onPress: () => router.push('/Tiket') },
      { ikon: User, label: 'Akun', onPress: () => router.push('/Akun') },
    ];
    centerAction = {
      ikon: Radar,
      label: 'Monitoring',
      gradasi: [P.teal600, P.teal900],
      onPress: () => router.push('/Anomali'),
    };
  } else if (peran.tipe === 'TAMU') {
    items = [
      { ikon: House, label: 'Beranda', onPress: () => navigation.navigate('index') },
      { ikon: ReceiptText, label: 'Cek Tagihan', onPress: () => router.push('/CekTagihan') },
      { ikon: Search, label: 'Lacak Tiket', onPress: () => router.push('/LacakTiket') },
      { ikon: LogIn, label: 'Masuk', onPress: () => router.push('/Masuk') },
    ];
    centerAction = {
      ikon: MessageSquareWarning,
      label: 'Lapor Gangguan',
      gradasi: [P.sky, P.sky700],
      onPress: () => router.push('/Pengaduan'),
    };
  } else {
    // Default: PENCATAT METER
    items = [
      { ikon: House, label: 'Beranda', onPress: () => navigation.navigate('index') },
      { ikon: Gauge, label: 'Rute', onPress: () => navigation.navigate('Rute') },
      { ikon: CloudDownload, label: 'Download', onPress: () => navigation.navigate('Unduh') },
      {
        ikon: CloudUpload,
        label: 'Upload',
        lencana: tertunda > 0 ? String(tertunda) : null,
        onPress: () => navigation.navigate('Upload'),
      },
    ];
    centerAction = {
      ikon: ScanLine,
      label: 'Scan Meter',
      gradasi: [P.teal, P.teal600],
      onPress: () => router.push('/Scan'),
    };
  }

  return (
    <BottomDock
      items={items}
      currentIndex={state.index}
      centerAction={centerAction}
      onTap={(i) => {
        const item = items[i];
        if (item?.onPress) {
          item.onPress();
        } else {
          const route = state.routes[i];
          if (route) navigation.navigate(route.name);
        }
      }}
    />
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RuangDockProvider nilai={TINGGI_DOCK + insets.bottom}>
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <DockTabBar {...(props as unknown as TabBarProps)} />}
        >
          {URUTAN.map((name) => (
            <Tabs.Screen key={name} name={name} options={{ title: name }} />
          ))}
        </Tabs>
      </RuangDockProvider>
    </View>
  );
}
