# Panduan Struktur dan Pemisahan Tanggung Jawab Kode

**Status:** konvensi wajib untuk kode baru dan refactor pada modul yang sedang disentuh.
**Cakupan:** seluruh kode aplikasi TypeScript/React: komponen, hook, API client, domain, tipe, tes, dan file pendukung.
**Lokasi dokumen:** `/docs/STRUKTUR-KODE.md`

Panduan ini menentukan di mana sebuah file diletakkan, bagaimana diberi nama, dan tanggung jawab apa yang boleh dimuatnya. Panduan ini **bukan** perintah memindahkan seluruh repository: file lama tetap di tempatnya sampai disentuh secara berarti. Saat sebuah modul diubah secara berarti, gunakan struktur di bawah ini dan migrasikan hanya bagian yang terkait.

## Aturan wajib

1. **Feature/domain lebih dulu.** File yang berubah bersama untuk satu use case harus berdekatan. Jangan membuat folder global `types`, `utils`, `hooks`, atau `api` yang mencampur banyak domain.
2. **Satu modul, satu tanggung jawab utama.** Pisahkan UI, state/effect React, pemanggilan endpoint, aturan domain, tipe kontrak, dan fungsi murni hanya bila masing-masing punya alasan berubah sendiri.
3. **Dependensi mengarah ke inti.** UI boleh memakai hook, tipe, API client, dan helper domain. Hook boleh memanggil API feature dan helper murni. Helper domain tidak boleh mengimpor React, UI, database, atau API. Server tidak boleh mengimpor kode browser.
4. **Modular secukupnya, bukan sebanyak mungkin.** Pisahkan bagian hanya bila ada tanggung jawab mandiri, kompleksitas, penggunaan ulang, atau alasan perubahan yang jelas (lihat "Kapan membuat file atau folder baru"). Jangan memecah komponen sederhana menjadi banyak file kecil dan jangan membuat lapisan abstraksi yang tidak dibutuhkan. Gabungkan kembali bagian yang selalu berubah dan dipakai bersama.
5. **Jangan membuat `shared` terlalu dini.** Pindahkan kode ke `shared` hanya bila benar-benar dipakai beberapa feature dan semantiknya sama. Kesamaan bentuk belum tentu kesamaan aturan.
6. **Pertahankan perilaku saat refactor.** Jangan menggabungkan perubahan struktur dengan perubahan aturan bisnis, API, atau UX kecuali memang diminta. Tambah atau perbarui tes pada batas yang dipindahkan.
7. **Pakai UI dan ikon yang sudah ada di project.** Periksa `src/components/ui`, pemakaian di feature terkait, dan `package.json` sebelum membuat elemen UI. Jangan mengarang nama komponen, ekspor, API, atau library.
8. **Jangan menambah primitive UI bersama atau dependency tanpa izin.** Jelaskan kebutuhan beserta alternatifnya, lalu tunggu persetujuan (detail di bagian "UI dan ikon").
9. **Nama file buatan aplikasi memakai PascalCase berbahasa Indonesia yang ringkas** (detail di bagian "Penamaan").

## Struktur target

Gunakan folder `feature/domain` dengan pola berikut. Ini pola, bukan kewajiban membuat semua subfolder; buat hanya folder yang berisi file.

```text
src/
  features/
    <area>/
      <feature>/
        components/      # UI khusus feature; tidak berisi akses database
        hooks/           # state, effect, dan orkestrasi client React
        api/             # pemanggil endpoint untuk feature
        types/           # kontrak dan model TypeScript khusus feature
        lib/             # fungsi murni/domain kecil khusus feature
        <Feature>.tsx    # komposisi utama feature, bila diperlukan
        index.ts         # public entry point, hanya bila dipakai dari luar feature
```

