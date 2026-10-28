# Prisma Schema — tirtacater / mytirta

> **Baca dulu: [`PEMETAAN-DATA.md`](./PEMETAAN-DATA.md)** — hubungan antar
> keempat CSV sumber, rekonstruksi tarif (22.523/22.523 tagihan terbukti bisa
> dihitung ulang), aturan `pakai_drd` vs selisih stand, dan apa yang masih
> kurang sebelum data ini boleh dipakai sebagai dasar tagihan resmi.

Schema ini dipecah per-domain (multi-file Prisma schema, GA sejak Prisma ORM ≥6.7,
dipakai di sini dengan **Prisma v7**). `schema/schema.prisma` berisi
`generator` + `datasource` — wajib ada di folder schema saat multi-file dipakai.

## Peta file → domain

Skema dikonsolidasikan (2026-07-14) dari 17 file per-model menjadi 6 file
per-domain besar, agar selaras dengan arsitektur aplikasi (Auth, Pelanggan,
Tagihan, Operasional, Organisasi) alih-alih 1 file per tabel.

| File | Isi |
|---|---|
| `schema/schema.prisma` | generator + datasource; entry point multi-file schema |
| `schema/auth.prisma` | Role, UserStatus, User + boilerplate Auth.js (Account, Session, VerificationToken, TwoFactor) |
| `schema/organisasi.prisma` | KodeDivisi, Divisi → Bagian → SubBagian, Pencatat, TargetKinerja |
| `schema/pelanggan.prisma` | Hierarki wilayah, golongan/tarif, pelanggan dan langganan warga |
| `schema/tagihan.prisma` | Meter, pembacaan, tagihan dan ledger pembayaran |
| `schema/operasional.prisma` | Pengaduan, laporan petugas, mutasi, pemutusan, audit dan konfigurasi |
| `schema/introspected.prisma` | `spatial_ref_sys`, tabel sistem PostGIS |
| `migrations/` | Migrasi SQL berurutan yang diterapkan ke database |
| `seed/` | Skrip import, helper ETL dan laporan verifikasi |
| `data/` | Berkas CSV/GeoJSON mentah; arsip sumber, jangan diedit |
| `docs/` | Pemetaan sumber data, panduan schema, dan prosedur seed |

Perubahan struktural terhadap versi sebelumnya (lihat masing-masing file
untuk detail & alasan):

- `User.password` → `username` + `passwordHash`, menyamakan skema dengan
  yang sudah dipakai `auth.ts` (provider Credentials query by `username`,
  cek `passwordHash`) — sebelumnya field ini tidak ada di skema meski
  sudah dipakai di kode.
- `StatusPelanggan` menambah `DISEGEL` (meter disegel karena
  tunggakan/pelanggaran, sambungan fisik masih ada).
- Kolom spasial `Unsupported("geometry")` generik dipertegas jadi
  `geometry(Point, 4326)` (titik: koordinat pelanggan, verifikasi
  pemutusan, mutasi, potensi pelanggan, pengaduan) atau
  `geometry(MultiPolygon, 4326)` (batas wilayah) — lihat panduan
  penggunaan tipe spasial di bagian bawah dokumen ini.
- Model baru: `Pengaduan` (aduan masyarakat umum, termasuk keluhan
  kebocoran via `jenis = KEBOCORAN`), `TagihanLain` (pungutan non-air
  insidental: pasang baru, balik nama, ganti meter, denda, dst.),
  `RiwayatPembayaran` (ledger pembayaran multi-percobaan, mendukung
  kanal PPOB/virtual account/QRIS, terhubung ke `Tagihan` **atau**
  `TagihanLain`).
- Seluruh model domain sekarang punya `@@map(...)` snake_case eksplisit
  (menyamakan pola yang sebelumnya hanya dipakai tabel Auth.js), supaya
  nama tabel di Postgres tidak bergantung pada identifier ter-quote
  case-sensitive.

Perubahan lanjutan (2026-07-15) — hasil audit CSV mentah baris-per-baris
sebelum migrasi, dua kategori:

**(a) Relasi accurate & join-able, bukan cuma field:**
- `LaporanHarianPetugas` sebelumnya cuma punya `nomorLangganan String`
  (bukan relasi Prisma) → frontend tidak bisa `include: { pelanggan }`
  sama sekali, dan baris orphan (pelanggan belum ter-import) kehilangan
  nama/alamat tanpa jejak. Sekarang ditambah `pelangganId String?` +
  relasi opsional ke `Pelanggan` (bisa di-join begitu resolved) **dan**
  `namaPelanggan`/`alamatPelanggan` (snapshot mentah, fallback kalau
  orphan) — pola yang sama persis dengan `Pemutusan` yang sudah lebih
  dulu benar.
