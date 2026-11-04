# Verifikasi token — mobile-petugas vs dashboard web

Tabel ini ada supaya klaim "satu tema dengan web" bisa **diperiksa**, bukan
dipercaya. Sumbernya `packages/ui` (shadcn style `radix-nova`, baseColor
`neutral`) — dashboard web yang sama yang dipakai kantor.

Kalau ada baris yang tidak cocok, itu bug.

## Warna

Web menulis warnanya dalam `oklch()`. React Native tidak mengenal `oklch`,
jadi tiap nilai dikonversi mekanis (oklch → oklab → linear sRGB → sRGB gamma).
Kolom "hex" adalah hasil konversi, dan nilai oklch asalnya ikut ditulis di
`components/theme/tokens.ts` pada baris yang sama.

### Terang

| Token | Web (`globals.css`) | Mobile (`tokens.ts`) |
|---|---|---|
| `background` | `oklch(1 0 0)` | `#FFFFFF` |
| `foreground` | `oklch(0.148 0.004 228.8)` | `#090B0C` |
| `card` | `oklch(1 0 0)` | `#FFFFFF` |
| `primary` | `oklch(0.508 0.118 165.612)` | `#007A55` |
| `primary-foreground` | `oklch(0.979 0.021 166.113)` | `#ECFDF5` |
| `secondary` | `oklch(0.967 0.001 286.375)` | `#F4F4F5` |
| `muted` | `oklch(0.963 0.002 197.1)` | `#F1F3F3` |
| `muted-foreground` | `oklch(0.56 0.021 213.5)` | `#67787C` |
| `accent` | `oklch(0.963 0.002 197.1)` | `#F1F3F3` |
| `destructive` | `oklch(0.577 0.245 27.325)` | `#E7000B` |
| `border` / `input` | `oklch(0.925 0.005 214.3)` | `#E3E7E8` |
| `ring` | `oklch(0.723 0.014 214.4)` | `#9CA8AB` |

### Gelap

| Token | Web | Mobile |
|---|---|---|
| `background` | `oklch(0.148 0.004 228.8)` | `#090B0C` |
| `foreground` | `oklch(0.987 0.002 197.1)` | `#F9FBFB` |
| `card` | `oklch(0.218 0.008 223.9)` | `#161B1D` |
| `primary` | `oklch(0.432 0.095 166.913)` | `#006045` |
| `secondary` | `oklch(0.274 0.006 286.033)` | `#27272A` |
| `muted` | `oklch(0.275 0.011 216.9)` | `#22292B` |
| `muted-foreground` | `oklch(0.723 0.014 214.4)` | `#9CA8AB` |
| `destructive` | `oklch(0.704 0.191 22.216)` | `#FF6467` |
| `border` | `oklch(1 0 0 / 10%)` | `#FFFFFF1A` |
| `input` | `oklch(1 0 0 / 15%)` | `#FFFFFF26` |
| `ring` | `oklch(0.56 0.021 213.5)` | `#67787C` |

`success` tidak ada di web. Dipetakan ke `primary` supaya tidak ada warna di
luar palet dashboard.

## Sudut

| | Web | Mobile |
|---|---|---|
| `--radius` | `0` (`globals.css:100`) | `Radius.kartu = 0` |
| skala turunan | `calc(--radius × 0.6 … × 2.6)` → semuanya 0 | `tailwind.config.js` memakai rumus yang sama |

Satu pengecualian yang disengaja: `Radius.bundar = 999` untuk indikator yang
memang lingkaran (titik legend, bar progres, badge angka). Web pun memakai
`rounded-full` untuk hal seperti itu.

## Teks

Skala Tailwind, sama seperti yang dipakai komponen web.

| Token | px | Dipakai web di |
|---|---|---|
| `Teks.xs` | 12 | `text-xs` — badge, meta |
| `Teks.sm` | 14 | `text-sm` — isi Card, label Button, baris tabel |
| `Teks.base` | 16 | `text-base` — Input, `CardTitle` |
| `Teks.lg` | 18 | `text-lg` — judul seksi |
| `Teks.xl2` | 24 | `text-2xl` — judul layar |
| `Teks.xl4` | 36 | `text-4xl` — angka pahlawan |

`CardTitle` web: `font-heading text-base leading-snug font-medium` — jadi
judul kartu di mobile 16/medium, bukan 17/semibold seperti sebelumnya.

## Tinggi kontrol — SATU-SATUNYA penyimpangan

| | Web | Mobile | Alasan |
|---|---|---|---|
| Button baku | `h-8` = 32 | **36** | naik satu langkah |
| Button `lg` | `h-9` = 36 | 36 | — |
| Button `sm` | `h-7` = 28 | 32 | naik satu langkah |
| Input | `h-8` = 32 | **36** | naik satu langkah |
| Select | `h-8` = 32 | **36** | naik satu langkah |

Aturannya: **mobile memakai langkah `lg` web sebagai ukuran bakunya.** Web
diarahkan mouse yang presisinya beberapa piksel; HP diarahkan jempol. 36
adalah nilai yang **sudah ada di skala web** (`h-9`), bukan angka baru — jadi
tidak ada dialek ketiga yang masuk.

Ini satu-satunya baris di seluruh sistem yang tidak identik dengan web. Kalau
kamu mau benar-benar identik, ubah `TinggiKontrol` di
`components/theme/ukuran.ts` jadi 32/28 dan `Kelas` jadi `h-8`/`h-7`.

## Cara memeriksa ulang

```bash
# Nilai oklch web
grep -A20 "^:root {" packages/ui/src/styles/globals.css

# Nilai hex mobile (oklch asal ada di komentar tiap baris)
grep -n "oklch" apps/mobile-petugas/components/theme/tokens.ts

# Tidak boleh ada ukuran telanjang di layar
grep -rn "fontSize: [0-9]\|borderRadius: [0-9]" apps/mobile-petugas/features
```
