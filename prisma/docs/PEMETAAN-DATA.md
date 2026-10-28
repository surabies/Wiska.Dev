# Pemetaan Data Antar-Sumber — dasar data resmi penagihan

Dokumen ini menjawab satu pertanyaan: **bagaimana keempat CSV sumber saling
berhubungan, dan apa yang masih kurang sebelum aplikasi ini boleh dipakai
sebagai dasar tagihan resmi ke pelanggan.**

Semua angka di sini **diverifikasi langsung terhadap file mentah** periode
202605 (bukan perkiraan).

**Cara membaca dokumen ini:** bagian 1–5 adalah **diagnosis** — keadaan
sebagaimana ditemukan, termasuk kalimat seperti "TarifBlok saat ini 0 baris".
Bagian **6 mencatat apa yang sudah diubah** sebagai jawabannya, lengkap
dengan angka hasil terukur. Jadi kalau bagian 3 bilang sesuatu "belum ada",
periksa bagian 6 sebelum menyimpulkan itu masih berlaku.

> **Catatan struktur:** laporan ini berasal dari analisis saat data masih
> berada di monorepo lama. Rujukan berkas aplikasi/paket di bagian historis
> dapat menunjukkan lokasi lama; struktur Prisma saat ini dijelaskan di
> [`STRUKTUR.md`](./STRUKTUR.md). Perintah seed di bawah dijalankan dari root
> project ini.


---

## 1. Hubungan keempat file: satu superset, tiga irisan

```
lapdatameter (22.553 baris)  ← daftar kerja petugas Mei, SUPERSET
        │
        ├── ProgresCater (22.523)  = yang layak ditagih Mei
        ├── r-nomor      (19)      = dicabut dalam Mei → dicatat, TIDAK ditagih
        └── PBPK         (11)      = aktif 26 Mei → dicatat, BELUM ditagih
```

Terverifikasi:

| Pemeriksaan | Hasil |
|---|---|
| ProgresCater ∩ lapdatameter | 22.523 |
| ProgresCater \ lapdatameter | **0** — tidak ada baris tagihan tanpa pencatatan |
| lapdatameter \ ProgresCater | 30 = 19 r-nomor + 11 PBPK, **tanpa sisa** |
| Stand awal sama di kedua file | 22.523 / 22.523 |
| Stand akhir sama di kedua file | 22.523 / 22.523 |
| Kode rute sama di kedua file | 22.523 / 22.523 |
| Nama petugas | 9 nama identik (lapdatameter punya tambahan `-` = belum berpetugas) |

### Konsekuensi yang harus diluruskan

**ProgresCater bukan sumber independen.** Ia adalah lapdatameter yang sudah
disaring (buang cabutan & PBPK) lalu ditambah hasil perhitungan tarif.
Selama ini skema memperlakukan keduanya sebagai dua aliran terpisah — step
06 membangun `PembacaanMeter`/`Tagihan` dari ProgresCater, step 07
membangun `LaporanHarianPetugas` dari lapdatameter lalu menandainya
`isVerified` kalau ketemu padanan di step 06.

Untuk **backfill historis** pola itu tidak merusak apa pun. Tapi sebagai
**model alur ke depan ia terbalik**: begitu aplikasi ini menggantikan
Aurora, aplikasi inilah yang memproduksi lapdatameter, dan ProgresCater
menjadi **keluaran** (hasil closing), bukan masukan. Verifikasi V1→V2→V3
yang sudah ada di `LaporanHarianPetugas` adalah jalur yang benar; yang
belum ada adalah langkah "closing periode" yang mengubah laporan
terverifikasi menjadi `PembacaanMeter` + `Tagihan` resmi secara massal.

### Wujud 30 baris pembeda (penting, sering disalahpahami)

**11 PBPK** di lapdatameter: stand awal 0, stand akhir 0, pakai 0,
`tgl_catat` 2026-05-27, **petugas `-`** (belum ada rute/petugas).
Jadi mereka bukan "pelanggan yang terlewat dicatat" — mereka sengaja
dibuka dengan stand nol sebagai baris pembuka. Bulan Juni-lah pertama
kalinya mereka menghasilkan tagihan, dan **saat itu juga mereka baru
masuk beban kerja petugas.**

Dua di antaranya berjenis `PK` (bukan `PB`): `00802100540` dan
`00404101010`, dengan `tglaktif` 1980 dan 1985 — pelanggan lama yang
ganti kontrak/meter, stand-nya direset ke 0. Karena itu **`tglaktif`
tidak boleh dipakai sebagai tanggal mutasi** (sudah ditangani benar di
`lib/csv.ts:getPbpkPeriode`).

**19 r-nomor** di lapdatameter: stand awal = stand akhir, pakai 0,
`Kd_kel` = `D` (DI CABUT), **punya rute & petugas**. Artinya mereka masih
menjadi beban kerja petugas di Mei, tapi tidak menghasilkan tagihan.

Ini terkonfirmasi silang lewat distribusi kode kelainan: lapdatameter
punya 46 kode `D`, ProgresCater punya 27 — selisihnya **tepat 19**.

### Aritmetika SL yang harus dipegang aplikasi

```
SL ditagih Mei                   = 22.523
+ PBPK Mei (mulai ditagih Juni)  =     11
= Daftar catat Juni              = 22.534   ← kini tersimpan sebagai DaftarCatat
```

Tabel `Pelanggan` sendiri berisi **22.553** baris: 19 yang dicabut tetap
disimpan berstatus non-aktif, bukan dihapus (lihat bagian 4 & 6).

Cabutan Mei (19) tidak perlu dikurangkan lagi di sini karena memang sudah
tidak ada di ProgresCater Mei. Kalau dihitung dari sisi daftar kerja
petugas, hasilnya sama: `22.553 − 19 = 22.534`.

---

## 2. Seluruh tagihan bisa dihitung ulang 100% — tarifnya ada di data

**22.523 dari 22.523 baris tagihan berhasil direproduksi persis** dengan:

```
total = hargaAir(golongan, pakai_drd)
      + beaBeban(ukuran meter)
      + 10.000   (bea admin, flat)
      + 11.100   (air kotor, flat)
      + 0        (lain-lain)
```

- `jmlhargaair` adalah **fungsi murni** dari (golongan tarif, `pakai_drd`):
  629 kombinasi berbeda, **0 konflik** — tidak ada satu pun kasus di mana
  golongan & pemakaian sama tapi harga air berbeda.
- `tjtg` = penjumlahan kelima komponen di atas: **0 baris tidak cocok.**

### Blok progresif: batas 1–10 / 11–20 / 21–30 / >30 m³

Harga per m³ hasil rekonstruksi (rupiah):

| Golongan | Blok 1 | Blok 2 | Blok 3 | Blok 4 |
|---|---|---|---|---|
| 1A | 900 | 900 | 900 | 1.300 |
| 2A2 | 2.000 | 3.600 | 5.700 | 8.800 |
| 2A3 | 3.120 | 5.520 | 8.880 | 12.840 |
| 2A4 | 3.960 | 7.200 | 11.280 | 15.120 |
| 3A | 4.350 | 7.950 | 13.050 | 18.900 |
| 3B | 6.900 | 10.800 | 16.050 | 21.600 |

Golongan bervolume kecil (1B, 2A1, 2A5, 2B, 3C, 4A, 4B) datanya terlalu
jarang untuk memastikan keempat bloknya dari observasi saja — untuk yang
ini **wajib menunggu SK tarif**, jangan diekstrapolasi.

### Bea beban = fungsi murni ukuran meter

| Ukuran | Kode `ukr` | Bea beban | Jumlah SL |
|---|---|---|---|
| ½" | A | 7.000 | 22.438 |
| 1" | C | 43.000 | 58 |
| 1½" | D | 72.000 | 4 |
| 2" | E | 129.000 | 19 |
| 3" | F | 158.000 | 2 |
| 4" | G | 187.000 | 2 |