- UI feature berada di `components/`. Root feature hanya berisi komposisi utama `<Feature>.tsx`, `index.ts` (bila perlu), dan folder peran.
- **Feature kecil** (kira-kira 4 file atau kurang) boleh datar tanpa subfolder peran. Saat tumbuh, pindahkan ke folder peran.
- **Backend** memakai pola domain/module server yang sudah ada di `src/lib/server/modules/<domain>`. Tempatkan route, service/use case, schema, dan repository menurut pola lokal. Jangan memindahkan aturan bisnis ke route handler atau komponen.
- **Next.js** menyimpan file konvensi (`page`, `layout`, `route`, `loading`, `error`) di `src/app`. Route dibuat tipis dan hanya menghubungkan URL ke feature. Jangan membuat folder feature di dalam `app` hanya untuk menghindari struktur framework.

### Tanggung jawab tiap lapisan

| Lapisan        | Boleh                                                                                             | Jangan                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `components/`  | Render, menerima props, interaksi lokal presentasi.                                               | Query database, aturan bisnis besar, request endpoint yang tersebar.                                            |
| `hooks/`       | Mengelola state/effect client, membatalkan respons usang, memanggil API feature.                  | Menjadi gudang JSX, query Prisma, atau aturan server.                                                           |
| `api/`         | Membungkus pemanggilan endpoint, serialisasi request, dan normalisasi respons di batas transport. | Menyimpan kredensial server di client atau mengulang aturan bisnis.                                             |
| `types/`       | Menamai kontrak input/output dan model feature.                                                   | Mengumpulkan tipe lintas domain tanpa pemilik jelas; memakai `any` untuk menutupi kontrak yang belum diketahui. |
| `lib/`         | Fungsi murni, formatter, mapper, selector, aturan domain terisolasi, dan konstanta milik feature. | Efek samping tersembunyi, akses React/DOM/database, atau fallback yang menyembunyikan error.                    |
| modul `server` | Validasi, otorisasi, transaksi, orkestrasi use case, dan akses database sesuai pola server.       | Mengimpor komponen atau hook client.                                                                            |

Catatan:

- Tipe respons mentah endpoint boleh berada di dekat adapter `api/` bila tidak menjadi kontrak UI. Tipe yang dipakai lintas komponen feature berada di `types/`.
- Validasi runtime input tetap wajib di batas kepercayaan; tipe TypeScript bukan validasi request.
- Konstanta ditempatkan di modul pemiliknya, bukan di file `Konstanta` global.

## Kapan membuat file atau folder baru

Buat file terpisah hanya bila memenuhi **setidaknya satu** kondisi berikut:

- dipakai di dua tempat atau lebih;
- berupa logika murni yang perlu dites sendiri;
- melintasi batas arsitektur (UI ↔ state/effect, client ↔ endpoint);
- punya alasan berubah sendiri **dan** file asalnya sudah panjang atau memuat lebih dari satu tanggung jawab (pedoman: lebih dari ±200 baris).

Bila tidak ada yang terpenuhi, biarkan di file pemakainya. Subkomponen pendek yang hanya dipakai satu komponen induk tetap berada di file induk. Satu komponen yang kohesif tetap satu file.

## Penamaan

### File

- Nama file source buatan aplikasi memakai **PascalCase berbahasa Indonesia**, singkat, dan menyebut domain atau tanggung jawab.
- Nama file komponen sama dengan komponen utamanya: `InfoPelangganView.tsx`, `BlokLokasi.tsx`, `GrafikPemakaian.tsx`.
- File non-UI di folder peran memakai pola berikut agar nama unik dan mudah dicari:

| Peran | Pola file                | Contoh file                | Contoh simbol utama     |
| ----- | ------------------------ | -------------------------- | ----------------------- |
| API   | `Api<Nama>.ts`           | `ApiInfoPelanggan.ts`      | `ambilInfoPelanggan`    |
| Hook  | `Use<Nama>.ts`           | `UseInfoPelanggan.ts`      | `useInfoPelanggan`      |
| Tipe  | `Tipe<Nama>.ts`          | `TipeInfoPelanggan.ts`     | `InfoPelanggan`         |
| Lib   | `<NamaDomain>.ts`        | `RiwayatPemakaian.ts`      | `susunRiwayatPemakaian` |
| Tes   | `<NamaModul>.test.ts(x)` | `RiwayatPemakaian.test.ts` |                         |

