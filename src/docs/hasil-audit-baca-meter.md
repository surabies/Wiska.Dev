# Hasil Audit Sistem Baca Meter

**Tanggal audit:** 31 Oktober 2026
**Cakupan:** pemeriksaan statis repository untuk alur pembacaan, verifikasi, billing, skema Prisma, autentikasi/otorisasi, dan sinkronisasi batch.
**Status:** temuan ini bukan penetration test, audit database produksi, atau sertifikasi metrologi.

## Ringkasan eksekutif

Repository telah memiliki fondasi yang berguna: validasi request, middleware autentikasi global untuk API internal, role-based access control, foto dan koordinat pembacaan, tahapan verifikasi V1/V2/V3, audit pada beberapa aksi penting, constraint unik, tarif bertanggal berlaku, dan proses closing periode.

Namun, implementasi belum siap dinyatakan production-ready. Prioritas pertama adalah memastikan setiap pengguna hanya dapat memproses objek yang berhak diakses, menutup jalur pembentukan pembacaan resmi yang melewati approval, dan menghilangkan override tarif tanpa kontrol/audit yang memadai. Race condition, histori koreksi, rollover, serta hardening operasional juga perlu dituntaskan sebelum deployment untuk penagihan resmi.

## Temuan berbasis repository

### A. Prioritas tinggi

1. **Laporan mandiri tidak memeriksa kepemilikan pelanggan.**
   `POST /api/v1/laporan-mandiri` menerima `pelangganId`, memeriksa pelanggan aktif, lalu membuat laporan. Tidak terlihat pemeriksaan bahwa pelanggan tersebut terhubung ke akun pengguna yang mengirim request. Autentikasi global tidak menggantikan otorisasi per objek.
   - Lokasi: [`laporan-mandiri.router.ts`](../lib/server/modules/laporan/laporan-mandiri.router.ts), handler `POST /`.
   - Risiko: pengguna terautentikasi dapat membuat laporan atas nomor pelanggan lain.
   - Rekomendasi: ambil pelanggan dari relasi akun/sambungan pengguna di server. Jangan jadikan `pelangganId` dari request sebagai bukti kepemilikan.

2. **Verifikasi laporan mandiri tidak memastikan meter milik pelanggan yang sama.**
   Handler verifikasi memastikan `meterId` ada, tetapi tidak membandingkan `meter.pelangganId` dengan `laporan.pelangganId`.
   - Lokasi: [`laporan-mandiri.router.ts`](../lib/server/modules/laporan/laporan-mandiri.router.ts), handler `PATCH /:id/verify`.
   - Risiko: pembacaan resmi dapat terhubung ke meter milik pelanggan berbeda.
   - Rekomendasi: validasi kepemilikan, status aktif, periode, dan penggantian meter dalam satu transaksi yang memfinalkan verifikasi.

3. **Endpoint pembacaan langsung dapat melewati alur approval.**
   `POST /api/v1/pembacaan` tersedia bagi `STAFF_UP` dan membuat `PembacaanMeter` secara langsung. Jalur ini tidak menjalankan tahap V1/V2/V3 dan tidak tampak memeriksa periode yang sudah terkunci. Ini mungkin dibutuhkan untuk impor administratif, tetapi perlu dibatasi dan diaudit sebagai jalur khusus.
   - Lokasi: [`pembacaan.router.ts`](../lib/server/modules/pembacaan/pembacaan.router.ts), handler `POST /`.
   - Risiko: jalur samping melewati kontrol verifikasi yang diandalkan proses closing.
   - Rekomendasi: jadikan jalur impor dengan izin sempit, validasi periode, sumber, rekonsiliasi, dan audit; atau hapus jika tidak dibutuhkan.

4. **Endpoint pembuatan tagihan menerima komponen nominal dari client.**
   Request dapat menyertakan `beaBeban`, `beaAdmin`, dan `airKotor`; service menggunakan nilai input tersebut bila tersedia. `lainLain` dan `denda` juga dapat dikirim tanpa alasan wajib dan approval terpisah.
   - Lokasi: [`tagihan.router.ts`](../lib/server/modules/tagihan/tagihan.router.ts), `generateSchema`; [`tagihan.service.ts`](../lib/server/modules/tagihan/tagihan.service.ts), `generateTagihan()`.
   - Risiko: komponen tagihan yang seharusnya berasal dari tarif berlaku dapat diubah pada request.
   - Rekomendasi: hilangkan komponen tarif dari endpoint biasa. Sediakan koreksi manual tersendiri, dengan alasan, aktor, nilai sebelum/sesudah, bukti, dan approval.

### B. Prioritas menengah-tinggi

5. **Status token memuat role yang mungkin sudah tidak berlaku.**
   Token mobile menyimpan role; middleware pemeriksaan sesi hidup memeriksa keberadaan dan status aktif user, tetapi tidak memuat role terbaru untuk otorisasi. Penurunan role dapat tidak berlaku sampai token kedaluwarsa. Token mobile berlaku tujuh hari.
   - Lokasi: [`mobile-token.ts`](../lib/server/lib/mobile-token.ts), [`sesi-hidup.ts`](../lib/server/middleware/sesi-hidup.ts), [`auth.ts`](../lib/auth/auth.ts).
   - Rekomendasi: gunakan versi sesi/authorization yang dapat dicabut, atau muat role terbaru dari cache server yang memiliki invalidasi saat perubahan role. Pertimbangkan sesi mobile berumur pendek dan refresh token yang dapat dicabut.