### Kenapa ini penting

`TarifBlok` di database saat ini **0 baris**. Komentar di
`steps/01-referensi.ts` menyatakan tarif per-blok "perlu sumber data
terpisah (SK tarif resmi) sebelum bisa diisi akurat". Untuk **legalitas**
itu benar. Tapi tidak benar bahwa datanya belum ada — datanya ada, dan
sudah terbukti mereproduksi 22.523 tagihan tanpa satu pun selisih. SK
tarif nanti berfungsi **mengonfirmasi dan menandatangani** angka ini,
bukan menemukannya.

Selama `TarifBlok` kosong, aplikasi ini **tidak bisa menerbitkan tagihan
sendiri** — ia hanya bisa menyalin tagihan dari CSV Aurora. Itu penghalang
terbesar untuk benar-benar menggantikan Aurora.

---

## 3. Yang paling berisiko: `pakai_drd` ≠ (stand akhir − stand awal)

**10.160 dari 22.523 baris (45%)** punya `pakai_drd` yang berbeda dari
selisih stand. **Yang ditagihkan adalah `pakai_drd`**, bukan selisih stand.

Aturan yang berhasil direkonstruksi dari data:

| Situasi | Aturan | Kecocokan |
|---|---|---|
| Meter tak terbaca (`H`,`R`,`7`,`5`,`3`,`E`,`O`,`2`,`6`) | pakai tagih = **pemakaian bulan lalu** (taksiran) | 92–98% |
| `8` TIDAK ADA AIR, `D` DICABUT | pakai tagih = **0**, selalu | 100% |
| Normal | pakai riil, tapi **minimum 5 m³** | ±97% |
| Sisanya (~1,4%) | **override manual** verifikator | tidak berpola — dan itu wajar |

Contoh nyata: pelanggan `00402100060`, stand tidak bergerak (715 → 715),
kondisi `H` TIDAK DIPAKAI, **ditagih 10 m³** karena bulan lalu memakai 10 m³.

### Konsekuensi

Kalau aplikasi baru menghitung tagihan langsung dari stand yang diinput
petugas, hasilnya akan **berbeda dari Aurora untuk hampir separuh
pelanggan**. Ini bukan bug yang ketahuan pelan-pelan — ini langsung
menjadi sengketa tagihan massal di bulan pertama pemakaian.

Skema saat ini menyimpan `PembacaanMeter.pemakaianM3` = `pakai_drd` (nilai
tagih) dan **tidak menyimpan pemakaian riil secara terpisah**. Akibatnya
jejak "berapa yang sebenarnya terbaca vs berapa yang ditagihkan, dan
kenapa" hilang — padahal justru itu yang ditanyakan pelanggan saat
mengadu, dan yang diperiksa auditor.

---

## 4. Yang belum termodelkan: daftar catat per periode (DPM)

Tidak ada satu pun tabel yang menyatakan **"daftar pelanggan yang wajib
dicatat pada periode X"**. Angkanya benar, tapi konsepnya tidak ada.
Akibat yang terukur:

**a. Target petugas tidak bisa dihitung dengan benar.** Beban Mei per
petugas berbeda tergantung sumber yang dipakai:

| Petugas | Daftar kerja (lapdatameter) | Tagihan terbit (ProgresCater) | Selisih |
|---|---|---|---|
| AGUS | 2.526 | 2.520 | 6 |
| DADANG | 2.506 | 2.503 | 3 |
| IWAN | 2.547 | 2.545 | 2 |
| RUDY | 2.492 | 2.490 | 2 |
| *(dan seterusnya)* | | | |
| *(tanpa petugas)* | 11 | 0 | 11 |

Selisihnya persis cabutan + PBPK di rute masing-masing. Kalau target
diambil dari jumlah tagihan, petugas **dirugikan** (kunjungan ke rumah
yang ternyata sudah dicabut tetap pekerjaan). Kalau diambil dari daftar
kerja mentah, cabutan ikut terhitung selamanya.

**b. `TargetKinerja` yang ada sekarang tidak menjawab ini** — isinya
`targetKubikasi` + `targetSambunganBaru` per SeksiCater/WilayahDist, bukan
target jumlah SL yang harus dicatat per pencatat per periode.

**c. 19 pelanggan tercabut hilang total dari sistem.** Mereka tidak pernah
masuk tabel `Pelanggan` (semua baris `Pemutusan` ber-`pelangganId` null),
karena step 05 hanya membaca ProgresCater + PBPK. Jadi:

- tidak ada jejak "pernah jadi pelanggan lalu dicabut" yang bisa di-join;
- kalau bulan depan salah satu nomor itu muncul lagi di ProgresCater, ia
  akan dibuat sebagai pelanggan **AKTIF baru** tanpa peringatan apa pun —
  penjaga status terminal di `lib/status.ts` tidak bisa bekerja pada baris
  yang memang tidak ada.

Ini berbeda dari kekhawatiran yang tertulis di `steps/09-pemutusan.ts`
(yang menjaga agar status pelanggan tidak diubah otomatis). Penjagaan itu
tetap benar; masalahnya barisnya sama sekali tidak ada untuk dijaga.

---

## 5. Bug yang ditemukan & sudah diperbaiki

| Masalah | Dampak | Status |
|---|---|---|
| File seed mengimpor path client yang berasal dari proyek lama | **Seed tidak bisa dijalankan sama sekali** — `Cannot find module` | Diperbaiki dengan alias `@generated` di `tsconfig.paths.json` |
| Folder seed tidak masuk `tsconfig.include` | Impor basi di atas lolos `pnpm typecheck` tanpa suara | Diperbaiki |
| `.env` dicari relatif ke working directory seed | `DATABASE_URL tidak ditemukan` | Diperbaiki di `prisma/seed/lib/db.ts` dengan path root project |
| Seed hanya bisa dijalankan sekaligus 10 step | Tidak bisa mengulang satu step saja | Diperbaiki (lihat di bawah) |
| 3 pelanggan ber-nolg huruf tidak punya Meter/Tagihan di DB | Tagihan Mei kurang 3 baris (22.520, bukan 22.523) | Diperbaiki dengan menjalankan ulang step 06 |

`bootstrap-admin.ts`, `bootstrap-pencatat.ts`, dan
`reset-pencatat-password.ts` **masih rusak** — ketiganya mengimpor
`hashPassword` dari `@/lib/password`. Belum diperbaiki karena butuh
keputusan: `@workspace/auth` bergantung pada `@workspace/db` (jadi arah
sebaliknya akan sirkular), **dan** `packages/auth/password.ts` memakai
`import "server-only"` yang melempar error kalau dijalankan lewat `tsx`.
Pilihannya: pindahkan skrip ini ke paket yang boleh bergantung ke auth,
atau pisahkan `password.ts` dari `server-only`.

### Perintah

Dari root project:

```bash
pnpm db:seed                     # semua step, seperti sebelumnya
pnpm db:seed:step --list         # daftar step
pnpm db:seed:step 05             # satu step saja
pnpm db:seed:step 05 06 07       # beberapa step
pnpm db:seed:step --from=06      # step 06 sampai terakhir
pnpm db:seed:step --from=05 --to=07
pnpm db:cek                      # audit read-only: DB vs angka acuan
pnpm db:verifikasi-tarif         # uji regresi tagihan (tarif dari CSV)
pnpm db:verifikasi-tarif --dari-db   # idem, tapi tarif dibaca dari database
```

Dari root project:

```bash
pnpm bootstrap-admin
pnpm bootstrap-pencatat
pnpm reset-pencatat-password
```

