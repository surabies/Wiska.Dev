# Kontrak UI — Aplikasi Baca Meter (Expo + React Native Reusables)

Tujuan: setiap layar tampil benar di semua ukuran HP dan versi Android tanpa konten
terpotong, tertutup system bar, atau tertutup keyboard. Aturan di sini adalah sumber
kebenaran; `AGENTS.md` hanyalah ringkasannya.

> Contoh kode di dokumen ini adalah titik awal. Agent harus menyesuaikannya dengan versi
> library yang terpasang dan memeriksa dokumentasi resminya bila API berbeda.

## 1. Prinsip
1. **Berbasis lebar, bukan model HP.** Jangan membuat daftar ukuran per model perangkat.
2. **Satu sumber ukuran.** Semua angka layout ada di `~/lib/layout.ts`.
3. **Satu pembungkus halaman.** Semua halaman memakai `<Screen>`.
4. **Satu sumber komponen.** Semua elemen UI berasal dari `~/components/ui`.
5. **Aturan ditegakkan mesin** (ESLint + checklist), bukan hanya instruksi.

## 2. Peta file
| File | Fungsi |
|---|---|
| `global.css`, `tailwind.config.js` | Token warna, radius, font (variabel CSS) |
| `lib/layout.ts` | Breakpoint, konstanta ukuran, hook `useBreakpoint` |
| `components/screen.tsx` | Pembungkus halaman: safe area, scroll, keyboard, lebar maksimum |
| `components/ui/*` | Komponen React Native Reusables (disalin ke proyek) |
| `AGENTS.md` | Ringkasan aturan untuk AI agent |

## 3. Breakpoint dan ukuran
```ts
// lib/layout.ts — satu-satunya sumber ukuran & breakpoint
import { useWindowDimensions } from "react-native";

// 1) Breakpoint berdasarkan LEBAR layar (dp), bukan jenis HP
export const BREAKPOINTS = { medium: 600, expanded: 840 } as const;

// 2) Konstanta yang dipakai semua komponen
export const LAYOUT = {
  touchTarget: 48,       // tinggi minimum area sentuh (dp)
  screenPadding: 16,
  maxContentWidth: 640,  // batas lebar konten di tablet/foldable
} as const;

// 3) Hook tunggal untuk layout responsif
export function useBreakpoint() {
  const { width } = useWindowDimensions(); // ikut rotasi & split-screen
  const size =
    width >= BREAKPOINTS.expanded ? "expanded"
    : width >= BREAKPOINTS.medium ? "medium" : "compact";
  return { width, size, isCompact: size === "compact" };
}
```

## 4. Pembungkus halaman
```tsx
// components/screen.tsx — bungkus SEMUA halaman
import * as React from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { LAYOUT } from "~/lib/layout";

type Props = { children: React.ReactNode; scroll?: boolean; safeTop?: boolean };

export function Screen({ children, scroll = true, safeTop = true }: Props) {
  // 1) Inset sistem (status bar, navigation bar, notch)
  const insets = useSafeAreaInsets();

  // 2) Isi dipusatkan dan dibatasi lebarnya agar rapi di tablet/foldable
  const content = (
    <View
      style={{
        width: "100%",
        maxWidth: LAYOUT.maxContentWidth,
        alignSelf: "center",
        padding: LAYOUT.screenPadding,
      }}
    >
      {children}
    </View>
  );

  return (
    // 3) Keyboard tidak menutupi input; safeTop=false bila halaman memakai header native
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, paddingTop: safeTop ? insets.top : 0, paddingBottom: insets.bottom }}
    >
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}
```

Prasyarat di root layout:
- `<SafeAreaProvider>` membungkus seluruh app.
- `<PortalHost />` untuk overlay (Dialog, Popover, Select, Tooltip).
- Edge-to-edge Android diaktifkan sesuai dokumentasi Expo SDK yang dipakai.

