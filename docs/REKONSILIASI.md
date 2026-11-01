# Rekonsiliasi data ProgresCater untuk baca meter

**Status:** analisis satu sampel; bukan pengesahan aturan tarif/pemakaian
**Sumber:** [`ProgresCater-PW5.csv`](../../prisma/data/jan/ProgresCater-PW5.csv)
**Periode sampel:** `202601`
**Tanggal analisis:** 31 Oktober 2026 (angka tidak dihitung ulang pada rekonsiliasi dokumentasi 1 November 2026)
**Versi:** 0.2 (catatan `REV.PENCATAT` dan tautan Indeks ditambahkan 1 November 2026; sebelumnya tanpa nomor versi)

**Peran dokumen:** sumber kebenaran untuk analisis data sampel `202601`. Makna kode: [codebook](./CODEBOOK.md); keputusan (DEC) dan isu terbuka (OPEN): [Indeks](./INDEKS.md#register-open).

## Ringkasan terukur

CSV berisi 22.549 record terparse dan 85 kolom. Semua record berada pada periode `202601`.

| Ukuran | Hasil | Implikasi |
|---|---:|---|
| `nolg` unik | 22.549 | Identitas sambungan tampak unik dalam sampel ini; tetap validasi constraint terhadap semua periode/data sumber. |
| `nometer` unik | 22.078 | Ada 471 kemunculan duplikat tambahan. Nomor meter tidak aman dijadikan unique key; kemungkinan nomor dipakai ulang, placeholder, atau kesalahan input perlu dipilah. |
| `pakai_drd` tidak sama dengan `stma - stml` | 9.946 (44,1%) | Delta stand bukan formula yang dapat menggantikan pemakaian tagihan. |
| Delta stand negatif | 16 | Perlu pemetaan ke meter diganti/rollover/koreksi atau review; jangan otomatis menagih nol. |
| Delta stand nol, `pakai_drd` positif | 8.118 | Perbedaan pemakaian harus dipertahankan dengan alasan/sumber aturan, bukan dinormalisasi. |
| `kategorialnama = OFFSITE` | 18.777 (83,3%) | Kategori sumber/kunjungan perlu disimpan berbeda dari kondisi alat. |
| `kategorialnama = ONSITE` | 3.772 (16,7%) | Sama-sama rekam historis; bukan bukti bahwa nilai stand semuanya telah melalui workflow aplikasi baru. |

Penjumlahan sederhana `jmlhargaair + beabeban + beaadmin + airkotor + lainlain` sama dengan `tjtg` untuk seluruh 22.549 baris. Ini pemeriksaan konsistensi aritmetika sampel, bukan bukti bahwa tarif, komponen, atau kebijakan hukumnya sudah benar.

## Pemetaan label catat

Kolom `kondisimeternama` dan `kondisimeterkode` kosong di seluruh sampel. Nilai kondisi/kunjungan yang terlihat justru berada di `ketcatat`:

| `ketcatat` mentah | Jumlah | Kode enum yang sudah ada | Batas interpretasi |
|---|---:|---|---|
| `Normal` | 14.129 | `NORMAL` | Label kondisi; pemakaian tetap ikut data sumber/aturan yang disahkan. |
| `TIDAK DIPAKAI` | 2.718 | `TIDAK_DIPAKAI` | Jangan otomatis mengubah stand atau menghapus bea tetap. |
| `RUMAH KOSONG` | 1.284 | `RUMAH_KOSONG` | Tidak selalu berarti pemakaian nol. |
| `STAND TEMPEL` | 1.249 | `STAND_TEMPEL` | Perlu codebook untuk membedakan sumber angka dan bukti. |
| `STAND-KONSUMEN` | 554 | `STAND_KONSUMEN` | Perlu dipertahankan sebagai input offsite, bukan disamakan dengan kunjungan petugas. |
| `REV.PENCATAT` | 490 | `REV_PENCATAT` | Pada sampel, `ketcatat` berisi label ini sementara `kondisimeternama`/`kondisimeterkode` kosong, sehingga kondisi asli baris tersebut tidak tersedia. Pemilik produk (31 Oktober) mengklarifikasi bahwa pada alur baru ini adalah penanda workflow revisi ST Awal, bukan kondisi meter (lihat codebook). Cara mengimpor 490 baris legacy tanpa kehilangan kondisi asli: OPEN-18. |
| `DK` | 408 | `DK` | Akronim belum didefinisikan; simpan label mentah. |
| `TIDAK ADA AIR` | 339 | `TIDAK_ADA_AIR` | Tidak otomatis berarti stand/pemakaian 0. |
| `MATI ADA AIR` | 314 | `METER_MATI_ADA_AIR` | Perlu aturan taksiran dan bukti yang disahkan. |
| `MTA` | 273 | `MTA` | Akronim belum didefinisikan; jangan menurunkan tagihan dari kode saja. |
| `TTB` | 261 | `TTB` | Akronim belum didefinisikan. |
| `BMK/BMB` | 227 | `BMK_BMB` | Akronim/kelompok belum didefinisikan. |
| `TERHALANG` | 151 | `TERHALANG` | Bedakan dari rumah terkunci dan meter tidak terbaca. |
| `METER RUSAK` | 102 | `METER_RUSAK` | Perlu aturan taksiran/approval. |
| `DICABUT` | 27 | `DICABUT` | Perlu menghubungkan kejadian dengan mutasi meter/sambungan. |
| `MB` | 7 | `MB` | Akronim belum didefinisikan. |
| `ADA ANJING` | 6 | `ADA_ANJING` | Label hambatan kunjungan, bukan nilai meter. |
| `METER MUNDUR` | 6 | `METER_MUNDUR` | Perlu review meter/riwayat; jangan menghitung selisih negatif sebagai konsumsi. |
| `MUDA KEMBALI` | 2 | `MUDA_KEMBALI` | Akronim belum didefinisikan. |
| `METER TERBALIK` | 1 | `METER_TERBALIK` | Perlu pemeriksaan alat dan aturan taksiran. |
| `LOS METER` | 1 | `LOS_METER` | Perlu codebook/pemetaan proses. |

Mapping di atas hanya menormalisasi ejaan ke nilai enum `KondisiCatat` yang sudah ada pada `prisma/schema/tagihan.prisma`. Simpan `ketcatat` mentah saat impor agar pemetaan dapat ditinjau ulang. Kode yang belum memiliki definisi resmi harus masuk review/manual mapping; jangan menerka makna dari singkatannya.

## Aturan implementasi yang aman

1. Pertahankan `standLalu`, `standAkhir`, delta terukur (`pemakaianRiil`), dan pemakaian tagihan (`pemakaianM3`) sebagai nilai berbeda.
2. Bila delta stand negatif atau delta nol tetapi pemakaian tagih positif, tandai sebagai kondisi yang perlu dijelaskan oleh aturan/sumber data. Jangan menimpa nilai historis.
3. Pertahankan kondisi mentah, kode enum hasil normalisasi, kategori `ONSITE/OFFSITE`, dan provenance impor terpisah.
4. Jangan menambahkan unique constraint pada `nometer` berdasarkan sampel ini. Normalisasi placeholder dan riwayat pemakaian ulang harus dilakukan lebih dahulu.
5. Untuk nilai taksiran/manual, simpan alasan, dasar periode, aktor, waktu, versi aturan, dan approval. Nilai default kalkulator belum merupakan kebijakan resmi.
6. Satu periode saja tidak memadai untuk menetapkan rata-rata taksiran, ambang anomali musiman, tren nol, atau pola meter macet. Minta beberapa periode historis dan rekonsiliasi hasil dengan pemilik proses.

Rincian rancangan domain dan urutan migrasi ada di [`ARSITEKTUR.md`](./ARSITEKTUR.md). Preflight constraint harus dibuat dari schema dan migration aktual, lalu ditinjau sebelum perubahan database; draft SQL historis bukan sumber migration aktif.