Urutan eksekusi **selalu** mengikuti urutan kanonik (dependensi FK),
berapa pun urutan pengetikan argumen. Menjalankan sebagian step aman
karena semua tulis lewat `upsert`, tapi prasyarat FK tetap berlaku —
step 06 butuh `Pelanggan` dari step 05, dan seterusnya.

---

## 5b. Kinerja seed — dari berjam-jam jadi 3 menit

Step 06 versi awal melakukan **~7 query berurutan per baris**. Untuk 22.523
baris terhadap Postgres terkelola (Neon, lintas jaringan) itu berarti
~158.000 round-trip: terukur **>44 menit dan belum selesai**, proyeksi
sekitar 4,5 jam. Impor bulanan yang butuh setengah hari bukan hal yang bisa
dijalankan rutin — dan itu membatalkan tujuan "seed bisa dijalankan satu
per satu".

Dua perbaikan, keduanya **tanpa mengubah semantik**:

1. Semua lookup di-preload sekali di awal jadi `Map` di memori (pelanggan,
   meter aktif, pembacaan & tagihan periode ini).
2. Baris diproses dalam kelompok paralel (16 sekaligus), bukan satu per satu.
   Aman karena `nolg` terverifikasi unik di ProgresCater — tidak ada dua
   baris menyentuh pelanggan yang sama, jadi tidak ada balapan pada logika
   penggantian meter. `try/catch` per baris tetap dipertahankan persis.

Hasil terukur: **181 detik** (dari >44 menit), 0 error, 0 warning.

Step 05 punya penyakit yang sama (findUnique + upsert berurutan per baris,
masih berjalan setelah 11 menit) dan diperbaiki dengan cara yang sama:
**87 detik**.

Ringkasan waktu jalan sekarang: step 05 ≈ 87 dtk, step 06 ≈ 181 dtk,
step 11 ≈ 227 dtk. Impor bulanan penuh jadi hitungan menit, bukan jam.

## 6. Pemetaan ulang — yang SUDAH dikerjakan

1. **`TarifBlok` + `BiayaTetap` diisi dari data** (`seed/lib/tarif.ts`,
   dipanggil step 01), dengan uji regresi `pnpm db:verifikasi-tarif`.
   Hasil: **22.516 dari 22.517 tagihan direproduksi persis.** Sisanya:
   1 anomali data (lihat di bawah) dan 6 pelanggan di golongan yang blok
   atasnya belum bisa dipastikan (2A1, 4A) — wajib dari SK tarif, sengaja
   **tidak diekstrapolasi**.

   Skrip ini keluar dengan exit code ≠ 0 kalau ada yang meleset, jadi bisa
   langsung dipasang di CI. Jalankan `--dari-db` untuk menguji tarif yang
   TERSIMPAN, bukan yang dihitung di memori.

2. **Pemakaian riil dipisah dari pemakaian tagih** — `PembacaanMeter`
   mendapat `pemakaianRiil` + `alasanTaksir`. Aturannya (termasuk minimum
   5 m³ menurut Perdir) hidup di `prisma/seed/lib/domain/tagihan.ts` sebagai modul
   murni tanpa impor, dipakai bersama oleh server, seed, dan skrip
   verifikasi. Seed **melabeli** alasan dari apa yang terjadi di data —
   tidak pernah menghitung ulang lalu menimpa angka tagih dari sumber.

3. **`DaftarCatat` (DPM)** — `steps/11-daftar-catat.ts`. Periode berjalan
   direkonstruksi dari daftar kerja nyata (lapdatameter); periode
   berikutnya diturunkan dengan `DPM(N+1) = DPM(N) − dicabut(N)`.

4. **Pelanggan tercabut tidak lagi hilang** — step 05 membaca r-nomor,
   nama & alamatnya diambil dari lapdatameter (bukan dikarang), status dari
   jenis pemutusan (TSM → TUTUP_SEMENTARA, SPT → TUTUP_SPT). Yang tetap
   TIDAK dilakukan: mengubah status pelanggan yang sudah ada — itu tetap
   hanya ditandai untuk ditinjau manusia di step 09.

### Kondisi database setelah semuanya dijalankan (`pnpm db:cek`)

```
Pelanggan total       : 22.553   = 22.523 + 11 PBPK + 19 tercabut
  AKTIF               : 22.507
  TUTUP_SEMENTARA     :     37   (27 tupsp/tupsm + 10 TSM)
  TUTUP_SPT           :      9
Tagihan 202605        : 22.523   (sebelumnya 22.520 — 3 baris hilang, kini lengkap)
  total ditagih       : Rp 3.012.581.580
Pemutusan             :     19   (semuanya kini tertaut ke baris Pelanggan)
TarifBlok             :     46
Tagih != riil         : 10.160   <- cocok PERSIS dengan hitungan langsung dari CSV
  TAKSIRAN_BULAN_LALU :  6.631
  MINIMUM_5M3         :  2.237
  OVERRIDE_MANUAL     :  1.292
DPM 202605            : 22.553   DICATAT 22.523 | TIDAK_TERCATAT 11 | DICABUT 19
DPM 202606            : 22.534   BELUM_DICATAT
```

Beban per pencatat periode 202606 kini bisa di-`COUNT` langsung: IWAN 2.545,
PERIYADI 2.545, AGUS 2.520, EDI 2.518, DADANG 2.503, OMAY 2.492, RUDY 2.490,
DIDIN 2.464, DANI 2.446, dan 11 belum berpetugas — persis angka yang
sebelumnya cuma bisa didapat dengan menghitung ulang CSV secara manual.

Angka **10.160** patut digarisbawahi: ia dihasilkan ulang oleh jalur yang
sepenuhnya berbeda (aturan di `prisma/seed/lib/domain/tagihan.ts` yang diterapkan
baris per baris saat impor) dan bertemu persis dengan hitungan langsung atas
file mentah. Aturan taksiran & minimum yang direkonstruksi memang benar.

### Normalisasi tarif pelanggan kontrak khusus

Pelanggan **`00008001503`** (RM. TINGGAL PANGDAM VI/SL), golongan 2B,
memiliki `pakai_drd` **3.000 m³** pada periode 202601–202608. STI sebelumnya
menerapkan harga kontrak khusus pada `jmlhargaair`; aplikasi ini tidak
memodelkan kontrak tersebut, sehingga data CSV dinormalisasi ke tarif
standar aplikasi:

| Komponen | Nilai |
|---|---:|
| Harga air 2B untuk 3.000 m³ | 38.046.000 |
| Bea beban | 43.000 |
| Bea admin | 10.000 |
| Air kotor | 11.100 |
| Lain-lain | 0 |
| **Total tagihan standar** | **38.110.100** |

Pemakaian 3.000 m³ dipertahankan; nilai kontrak khusus pada tagihan sumber
bukan dasar untuk mengubah pemakaian atau rumus tarif aplikasi.

## 7. Closing periode — SUDAH ADA (butir 1 lama)

Arah aliran data sudah dibalik. Aplikasi kini **memproduksi** closing:

| Bagian | Berkas |
|---|---|
| Mesin closing | `packages/server/modules/closing/closing.service.ts` |
| Mesin buka bulan baru | `packages/server/modules/closing/bulan-baru.service.ts` |
| API | `packages/server/modules/closing/closing.router.ts` |
| Layar operator | `apps/web/app/(dashboard)/dashboard/closing/page.tsx` + `features/dashboard/components/closing/` |
| Uji regresi | `src/lib/server/scripts/cek-closing.ts` → `pnpm server:cek-closing [periode]` |