## 5. Aturan layout
| Lakukan | Hindari |
|---|---|
| `flex-1`, `w-full`, `max-w-*` | `w-[360px]`, `h-[800px]` untuk kontainer |
| `min-h-12` untuk tombol dan baris berisi teks | `h-10` pada elemen berisi teks |
| `numberOfLines` + `flex-1`/`shrink` untuk teks panjang | Teks tanpa batas di dalam `Row` |
| `flex-wrap` untuk baris yang bisa penuh | Baris tetap dengan banyak item |
| `useBreakpoint()` untuk variasi layout | `Dimensions.get("window")` |
| `Text` dan `Icon` dari `~/components/ui` | `Text` mentah dari `react-native`, ikon lepas |
| Token tema (`bg-primary`, `text-muted-foreground`) | Hex langsung (`#1a73e8`) |

Catatan:
- `Text` dari RNR memakai pewarisan gaya (`TextClassContext`); `Text` mentah memutus pewarisan.
- Batasi pembesaran font di komponen `Text` (mis. `maxFontSizeMultiplier={1.3}`) sebagai default.
  Boleh dilonggarkan per kasus, karena membatasinya mengurangi aksesibilitas.

## 6. Android
- Jangan hardcode `paddingTop` untuk status bar. Pakai `<Screen>` / `useSafeAreaInsets()`.
- Uji di API minimum yang didukung dan di versi Android terbaru.
- Cek ulang tampilan setiap kali menaikkan versi Expo SDK.

## 7. Profil uji (acuan, dalam dp)
| Profil | Ukuran kira-kira |
|---|---|
| Kecil | 320 × 640 |
| Standar | 360 × 800 |
| Besar | 412 × 915 |
| Tablet | 800 × 1280 |
| Foldable | terlipat dan terbuka |

Kondisi tambahan yang wajib diuji: **font scale ±1.3** dan **display size besar**
(pengaturan Android). Minimal satu HP Android murah sungguhan.

## 8. Penegakan otomatis (contoh ESLint flat config)
```js
// eslint.config.js — tambahkan ke konfigurasi yang sudah ada
module.exports = [
  {
    rules: {
      // Larang Dimensions.get; pakai useBreakpoint()
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Dimensions"],
          message: "Pakai useBreakpoint() dari ~/lib/layout.",
        }],
      }],
      // Larang warna hex langsung di kode; pakai token tema
      "no-restricted-syntax": ["error", {
        selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
        message: "Pakai token tema, bukan hex langsung.",
      }],
    },
  },
];
```

## 9. Checklist sebelum tugas dinyatakan selesai
- [ ] Halaman dibungkus `<Screen>`
- [ ] Hanya memakai komponen dari `~/components/ui`
- [ ] Tidak ada width/height tetap pada kontainer
- [ ] Teks panjang aman (`numberOfLines`/`shrink`/`flex-wrap`)
- [ ] Diperiksa di 5 profil layar dan font scale 1.3
- [ ] `pnpm typecheck && pnpm lint` lolos
- [ ] Hal yang belum bisa diuji disebutkan secara eksplisit

## 10. Riwayat keputusan
Catat setiap perubahan aturan di sini (tanggal, aturan, alasan). Agent wajib menambahkan
entri saat pengguna memberi aturan UI baru.

- **2026-11-04**:
  - Ikon ubin (App Tiles) di Beranda menggunakan styling ikon macOS (squircle continuous, inner glass highlight, ambient colored glow, dan Lucide icon berkelas).
  - Bottom Dock (footer aplikasi) beradaptasi dinamis berdasarkan peran akun yang login (Pencatat, Teknisi, Warga, Supervisor, Tamu), baik tab navigasi maupun tombol aksi utama (hero action) di tengah.
  - Setup fondasi `lib/layout.ts` (breakpoints, konstanta touchTarget & maxContentWidth, `useBreakpoint`) dan pembungkus `<Screen>` di `components/Screen.tsx`.