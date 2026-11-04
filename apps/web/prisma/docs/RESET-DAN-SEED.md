# Reset & seed ulang database — panduan langkah demi langkah

Ditulis supaya prosedur ini tidak perlu ditanyakan ulang. Kalau ada yang
berubah (script baru, folder bulan baru), update file ini juga.

## ⚠️ Baca dulu: ini database Neon (cloud), bukan Postgres lokal

`DATABASE_URL` di `.env` root menunjuk ke database Neon cloud. Artinya:

- **Reset menghapus SEMUA data**, untuk siapa pun/aplikasi apa pun yang
  connect ke database itu — bukan cuma di komputer ini.
- **Tidak bisa di-undo** lewat perintah Prisma. Kalau Neon punya fitur
  point-in-time restore di dashboard mereka, itu jalur pemulihan
  terpisah — bukan sesuatu yang dilakukan `prisma migrate reset`.
- Jangan jalankan langkah reset di bawah kalau belum yakin database ini
  memang boleh dikosongkan sekarang.

## Konsep yang perlu dipahami dulu

1. **Seed membaca DUA berkas per bulan** dari folder
   `prisma/data/{jan,…,juli}`:
   - `ProgresCater-PW5.csv` — hasil closing bulan itu (DRD)
   - `lapdatametertes.csv` — daftar catat bulan itu (DPM)

   Sejak 2026-08-01 `lapdatametertes.csv` **ikut dibaca** (sebelumnya tidak):
   ialah daftar kerja yang sebenarnya, sedangkan ProgresCater adalah
   keluarannya. Keduanya digabung karena daftar kerja Aurora sesekali
   kehilangan satu rute utuh akibat gagal unggah — lihat
   `PEMETAAN-DATA.md` §8b.

   Dua berkas lain (`PBPK*.csv`, `r-nomor.csv`) **tidak dibaca seed** — itu
   jalur aplikasi sendiri (`/dashboard/pbpk`, layar pemutusan, closing).
   Lihat komentar di `prisma/seed/index.ts` kalau mau detail alasannya.
2. **Bulan mana yang diseed diatur lewat env var `SEED_PERIODE`**
   (didefinisikan di `prisma/seed/lib/csv.ts`). Tanpa env var ini, seed
   membaca **seluruh** periode yang terdaftar (jan sampai agustus) sekaligus —
   biasanya bukan itu yang diinginkan kalau tujuannya seed bertahap
   per bulan.
   - `SEED_PERIODE=mei` → hanya baca folder `mei/`
   - `SEED_PERIODE=mei,juni` → baca `mei/` lalu `juni/`, urutan
     kronologis dijaga otomatis apa pun urutan ketiknya
3. Semua step seed pakai upsert (idempoten) — aman dijalankan berkali-kali,
   tidak akan menduplikasi baris. Jadi **reset database TIDAK WAJIB**
   setiap kali mau menambah bulan baru; reset hanya perlu kalau memang
   mau mengosongkan semuanya dan mulai dari nol.

## Langkah 1 — Reset database (skema kosong, tanpa data)

Jalankan dari root project hanya bila memang ingin mengosongkan database:

```powershell
pnpm exec prisma migrate reset --skip-seed
```

- `--skip-seed` penting: tanpa ini, Prisma otomatis menjalankan
  `pnpm db:seed` setelah reset **tanpa** `SEED_PERIODE`, yang berarti
  langsung mengimpor semua periode yang terdaftar.
- Perintah ini akan minta konfirmasi (`Are you sure...`) — ketik `y` untuk
  lanjut, atau tekan Ctrl+C untuk batal.
- Ini menjalankan ulang seluruh file di `prisma/migrations/` dari awal,
  jadi skema tabel akan sama persis dengan yang ada di repo saat ini.

## Langkah 2 — Seed hanya bulan Mei

Masih dari root project:

```powershell
$env:SEED_PERIODE = "mei"
pnpm db:seed
```

Yang terjadi: step 01–06, 10, 11 jalan berurutan, tapi hanya memakai baris
dari `prisma/data/mei/ProgresCater-PW5.csv` sebagai satu-satunya periode.
Di akhir akan muncul ringkasan di terminal + file laporan JSON baru di
`prisma/seed/reports/seed-<timestamp>.json`.

**Setelah selesai, hapus env var-nya** supaya perintah lain di sesi
terminal yang sama tidak ikut kebawa:

```powershell
Remove-Item Env:\SEED_PERIODE
```

(Kalau tutup & buka ulang terminal, env var ini otomatis hilang juga.)

## Langkah 3 — Verifikasi hasil

Pilih salah satu:

```powershell
pnpm db:studio        # buka Prisma Studio, cek isi tabel Pelanggan/Meter/Tagihan
pnpm db:cek           # jalankan prisma/seed/cek-konsistensi.ts
```

Atau baca ringkasan yang dicetak di terminal saat `pnpm db:seed` selesai
(jumlah baris dibuat/diperbarui/error per step) dan file laporan JSON di
`prisma/seed/reports/`.