- Hook memakai awalan `Use` pada nama file karena React mewajibkan awalan `use` pada simbol hook; dengan begitu nama file sama dengan ekspornya.
- Pertahankan istilah domain yang sudah disepakati, nama produk/protokol, dan singkatan teknis mapan (misalnya `Odometer`). Jangan menerjemahkan nama API/ekspor library, route, atau simbol eksternal.
- Pilih satu istilah domain yang konsisten. Jangan memperkenalkan alias atau duplikasi tipe bila tipe canonical sudah ada.

### Folder

- Folder feature dan area memakai huruf kecil dengan kebab-case: `info-pelanggan`, `dashboard`.
- Nama folder peran baku dan tidak diterjemahkan: `components`, `hooks`, `api`, `types`, `lib`.
- Subfolder pengelompokan UI (khusus feature besar) berupa satu kata Indonesia huruf kecil, misalnya `foto`, `modal`, `panel`.
- Pertahankan nama segmen URL dan folder Next.js yang menjadi kontrak framework.

### Simbol

- Komponen dan tipe: `PascalCase` (`InfoPelangganView`, `InfoPelanggan`).
- Hook dan fungsi: `camelCase` (`useInfoPelanggan`, `susunRiwayatPemakaian`).
- Konstanta: `UPPER_SNAKE_CASE` bila sesuai.

### Pengecualian bernama tetap