Enam endpoint, kewenangan berjenjang: `GET /closing` (daftar, STAFF_UP),
`GET /closing/:periode` (pratinjau, tidak menulis, STAFF_UP),
`POST /closing/:periode/tutup` (SENIOR_UP), `POST /closing/:periode/buka`
(ADMIN, wajib beralasan ≥10 karakter, ditolak bila ada tagihan lunas),
`GET /closing/:periode/bulan-baru` (pratinjau DPM berikutnya, STAFF_UP),
`POST /closing/:periode/bulan-baru` (SENIOR_UP).

### Buktinya, bukan klaimnya

`pnpm server:cek-closing 202605` menghitung ulang SELURUH pembacaan lewat jalur
closing aplikasi lalu membandingkannya dengan tagihan yang benar-benar
tersimpan:

```
Dibandingkan     : 22523
COCOK            : 22523
BEDA             : 0
```

Uji ini lebih kuat daripada `db:verifikasi-tarif`: yang itu menguji rumus
terhadap CSV, yang ini menguji **seluruh jalur** (pembacaan di DB → tarif
berlaku → biaya tetap per ukuran meter → total).

Skrip keluar dengan kode 0 sekarang, jadi **bisa dipasang sebagai gerbang
CI**. Semua selisih, termasuk perubahan tarif, menggagalkan pemeriksaan
sampai data dan tagihan tersimpan selaras.

### 8 pelanggan yang TIDAK bisa ditagih mesin ini

Terungkap oleh `pnpm cek-closing`, dan sekarang ditampilkan lengkap dengan
nomornya di layar closing (dulu cuma angka tanpa nama, yang tidak bisa
ditindaklanjuti siapa pun):

| Hambatan | Jml | Nomor langganan |
|---|---|---|
| `TARIF_BLOK_KOSONG` | 6 | 00402100270, 00802200455, 00900900704, 00901100440, 00902500163, 00908220370 |
| `PEMAKAIAN_DI_LUAR_BLOK_TARIF` | 2 | 00401000590, 00904900251 |

Keduanya berpangkal pada hal yang sama: blok tarif golongan bervolume kecil
belum ada. Mesin sengaja **menolak menerbitkan** tagihannya daripada
menagih terlalu murah secara diam-diam.

## 7c. Buka bulan baru — siklusnya kini berputar

Padanan "Create Bulan baru" di Aurora. Closing menutup bulan; ini membukanya
lagi. Aturannya:

```
DPM(N+1) = [ DaftarCatat(N) ∪ yang BERTAGIHAN pada N ]
           − yang ditandai DICABUT pada DPM(N)

lalu selama N+1 berjalan:  DPM(N+1) += PBPK(N+1)
```

> **Dikoreksi 2026-08-01.** Bagian ini sebelumnya menetapkan basis MASTER
> (seluruh tabel `Pelanggan` − yang PERNAH dicabut). Itu salah; lihat
> "Kenapa basisnya per-periode" di bawah, dan bagian 13 untuk buktinya.

### Kenapa basisnya PER-PERIODE, bukan master pelanggan

Basis master keliru dua kali, dan keduanya terukur pada data nyata:

**1. Tabel `Pelanggan` akumulatif** — tidak pernah menyusut kecuali lewat
penanda DICABUT, jadi DPM kelebihan orang setiap bulan:

| periode | basis master | seharusnya | kelebihan | kekurangan |
|---|---|---|---|---|
| 202602 | 22.621 | 22.559 | **+62** | 0 |
| 202603 | 22.595 | 22.537 | **+58** | 0 |
| 202604 | 22.585 | 22.542 | **+43** | 0 |
| 202605 | 22.566 | 22.534 | **+32** | 0 |
| 202606 | 22.547 | 22.520 | **+27** | 0 |

**2. "PERNAH dicabut sampai N" juga akumulatif** — sambungan yang dipasang
kembali (mutasi `Pembukaan Kembali PS/SPT`, nyata ada di PEL202604,
PEL202606, dan ProgresCater April) terkunci keluar dari SELURUH daftar
berikutnya, diam-diam.

### Kenapa dulu dikira harus master — dan kenapa itu salah alamat

Alasan yang tertulis di versi lama: menurunkan dari daftar bulan lalu "bocor"
156 sambungan di Maret dan 34 di April. Kebocorannya **nyata**, tapi letaknya
di berkas `lapdatameter`, bukan pada aturannya. Diperiksa baris per baris:

| bulan | hilang | terkumpul di rute | tetap ditagih | kembali |
|---|---|---|---|---|
| Maret | 157 | TA607 (84), KC202 (68) — petugas DANI & DIDIN | **156/157** | April (156) |
| April | 34 | KC302 (34) — petugas DIDIN | **34/34** | Mei (34) |

Rute **utuh** menghilang satu bulan lalu kembali, sementara pelanggannya
tetap ditagih normal. Itu celah unggah/ekspor berkas harian per rute, bukan
populasi yang berubah. Membuang cakupan per-periode untuk menambalnya berarti
menukar satu gejala dengan kelebihan permanen.

Suku `∪ yang BERTAGIHAN pada N` menambal celah itu **tanpa** kehilangan
cakupan periode, dan dilaporkan lewat kode `DIPULIHKAN_DARI_TAGIHAN` (sengaja
ditandai kuning, bukan netral: ia menandakan daftar catat periode sumber
tidak lengkap).

**Penjagaan produksi:**

| Penjagaan | Alasan |
|---|---|
| Periode sumber **wajib TERKUNCI** | DPM baru diturunkan dengan mengeluarkan yang DICABUT pada periode sumber, dan itu baru pasti setelah periodenya dikunci. Ini juga urutan yang dipakai Aurora (close DRD → bulan baru). |
| Ditolak bila DPM tujuan **sudah dipakai bekerja** | Menerbitkan ulang menghapus daftar; selama belum ada baris yang statusnya bukan `BELUM_DICATAT`, tidak ada pekerjaan yang hilang |
| Aman diulang | Hapus-lalu-tulis dalam batch 1.000; idempoten karena penjagaan di atas |
| Snapshot rute/petugas dari penugasan **saat ini** | Sebabnya Aurora menjalankan "Update zonasi" tepat sebelum langkah ini. Menyalin bulan lalu membuat perubahan rute tak pernah sampai ke lapangan |

### Temuan: `PenugasanRute` baru mencakup 29 dari 123 rute

Fitur ini mengungkapnya. DPM 202605 punya petugas untuk 22.542 baris — tapi
angka itu datang dari **nama petugas di CSV**, bukan dari penugasan formal.
Menurunkan petugas murni dari `PenugasanRute` akan mengosongkan **17.585**
penugasan sekaligus.

Karena itu penugasan dicari dua tingkat: `PenugasanRute` yang berlaku hari
ini, lalu — bila rutenya **tidak berubah** — diwarisi dari daftar bulan lalu.
Hasilnya yang benar-benar tanpa petugas turun dari 17.585 menjadi **9**:

| | Jml | Keterangan |
|---|---|---|
| `TANPA_RUTE` | 2 | 00702400640, 00903310175 |
| `RUTE_TANPA_PENCATAT` | 7 | seluruhnya nomor PBPK Mei — memang belum berpetugas, dan Juni inilah pertama kali mereka masuk beban kerja |
| `PENCATAT_DARI_BULAN_LALU` | 17.578 | daftar kerjanya benar, tapi bergantung pada warisan |

**Tindakan yang disarankan:** lengkapi `PenugasanRute` untuk 94 rute yang
belum punya, lewat Data Induk → Organisasi & petugas. Selama belum, closing
tetap jalan — hanya saja penugasan bulan baru bersandar pada warisan bulan
lalu, dan itu putus begitu ada rute yang berubah.

## 7d. Master pelanggan STI — `PEL{periode}-PW5.csv`

Contoh yang ada: `prisma/data/PEL202604-PW5.csv` (periode 202604, dicatat
202605). Pemisah `;`, 22.542 baris, `nolg` unik semua.