- `Pemutusan` menambah `namaPelanggan String?` (sebelumnya cuma
  `nomorLangganan`, kehilangan nama untuk baris orphan dari r-nomor.csv).
- Prinsipnya: field relasi (`pelangganId` + `@relation`) untuk yang BISA
  di-join, field snapshot teks mentah untuk yang TIDAK BOLEH hilang saat
  baris orphan — dua-duanya perlu ada bersamaan, bukan pilih salah satu.

**(b) Field/model baru dari kolom CSV yang belum termodelkan:**
- `Meter.umurHari` — pelengkap `umurTahun`/`umurBulan` yang sudah ada
  (sumber: `umurmeterhari`, ProgresCater, terisi 100% baris).
- `Pelanggan.statusPasokanAir` (enum `StatusPasokanAir`: PENUH/BERGILIR)
  + `jamGilirMulai`/`jamGilirSelesai` (`@db.Time`) + `polaGilir` (String
  bebas, ruang nilai belum diketahui penuh) — jadwal giliran air per
  sambungan (sumber: `durasi`/`jamgilirstart`/`jamgilirend`/`waktugilir`,
  ProgresCater, terisi 46% baris — bukan data langka).
- `GolonganBesar` (tabel referensi, bukan enum — daftar instansi terbuka)
  + `Pelanggan.golonganBesarId` + `Pelanggan.objekBayar` (enum tertutup:
  SIPIL/AUTODEBET/HANKAM) — klasifikasi pelanggan institusi/korporat
  besar (sumber: `gbid`/`gbnama`/`obid`/`obnama`, ProgresCater, ~0.7%
  pelanggan). `isovb` di sumber data TIDAK disimpan terpisah karena
  sepenuhnya derivable dari `golonganBesarId != null`.
- `Dma` (District Metered Area, untuk NRW) + `Pelanggan.dmaId` — sumber:
  `dmakode` (ProgresCater), **sangat jarang terisi saat ini** (~8 dari
  22.523 baris punya nilai riil) — model disiapkan untuk masa depan,
  bukan karena datanya sudah kaya sekarang.

Perbaikan skema lanjutan (2026-07-15, ditemukan saat menulis seed script):

- **`Meter.pelangganId` diubah dari `@unique` menjadi relasi 1:banyak**
  (`Pelanggan.meter` sekarang `Meter[]`, bukan `Meter?`). Versi lama
  bertentangan dengan niatnya sendiri: komentar model bilang "meter lama
  disimpan sebagai histori (isAktif=false)", tapi `@unique` cuma
  mengizinkan SATU baris Meter per pelanggan SELAMANYA — penggantian
  meter akan menimpa baris lama, bukan menyimpannya. "satu meter aktif
  per pelanggan" sekarang ditegakkan di seed script (lihat
  `steps/06-meter-pembacaan-tagihan.ts`), bukan di constraint database —
  Prisma tidak punya sintaks partial unique index (`WHERE isAktif=true`).
  Kalau butuh ditegakkan di level DB juga, perlu ditambahkan manual lewat
  raw SQL di file migrasi.
- **`Tagihan.status` pada baris baru diturunkan dari `jmlreknunggak`**
  (jumlah rekening menunggak — data ASLI, bukan placeholder): kalau > 0,
  `JATUH_TEMPO`; kalau tidak, `BELUM_BAYAR`. `tanggalJatuhTempo` sendiri
  TETAP placeholder (periode + 1 bulan, TIDAK ADA sumber data due-date
  asli di CSV manapun) — wajib dikonfirmasi ke aturan bisnis PDAM
  sebenarnya sebelum dipakai untuk pengingat jatuh tempo produksi. Kedua
  field TIDAK PERNAH disentuh saat re-import (upsert) supaya status yang
  sudah diproses manual lewat aplikasi (dibayar/dihapuskan) tidak
  tertimpa balik.

Perubahan lanjutan (2026-07-16) — verifikasi berjenjang laporan lapangan:

- **`LaporanHarianPetugas` mendapat kolom ring V1→V2→V3**
  (`verif1At/ById`, `verif2At/ById`, `verif3At/ById`), `standAkhirRevisi`
  (koreksi V1 — TIDAK menimpa `standAkhir` catat), serta
  `meterVerifId`/`blokTarifVerif` (pilihan V1, dipakai V3 saat membuat
  PembacaanMeter resmi). Spesifikasi alur:
  `features/dashboard/components/verifikasi/tabel.md`; penegakan urutan
  ring ada di `server/modules/laporan/laporan-harian.router.ts`.
  Kolom legacy `isVerified`/`verifiedAt`/`verifiedById` TIDAK dihapus dan
  tetap diisi (V3 = final, reject = tolak) supaya baris hasil sistem lama
  dan filter `statusVerif` bekerja tanpa backfill. Migrasi
  `20260716110747_verifikasi_berjenjang_v1v2v3` sudah diterapkan.
- **`LaporanHarianPetugas` juga mendapat tiga kolom foto bukti**
  (`fotoStandUrl`/`fotoSegelUrl`/`fotoRumahUrl` — stand meter, segel,
  rumah/persil, semuanya nullable karena data sistem lama tidak berfoto).
  Diisi aplikasi petugas via `POST /laporan-harian`; panel verifikasi
  menampilkannya sebagai tab, dan `fotoStandUrl` disalin ke
  `PembacaanMeter.fotoBukti` saat V3 approve. Migrasi
  `20260716113551_foto_bukti_laporan_harian` sudah diterapkan.

## Filosofi ETL: skrip mengikuti struktur data mentah, BUKAN edit file mentah

CSV/geojson di `prisma/data/` adalah **arsip sumber, immutable** — jangan
pernah diedit manual (Excel, cari-ganti, dll). Semua normalisasi (zero-pad
nolg, trim whitespace, parse Excel serial date, mapping kode→enum) terjadi
di **kode skrip seed/import**, bukan di file CSV-nya. Alasan:

1. **Audit trail** — kalau file mentah diedit, tidak ada lagi cara
   membuktikan "data asli dari sistem lama itu apa" saat ada sengketa
   angka (mis. kenapa nolg pelanggan X berubah).
2. **Reproducible** — export bulan depan (`ProgresCater-PW6.csv`, dst.)
   akan punya masalah format YANG SAMA (nolg PBPK 9 digit, tanggal
   campur format, dst.) — kalau aturan normalisasi ada di kode, bulan
   depan tinggal jalan lagi; kalau ada di hasil edit manual, harus
   diulang manual selamanya.
3. **Testable** — fungsi seperti `normalizeNolg()`/`parseExcelSerial()`/
   `mapKondisiCatat()` bisa ditulis unit test dan divalidasi terhadap
   kasus edge yang sudah ketemu (tab prefix di `No Pel`, 9 vs 11 digit,
   format tanggal campur DD/MM/YY vs M/D/YYYY) — edit manual di spreadsheet
   untuk 22 ribu baris tidak bisa diverifikasi sama sekali.
4. Baris yang **benar-benar rusak** (bukan cuma beda format, tapi datanya
   tidak masuk akal) sebaiknya di-skip + dicatat di log import (baris
   mana, kenapa ditolak) — bukan ditebak-tebak lewat edit manual.

Temuan konkret yang WAJIB ditangani di kode skrip (bukan di file), lihat
detail di bagian "Temuan kritis" di atas — ringkasnya: `nolg`/
`nomor_pelanggan` di PBPK & r-nomor 9 digit tanpa padding (harus
`.padStart(11, "0")` sebelum insert/lookup ke `Pelanggan.nomorLangganan`
yang `Char(11)`), `No Pel` di lapdatameter punya tab literal di depan
(wajib `.trim()`), `tglaktif` PBPK adalah Excel serial date, tanggal di
r-nomor campur format.

## Sumber data lapangan

- `lapdatametertes.csv` (22.553 baris — **daftar catat / DPM**: daftar kerja
  petugas periode itu. Inilah acuan populasi, bukan ProgresCater)
- `ProgresCater-PW5.csv` (22.523 baris — **hasil closing / DRD**: keluaran
  periode yang sudah ditutup, bukan masukan)
- `PBPK202605-PW5.csv` (11 baris — pasang baru & ubah kontrak)
- `r-nomor.csv` (19 baris — riwayat pemutusan TSM/SPT)
- `Area_layanan_Wilayah_5.geojson` (32 baris — batas Kelurahan/Kecamatan PW5)
- `Data_progres_verifikasi_pelanggan_PW_5_2026.geojson` (1.875 baris — hasil survei lapangan mWater)

