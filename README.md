# Azkaqueen — Sistem Baca Meter Air PERUMDA Tirtawening Kota Bandung

Aplikasi web dan API terpadu untuk operasional pencatatan meter air, verifikasi berjenjang (V1/V2/V3), penagihan (DRD & closing bulanan), pemetaan spasial wilayah layanan, serta portal layanan mandiri warga PERUMDA Tirtawening Kota Bandung.

## Tumpukan Teknologi

- **Framework & UI:** Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS 4, shadcn/ui, HugeIcons, AG Grid, ECharts / Recharts, MapLibre GL
- **Backend API:** Hono (dipasang pada Route Handler Next.js `/api/[[...route]]`), Auth.js v5 (NextAuth), Zod v4
- **Database & Spasial:** PostgreSQL + PostGIS, Prisma ORM 7 (`@prisma/adapter-pg` / `@prisma/adapter-neon`)
- **Pengujian:** Vitest (unit & domain), Playwright (E2E)

## Struktur Folder Utama

```text
├── src/
│   ├── app/            # Route, layout, dan halaman Next.js App Router (tipis, merakit dari features/)
│   ├── features/       # Modul fitur berbasis domain (components/, hooks/, api/, types/, lib/, server/)
│   ├── components/     # Komponen UI bersama (ui/, layout/, data-grid, grafik)
│   ├── hooks/          # Hook React lintas fitur
│   └── lib/
│       ├── auth/       # Konfigurasi Auth.js dan hashing password (Argon2id)
│       ├── domain/     # Aturan bisnis murni (tarif, periode, SLA, taksasi, anomali)
│       └── server/     # Aplikasi Hono API, middleware RBAC/sesi, modul router & service, skrip operasional
├── prisma/             # Skema multi-file Prisma, migrasi SQL, dan skrip seed/verifikasi
├── e2e/                # Pengujian end-to-end Playwright
└── docs/               # Dokumentasi produk, arsitektur, aturan domain, dan konvensi kode
```

## Perintah Utama

Salin `.env.example` ke `.env` dan isi variabel lingkungan sebelum menjalankan aplikasi.

| Perintah                       | Keterangan                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| `pnpm dev`                     | Menjalankan server pengembangan Next.js (`http://localhost:3000`) |
| `pnpm build`                   | Menjalankan `prisma generate` lalu membangun aplikasi produksi    |
| `pnpm start`                   | Menjalankan hasil build produksi                                  |
| `pnpm typecheck`               | Memeriksa tipe TypeScript aplikasi dan server (`tsc --noEmit`)    |
| `pnpm db:typecheck`            | Memeriksa tipe TypeScript khusus folder `prisma/`                 |
| `pnpm test`                    | Menjalankan unit test dengan Vitest                               |
| `pnpm e2e`                     | Menjalankan pengujian end-to-end dengan Playwright                |
| `pnpm generate`                | Menghasilkan Prisma Client dari skema di `prisma/`                |
| `pnpm db:seed`                 | Mengisi data awal (seed) ke database                              |
| `pnpm db:cek`                  | Memeriksa konsistensi data database                               |
| `pnpm db:verifikasi-tarif`     | Memverifikasi perhitungan tarif terhadap data database            |
| `pnpm server:cek-closing`      | Pemeriksaan read-only kesiapan closing periode                    |
| `pnpm server:cek-siklus`       | Pemeriksaan read-only siklus pencatatan dan penagihan             |
| `pnpm format` / `format:check` | Memformat atau memeriksa format kode dengan Prettier              |

Skrip pemeliharaan tambahan (`server:backfill-golongan`, `server:backfill-jam-catat`, `server:generate-urut-catat`, `server:perbaiki-jenis-pemutusan`) berjalan dalam mode pratinjau secara bawaan; tambahkan `--terapkan` untuk menulis perubahan ke database.

## Variabel Lingkungan

Lihat [`.env.example`](.env.example) dan [`src/lib/server/README.md`](src/lib/server/README.md) untuk daftar lengkap:

- `DATABASE_URL` — URL koneksi PostgreSQL (dengan ekstensi PostGIS).
- `AUTH_SECRET` — kunci rahasia penandatanganan sesi Auth.js (`openssl rand -base64 32`).
- `AUTH_GOOGLE_ID` & `AUTH_GOOGLE_SECRET` — kredensial OAuth Google.
- `CRON_SECRET` — token otorisasi untuk endpoint cron job.
- `PETUGAS_DEV_ACCESS_CODE` — kode akses internal untuk fitur pengembangan petugas.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — konfigurasi penyimpanan foto/media bukti lapangan.
- `CORS_ORIGINS` _(opsional)_ — daftar origin yang diizinkan untuk klien seluler/web terpisah.

## Dokumentasi

- [Indeks Dokumentasi & Glosarium (`docs/INDEKS.md`)](docs/INDEKS.md)
- [Rancangan Arsitektur (`docs/ARSITEKTUR.md`)](docs/ARSITEKTUR.md)
- [Panduan Struktur & Pemisahan Tanggung Jawab Kode (`docs/STRUKTUR-KODE.md`)](docs/STRUKTUR-KODE.md)
- [Dokumentasi Backend Hono (`src/lib/server/README.md`)](src/lib/server/README.md)
