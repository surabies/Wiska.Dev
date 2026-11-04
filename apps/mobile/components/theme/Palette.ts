/**
 * palette.ts — PALET MASTER kedua aplikasi (padanan Dart
 * `core/theme/master_palette.dart`).
 *
 * Padanan "CSS global" (`:root { --color-... }`) versi TS: SATU file berisi
 * seluruh nilai warna yang boleh dipakai; file lain (token tema, komponen)
 * hanya MERUJUK ke sini, tidak mendefinisikan hex sendiri.
 *
 * LIMA WARNA PATEN (keputusan produk 2026-07-19):
 *   1. Emerald 500 #10B981 — aksi utama (tombol primer), status sukses
 *   2. Teal 300    #5EEAD4 — highlight/aksen kategori (accent)
 *   3. Sky 400     #38BDF8 — info, tautan, aksen biru, hero
 *   4. Slate 400   #94A3B8 — netral: teks redup, border, latar, chrome
 *   5. Rose 500    #F43F5E — destruktif DAN peringatan
 *
 * ATURAN: warna apa pun di kode HARUS berasal dari salah satu rumpun di atas
 * — master-nya langsung, atau turunan tonal serumpun (tangga terang-gelap
 * Tailwind dari hue yang SAMA). Putih/hitam/alpha tetap boleh sebagai netral
 * absolut. JANGAN menambah hue lain (amber, violet, cyan, navy brand lama).
 */
export const MasterPalette = {
  // ── 5 MASTER ─────────────────────────────────────────────────────────
  emerald: '#10B981', // Emerald 500
  teal: '#5EEAD4', // Teal 300
  sky: '#38BDF8', // Sky 400
  slate: '#94A3B8', // Slate 400
  rose: '#F43F5E', // Rose 500

  // ── Turunan tonal rumpun EMERALD ─────────────────────────────────────
  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald300: '#6EE7B7',
  emerald400: '#34D399',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065F46',
  emerald900: '#064E3B',

  // ── Turunan tonal rumpun TEAL ────────────────────────────────────────
  teal100: '#CCFBF1',
  teal400: '#2DD4BF',
  teal600: '#0D9488',
  teal700: '#0F766E',
  teal900: '#134E4A',

  // ── Turunan tonal rumpun SKY ─────────────────────────────────────────
  sky50: '#F0F9FF',
  sky100: '#E0F2FE',
  sky200: '#BAE6FD',
  sky300: '#7DD3FC',
  sky500: '#0EA5E9',
  sky600: '#0284C7',
  sky700: '#0369A1',
  sky800: '#075985',
  sky900: '#0C4A6E',
  sky950: '#082F49',

  // ── Turunan tonal rumpun SLATE ───────────────────────────────────────
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',

  // ── Turunan tonal rumpun ROSE ────────────────────────────────────────
  rose100: '#FFE4E6',
  rose200: '#FECDD3',
  rose300: '#FDA4AF',
  rose400: '#FB7185',
  rose600: '#E11D48',
  rose700: '#BE123C',
  rose900: '#881337',
} as const;

/**
 * Palet aksen chip ikon menu/statistik (padanan `AppAccents`) — SATU sumber
 * supaya kedua aplikasi terlihat satu keluarga. Sama untuk terang & gelap.
 */
export const AppAccents = {
  biru: MasterPalette.sky,
  sian: MasterPalette.teal400,
  hijau: MasterPalette.emerald,
  amber: MasterPalette.rose, // peringatan & bahaya kini satu rumpun Rose
  ungu: MasterPalette.slate500,
  merah: MasterPalette.rose,
  slate: MasterPalette.slate600,
} as const;

/** Gradien header brand per aplikasi (padanan `AppGradients`). Emerald → Sky. */
export const AppGradients = {
  publik: [MasterPalette.emerald, MasterPalette.sky600] as const,
  petugas: [MasterPalette.emerald, MasterPalette.sky600] as const,
};