## Nanti — menambah Juni

Folder `prisma/data/juni/` dan kodenya sudah siap (Juni sudah terdaftar
di `SEMUA_PERIODE` pada `prisma/seed/lib/csv.ts`). **Tidak perlu reset
ulang** — cukup jalankan seed lagi dengan periode diperluas:

```powershell
$env:SEED_PERIODE = "mei,juni"
pnpm db:seed
Remove-Item Env:\SEED_PERIODE
```

Sertakan `mei` di daftar (bukan cuma `juni` sendirian) — deteksi
pelanggan yang dicabut/baru dibandingkan antar-bulan **berurutan**, jadi
Juni butuh Mei sebagai pembanding di jalan yang sama.

## Juli — sudah terdaftar

Juli sudah masuk `SEMUA_PERIODE` sejak 2026-08-01, dan berkasnya sudah ada
di `prisma/data/juli/`. Perintahnya sama polanya:

```powershell
$env:SEED_PERIODE = "mei,juni,juli"
pnpm db:seed
Remove-Item Env:\SEED_PERIODE
```

**Catatan Juli:** `lapdatametertes.csv` dan `ProgresCater-PW5.csv` tersedia.
File `PBPK.csv` dan `r-nomor.csv` tidak ada; yang tersedia adalah file turunan
`PBPK-disusun-dari-lapdatameter.csv` dan
`r-nomor-disusun-dari-pemutusan.csv`. Verifikasi file turunan sebelum
dianggap sumber resmi. Kedua jenis file mutasi memang tidak dibaca oleh seed.

## Agustus dan periode berikutnya

Folder Agustus sudah terdaftar, tetapi saat ini hanya berisi
`ProgresCater-PW5.csv`; `lapdatametertes.csv` belum tersedia. Salin file
daftar catat dari proyek lama bila periode Agustus perlu dimuat lengkap.
Jangan menambahkan periode ke kode lagi karena `agustus` sudah terdaftar.

1. Taruh berkasnya di `prisma/data/<folder>/`.
2. Bila menambahkan periode baru, tambahkan satu baris di `SEMUA_PERIODE`
   (`prisma/seed/lib/csv.ts`):

   ```ts
   { folder: "september", thbl: 202609 },   // <- contoh periode baru
   ```

   Tanpa ini, `SEED_PERIODE=agu` akan gagal dengan error "folder yang tidak
   dikenal" (sengaja meledak, bukan diabaikan diam-diam — lihat komentar di
   file yang sama).

Pemisah kolom **tidak** perlu diurus: sejak 2026-08-01 pengurai
menyimpulkannya sendiri dari baris header. Ini bukan kemewahan — berkas
`lapdatametertes.csv` memakai `;` sampai Mei lalu berpindah ke `,` mulai
Juni, dan delimiter yang dipatok mati menghasilkan **nol baris tanpa satu
pun error**.

## Catatan penting soal arsitektur (baca sebelum rutin mengulang ini)

`prisma/seed/index.ts` sengaja menandai dirinya sebagai **migrasi
sekali-jalan**, bukan alur kerja harian: idenya, ProgresCater CSV hanya
dipakai untuk membentuk **populasi awal** (dulu: Januari saja), lalu
bulan-bulan berikutnya seharusnya dihasilkan **oleh aplikasi sendiri**
lewat halaman impor pencatatan harian, `/dashboard/pbpk`, dan
`/dashboard/closing` — bukan dengan menambah folder CSV baru dan
menjalankan seed lagi.

Memperluas `SEED_PERIODE` ke Mei/Juni/Juli seperti di atas **berfungsi**
dan tidak melanggar apa pun secara teknis, tapi kalau tujuannya menguji
apakah aplikasi benar-benar sanggup menghasilkan bulan berjalan sendiri
(bukan cuma menampilkan hasil olahan Aurora), pertimbangkan: seed Mei
saja sebagai titik awal, lalu progres ke Juni/Juli lewat layar aplikasi
yang sebenarnya. Kalau tujuannya cuma menyiapkan data uji secepat
mungkin, jalur `SEED_PERIODE` di atas sudah cukup.

## Troubleshooting singkat

- **Error "SEED_PERIODE memuat folder yang tidak dikenal"** — salah ketik
  nama folder, atau folder itu belum ditambahkan ke `SEMUA_PERIODE`
  (lihat bagian Agustus di atas).
- **Step tertentu banyak warning "dilewati"** — biasanya prasyarat FK-nya
  belum ada (mis. menjalankan step 06 sendirian tanpa 05 pernah jalan).
  Jalankan urut dari awal tanpa argumen tambahan kalau ragu.
- **DITOLAK: seed membaca CSV ekspor Aurora...** — ini muncul hanya kalau
  `NODE_ENV=production`. Untuk dev/lokal seharusnya tidak muncul; kalau
  muncul, cek apakah `NODE_ENV` ke-set production secara tidak sengaja.