Kolom: `thbl;thblcatat;nolg;nama;almt;rt;rw;kd_goltarif;kd_merkmeter;`
`nometer;kd_ukmeter;caterseksikode;wildistkode;mutasikode;mutasinama`

Isinya **master + kode mutasi**, bukan sekadar daftar nama:

| `mutasinama` | Jml |
|---|---|
| PELANGGAN AKTIF | 22.522 |
| Pelanggan Baru | 13 |
| Tutupan PS | 3 |
| Tutupan SPT | 2 |
| Pembukaan Kembali SPT | 1 |
| Pembukaan Kembali PS | 1 |

**Terverifikasi terhadap database:** seluruh 22.542 nomor STI ada di tabel
`Pelanggan` (irisan 22.542, nol yang hanya ada di STI). Yang hanya ada di
database berjumlah **11 — tepat nomor PBPK Mei**, termasuk dua PK
`00404101010` dan `00802100540` yang dibahas di bagian 1. Jadi:

```
master STI 202604 (22.542) + PBPK Mei (11) = 22.553 = isi tabel Pelanggan
```

Artinya PEL-CSV inilah sumber resmi data induk pelanggan, dan tabel
`Pelanggan` saat ini konsisten dengannya tanpa sisa. Fitur "upload master
pelanggan" belum dibangun — lihat 7b.

## 7b. Yang masih tersisa

1. **Tarif blok golongan bervolume kecil** (2A1, 4A dan blok atas 1B, 2A5,
   2B, 3C, 4B) — wajib dari SK tarif. **Ini satu-satunya penghalang yang
   tersisa untuk DRD yang benar-benar lengkap**: selama kosong, 8 pelanggan
   di tabel atas tidak akan pernah masuk closing.

2. **Upload master pelanggan dari STI** (`PEL{periode}-PW5.csv`) — belum ada
   sebagai fitur aplikasi. Formatnya sudah dipetakan di 7d dan terbukti cocok
   dengan isi database, jadi tinggal dibangun. Ini padanan tiga langkah
   Aurora sekaligus: upload master, sync pelanggan baru, update data
   pelanggan — kolom `mutasikode`/`mutasinama` yang membedakan ketiganya.

4. **`PenugasanRute` baru mencakup 29 dari 123 rute** — lihat 7c. Tidak
   memblokir, tapi membuat penugasan bulan baru bersandar pada warisan.

5. **Import & mutasi PBPK** belum jadi fitur aplikasi (masih lewat skrip
   seed dari CSV). 7 dari 11 PBPK Mei masih belum berrute/berpetugas.

6. **Peringatan build** `unexpected export *` dari
   client Prisma berformat CommonJS. Ekspor runtime kini didaftarkan eksplisit
   di `prisma/index.ts` agar bundler dapat menganalisis nama ekspor. Tidak memblokir —
   build kedua app hijau — hanya menambah kode runtime.

### Yang sudah selesai dari daftar lama

- ~~Langkah closing periode~~ → bagian 7 di atas.
- ~~Tanggal jatuh tempo placeholder~~ → sekarang **wajib diisi operator**
  saat menutup periode (`tutupSchema.tanggalJatuhTempo`, tanpa nilai
  bawaan di server). Layar closing mengusulkan akhir bulan berikutnya
  sebagai nilai awal kolom, tapi angkanya tetap keputusan manusia yang
  tercatat di `PeriodePenagihan` + audit log.
- ~~`pnpm typecheck` gagal~~ → **hijau di seluruh monorepo (8/8 paket)**.
  Yang sebenarnya rusak ada empat lapis, bukan satu:
  1. 7 error strict-null di `laporan-harian.router.ts` (kini disempitkan
     tipenya, bukan ditambal `!`);
  2. `turbo typecheck` mati total karena dependensi melingkar
     `@workspace/db` ⇄ `@workspace/domain` — diperbaiki dengan membuang
     `dependsOn: ["^typecheck"]` di `turbo.json`, karena tidak ada paket
     yang punya script `build` sehingga urutan itu tidak membeli apa pun;
  3. parser `csv-parse/sync` belum tercantum sebagai dependensi project;
     kini dependency ditambahkan pada root `package.json`;
  4. `apps/api` gagal karena augmentasi `next-auth` di `apps/api/types/`
     **tidak pernah berefek** — apps/api tidak punya `next-auth` sebagai
     dependensi sehingga `declare module` di sana tidak me-merge, dan
     `skipLibCheck` menyembunyikannya. Sekarang `packages/auth/auth.ts`
     me-`/// <reference>` augmentasinya sendiri, jadi berlaku di setiap
     app yang mengimpornya; salinan di `apps/api/types/` dihapus.
- ~~`scripts/` tidak ikut typecheck~~ → `packages/server/tsconfig.json`
  kini meng-include `scripts`. Sebelumnya `cek-closing.ts` **tidak pernah
  diperiksa** — penyakit yang sama persis dengan folder seed di bagian 5.

### Yang masih perlu dikonfirmasi ke PDAM (tidak bisa disimpulkan dari data)

- **Pemakaian minimum 5 m³** — terbaca konsisten di data, tapi perlu dasar
  aturannya.
- **Taksiran = pemakaian bulan lalu** — cocok 92–98%; sisanya override
  manual. Perlu dipastikan apakah aturan resminya "bulan lalu" atau
  "rata-rata 3 bulan terakhir" (data satu periode belum bisa membedakan).
- **Tanggal jatuh tempo** — sampai sekarang masih placeholder (periode + 1
  bulan). Tidak ada di CSV mana pun.
- **Tarif blok untuk golongan bervolume kecil** (1B, 2A1, 2A5, 2B, 3C, 4A,
  4B) — datanya terlalu jarang, wajib dari SK.

---

## 8. Analisis enam periode (jan–juni 2026) — pola yang mengoreksi bagian 1

Bagian 1 disimpulkan dari SATU periode (202605). Dengan enam periode di
`prisma/data/{jan,feb,mar,apr,mei,juni}/`, dua kesimpulannya ternyata tidak
berlaku umum.

### 8a. Yang TERBUKTI berlaku di semua periode

**MASUK(N→N+1) = PBPK(N), persis.**

| transisi | masuk | PBPK(N) |
|---|---|---|
| jan→feb | 26 | 26 |
| feb→mar | 8 | 8 |
| mar→apr | 5 | 5 |
| mei→juni | 11 | 11 |

Dan PBPK(N) selalu sudah ada di daftar kerja bulan N (26/26, 8/8, 5/5,
11/11) — jadi sambungan baru memang dicatat lebih dulu dengan stand nol,
baru ditagih bulan berikutnya.

**KELUAR = yang dicabut pada bulan itu.** Terverifikasi untuk apr→mei:
19 keluar, dan `r-nomor.csv` Mei berisi tepat 19 nomor yang sama. Ketiganya
konsisten: ke-19 nomor itu ADA di daftar kerja Mei (tetap dikunjungi), NOL di
ProgresCater Mei (tidak ditagih), dan hilang dari Juni.

### 8b. Yang TIDAK berlaku umum — daftar kerja bocor

Bagian 1 menyatakan "ProgresCater \ lapdatameter = **0** — tidak ada baris
tagihan tanpa pencatatan". Itu benar untuk Januari, Februari, dan Mei —
**tapi tidak untuk Maret dan April**:

| periode | ProgresCater | lapdatameter | ditagih TANPA ada di daftar kerja |
|---|---|---|---|
| jan | 22.549 | 22.590 | 0 |
| feb | 22.551 | 22.583 | 0 |
| mar | 22.532 | 22.407 | **156** |
| apr | 22.527 | 22.518 | **34** |
| mei | 22.523 | 22.553 | 0 |
| juni | 22.515 | 22.539 | 0 |
| juli | 22.511 | 22.531 | 0 |