## Temuan kritis — analisis relasi antar CSV

- 30 orphan `lapdatameter` = 19 DICABUT + 11 PBPK baru → **NORMAL**
- 681 `nomorMeter` duplikat → ditangani via `Meter.isAktif` (histori tetap ada)
- 116 `nprs` duplikat (satu lokasi, beda pelanggan) → karena itu **bukan** `@unique`
- 19 `r-nomor` tidak ada di `ProgresCater` → dicabut sebelum closing → **NORMAL**
- `kd_petugas` di CSV adalah nama panggilan ("IWAN", "DADANG", "-") → model `Pencatat`
  dipakai sebagai jembatan ke `User`

## Temuan kritis — analisis geojson survei (PW5 2026)

- 3 dari 32 Kelurahan punya geometri `MultiPolygon` sungguhan (PASIR KALIKI, TURANGGA,
  KARASAK punya 2–4 bagian terpisah) → kolom `area` **wajib** `MultiPolygon`, bukan
  `Polygon`, atau insert akan gagal/data hilang.
- 219 titik "Eks Pelanggan" di survei adalah histori cabut lama (rentang 1994–2025);
  banyak `nolg`-nya **tidak ada** di tabel `Pelanggan` (di luar jendela data CSV utama)
  → `Pemutusan.pelangganId` dibuat optional, pola sama seperti
  `LaporanHarianPetugas.nomorLangganan`.
- Field "Nomor Eks Pelanggan" sering berisi >1 nomor / catatan dalam kurung / nama
  enumerator (bukan nomor) → diparse defensif, teks asli tetap disimpan untuk audit
  (`Pemutusan.catatanSurveiAsli`).

## Seed geometri PostGIS (step `10-geometri`, 2026-07-19)

Sebelum step ini SEMUA kolom geometri kosong (0/21 kelurahan ber-`area`,
0/22.534 pelanggan ber-`koordinat`) — fitur spasial (auto-tag wilayah
pengaduan, `/pelanggan/near`, peta) tidak punya data. `steps/10-geometri.ts`
mengisinya, idempoten, dari dua sumber di `prisma/data/`:

- **`Area_layanan_Wilayah_5.geojson`** → `Kelurahan.area` (32 MultiPolygon;
  dicocokkan lewat **NAMA**, bukan kode — `KODE_DESA` file adalah kode
  Kemendagri 3273xxxx, sedangkan `Kelurahan.kode` DB adalah kode internal
  PDAM "KD3" dst; tidak ada peta silang). `Kecamatan.area` DITURUNKAN via
  `ST_Multi(ST_Union(...))` dari kelurahan anggotanya. Semua geometri lewat
  `ST_MakeValid` (polygon digitasi kerap self-intersect kecil yang membuat
  `ST_Contains` diam-diam salah). Hasil terukur: 21/21 kelurahan + 7/7
  kecamatan terisi, 0 invalid.
- **`Data_progres_verifikasi_pelanggan_PW_5_2026.geojson`** → titik
  pelanggan master melalui "Nomor Pelanggan" (zero-pad 11 digit, titik di
  luar kotak Bandung ±(-8..-6, 106..109) ditolak); "Non Pelanggan" menjadi
  `PotensiPelanggan` dan "Eks Pelanggan" menjadi arsip `Pemutusan` dengan
  `sumberData = SURVEI_GEOJSON`. Semua baris memakai `Response Code` unik
  sebagai kunci upsert sehingga seed dapat diulang tanpa menggandakan titik.
  Baris dibuat dan geometri diperbarui per-batch; perubahan status prospek
  yang dilakukan pengguna tidak ditimpa saat seed dijalankan ulang.
  `Nomor Eks Pelanggan` hanya dipautkan ke master jika tepat satu nomor
  dapat diparsing; teks mentah tetap disimpan untuk kasus ambigu. Kategori,
  catatan, wilayah, tanggal pencabutan yang benar-benar tersedia, serta
  koordinat dipertahankan. Jika tanggal pencabutan kosong, periode laporan
  memakai tanggal survei; jika keduanya tidak tersedia, periode laporan
  fallback ke Mei 2026 dan `tanggalCabut` tetap kosong (dicatat sebagai
  warning, bukan dianggap tanggal pencabutan).
  Nomor pelanggan yang tidak ada di master serta satu nomor yang muncul di
  dua lokasi berbeda dilaporkan dan tidak dipasangkan/ditimpa secara
  arbitrer. Hasil inspeksi berkas saat ini: 1.875 titik (928 pelanggan,
  728 non-pelanggan, 219 eks-pelanggan); dari 924 baris berstatus pelanggan
  yang memiliki nomor, 921 cocok dengan master, 3 tidak, dan satu nomor
  survei muncul pada dua titik berbeda. Kolom `goe_lat/goe_long` PBPK
  terbukti kosong total di data sumber. Seed terarah terakhir mengimpor 728
  prospek dan 219 eks-pelanggan, serta mengisi 920 titik pelanggan master
  yang tidak ambigu. Dari catatan eks-pelanggan, 202 nomor hasil parsing
  tidak ada di master dan 5 catatan ambigu; nilai asli tetap disimpan tanpa
  dipasangkan secara paksa. Anomali baris lain tetap tercatat pada laporan
  seed JSON.
