# Hasil Audit Sistem Baca Meter

**Tanggal audit:** 31 Oktober 2026
**Cakupan:** pemeriksaan statis repository untuk alur pembacaan, verifikasi, billing, skema Prisma, autentikasi/otorisasi, dan sinkronisasi batch.
**Status:** temuan ini bukan penetration test, audit database produksi, atau sertifikasi metrologi.
**Versi:** 0.2 (tabel status temuan ditambahkan 1 November 2026; isi temuan tetap snapshot 31 Oktober 2026)

**Peran dokumen:** sumber kebenaran untuk temuan audit statis kode dan status temuannya. Status implementasi lain ada di [STATUS](./STATUS.md); keputusan (DEC) dan isu terbuka (OPEN) di [Indeks](./INDEKS.md#register-open).

## Ringkasan eksekutif

Repository telah memiliki fondasi yang berguna: validasi request, middleware autentikasi global untuk API internal, role-based access control, foto dan koordinat pembacaan, tahapan verifikasi V1/V2/V3, audit pada beberapa aksi penting, constraint unik, tarif bertanggal berlaku, dan proses closing periode.

Namun, implementasi belum siap dinyatakan production-ready. Prioritas pertama adalah memastikan setiap pengguna hanya dapat memproses objek yang berhak diakses, menutup jalur pembentukan pembacaan resmi yang melewati approval, dan menghilangkan override tarif tanpa kontrol/audit yang memadai. Race condition, histori koreksi, rollover, serta hardening operasional juga perlu dituntaskan sebelum deployment untuk penagihan resmi.

## Status temuan (diperbarui 1 November 2026)

Isi temuan di bawah adalah snapshot pemeriksaan statis 31 Oktober 2026. Status tindak lanjut yang diperbarui ditandai khusus dan didukung pemeriksaan kode/tes terarah; temuan lain tetap merupakan snapshot dan tidak diverifikasi ulang. **Terbuka**: belum ada bukti perbaikan. **Sebagian (klaim)** dan **Tertangani (klaim)**: dokumen menyatakan ditangani, belum diverifikasi. **OPEN**: perlu keputusan, lihat [register OPEN](./INDEKS.md#register-open).

| #   | Temuan                                                       | Status                                               | Dasar dan langkah berikutnya                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Laporan mandiri tidak memeriksa kepemilikan pelanggan        | Tertangani (klaim)                                   | STATUS menyebut pemeriksaan sambungan tertaut pada alur akun. Perlu tes negatif lintas akun (G1). Tautan tetap bukan bukti kepemilikan.                                                                                          |
| 2   | Verifikasi Mandiri tidak membandingkan meter dengan laporan  | Tertangani (alur dipisahkan)                         | Endpoint Mandiri tidak lagi menerima meter atau membuat pembacaan resmi; verifikasi hanya memperbarui status dan stand laporan. Penerbitan resmi dilakukan lewat alur Petugas.                                                   |
| 3   | `POST /pembacaan` melewati approval                          | OPEN                                                 | Keputusan kewenangan belum ada (OPEN-20).                                                                                                                                                                                        |
| 4   | Komponen nominal tagihan dari client                         | Terbuka                                              | Tidak ada bukti perbaikan di dokumen.                                                                                                                                                                                            |
| 5   | Role pada token dapat usang                                  | Terbuka                                              | Tidak ada bukti perbaikan di dokumen.                                                                                                                                                                                            |
| 6   | Koreksi tanpa histori append-only                            | Sebagian (klaim; tindak lanjut kode dan tes terarah) | Helper pembacaan resmi yang dipakai jalur V3 massal menulis audit before/after saat penggantian; tes helper lulus. Ini belum membuktikan histori immutable append-only untuk semua koreksi/reopen atau tes PostgreSQL (OPEN-08). |
| 7   | Pemeriksaan state sebelum transaksi (race)                   | Sebagian                                             | Verify laporan Mandiri memakai update bersyarat di transaksi; reject dan unverify masih perlu pemeriksaan race yang sama.                                                                                                        |
| 8   | Meter aktif hanya ditegakkan aplikasi                        | Terbuka                                              | Partial unique index direncanakan setelah preflight; tidak ada bukti diterapkan.                                                                                                                                                 |
| 9   | Rollover dihitung nol                                        | Terbuka                                              | STATUS dan aturan kondisi mencatat sebagian jalur masih memakai `Math.max(0, ...)`; kapasitas digit `MUDA_KEMBALI` belum disahkan (OPEN-10).                                                                                     |
| 10  | Validasi periode menerima bulan tidak valid                  | Terbuka                                              | Tidak ada bukti perbaikan di dokumen.                                                                                                                                                                                            |
| 11  | `pencatatId` berasal dari client                             | Terbuka                                              | Tidak ada bukti perbaikan di dokumen.                                                                                                                                                                                            |
| 12  | Kunci hasil resmi per meter/periode, bukan pelanggan/periode | OPEN                                                 | OPEN-06.                                                                                                                                                                                                                         |

## Temuan berbasis repository

### A. Prioritas tinggi

1. **Laporan mandiri tidak memeriksa kepemilikan pelanggan.**
   `POST /api/v1/laporan-mandiri` menerima `pelangganId`, memeriksa pelanggan aktif, lalu membuat laporan. Tidak terlihat pemeriksaan bahwa pelanggan tersebut terhubung ke akun pengguna yang mengirim request. Autentikasi global tidak menggantikan otorisasi per objek.
   - Lokasi: [`laporan-mandiri.router.ts`](../lib/server/modules/laporan/LaporanMandiri.router.ts), handler `POST /`.
   - Risiko: pengguna terautentikasi dapat membuat laporan atas nomor pelanggan lain.
   - Rekomendasi: ambil pelanggan dari relasi akun/sambungan pengguna di server. Jangan jadikan `pelangganId` dari request sebagai bukti kepemilikan.

2. **Verifikasi laporan mandiri tidak memastikan meter milik pelanggan yang sama (temuan snapshot, tidak berlaku setelah pemisahan alur).**
   Pada snapshot audit 31 Oktober, handler verifikasi menerima `meterId` dan membuat pembacaan resmi tanpa membandingkan kepemilikan meter. Endpoint kini hanya mengoreksi stand laporan dan tidak menerima `meterId` atau membuat pembacaan resmi.
   - Lokasi: [`laporan-mandiri.router.ts`](../lib/server/modules/laporan/LaporanMandiri.router.ts), handler `PATCH /:id/verify`.
   - Dampak lama: pembacaan resmi dapat terhubung ke meter milik pelanggan berbeda.
   - Penanganan: pemisahan verifikasi foto/koreksi stand dari penerbitan resmi menghilangkan jalur ini; pencocokan meter tetap tanggung jawab alur Petugas.

3. **Endpoint pembacaan langsung dapat melewati alur approval.**
   `POST /api/v1/pembacaan` tersedia bagi `STAFF_UP` dan membuat `PembacaanMeter` secara langsung. Jalur ini tidak menjalankan tahap V1/V2/V3 dan tidak tampak memeriksa periode yang sudah terkunci. Ini mungkin dibutuhkan untuk impor administratif, tetapi perlu dibatasi dan diaudit sebagai jalur khusus.
   - Lokasi: [`pembacaan.router.ts`](../lib/server/modules/pembacaan/Pembacaan.router.ts), handler `POST /`.
   - Risiko: jalur samping melewati kontrol verifikasi yang diandalkan proses closing.
   - Rekomendasi: jadikan jalur impor dengan izin sempit, validasi periode, sumber, rekonsiliasi, dan audit; atau hapus jika tidak dibutuhkan.

4. **Endpoint pembuatan tagihan menerima komponen nominal dari client.**
   Request dapat menyertakan `beaBeban`, `beaAdmin`, dan `airKotor`; service menggunakan nilai input tersebut bila tersedia. `lainLain` dan `denda` juga dapat dikirim tanpa alasan wajib dan approval terpisah.
   - Lokasi: [`tagihan.router.ts`](../lib/server/modules/tagihan/Tagihan.router.ts), `generateSchema`; [`tagihan.service.ts`](../lib/server/modules/tagihan/Tagihan.service.ts), `generateTagihan()`.
   - Risiko: komponen tagihan yang seharusnya berasal dari tarif berlaku dapat diubah pada request.
   - Rekomendasi: hilangkan komponen tarif dari endpoint biasa. Sediakan koreksi manual tersendiri, dengan alasan, aktor, nilai sebelum/sesudah, bukti, dan approval.

### B. Prioritas menengah-tinggi

5. **Status token memuat role yang mungkin sudah tidak berlaku.**
   Token mobile menyimpan role; middleware pemeriksaan sesi hidup memeriksa keberadaan dan status aktif user, tetapi tidak memuat role terbaru untuk otorisasi. Penurunan role dapat tidak berlaku sampai token kedaluwarsa. Token mobile berlaku tujuh hari.
   - Lokasi: [`mobile-token.ts`](../lib/server/lib/SelulerToken.ts), [`sesi-hidup.ts`](../lib/server/middleware/SesiHidup.ts), [`auth.ts`](../lib/auth/Auth.ts).
   - Rekomendasi: gunakan versi sesi/authorization yang dapat dicabut, atau muat role terbaru dari cache server yang memiliki invalidasi saat perubahan role. Pertimbangkan sesi mobile berumur pendek dan refresh token yang dapat dicabut.

6. **Koreksi verifikasi belum memiliki histori nilai yang append-only.**
   Nilai koreksi seperti stand akhir, pemakaian taksir, dan meter verifikasi masih disimpan pada kolom yang dapat ditimpa. Pemeriksaan tindak lanjut mengonfirmasi helper hasil resmi mencatat snapshot before/after ke `AuditLog` saat hasil diganti dan dipakai V3 massal; ini tidak setara dengan histori revision append-only untuk seluruh perubahan/reopen.
   - Lokasi: [`operasional.prisma`](../../prisma/schema/operasional.prisma), `LaporanHarianPetugas`; [`laporan-harian.router.ts`](../lib/server/modules/laporan/LaporanHarian.router.ts), handler V1–V3.
   - Risiko: sulit merekonstruksi siapa mengubah nilai apa dan nilai sebelum/sesudahnya.
   - Rekomendasi: pertahankan snapshot before/after transaksional dan lengkapi histori append-only untuk semua jalur koreksi/reopen; pembacaan resmi dan tagihan harus merujuk pada revision yang disetujui.

7. **Pemeriksaan state dilakukan sebelum transaksi, sehingga request bersamaan dapat berlomba.**
   Verify laporan Mandiri memeriksa status awal, lalu memakai update bersyarat `where: { id, status: "MENUNGGU" }` di dalam transaksi. Reject dan unverify masih perlu ditinjau untuk race condition yang serupa.
   - Lokasi: [`laporan-mandiri.router.ts`](../lib/server/modules/laporan/LaporanMandiri.router.ts), handler verify/reject/unverify.
   - Risiko tersisa: dua request reject/unverify dapat membaca status yang sama sebelum keduanya menulis.
   - Rekomendasi: terapkan update bersyarat dan pastikan tepat satu baris berubah pada jalur reject/unverify; pakai tingkat isolasi/retry yang sesuai untuk transaksi multi-baris.

8. **Aturan meter aktif hanya ditegakkan aplikasi.**
   Komentar model `Meter` menyebut satu meter aktif per pelanggan ditegakkan oleh logika aplikasi dan menyarankan partial unique index manual.
   - Lokasi: [`tagihan.prisma`](../../prisma/schema/tagihan.prisma), model `Meter`.
   - Risiko: pemasangan/penggantian meter bersamaan dapat menghasilkan dua meter aktif.
   - Rekomendasi: bersihkan duplikasi yang ada, lalu tegakkan dengan partial unique index PostgreSQL.

### C. Domain dan kualitas data

9. **Rollover tidak dihitung sebagai pemakaian yang sah.**
   Beberapa jalur menghitung `Math.max(0, standAkhir - standLalu)`. Saat counter turun, hasilnya nol, bukan konsumsi lintas batas. Rollover perlu parameter kapasitas/digit register dan jenis meter; meter rusak atau penggantian meter perlu alur berbeda.
   - Lokasi: [`pembacaan.router.ts`](../lib/server/modules/pembacaan/Pembacaan.router.ts), [`perhitungan-meter.ts`](../lib/domain/PerhitunganMeter.ts).
   - Rekomendasi: hitung rollover hanya bila skenario dan meter mendukungnya; selain itu tandai untuk review/taksiran dengan alasan eksplisit.

10. **Validasi periode menerima bulan yang tidak valid.**
    Rentang angka seperti `190001–999912` menerima bulan `00` atau `13`. `periodeToDate()` melempar error biasa untuk bulan invalid, yang dapat menjadi respons 500, bukan validasi input.
    - Lokasi: [`pembacaan.router.ts`](../lib/server/modules/pembacaan/Pembacaan.router.ts), schema periode; [`periode.ts`](../lib/domain/Periode.ts).
    - Rekomendasi: schema bersama harus mensyaratkan `YYYYMM` dengan bulan `01–12`.

11. **Identitas petugas dalam pencatatan menerima nilai dari client.**
    Schema pembacaan lapangan menerima `pencatatId` opsional. `simpanLaporan()` menggunakan nilai client bila dikirim, sebelum fallback ke pencatat dari sesi.
    - Lokasi: [`laporan-harian.router.ts`](../lib/server/modules/laporan/LaporanHarian.router.ts), `createSchema` dan `simpanLaporan()`.
    - Risiko: atribusi pekerjaan dapat salah atau dipalsukan, terutama pada endpoint petugas.
    - Rekomendasi: untuk aplikasi petugas, turunkan identitas pencatat dari user sesi dan validasi assignment/rute; izinkan pemilihan manual hanya pada endpoint administrasi terpisah.

12. **Constraint pembacaan resmi adalah unik per meter/periode, bukan pelanggan/periode.**
    Skema mengizinkan beberapa pembacaan untuk meter berbeda pada pelanggan sama pada periode yang sama. Ini mungkin diperlukan untuk meter pengganti, tetapi aturan pemilihan satu hasil resmi perlu eksplisit dan ditegakkan dalam model/domain.
    - Lokasi: [`tagihan.prisma`](../../prisma/schema/tagihan.prisma), model `PembacaanMeter`; [`pembacaan-resmi.ts`](../lib/server/modules/laporan/PembacaanResmi.ts).
    - Rekomendasi: pisahkan submission mentah, reading resmi per pelanggan/periode, dan segmen meter untuk kasus penggantian.

## Kontrol yang sudah terlihat baik

- API internal berada di bawah autentikasi global; endpoint publik dipisah.
- Request umumnya divalidasi melalui Zod dan error API memiliki handler terpusat.
- Tagihan periodik dihitung dari tarif yang berlaku di server; closing menyediakan pratinjau dan audit.
- Ada indeks serta constraint unik penting pada model pelanggan, laporan, pembacaan, dan tagihan.
- Foto memiliki batas ukuran dan pemeriksaan magic bytes; fallback storage lokal ditolak pada produksi.
- Batch lapangan mendukung partial success dan mengenali duplikat akibat retry jaringan.
- Rute dan daftar catat per periode menyimpan snapshot untuk menjaga konteks historis.

## Tindakan sebelum produksi

- [ ] Tutup temuan 1–4 dan uji akses antar-pelanggan, meter silang, jalur approval, serta nominal tagihan.
- [ ] Buat histori koreksi append-only dan kontrol transaksi atomik untuk semua transisi kritis.
- [ ] Perbaiki validasi periode, rollover, meter pengganti, meter rusak, rumah terkunci, dan estimasi.
- [ ] Tegakkan invariant yang kritis di PostgreSQL, bukan hanya di handler.
- [ ] Tambahkan pengujian integrasi race condition, idempotensi retry, dan rekonsiliasi closing.
- [ ] Uji backup dan pemulihan, migrasi, pemantauan, kapasitas koneksi, serta penyimpanan foto produksi.
- [ ] Lakukan threat modeling dan verifikasi kontrol terhadap OWASP ASVS/API Security.

Lihat [`ARSITEKTUR.md`](./ARSITEKTUR.md) untuk rancangan target, skema domain, alur sinkronisasi offline, backend, dan sumber rujukan.