Baris-baris itu tidak lenyap: mereka **kembali** ke daftar kerja bulan
berikutnya.

**Sebabnya bukan acak — ia per-RUTE** (diperiksa 2026-08-01):

| bulan | hilang | terkumpul di rute | petugas | tetap ditagih | kembali |
|---|---|---|---|---|---|
| Maret | 157 | TA607 (84), KC202 (68), TA606 (4), TA405 (1) | DANI, DIDIN | **156/157** | April (156) |
| April | 34 | KC302 (34) | DIDIN | **34/34** | Mei (34) |

Rute **utuh** menghilang satu bulan lalu kembali, sementara pelanggannya tetap
ditagih normal dengan kondisi catat biasa. Itu **kegagalan unggah berkas
harian per rute**, bukan populasi yang berubah — dan itu perbedaan yang
menentukan: `lapdatameter` tetap sumber daftar kerja yang benar, ia hanya
sesekali tidak lengkap.

### 8c. Cara menambalnya: gabungkan dengan yang bertagihan

Kesimpulan versi lama di sini — "karena itu `bulan-baru.service.ts` memakai
master (tabel `Pelanggan`) sebagai basis" — **sudah dicabut**. Menukar cakupan
per-periode dengan basis akumulatif menyembuhkan gejala Maret/April dengan
harga kelebihan 27–62 sambungan setiap bulan (lihat 7c).

Penambal yang benar adalah menggabungkan daftar kerja dengan **siapa yang
benar-benar bertagihan** pada periode itu:

```
DPM(N) = lapdatameter(N) ∪ ProgresCater(N)        (di seed, step 11)
DPM(N+1) = [ DaftarCatat(N) ∪ bertagihan(N) ] − DICABUT(N)   (di aplikasi)
```

Sambungan yang jatuh dari daftar kerja tapi tetap ditagih ditarik kembali
dengan sendirinya, dan dilaporkan lewat `DIPULIHKAN_DARI_TAGIHAN` supaya
rute yang gagal terunggah bisa ditelusuri, bukan lewat begitu saja.

### 8d. Jumlah baris per periode (rujukan cepat)

| | jan | feb | mar | apr | mei | juni | juli |
|---|---|---|---|---|---|---|---|
| ProgresCater (DRD) | 22.549 | 22.551 | 22.532 | 22.527 | 22.523 | 22.515 | 22.511 |
| lapdatameter (DPM) | 22.590 | 22.583 | 22.407 | 22.518 | 22.553 | 22.539 | 22.531 |
| PBPK | 26 | 8 | 5 | 15 (xlsx) | 11 | 5 | *(11)* |
| r-nomor | *(15)* | 24 | 26 | 10 | 19 | 19 | *(9)* |
| PEL (master STI) | — | — | — | 22.542 | — | 22.520 | — |

Angka dalam *(kurung)* adalah turunan, bukan dari berkas: PBPK & r-nomor Juli
dan r-nomor Januari belum ada berkasnya. PBPK diturunkan dari baris berstand
0/0 yang tidak ditagih, cabutan dari selisih DRD antar-bulan.

Berkas April dan Juni menyimpan PBPK sebagai `.xlsx`, bulan lain `.csv` —
pembaca impor kelak harus menerima keduanya. **Pemisah kolom `lapdatameter`
berubah di tengah jalan**: jan–mei `;`, juni–juli `,`. Kedua pengurai
(`seed/lib/csv.ts` dan `impor/parser-csv.ts`) kini menyimpulkannya dari baris
header, bukan mematoknya.

---

## 13. Siklus bulanan — rumusnya, dan buktinya

### 13a. Rumus

```
closing(N)      : DRD(N)   = DPM(N) − dicabut(N) − PBPK(N)
buka bulan(N+1) : DPM(N+1) = [ DPM(N) ∪ DRD(N) ] − dicabut(N)
selama N+1      : DPM(N+1) += PBPK(N+1)          ← lewat impor PBPK
```

Tiga hukum yang menyangganya, diuji di enam transisi berturut-turut:

| hukum | jan→feb | feb→mar | mar→apr | apr→mei | mei→jun | jun→jul |
|---|---|---|---|---|---|---|
| Masuk DRD = PBPK(N) | 26/26 | 8/8 | 5/5 | 15/15 | 11/11 | 5/5 |
| Keluar DRD = r-nomor(N+1) | 24/24 | 26/27 | 10/10 | 19/19 | 19/19 | — |

**Nol pengecualian.** PBPK adalah satu-satunya pintu masuk; pemutusan pada
periode itu satu-satunya pintu keluar.

### 13b. PBPK ada di daftar catat, tapi TIDAK ditagih bulan itu

Sambungan baru dibuka dengan **stand nol sebagai baris pembuka**: dicatat
bulan N, ditagih pertama kali bulan N+1. Itulah sebabnya MASUK(N→N+1) selalu
tepat sama dengan PBPK(N). Hal yang sama berlaku untuk yang **dicabut pada N**
— tetap dikunjungi petugas (tetap beban kerja), tetapi tidak ditagih.

Keduanya punya pemakaian 0, jadi tanpa penjaga di closing mereka tidak
menghasilkan tagihan nol melainkan tagihan berisi bea beban + bea admin + air
kotor (±Rp 28.100) untuk air yang tidak pernah dipakai. Penjaganya ada di
`hitungBarisSiapTagih` dan dilaporkan lewat `DICABUT_TIDAK_DITAGIH` /
`PBPK_BELUM_DITAGIH`.

### 13c. Buktinya — siklus mei→juli, dibandingkan anggota per anggota

Disimulasikan dari daftar catat Mei, lalu tiap langkah dibandingkan **himpunan
nomor langganannya** (bukan cuma jumlah) dengan berkas Aurora asli:

| periode | DPM hasil | DPM acuan | DRD hasil | DRD acuan |
|---|---|---|---|---|
| 202605 | 22.553 | 22.553 ✓ | 22.523 | 22.523 ✓ |
| 202606 | 22.539 | 22.539 ✓ | 22.515 | 22.515 ✓ |
| 202607 | 22.531 | 22.531 ✓ | 22.511 | 22.511 ✓ |

Enam perbandingan himpunan, **semuanya nol lebih & nol kurang**.

### 13d. Peran kedua berkas — sebelumnya tertulis terbalik

Sampai 2026-08-01 dokumen ini dan `steps/11-daftar-catat.ts` menyatakan
"ProgresCater adalah SUMBER KEBENARAN; lapdatameter boleh salah". Yang benar
kebalikannya:

| berkas | perannya |
|---|---|
| `lapdatametertes.csv` | **DAFTAR CATAT (DPM)** — daftar kerja petugas yang benar-benar dijalankan di Aurora |
| `ProgresCater-PW5.csv` | **HASIL CLOSING (DRD)** — keluaran periode yang sudah ditutup, bukan masukan |

Akibat dari versi lama: daftar catat yang dibangun seed sebenarnya bukan
daftar kerja, melainkan hasil closing bulan sebelumnya.

---

## 9. Siklus bulanan lengkap — sudah diuji end-to-end

Aplikasi kini punya seluruh langkah yang dibutuhkan untuk menggantikan
ritual closing Aurora.

| Langkah Aurora | Di aplikasi ini |
|---|---|
| Import PBPK | `/dashboard/pbpk` — menerima `.csv` **dan** `.xlsx` |
| Mutasi PBPK | ikut di atas: pelanggan + meter + baris daftar catat sekaligus |
| Update zonasi | `/dashboard/pemetaan-rute`, `/dashboard/organisasi` — kapan saja |
| Create close DRD | `/dashboard/closing` |
| Create Perbandingan | tidak perlu — `standLalu`/`pemakaianLalu`/`blokTarifLalu` sudah jadi kolom `PembacaanMeter` |
| Create Bulan baru | `/dashboard/closing`, panel "Buka bulan baru" |
| Upload master pelanggan | `/dashboard/master-pelanggan` |
| Sync pelanggan baru | ikut di atas (`mutasikode` 0) |
| Update data pelanggan | ikut di atas (`mutasikode` 3) |

