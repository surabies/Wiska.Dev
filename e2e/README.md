# E2E RBAC

Tes Playwright membuat akun `SUPER_ADMIN`, `DIREKSI`, `SENIOR_MANAGER`,
`MANAGER`, `SUPERVISOR`, `STAFF`, `PELAKSANA`, dan `USER` hanya di database
terisolasi yang ditentukan oleh `E2E_DATABASE_URL`.

## Persiapan database

1. Buat database PostgreSQL khusus pengujian. Nama database wajib mempunyai
   segmen `e2e` atau `test`, misalnya `wiska_e2e`.
2. Salin `.env.example` lokal bila tersedia sebagai referensi, lalu buat
   `.env.e2e` (file ini diabaikan Git) dengan:

   ```dotenv
   E2E_DATABASE_URL="postgresql://user:password@localhost:5432/wiska_e2e"
   E2E_TEST_PASSWORD="gunakan-password-uji-minimal-16-karakter"
   ```

3. Terapkan migrasi pada database tersebut sebelum menjalankan tes:

   `prisma` tidak membaca `.env.e2e` secara otomatis. Muat URL dari file itu
   ke environment PowerShell sebelum migrasi, tanpa menampilkan nilainya:

   ```powershell
   $line = Get-Content .env.e2e | Where-Object { $_ -match '^E2E_DATABASE_URL=' } | Select-Object -First 1
   if (-not $line) { throw "E2E_DATABASE_URL tidak ditemukan di .env.e2e" }
   $env:E2E_DATABASE_URL = ($line -replace '^E2E_DATABASE_URL=', '').Trim().Trim('"')
   $env:DATABASE_URL = $env:E2E_DATABASE_URL
   pnpm exec prisma migrate deploy
   Remove-Item Env:DATABASE_URL
   Remove-Item Env:E2E_DATABASE_URL
   ```

   Periksa nama database pada URL sebelum menjalankan migrasi; hanya gunakan
   database E2E yang memang boleh diubah.

## Jalankan

```powershell
pnpm exec playwright install chromium
pnpm e2e
```

Seed manual (hanya diperlukan untuk pengembangan tes) menggunakan guard yang
sama:

```powershell
pnpm e2e:seed
```

Seed dan runner menolak berjalan tanpa `E2E_DATABASE_URL`, menolak database
non-PostgreSQL, dan mensyaratkan nama database mengandung `e2e` atau `test`.
Semua role memakai password uji yang sama; jangan menggunakan kredensial
produksi. Tes tidak menghapus data atau akun pada database.

`rbac-roles.pw.ts` login melalui UI dan memeriksa endpoint yang dibatasi
role. `manual-add.e2e.test.ts` tetap merupakan tes Vitest server-side dan
dijalankan melalui `pnpm test`.