File konvensi Next.js (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`), `index.ts` sebagai public entry point, file konfigurasi/manifest, nama URL/route, dan suffix tes (`.test.ts`, `.spec.ts`; bagian sebelum suffix tetap PascalCase).

### Next.js App Router

- Pertahankan `page.tsx`/`layout.tsx` dan export metadata `metadata` atau `generateMetadata` (huruf kecil).
- Beri fungsi komponen default nama PascalCase yang spesifik sesuai route (`DashboardPage`, `TarifAirPage`), bukan `Page` generik.
- Import tipe lewat `import type { Metadata } from "next"`. Jangan memakai jalur internal `next/dist/...` dan jangan menamai export metadata `Metadata`.

### File legacy

Jangan mengubah nama file legacy yang tidak sedang direfactor. Saat file disentuh atau dipindah secara berarti, gunakan konvensi di atas dan perbarui semua import. Nama lama seperti `Gunakan*`, `*Api`, atau `*Types` tetap sah sampai file itu disentuh.

## Impor dan dependensi

- Hindari barrel `index.ts` internal yang menyamarkan arah dependensi atau memicu circular import. Barrel hanya boleh sebagai public entry point feature yang dipakai dari luar feature.
- Jangan mengimpor modul antar-feature lewat path internal yang dalam. Bila beberapa feature berbagi kontrak atau perilaku, buat abstraksi bersama dengan pemilik dan semantik yang jelas.
- Hindari dependency cycle. Bila muncul, pindahkan kontrak kecil ke lapisan yang lebih dalam dan stabil, jangan menambah barrel.

## UI dan ikon

**shadcn/ui**

- Cari dan gunakan komponen di `src/components/ui` terlebih dahulu. Jangan membuat ulang button, dialog, input, card, menu, atau primitive serupa tanpa alasan kuat.
- Verifikasi ekspor dan props aktual dari file komponen; jangan mengandalkan ingatan atau contoh dari versi lain.

**HugeIcons**

- Impor ikon lewat entry point project: `@/components/ui/hugeicons-compat`. Jangan memperkenalkan jalur impor kedua, dan ikuti pola pemakaian di feature terkait.
- Verifikasi bahwa ikon benar-benar tersedia sebelum dipakai; jangan menebak nama ikon.

**Library UI lain**

- Hanya yang sudah terpasang di `package.json` dan cocok dengan kebutuhan. Dokumentasi versi terpasang lebih diutamakan daripada ingatan.

**Izin untuk menambah**

- Bila kebutuhan tidak dapat dipenuhi komponen terpasang, jelaskan kebutuhan beserta opsinya, lalu minta persetujuan sebelum menambah primitive bersama, wrapper pengganti, atau dependency UI baru. Jangan menambahnya hanya karena API yang diinginkan tidak ditemukan.
- Komponen komposisi khusus feature boleh dibuat bila menyederhanakan UI secara bermakna atau memisahkan tanggung jawab sesuai aturan modular, dan bukan menduplikasi primitive.

## Strategi penerapan

1. **Kode baru:** mulai dari feature/domain dan buat file hanya untuk tanggung jawab yang diperlukan.
2. **Kode lama:** jangan memindahkan secara massal. Refactor area yang diperlukan, pertahankan pintu masuk/import publik, dan hapus modul lama hanya setelah semua pemakai diperbarui.
3. **Satu perubahan, satu tujuan:** pisahkan perubahan struktur dari perubahan perilaku. Tambah tes untuk fungsi murni, API, atau hook pada batas yang relevan.
4. **Cek pemakai:** periksa semua pemakai simbol sebelum memindahkan file. Jangan meninggalkan import atau dokumentasi yang menunjuk lokasi lama.
5. **Rename beda kapitalisasi:** filesystem Windows umumnya tidak membedakan huruf besar/kecil. Gunakan `git mv` (bila perlu lewat nama sementara), pastikan `forceConsistentCasingInFileNames` aktif di `tsconfig`, dan verifikasi dengan typecheck.
6. **Validasi:** jalankan formatter, tes terarah, dan typecheck yang sesuai. Laporkan secara eksplisit validasi yang tidak dapat dijalankan.

## Contoh acuan: Info Pelanggan

Contoh ini menunjukkan bentuk target untuk feature berukuran sedang yang melewati semua lapisan. Jumlah file UI mengikuti kebutuhan nyata; contoh ini bukan target jumlah file.

```text
src/features/dashboard/info-pelanggan/
  api/ApiInfoPelanggan.ts
  hooks/UseInfoPelanggan.ts
  lib/FormatAngka.ts            # sesuaikan nama dengan isi Format.ts lama
  lib/RiwayatPemakaian.ts
  lib/RiwayatPemakaian.test.ts
  types/TipeInfoPelanggan.ts
  components/
    BlokLokasi.tsx
    FormCari.tsx
    GrafikPemakaian.tsx
    LembarCetak.tsx
    ...                         # komponen UI lain; gabungkan yang selalu berubah bersama
  InfoPelangganView.tsx         # komposisi utama
```

Pemetaan dari bentuk lama:

| Lama                                                           | Target                                     |
| -------------------------------------------------------------- | ------------------------------------------ |
| `components/info-pelanggan/` (di bawah `dashboard/components`) | `features/dashboard/info-pelanggan/`       |
| `api/InfoPelangganApi.ts`                                      | `api/ApiInfoPelanggan.ts`                  |
| `hooks/UseInfoPelanggan.ts`                                    | `hooks/UseInfoPelanggan.ts` (tetap)        |
| `types/InfoPelangganTypes.ts`                                  | `types/TipeInfoPelanggan.ts`               |
| `lib/Format.ts`                                                | `lib/` dengan nama Indonesia sesuai isinya |
| komponen UI di root                                            | `components/`                              |

Route (`page.tsx`) tetap tipis dan hanya mengimpor `InfoPelangganView` dari feature. Jangan menyalin struktur lama sebagai alasan menambah file di folder global.

## Feature besar

Feature dengan banyak komponen UI (puluhan, seperti Verifikasi) boleh mengelompokkan UI menurut peran di dalam `components/`, misalnya `components/foto/`, `components/modal/`, `components/panel/`. Ini pengecualian untuk skala besar, bukan pola dasar; feature berukuran sedang cukup memakai `components/` datar. Struktur Verifikasi yang ada (`foto/`, `modal/`, `panel/` sejajar `hooks/`, `lib/`, `types/`) tetap sah sampai disentuh; bila dirapikan, pindahkan UI-nya ke `components/`.