- Peta wilayah menampilkan semua pengaduan yang berkoordinat (termasuk
  tiket selesai/non-kebocoran), titik prospek dan eks-pelanggan survei.
  Popup kelurahan/kecamatan merangkum status pelanggan, riwayat pemutusan,
  total pengaduan, pengaduan aktif, dan laporan kebocoran.
- Wilayah operasional PDAM (WilayahAdm/Dist/SeksiCater/WilayahSeksi/Zona/
  Rute) **sengaja tetap kosong** — belum ada sumber polygon-nya; jangan
  dikarang. Saat file batasnya tersedia, tambahkan pencocokannya di step
  yang sama.

## Catatan perbaikan saat modularisasi

- Banner section di atas model `TargetKinerja` pada `schema.prisma` lama tertulis
  salah copy-paste ("PEMUTUSAN LAYANAN — r-nomor"). Sudah diperbaiki jadi
  "TARGET KINERJA" di `kinerja.prisma` (sekarang `organisasi.prisma`). Tidak ada
  perubahan pada field, tipe, relasi, atau index — murni perbaikan komentar.

## Alur pengaduan (migrasi `20260717000000_alur_pengaduan_enterprise`)

Keputusan pemodelan yang tidak terbaca dari schema-nya sendiri:

- **`Pengaduan.nomorTiket` tidak lagi punya `@default(cuid())`** — dibangkitkan
  aplikasi berformat `TW-YYMM-XXXXXX` (`server/modules/pengaduan/tiket.ts`).
  6 karakter terakhir **acak, bukan urut**, dan itu load-bearing: endpoint
  pelacakan publik sengaja tanpa verifikasi identitas, jadi hanya
  ketidakbisatebakan nomor ini yang menjaga tiket warga lain. Membuatnya
  berurutan tanpa memasang faktor kedua lebih dulu = membuka enumerasi massal.
  Efek samping bagusnya: nomor acak tidak butuh penghitung, jadi tidak ada
  balapan antar aduan yang masuk bersamaan (bentrok ditangani lewat retry).
  Baris lama bernomor cuid tetap valid & bisa dilacak — pencocokannya exact
  match, tidak perlu backfill.
- **`RiwayatPengaduan` terpisah dari `AuditLog`** walau sekilas mirip.
  AuditLog = forensik internal lintas entitas (untuk auditor).
  RiwayatPengaduan = linimasa operasional satu tiket yang **sebagian barisnya
  sengaja dibaca warga** (`isPublik`). Menyatukannya akan memaksa AuditLog ikut
  memikirkan mana yang aman dibuka ke publik.
- **`RiwayatPengaduan.isPublik` default `false`** — catatan koordinasi antar
  petugas tidak boleh bocor karena seseorang lupa menyetel flag. Yang publik
  harus dinyatakan sadar.
- **`olehNama` di-snapshot** (bukan hanya `olehId`) — pola sama seperti
  `LaporanHarianPetugas.namaPelanggan`. User bisa dihapus (`onDelete: SetNull`)
  atau berganti nama; linimasa tiket lama tidak boleh ikut berubah. Aksi dari
  pelapor publik (yang tidak punya akun) memakai `olehId = null` + label.
- **Target SLA disimpan di baris tiket, bukan dihitung saat dibaca** — supaya
  mengubah matriks SLA (`server/modules/pengaduan/sla.ts`) tidak diam-diam
  menulis ulang sejarah: tiket lama harus tetap dinilai dengan janji yang
  berlaku saat ia dibuat.
