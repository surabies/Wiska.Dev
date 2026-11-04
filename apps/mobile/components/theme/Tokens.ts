/**
 * tokens.ts — token warna tema TERANG & GELAP. SATU SUMBER:
 * `components/theme/palette.ts` (MasterPalette — Emerald / Teal / Sky /
 * Slate / Rose). Keputusan 2026-07-27: seluruh aplikasi kembali ke palet ini,
 * dan token web yang sempat disalin dari `packages/ui` dibatalkan.
 *
 * MODE GELAP AKTIF DI SEMUA HALAMAN. Layar TIDAK BOLEH menulis hex
 * MasterPalette langsung untuk permukaan/teks — pakai `useTheme().colors`,
 * kalau tidak layar itu akan menyala putih saat HP bermode gelap. Hex langsung
 * hanya sah untuk hal yang memang berwarna di kedua mode (gradasi header,
 * busur cincin).
 *
 * Catatan lama, masih berlaku — dua sumber Dart aslinya:
 *   - `ShadColorScheme` (core/theme/app_theme.dart) → warna semantik komponen
 *     (button/card/input/badge): background, foreground, primary, muted, dst.
 *   - `IosStyle` (core/theme/ios_style.dart) → token "chrome" gaya iOS untuk
 *     nav bar / tab bar / kartu kaca: iosLabel, iosSeparator, systemBlue, dst.
 *
 * Nilai alpha Dart (mis. 0x99334155 = ARGB) dikonversi ke hex RN 8-digit
 * `#RRGGBBAA` (mis. '#33415599').
 *
 * SATU-satunya sumber warna tema — komponen mengambil lewat `useTheme()`,
 * tidak menuliskan hex sendiri (kecuali menembus langsung ke MasterPalette).
 */
import { MasterPalette as P } from './Palette';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  // ── Semantik komponen (ShadColorScheme) ──────────────────────────────
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  selection: string;
  // ── Status ───────────────────────────────────────────────────────────
  /** Status "berhasil/normal" (badge Lunas, bacaan normal) — rumpun Emerald. */
  success: string;
  // ── Permukaan bernada (kartu metrik & spanduk beranda) ───────────────
  /** Latar blok Emerald: emerald50 di terang, emerald900 di gelap. */
  nadaHijauLatar: string;
  /** Tinta di atas nadaHijauLatar. */
  nadaHijauTinta: string;
  /** Tinta redup (label) di atas nadaHijauLatar. */
  nadaHijauRedup: string;
  /** Latar blok Sky. */
  nadaBiruLatar: string;
  nadaBiruTinta: string;
  nadaBiruRedup: string;
  /** Latar blok peringatan (rumpun Rose). */
  nadaBahayaLatar: string;
  nadaBahayaTinta: string;
  /** Permukaan sekunder: latar ubin & baris daftar (slate50 / slate800). */
  permukaan: string;
  // ── Chrome gaya iOS (IosStyle) ────────────────────────────────────────
  iosBackground: string;
  iosSecondaryBackground: string;
  iosTertiaryBackground: string;
  iosLabel: string;
  iosSecondaryLabel: string;
  iosSeparator: string;
  /** Aksi/tautan sistem iOS (dipetakan ke master: biru=Sky, hijau=Emerald, merah=Rose). */
  systemBlue: string;
  systemGreen: string;
  systemRed: string;
}

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** Radius baku (px). `card` = sudut kartu, `dialog` = sudut dialog. */
  radius: { sm: number; md: number; card: number; dialog: number; pill: number };
}

const radius = { sm: 8, md: 12, card: 16, dialog: 16, pill: 999 } as const;

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  foreground: P.slate900,
  card: '#FFFFFF',
  cardForeground: P.slate900,
  popover: '#FFFFFF',
  popoverForeground: P.slate900,
  primary: P.emerald,
  primaryForeground: '#FFFFFF',
  secondary: P.slate100,
  secondaryForeground: P.slate900,
  muted: P.slate100,
  mutedForeground: P.slate500,
  accent: P.teal100,
  accentForeground: P.teal700,
  destructive: P.rose,
  destructiveForeground: '#FFFFFF',
  border: P.slate200,
  input: P.slate200,
  ring: P.emerald,
  selection: P.sky200,
  success: P.emerald,
  // Permukaan bernada — terang.
  nadaHijauLatar: P.emerald50,
  nadaHijauTinta: P.emerald700,
  nadaHijauRedup: '#047857BF', // emerald700 @75%
  nadaBiruLatar: P.sky50,
  nadaBiruTinta: P.sky700,
  nadaBiruRedup: '#0369A1BF', // sky700 @75%
  nadaBahayaLatar: P.rose100,
  nadaBahayaTinta: P.rose700,
  permukaan: P.slate50,
  iosBackground: '#FFFFFF',
  iosSecondaryBackground: P.slate100,
  iosTertiaryBackground: '#FFFFFF',
  iosLabel: P.slate900,
  iosSecondaryLabel: '#33415599', // slate-700 @60%
  iosSeparator: '#4757694A', // slate-600 @29%
  systemBlue: P.sky,
  systemGreen: P.emerald,
  systemRed: P.rose,
};

const darkColors: ThemeColors = {
  background: P.slate950,
  foreground: P.slate50,
  card: P.slate900,
  cardForeground: P.slate50,
  popover: P.slate900,
  popoverForeground: P.slate50,
  // Emerald dicerahkan satu langkah tonal — kontras cukup di atas latar gelap.
  primary: P.emerald400,
  primaryForeground: P.slate950,
  secondary: P.slate800,
  secondaryForeground: P.slate50,
  muted: P.slate800,
  mutedForeground: P.slate,
  accent: P.teal900,
  accentForeground: P.teal,
  destructive: P.rose400,
  destructiveForeground: P.slate950,
  border: P.slate700,
  input: P.slate700,
  ring: P.emerald400,
  selection: P.sky900,
  success: P.emerald400, // kontras mode gelap
  // Permukaan bernada — gelap. Latar turun ke ujung gelap rumpunnya dan
  // tintanya naik ke ujung terang, supaya kontrasnya tetap terbaca. Membalik
  // begitu saja (emerald50 jadi latar gelap) akan menghasilkan teks hijau tua
  // di atas hijau tua.
  nadaHijauLatar: P.emerald900,
  nadaHijauTinta: P.emerald300,
  nadaHijauRedup: '#6EE7B7BF', // emerald300 @75%
  nadaBiruLatar: P.sky900,
  nadaBiruTinta: P.sky300,
  nadaBiruRedup: '#7DD3FCBF', // sky300 @75%
  nadaBahayaLatar: P.rose900,
  nadaBahayaTinta: P.rose300,
  permukaan: P.slate800,
  iosBackground: P.slate950,
  iosSecondaryBackground: P.slate900,
  iosTertiaryBackground: P.slate800,
  iosLabel: P.slate50,
  iosSecondaryLabel: '#E2E8F099', // slate-200 @60%
  iosSeparator: '#94A3B85A', // slate-400 @35%
  systemBlue: P.sky,
  systemGreen: P.emerald,
  systemRed: P.rose,
};

export const lightTheme: Theme = { scheme: 'light', isDark: false, colors: lightColors, radius };
export const darkTheme: Theme = { scheme: 'dark', isDark: true, colors: darkColors, radius };

export function themeForScheme(scheme: ColorScheme | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
