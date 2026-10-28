# Struktur direktori Prisma

```text
prisma/
  schema/       schema Prisma multi-file, dikelompokkan per domain
  migrations/   SQL perubahan database yang berurutan
  seed/         skrip ETL, helper domain, dan utilitas verifikasi
    steps/      langkah import yang dijalankan berurutan
    lib/        parser, normalisasi, helper domain, dan laporan seed
    reports/    hasil JSON lokal; tidak dilacak Git
  data/         CSV/GeoJSON mentah sebagai arsip sumber
  docs/         dokumentasi schema, sumber data, dan prosedur

generated/      Prisma Client hasil generate; tidak dilacak Git
```

Pemetaan alias TypeScript ada di `tsconfig.paths.json`:

| Alias | Tujuan | Contoh |
|---|---|---|
| `@/*` | `src/*` | `@/lib/prisma` |
| `@db` | `prisma/index.ts` | `@db` untuk client dan enum |
| `@db/*` | `prisma/*` | `@db/seed/lib/csv` |
| `@generated` | `generated/client` | `@generated` untuk Prisma Client |
| `@generated/*` | `generated/client/*` | `@generated/enums` |

Gunakan alias untuk menyeberang kelompok direktori. Impor antarfile yang
berdekatan di dalam satu kelompok tetap boleh memakai path relatif pendek.
Konfigurasi Prisma CLI ada di `prisma7.config.ts`; `prisma/tsconfig.json`
dipakai untuk mengecek tipe seluruh skrip seed dengan `pnpm db:typecheck`.
Jangan mengimpor file di dalam `generated/` selain melalui `@generated`.
