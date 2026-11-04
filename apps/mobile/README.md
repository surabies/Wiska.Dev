# Tirtawening Petugas

Aplikasi lapangan untuk **pencatat meter** dan **petugas gangguan**. Port dari
aplikasi Flutter di `project lama/mobile` (`lib/features/staff/**`) ke Expo SDK
57, mengikuti pola `apps/mobile-publik`.

## Menjalankan

```bash
pnpm --filter mobile-petugas start
```

Backend yang dituju ditentukan `packages/mobile-core/src/network/api-config.ts`:
override kosong + `__DEV__` → `http://localhost:3001`. Dev server web repo ini
berjalan di **3000**, jadi saat menguji dengan backend lokal jalankan:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000 pnpm --filter mobile-petugas start
```

Pakai IP LAN, bukan `localhost` — perangkat fisik tidak bisa menjangkau
localhost komputer Anda. Mode peragaan tanpa backend: `EXPO_PUBLIC_DEMO=true`.

## Kenapa akun harus lapangan

Layar masuk menolak akun yang bukan peran lapangan. Endpoint
`/api/mobile/auth/login` melayani kedua aplikasi, jadi akun warga bisa saja
lolos — tapi ia tidak punya rute untuk dibaca dan hanya akan menemui layar
kosong. Akun petugas dibuat admin di dashboard web, lalu **ditautkan ke baris
Pencatat** (menu Pencatat). Tanpa tautan itu `GET /laporan-harian/rute-saya`
menolak dengan pesan yang menjelaskan sebabnya.

## Alur offline-first

Inilah alasan aplikasi ini ada, dan bentuknya mengikuti Aurora yang sudah
terbukti bertahun-tahun di lapangan:

```
unduh paket rute → SQLite → catat OFFLINE (outbox) → upload borongan (batch 300)
```

Tiga sikap yang menentukan seluruh rancangan:

1. **Mencatat ≠ mengirim.** `catat()` hanya menulis ke antrean lokal.
   Pengiriman adalah tindakan terpisah yang disengaja petugas (menu Upload),
   supaya hasil kerja terlihat menumpuk dan bisa dikirim sekaligus saat sinyal
   dan kuota memungkinkan.
2. **Kegagalan jaringan bukan kegagalan data.** Hanya kegagalan transport yang
   jatuh ke cache; 401/403/400 tetap dilempar — menyembunyikannya di balik
   "mode offline" membuat masalah nyata jadi tak terlihat.
3. **Hasil kerja punya dua jalur selamat.** Antrean SQLite adalah jalur kirim;
   folder cadangan (`features/baca-meter/backup.ts`) adalah jalur selamat bila
   database lokal rusak. Layar Cadangan memulihkan yang satu dari yang lain.

`DUPLIKAT` dari endpoint batch diperlakukan sebagai **sukses idempoten** — itu
terjadi saat unggah ulang setelah sinyal putus sebelum respons pertama sampai.
Memperlakukannya sebagai kegagalan akan membuat baris yang sudah aman menetap
selamanya di antrean.

## Peta berkas

| Berkas | Padanan Flutter |
| --- | --- |
| `features/baca-meter/db.ts` | `core/db/database_lokal.dart` |
| `features/baca-meter/dao.ts` | `features/staff/baca_meter/rbm_dao.dart` |
| `features/baca-meter/backup.ts` | `core/services/backup_lokal.dart` |
| `features/baca-meter/repository.ts` | `.../rute_repository.dart` |
| `features/baca-meter/tarif.ts` | `.../tarif_repository.dart` |
| `features/baca-meter/lokasi.ts` | `core/services/lokasi_service.dart` |
| `features/baca-meter/catat-screen.tsx` | `.../catat_meter_screen.dart` |
| `features/baca-meter/daftar-rute-screen.tsx` | `.../daftar_pelanggan_screen.dart` |
| `features/baca-meter/pelanggan-rute-screen.tsx` | `.../pelanggan_rute_screen.dart` |
| `features/baca-meter/{unduh,antrean,riwayat,cadangan}-screen.tsx` | `download_data`/`antrean_upload`/`riwayat`/`cadangan` |
| `features/portal/portal-screen.tsx` | `features/staff/portal/portal_screen.dart` |
| `features/pencatat/beranda-screen.tsx` | `.../pencatat_home_screen.dart` |
| `features/gangguan/*` | `features/staff/pengaduan/*` + `gangguan_home_screen.dart` |
| `features/petugas/workspace.tsx` | `.../workspace_widgets.dart` |
| `packages/mobile-core/src/models/rbm.ts` | `.../rbm_models.dart` |
| `packages/mobile-core/src/auth/sesi-petugas.ts` | `core/auth/sesi_petugas.dart` |

## Yang SENGAJA belum diport

Empat hal dihilangkan karena butuh modul native yang tidak ada padanannya di
Expo tanpa membangun modul kustom. Semuanya dicatat di sini supaya tidak
terlupakan, bukan karena dianggap tidak penting:

| Fitur | Alasan | Dampak |
| --- | --- | --- |
| **OCR angka stand dari foto** (`ocr_stand.dart`, ML Kit) | butuh ML Kit native | slot fotonya tetap ada; angka diketik petugas |
| **Watermark waktu+petugas pada foto** | `expo-image-manipulator` tidak bisa menggambar teks | foto tetap dikompres 600px; waktu unggah tetap dicatat server |
| **Ekspor ZIP + publikasi ke Galeri** (`archive`, MediaStore) | butuh pustaka arsip & MediaStore native | layar Cadangan membagikan **CSV catatan** (berkas yang memang diimpor web); foto tetap ada di folder cadangan |
| **Push notification** (Firebase) | butuh kredensial FCM/APNs + development client | **inbox notifikasi tetap berfungsi penuh** (dibaca dari server, bukan push); `POST /perangkat/token` sudah ada di backend dan tinggal dipanggil |

Juga tidak diport: **scan QR** (`scan_qr_screen.dart`). `expo-camera` sudah
terpasang dan mendukung barcode, jadi ini tinggal ditambahkan bila diperlukan —
tidak ada penghalang teknis, hanya belum dikerjakan.

Migrasi dari SharedPreferences (`migrasiDariPrefs`) sengaja tidak diport: ini
instalasi baru, tidak ada penyimpanan versi lama untuk diimpor.

## expo-sqlite di web

Di web, expo-sqlite memakai **wa-sqlite** yang dikompilasi ke WebAssembly,
bukan SQLite native. Dua penyesuaian sudah dipasang:

- `metro.config.js` — `assetExts.push('wasm')`. Tanpa ini bundel web gagal
  dengan `Unable to resolve module ./wa-sqlite/wa-sqlite.wasm`, dan karena
  aplikasi ini menyentuh SQLite sejak layar pertama, kegagalannya menjatuhkan
  seluruh bundel web.
- Header `Cross-Origin-Embedder-Policy` + `Cross-Origin-Opener-Policy` —
  wa-sqlite memakai `SharedArrayBuffer` yang hanya ada di halaman ter-isolasi
  lintas-origin. Dipasang di `metro.config.js` untuk dev server dan di plugin
  `expo-router` (`app.json`) untuk hosting produksi. Tanpa keduanya bundelnya
  berhasil tapi database gagal dibuka **saat dijalankan** — jauh lebih
  membingungkan daripada gagal build.

Web tetap bukan target penyebaran aplikasi ini: tanpa kamera dan GPS, layar
catat kehilangan foto bukti dan bukti kehadiran. Anggap web sebagai alat
memeriksa tampilan dengan cepat di laptop, bukan tempat petugas bekerja.

## Verifikasi

```bash
pnpm --filter mobile-petugas typecheck   # tsc --noEmit
npx expo-doctor                          # dari folder ini
npx expo export --platform android       # bundel Metro sungguhan
npx expo export --platform web           # memastikan jalur wasm sqlite utuh
```

Bundel Metro adalah pemeriksaan yang paling berarti: `withNativeWind` hanya
berjalan di sana, dan tanpa pipeline CSS-nya seluruh `className` tidak
ter-generate di release build — komponen tampak normal saat dev, lalu tak
terlihat di HP.
