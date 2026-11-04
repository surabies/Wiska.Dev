# AGENTS.md — Aplikasi Baca Meter (Expo)

File ini dibaca otomatis oleh AI agent di awal setiap sesi. Detail lengkap ada di
`docs/ui-contract.md`. Jika ada konflik, `docs/ui-contract.md` yang berlaku.

## Stack
- Expo + Expo Router, TypeScript (path alias `~/` = root app mobile)
- UI: React Native Reusables (komponen disalin ke `~/components/ui`)
- Styling: NativeWind — SATU saja. Jangan mencampur dengan Uniwind atau sintaks styling lain
- Backend: Hono (tipe dibagi lewat package monorepo)

## Aturan wajib UI
1. Semua halaman dibungkus `<Screen>` dari `~/components/screen`. Jangan atur safe area/keyboard manual.
2. Pakai komponen di `~/components/ui`. Jangan membuat Button/Input/Card/Text sendiri.
   Komponen baru ditambah lewat CLI: `npx @react-native-reusables/cli@latest add <nama>`.
3. Jangan hardcode width/height kontainer. Pakai flex, `w-full`, `max-w-*`.
4. Elemen berisi teks pakai `min-h-*`, bukan `h-*` (supaya tidak terpotong saat font besar).
5. Teks panjang: `numberOfLines` + `flex-1`/`shrink`. Baris yang bisa penuh: `flex-wrap`.
6. Responsif hanya lewat `useBreakpoint()` dari `~/lib/layout`. Dilarang `Dimensions.get`.
7. Area sentuh minimal 48dp (`min-h-12`). Form memakai keyboard-controller (sudah di `<Screen>`).
8. Warna, radius, dan font hanya dari token tema (`global.css`/`tailwind.config.js`). Dilarang hex langsung.
9. Overlay (Dialog, Popover, Select, Tooltip) butuh `<PortalHost />` di root layout.

## Sebelum menyatakan tugas selesai
- Periksa tampilan di 5 profil layar dan font scale 1.3 (lihat `docs/ui-contract.md` bagian 7).
- Jalankan `pnpm typecheck && pnpm lint`.
- Sebutkan secara eksplisit apa saja yang sudah dicek dan apa yang belum bisa dicek.

## Dilarang tanpa konfirmasi
- Mengubah token tema, `lib/layout.ts`, atau `components/screen.tsx`.
- Menambah library UI/styling baru.
- Menghapus aturan di file ini atau di `docs/ui-contract.md`.

## Memori proyek
Agent tidak boleh hanya "mengingat" aturan baru dari percakapan. Jika pengguna memberi aturan
UI baru yang berlaku seterusnya, tulis ke `docs/ui-contract.md` (dan ringkasannya di file ini),
lalu beri tahu pengguna file mana yang diubah.