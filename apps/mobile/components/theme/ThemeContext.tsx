/**
 * theme-context.tsx — penyedia tema mengikuti mode sistem (padanan
 * `ShadApp(themeMode: ThemeMode.system)` di publik_app.dart/petugas_app.dart).
 *
 * `useColorScheme()` React Native memantau light/dark sistem; komponen
 * mengambil warna aktif lewat `useTheme()`. Ini yang membuat setiap
 * komponen mobile-ui otomatis mengikuti palet master tanpa menimpa warna
 * satu per satu di tiap layar.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { themeForScheme, type Theme } from './Tokens';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  // useColorScheme() bisa mengembalikan null/'unspecified' — perlakukan apa pun
  // selain 'dark' sebagai terang (default aman, sama seperti ThemeMode.system).
  const theme = useMemo(() => themeForScheme(scheme === 'dark' ? 'dark' : 'light'), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Tema aktif (warna + radius + mode gelap). Wajib di dalam <ThemeProvider>. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme() dipakai di luar <ThemeProvider>. Bungkus root app dengan ThemeProvider.');
  }
  return theme;
}