- **`jedaMulaiAt` / `jedaTotalMenit`** membekukan jam SLA selama status
  `MENUNGGU_PELANGGAN`. Tanpanya, tiket yang tertahan menunggu jawaban warga
  tercatat melanggar SLA padahal bolanya bukan di kita.
- **`SELESAI` vs `DITUTUP` dibedakan sengaja**: SELESAI = klaim petugas,
  DITUTUP = konfirmasi pelapor. Tanpa pemisahan itu, tiket yang "beres"
  menurut petugas tapi tidak menurut warga tidak punya tempat untuk pulang —
  dan `DIBUKA_KEMBALI` jadi mustahil.
- **`ratingKepuasan` tidak punya CHECK 1-5 di DB** (Prisma tidak memodelkan
  CHECK constraint) — divalidasi di `server/modules/publik/publik.router.ts`.
- Enum `StatusPengaduan` **menambah** `MENUNGGU_PELANGGAN`, `DITUTUP`,
  `DIBUKA_KEMBALI`; lima nilai lama dipertahankan persis supaya baris yang
  sudah ada tidak perlu di-backfill. Urutan transisi yang sah **tidak** ada di
  enum — ia hidup di matriks `TRANSISI` (`server/modules/pengaduan/alur.ts`).

## Panduan tipe spasial PostGIS (`Unsupported("geometry(...)")`)

Prisma tidak punya tipe geometri native — kolom PostGIS dideklarasikan sebagai
`Unsupported("geometry(Tipe, SRID)")` di `.prisma`, dan **tidak muncul sebagai
properti biasa di Prisma Client**. Konsekuensinya:

1. **Query builder Prisma (`findMany`, `create`, dst.) tidak bisa membaca/menulis
   kolom ini sama sekali.** Semua akses ke kolom spasial wajib lewat raw SQL:
   `prisma.$queryRaw` (baca) atau `prisma.$executeRaw` (tulis), menggunakan
   fungsi PostGIS (`ST_SetSRID`, `ST_MakePoint`, `ST_AsGeoJSON`, `ST_DWithin`,
   `ST_Contains`, dst).
2. Gunakan `Prisma.sql`/tagged template (bukan concatenation string) untuk
   mencegah SQL injection — koordinat dari user input harus lewat parameter
   binding, bukan interpolasi langsung.
3. Konversi ke/dari GeoJSON di boundary API (Hono handler) dengan
   `ST_AsGeoJSON(kolom)::json` saat SELECT, dan `ST_GeomFromGeoJSON($1)` saat
   INSERT/UPDATE — supaya payload yang dipertukarkan dengan frontend
   (Leaflet/MapLibre di dashboard) selalu GeoJSON standar, bukan format WKB
   internal Postgres.

Contoh pola pemakaian di route Hono (`app/api/[[...route]]/route.ts` atau
modul yang di-mount di sana):

```ts
import { Prisma, prisma } from "@/lib/prisma" // singleton PrismaClient + adapter-pg

// Tulis titik koordinat pelanggan baru (Pelanggan.koordinat: geometry(Point, 4326))
await prisma.$executeRaw`
  UPDATE pelanggan
  SET koordinat = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
  WHERE id = ${pelangganId}
`

// Baca sebagai GeoJSON untuk ditampilkan di peta dashboard
const rows = await prisma.$queryRaw<{ id: string; geojson: unknown }[]>`
  SELECT id, ST_AsGeoJSON(koordinat)::json AS geojson
  FROM pelanggan
  WHERE "seksiCaterId" = ${seksiCaterId} AND "deletedAt" IS NULL
`

// Cari pelanggan dalam radius X meter dari titik pengaduan kebocoran
// (pakai geography cast supaya jarak dihitung dalam meter, bukan derajat)
const terdekat = await prisma.$queryRaw<{ id: string; jarakMeter: number }[]>`
  SELECT id, ST_Distance(koordinat::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS "jarakMeter"
  FROM pelanggan
  WHERE ST_DWithin(koordinat::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 300)
  ORDER BY "jarakMeter"
`
```

Field non-spasial (semua kolom lain) tetap bisa dipakai lewat query builder
Prisma seperti biasa (`prisma.pelanggan.findMany({ where: { ... } })`) —
hanya kolom `Unsupported("geometry...")` yang butuh raw SQL.