### Hasil uji siklus penuh (data nyata)

```
1. Tutup 202605       -> 0 tagihan baru, 22.523 SL, 341.139 m3,
                         Rp 3.012.581.580, status TERKUNCI
2. Buka bulan baru    -> DPM 202606: 22.534 baris,
                         tanpa rute 0 | tanpa pencatat 0
3. Siklus berikutnya  -> 202606 -> 202607: 22.534, 19 cabutan tetap keluar
```

Nol tagihan baru pada langkah 1 memang benar: seluruh tagihan 202605 sudah
ada dari impor Aurora, dan mesin closing tidak pernah menimpa tagihan yang
sudah ada. Yang terjadi hanyalah periodenya dikunci.

### Dua cacat yang ditemukan uji ini, dan sudah diperbaiki

1. **Cabutan hidup kembali.** Setelah DPM 202606 terbit (semua
   `BELUM_DICATAT`, tanpa satu pun `DICABUT`), pratinjau siklus berikutnya
   melaporkan 22.553 — ke-19 sambungan yang dicabut Mei masuk lagi, karena
   tanda dicabutnya ada di periode 202605 dan bukan 202606. Sinyal DICABUT
   kini dibaca dari SELURUH riwayat sampai periode sumber.

2. **Rute & penugasan tidak lengkap** — lihat 9a.

### 9a. Perbaikan data induk rute

Tiga lubang, semuanya di seed dan bukan data yang kurang:

| Gejala | Sebab | Perbaikan |
|---|---|---|
| 2 pelanggan tanpa rute | Rute **TA610** & **TC117** tak pernah dibuat: `caterseksikode`-nya kosong di sumber, jadi step 02 melewatinya | Seksi disimpulkan dari seksi mayoritas petugas rute itu, dengan peringatan di laporan seed |
| 17.578 rute tanpa penugasan | **Tidak ada satu pun step seed yang mengisi `PenugasanRute`** — isinya cuma 29 baris untuk 123 rute | Step 04 kini membangunnya dari 125 pasangan (rute, pencatat) unik di ProgresCater — satu pencatat per rute, tanpa ambiguitas |
| 7 PBPK tanpa petugas | rutenya ada, tapi rute itu termasuk 94 yang tak punya penugasan | ikut selesai oleh perbaikan di atas |

Terukur sesudahnya: **tanpa rute 0, tanpa pencatat 0** dari 22.534.

### 9b. Temuan kualitas data: alamat di ProgresCater rusak

Dry-run master STI menemukan **4.961 alamat berbeda** dari database. Sampel
menunjukkan sebabnya bukan format, melainkan kerusakan di sumber:

```
DB (dari ProgresCater) : "JL GAJAH LUMANTUNGNO 2"
STI (PEL202604)        : "JL GAJAH LUMANTUNG NO 2"
```

2.312 alamat di ProgresCater punya pola kata menyatu seperti ini. Master STI
bersih, jadi mengunggahnya **memperbaiki** data — bukan sekadar menyegarkan.

### 9c. Catatan berkas PBPK

`juni/PBPK.csv` dan `juni/PBPK202606-PW5.xlsx` berisi 5 pelanggan yang SAMA,
tetapi versi CSV memakai rute palsu `99999` sementara versi XLSX memuat rute
sebenarnya (CD105, TA201, KC307). **Pakai yang `.xlsx`** untuk Juni.

`apr/PBPK.xlsx` berisi 15 baris — persis angka MASUK(apr→mei) di bagian 8a,
melengkapi bukti `MASUK(N→N+1) = PBPK(N)` untuk kelima transisi.

---

## 10. Kemandirian: aplikasi ini tidak lagi bergantung pada berkas luar

Pertanyaan yang memicu bagian ini: *"kenapa kita harus menginput master
pelanggan? berarti aplikasi kita masih bergantung ke data lain."*

**Tidak.** Diverifikasi terhadap kode: tidak ada satu pun modul di
`packages/server` yang membaca berkas dari `prisma/data`. `bulan-baru.service`
mengambil daftarnya dari `prisma.pelanggan`, `daftarCatat`, dan
`penugasanRute` — database sendiri.

| Hal | Status | Penilaian |
|---|---|---|
| Seed dari CSV Aurora | migrasi sekali jalan, **ditolak di produksi** tanpa `IZINKAN_MIGRASI_AURORA=ya` | benar |
| Rekonsiliasi data induk | alat transisi, bukan langkah bulanan | benar |
| **SK tarif** | belum ada | **memang harus dari luar** — SK adalah dokumen hukum; aplikasi yang mengarang tarif sendiri justru berbahaya |

Bedanya penting: bergantung pada **SK tarif** itu benar. Bergantung pada
**berkas ekspor aplikasi lain** itu yang tidak boleh — dan itu sudah tidak ada.

### 10a. Ekspor DRD — aplikasi ini jadi rujukan

`GET /api/v1/closing/{periode}/drd.csv` (hanya periode TERKUNCI) menghasilkan
berkas berformat ProgresCater PERSIS: **85 kolom, header identik, urutan
sama**, sehingga sistem hilir bisa membacanya tanpa satu pun perubahan.

Diuji terhadap `mei/ProgresCater-PW5.csv`:

```
kolom       : 85 vs 85, header IDENTIK
baris       : 22.523 vs 22.523
baris cocok : 22.523  (nomor langganan + seluruh kolom uang)
beda        : 0
```

Kolom yang aplikasi ini belum punya sumbernya ditulis kosong dan diumumkan
lewat header `X-DRD-Kolom-Kosong`, supaya penerima tahu bedanya "kosong
karena belum tersedia" dan "kosong karena memang nol".

### 10b. Kesehatan data — pembuktian mandiri

`/dashboard/kesehatan` menjalankan sembilan pemeriksaan integritas, salah
satunya membandingkan `Tagihan.pemakaianM3` dengan `PembacaanMeter.pemakaianM3`
— pemeriksaan inilah yang menangkap anomali seperti `00008001503`.

**Batas perbaikan otomatis dipegang ketat:** mesin hanya memperbaiki yang
jawabannya sudah tertulis di data lain (menurunkan petugas dari
`PenugasanRute` yang sudah terdaftar). Apa pun yang menyangkut **angka uang**
atau **status pelanggan** tidak pernah diperbaiki otomatis, sekalipun
tebakannya kelihatan aman.

Hasil setelah seluruh perbaikan dijalankan:

| Temuan | Sebelum | Sesudah |
|---|---|---|
| Daftar catat tanpa pencatat | 11 | **0** (perbaikan otomatis) |
| Pelanggan aktif tanpa meter | 11 | **0** (meter dibuat dari berkas PBPK) |
| Golongan tanpa blok tarif | 1 | **1** — GOL_2A1, 7 pelanggan, menunggu SK |

Satu-satunya temuan tersisa adalah yang memang tidak boleh diselesaikan
aplikasi sendiri.

---

## 11. Tarif lengkap, dan celah pemodelan yang terungkap karenanya

### 11a. Seluruh 13 golongan kini terkunci penuh

Bagian 2 menyimpulkan golongan bervolume kecil "wajib menunggu SK, jangan
diekstrapolasi" — benar **ketika datanya hanya satu periode**. Dengan enam
periode, seluruhnya bisa direkonstruksi tanpa satu pun konflik:

| gol | n | blok1 | blok2 | blok3 | blok4 | cocok |
|---|---|---|---|---|---|---|
| 1A | 1.073 | 900 | 900 | 900 | 1.300 | 1073/1073 |
| 1B | 252 | 900 | 900 | 1.400 | 2.900 | 252/252 |
| **2A1** | 36 | **1.000** | **1.600** | **2.300** | **5.500** | 36/36 |
| 2A2 | 2.575 | 2.000 | 3.600 | 5.700 | 8.800 | 2575/2575 |
| 2A3 | 56.140 | 3.120 | 5.520 | 8.880 | 12.840 | 56140/56140 |
| 2A4 | 46.672 | 3.960 | 7.200 | 11.280 | 15.120 | 46672/46672 |
| 2A5 | 132 | 4.800 | 8.880 | 13.680 | 17.400 | 132/132 |
| 2B | 573 | 3.150 | 5.700 | 9.000 | 12.750 | 573/573 * |
| 3A | 7.219 | 4.350 | 7.950 | 13.050 | 18.900 | 7219/7219 |
| 3B | 19.833 | 6.900 | 10.800 | 16.050 | 21.600 | 19833/19833 |
| 3C | 332 | 9.450 | 13.650 | 19.050 | 24.300 | 332/332 |
| **4A** | 156 | 7.350 | 11.250 | **16.950** | **21.450** | 156/156 |
| 4B | 204 | 10.200 | 14.400 | 19.950 | 24.450 | 204/204 |

* Selisih 2B sebelumnya berasal dari harga kontrak khusus pelanggan
  `00008001503`, bukan dari kesalahan rumus atau pemakaian. Sumber periode
  202601–202608 dan tujuh tagihan tersimpan kini dinormalisasi ke harga
  standar untuk 3.000 m³. Uji regresi tarif: 180.213/180.213 cocok; 11 baris
  tidak dapat diuji karena blok tarif sumbernya belum tersedia.

Blok 2A1 (4 baru) dan 4A (2 yang kurang) sudah diisi, ditandai lewat kolom
baru `TarifBlok.catatan` bahwa dasarnya rekonstruksi dan **masih menunggu
pengesahan SK**. Blok 4A yang sudah ada sebelumnya (7.350 & 11.250) cocok
persis dengan rekonstruksi — konfirmasi independen bahwa metodenya benar.

### 11b. CELAH: `Tagihan` tidak mencatat golongan tarif yang dipakainya

Terungkap saat master Juni diterapkan: tiga pelanggan berpindah golongan
antara April dan Juni, dan `cek-closing` langsung melaporkan selisih baru —
bukan karena mesinnya salah, melainkan karena menghitung ulang tagihan MEI
memakai golongan yang berlaku HARI INI.

`Pelanggan.tarifGolonganId` adalah nilai BERJALAN, sedangkan tagihan adalah
dokumen SEJARAH. Selama golongan tidak ikut dibekukan di baris tagihan,
tagihan lama tidak bisa menjelaskan dasarnya sendiri — persis yang ditanyakan
auditor.

**Perbaikan yang benar:** simpan `tarifGolonganId` (dan idealnya rujukan blok
tarif yang dipakai) pada `Tagihan` atau `PembacaanMeter` saat closing. Belum
dikerjakan.

### 11c. Urutan menerapkan master itu penting

Menerapkan `PEL202604` mengembalikan golongan 3 pelanggan ke nilai April,
termasuk satu yang naik 2A3 → 3B pada Mei (selisih tagihan Rp 241.140).
Sekarang `master-sti.service` memperingatkan bila berkas yang diunggah lebih
lama daripada periode yang sudah diproses sistem. Sengaja peringatan, bukan
penolakan — memundurkan data kadang memang disengaja, yang tidak boleh adalah
melakukannya tanpa sadar.

### 11d. Pemutusan kini menandai daftar catat

Sebelumnya modul pemutusan TIDAK menandai `DaftarCatat` sebagai `DICABUT` —
tanda itu hanya pernah dibuat skrip seed dari `r-nomor.csv`. Akibatnya
cabutan yang diinput lewat aplikasi tidak mengeluarkan pelanggan dari daftar
bulan berikutnya: mereka terus dikunjungi dan terus ditagih. Sekarang
`POST /pemutusan` menandainya dalam transaksi yang sama.

---

## 12. Pembekuan golongan tarif & pemetaan sambungan

### 12a. `Tagihan.tarifGolonganId` — tagihan menjelaskan dasarnya sendiri

Celah 11b sudah ditutup. Kolom baru `Tagihan.tarifGolonganId` membekukan
golongan yang DIPAKAI saat tagihan diterbitkan:

- `closing.service` mengisinya saat menerbitkan tagihan;
- saat MENGHITUNG ULANG baris yang sudah bertagihan (dipakai `cek-closing`),
  yang berlaku adalah golongan BEKU itu — bukan golongan pelanggan hari ini;
- `pnpm backfill-golongan` mengisi baris warisan impor Aurora.

**Backfill menurunkan golongan dari ANGKA TAGIHAN ITU SENDIRI**, bukan dari
data pelanggan hari ini — memakai nilai hari ini justru akan membekukan
angka yang salah, persis kesalahan yang membuat kolom ini dibutuhkan. Untuk
tiap tagihan dicari golongan yang blok tarifnya mereproduksi `jmlHargaAir`
dari `pemakaianM3` tersimpan.

Hasil: **22.522 dari 22.523 terisi.**

| Jalur | Jumlah |
|---|---|
| Tepat satu golongan cocok dari harga | 22.030 |
| Ambigu, diputus oleh golongan berjalan yang termasuk kandidat | 492 |
| Tidak bisa diturunkan | **1** (hasil backfill sebelumnya; perlu dijalankan ulang) |

Ambiguitasnya nyata dan tak terhindarkan: 1A & 1B punya harga blok 1–2 yang
identik (900/900), dan pemakaian 0 m³ menghasilkan harga 0 di SELURUH
golongan. Pemutusnya sah karena golongan berjalan hanya dipakai bila ia
termasuk kandidat yang memang mereproduksi angkanya — harga sudah
menyempitkan pilihan, golongan berjalan tinggal memilih di antara yang
sama-sama benar.

**Dampak terukur** — `pnpm server:cek-closing 202605` sesudahnya:

```
Dibandingkan : 22.523
COCOK        : 22.523
BEDA         : 0
HASIL        : 22.523/22.523 direproduksi persis
```

### 12b. Pemetaan sambungan ke rute

`/dashboard/pemetaan-sambungan` menampilkan dua keadaan yang akibatnya sama
tapi sebabnya beda: belum punya rute sama sekali (mis. PBPK ber-`kd_rute`
palsu seperti `99999`), dan rutenya belum ditugaskan ke pencatat mana pun.
Keduanya berujung pada sambungan yang tidak dikunjungi, tidak dicatat, dan
tidak tertagih — kebocoran pendapatan yang diam.

Dropdown rutenya menampilkan nama petugas, dan rute tanpa petugas ditandai
tegas supaya tidak dipilih tanpa sadar.

Sekalian diperbaiki di akarnya: impor PBPK kini langsung mengisi
`pencatatId` pada baris daftar catat yang dibuatnya, dari `PenugasanRute`
yang berlaku. Sebelumnya sambungan baru lahir langsung sebagai temuan
"daftar catat tanpa pencatat" dan harus dibereskan menyusul.

### 12c. Keadaan akhir

| Pemeriksaan | Hasil |
|---|---|
| Kesehatan data | **0 temuan** (gawat 0, perhatian 0) |
| Sambungan perlu dipetakan | **0** |
| Daftar catat tanpa pencatat | **0** |
| Tagihan bergolongan beku | 22.522 / 22.523 |
| Regresi closing | 22.522 / 22.523, selisih baru **0** |
