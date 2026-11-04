// lib/layout.ts — satu-satunya sumber ukuran & breakpoint
import { useWindowDimensions } from 'react-native';

// 1) Breakpoint berdasarkan LEBAR layar (dp), bukan jenis HP
export const BREAKPOINTS = { medium: 600, expanded: 840 } as const;

// 2) Konstanta yang dipakai semua komponen
export const LAYOUT = {
  touchTarget: 48, // tinggi minimum area sentuh (dp)
  screenPadding: 16,
  maxContentWidth: 640, // batas lebar konten di tablet/foldable
} as const;

// 3) Hook tunggal untuk layout responsif
export function useBreakpoint() {
  const { width } = useWindowDimensions(); // ikut rotasi & split-screen
  const size =
    width >= BREAKPOINTS.expanded
      ? 'expanded'
      : width >= BREAKPOINTS.medium
      ? 'medium'
      : 'compact';
  return { width, size, isCompact: size === 'compact' };
}
