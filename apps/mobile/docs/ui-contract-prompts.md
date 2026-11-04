# Prompt untuk AI Agent — Kontrak UI

## Cara agent "mengingat"
Agent tidak punya ingatan permanen antar sesi. Yang ia ingat adalah **file yang dibaca di awal
sesi**. Jadi file di repo inilah ingatannya; jangan hanya menyuruh agent "ingat ini" di chat.

| Tool | File yang dibaca otomatis | Yang perlu dilakukan |
|---|---|---|
| Codex dan agent lain yang mengikuti standar AGENTS.md | `AGENTS.md` | Taruh di root repo |
| Claude Code | `CLAUDE.md` | Buat `CLAUDE.md` berisi satu baris: `@AGENTS.md` |
| Cursor | `.cursor/rules/*.mdc` | Buat rule yang merujuk ke `AGENTS.md` dan `docs/ui-contract.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | Salin ringkasan atau rujuk `AGENTS.md` |

Untuk agent yang tidak membaca file otomatis, awali tiap sesi dengan:
`Baca AGENTS.md dan docs/ui-contract.md sebelum mengerjakan apa pun.`

---

## Prompt 1 — Setup awal (jalankan sekali)
```text
Kamu bekerja di proyek Expo (Expo Router, React Native Reusables, NativeWind) untuk
aplikasi baca meter. Tujuan: layout konsisten di semua ukuran layar dan versi Android.

Langkah:
1. Baca AGENTS.md dan docs/ui-contract.md sampai habis.
2. Periksa kondisi proyek: versi Expo SDK, apakah memakai NativeWind atau Uniwind, path alias,
   lokasi root layout. Sesuaikan contoh kode di dokumen dengan versi yang terpasang
   (cek dokumentasi resmi bila API berbeda). Jangan mengubah pilihan styling yang sudah ada.
3. Buat atau perbarui: lib/layout.ts, components/screen.tsx, dan pastikan root layout
   memiliki SafeAreaProvider dan PortalHost.
4. Tambahkan aturan ESLint di docs/ui-contract.md bagian 8 ke konfigurasi proyek.
5. Buat file pointer sesuai tool yang saya pakai (CLAUDE.md berisi "@AGENTS.md", dst.).
6. Jalankan pnpm typecheck && pnpm lint dan perbaiki error yang kamu timbulkan.
7. Laporkan: file yang dibuat/diubah, penyesuaian dari contoh, dan hal yang belum bisa diuji.

Batasan: jangan menambah library UI/styling baru, jangan mengubah token tema, dan jangan
refactor halaman yang sudah ada pada tahap ini.
```

## Prompt 2 — Membuat atau mengubah satu halaman
```text
Baca AGENTS.md dan docs/ui-contract.md. Buat/ubah halaman: [NAMA HALAMAN + DESKRIPSI].

Syarat:
- Bungkus dengan <Screen>, pakai hanya komponen dari ~/components/ui.
- Tidak boleh ada width/height tetap pada kontainer; teks panjang aman dari pemotongan.
- Aman di layar 320dp dan font scale 1.3.

Setelah selesai, jalankan typecheck dan lint, lalu laporkan checklist di
docs/ui-contract.md bagian 9: mana yang sudah dicek, mana yang belum bisa dicek.
```

## Prompt 3 — Audit halaman yang sudah ada
```text
Baca AGENTS.md dan docs/ui-contract.md. Audit seluruh halaman di app/ terhadap aturan kontrak.

Untuk setiap pelanggaran, laporkan: file:baris, aturan yang dilanggar, risiko (konten
terpotong / tertutup keyboard / tertutup system bar / lainnya), dan perbaikan yang diusulkan.
Urutkan dari risiko tertinggi. JANGAN mengubah kode dulu; tunggu persetujuan saya.
```

## Prompt 4 — Menambah atau mengubah aturan (memperbarui ingatan)
```text
Aturan UI baru: [TULIS ATURAN DAN ALASANNYA].

Tulis aturan ini ke docs/ui-contract.md (bagian yang sesuai + entri di "Riwayat keputusan"
dengan tanggal hari ini), tambahkan ringkasannya di AGENTS.md bila bersifat wajib, dan
tambahkan penegakan otomatis (ESLint) bila memungkinkan. Beri tahu saya file mana yang
diubah. Jangan hanya mengingatnya di percakapan ini.
```