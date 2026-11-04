/**
 * status-badge.tsx — badge status berwarna (padanan `StatusBadge` +
 * helper tone di core/widgets/status_badge.dart). Nada visual dipetakan SEKALI
 * dari kode status API di sini supaya warna konsisten antar layar.
 *
 * Dibangun di atas shadcn Badge (react-native-reusables). Nada success/warning
 * tak punya varian shadcn sendiri → memakai warna kustom dari palet master
 * (success = rumpun Emerald; warning = rumpun Rose, lebih terang dari
 * destructive) lewat `style` + teks putih.
 */
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';

import { MasterPalette as P } from './theme/Palette';
import { useTheme } from './theme/ThemeContext';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function toneStatusTagihan(kode: string): StatusTone {
  switch (kode) {
    case 'SUDAH_BAYAR':
      return 'success';
    case 'JATUH_TEMPO':
      return 'danger';
    case 'BELUM_BAYAR':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function toneStatusLaporan(kode: string): StatusTone {
  switch (kode) {
    case 'DIVERIFIKASI':
    case 'DIGUNAKAN':
      return 'success';
    case 'DITOLAK':
      return 'danger';
    case 'MENUNGGU':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function toneStatusPengaduan(kode: string): StatusTone {
  switch (kode) {
    case 'SELESAI':
    case 'DITUTUP':
      return 'success';
    case 'DITOLAK':
    case 'DIBUKA_KEMBALI':
      return 'danger';
    case 'BARU':
    case 'TERVERIFIKASI':
    case 'MENUJU_LOKASI':
      return 'info';
    case 'MENUNGGU_PELANGGAN':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function tonePrioritas(kode: string): StatusTone {
  switch (kode) {
    case 'DARURAT':
      return 'danger';
    case 'TINGGI':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const { isDark, colors } = useTheme();

  switch (tone) {
    case 'danger':
      return (
        <Badge variant="destructive">
          <Text>{label}</Text>
        </Badge>
      );
    case 'neutral':
      return (
        <Badge variant="secondary">
          <Text>{label}</Text>
        </Badge>
      );
    case 'info':
      return (
        <Badge variant="default">
          <Text>{label}</Text>
        </Badge>
      );
    case 'success':
      return (
        <Badge className="border-transparent" style={{ backgroundColor: colors.success }}>
          <Text className="text-white">{label}</Text>
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="border-transparent" style={{ backgroundColor: isDark ? P.rose600 : P.rose400 }}>
          <Text className="text-white">{label}</Text>
        </Badge>
      );
  }
}
