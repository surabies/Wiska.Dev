/**
 * env.d.ts — tipe untuk variabel lingkungan Expo yang dibaca paket ini.
 *
 * Hanya prefiks `EXPO_PUBLIC_` yang di-inline Metro ke bundel klien (padanan
 * `String.fromEnvironment` di Dart). Deklarasi ambient minimal ini menghindari
 * menarik `@types/node` (yang membawa API Node tak relevan) ke paket RN.
 */
declare const process: {
  env: {
    readonly EXPO_PUBLIC_API_BASE_URL?: string;
    readonly EXPO_PUBLIC_DEMO?: string;
  };
};