6. **Koreksi verifikasi belum memiliki histori nilai yang append-only.**
   Skema menyimpan identitas dan waktu V1/V2/V3, tetapi nilai koreksi seperti stand akhir, pemakaian taksir, dan meter verifikasi disimpan pada kolom yang dapat ditimpa. Tidak ditemukan pencatatan `AuditLog` di handler perubahan verifikasi yang ditinjau.
   - Lokasi: [`operasional.prisma`](../../prisma/schema/operasional.prisma), `LaporanHarianPetugas`; [`laporan-harian.router.ts`](../lib/server/modules/laporan/laporan-harian.router.ts), handler V1–V3.
   - Risiko: sulit merekonstruksi siapa mengubah nilai apa dan nilai sebelum/sesudahnya.
   - Rekomendasi: simpan setiap koreksi dalam tabel histori append-only di transaksi yang sama; pembacaan resmi dan tagihan harus merujuk pada revision yang disetujui.

7. **Pemeriksaan state dilakukan sebelum transaksi, sehingga request bersamaan dapat berlomba.**
   Verifikasi laporan mandiri memeriksa status `MENUNGGU` sebelum memasuki transaksi dan kemudian melakukan update berdasarkan `id` saja. Bentuk serupa perlu ditinjau pada seluruh jalur transisi.
   - Lokasi: [`laporan-mandiri.router.ts`](../lib/server/modules/laporan/laporan-mandiri.router.ts), handler verify/reject/unverify.
   - Risiko: dua request dapat membaca status yang sama sebelum keduanya menulis.
   - Rekomendasi: gunakan update bersyarat `where: { id, status: "MENUNGGU" }` dan pastikan tepat satu baris berubah; pakai tingkat isolasi/retry yang sesuai untuk transaksi multi-baris.

8. **Aturan meter aktif hanya ditegakkan aplikasi.**
   Komentar model `Meter` menyebut satu meter aktif per pelanggan ditegakkan oleh logika aplikasi dan menyarankan partial unique index manual.
   - Lokasi: [`tagihan.prisma`](../../prisma/schema/tagihan.prisma), model `Meter`.
   - Risiko: pemasangan/penggantian meter bersamaan dapat menghasilkan dua meter aktif.
   - Rekomendasi: bersihkan duplikasi yang ada, lalu tegakkan dengan partial unique index PostgreSQL.

### C. Domain dan kualitas data

9. **Rollover tidak dihitung sebagai pemakaian yang sah.**
   Beberapa jalur menghitung `Math.max(0, standAkhir - standLalu)`. Saat counter turun, hasilnya nol, bukan konsumsi lintas batas. Rollover perlu parameter kapasitas/digit register dan jenis meter; meter rusak atau penggantian meter perlu alur berbeda.
   - Lokasi: [`pembacaan.router.ts`](../lib/server/modules/pembacaan/pembacaan.router.ts), [`perhitungan-meter.ts`](../lib/domain/perhitungan-meter.ts).
   - Rekomendasi: hitung rollover hanya bila skenario dan meter mendukungnya; selain itu tandai untuk review/taksiran dengan alasan eksplisit.

10. **Validasi periode menerima bulan yang tidak valid.**
    Rentang angka seperti `190001–999912` menerima bulan `00` atau `13`. `periodeToDate()` melempar error biasa untuk bulan invalid, yang dapat menjadi respons 500, bukan validasi input.
    - Lokasi: [`pembacaan.router.ts`](../lib/server/modules/pembacaan/pembacaan.router.ts), schema periode; [`periode.ts`](../lib/domain/periode.ts).
    - Rekomendasi: schema bersama harus mensyaratkan `YYYYMM` dengan bulan `01–12`.

11. **Identitas petugas dalam pencatatan menerima nilai dari client.**
    Schema pembacaan lapangan menerima `pencatatId` opsional. `simpanLaporan()` menggunakan nilai client bila dikirim, sebelum fallback ke pencatat dari sesi.
    - Lokasi: [`laporan-harian.router.ts`](../lib/server/modules/laporan/laporan-harian.router.ts), `createSchema` dan `simpanLaporan()`.
    - Risiko: atribusi pekerjaan dapat salah atau dipalsukan, terutama pada endpoint petugas.
    - Rekomendasi: untuk aplikasi petugas, turunkan identitas pencatat dari user sesi dan validasi assignment/rute; izinkan pemilihan manual hanya pada endpoint administrasi terpisah.

12. **Constraint pembacaan resmi adalah unik per meter/periode, bukan pelanggan/periode.**
    Skema mengizinkan beberapa pembacaan untuk meter berbeda pada pelanggan sama pada periode yang sama. Ini mungkin diperlukan untuk meter pengganti, tetapi aturan pemilihan satu hasil resmi perlu eksplisit dan ditegakkan dalam model/domain.
    - Lokasi: [`tagihan.prisma`](../../prisma/schema/tagihan.prisma), model `PembacaanMeter`; [`pembacaan-resmi.ts`](../lib/server/modules/laporan/pembacaan-resmi.ts).
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

Lihat [`arsitektur-awal-baca-meter.md`](./arsitektur-awal-baca-meter.md) untuk rancangan target, skema domain, alur sinkronisasi offline, backend, dan sumber rujukan.
