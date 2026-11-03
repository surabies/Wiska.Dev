# Dokumentasi Skenario Pengujian: Rollback & Guard Verifikasi Laporan Mandiri

Dokumen ini memuat panduan pengujian regresi dan skenario fungsional untuk fitur **Verifikasi dan Unverifikasi Laporan Mandiri** pada sistem pencatatan meter air, yang mencakup mekanisme _rollback_ penuh, pemulihan/penghapusan baris di tabel Verifikasi Petugas, serta _guard_ pengaman hak akses.

---

## 📋 Data Uji Awal (Pre-conditions)

Pastikan kondisi data dalam database saat pengujian mencakup:

- **9 Data di Verifikasi Petugas**, terdiri dari:
  - 3 Data _Laporan Petugas / Onsite_
  - 3 Data _Manual Add_
  - 3 Data _Manual Add All_
- **3 Data di Laporan Mandiri (KONSUMEN)** yang siap diverifikasi.

---

## 🧪 Daftar Skenario Pengujian

### Skenario 1: Rollback & Pemulihan Baris Petugas (Skenario A)

- **Tujuan:** Memastikan jika verifikasi mandiri menimpa data yang **sudah ada** di Verifikasi Petugas, saat dilakukan pembatalan (_unverify_), data aslinya pulih utuh.
- **Langkah-langkah:**
  1. Pilih salah satu data Laporan Mandiri (KONSUMEN) yang nomor pelanggannya **sudah memiliki** catatan di tabel Verifikasi Petugas (ambil dari data _Manual Add_ atau _Laporan Petugas_).
  2. Catat angka stand kiriman asli dari warga.
  3. Buka halaman **Verifikasi Pembacaan Pelanggan (Mandiri)**, lalu lakukan **Verifikasi** pada data tersebut (ubah sedikit angka stand hasil verifikasi jika perlu).
  4. Periksa halaman **Verifikasi Petugas**: pastikan jenis input berubah menjadi `KONSUMEN` (ikon biru) dan data stand/foto mengikuti hasil verifikasi mandiri.
  5. Kembali ke halaman Verifikasi Mandiri, lalu klik tombol **Batalkan Verifikasi (Unverifikasi)**.
- **Expected Result:**
  - **Halaman Verifikasi Mandiri:** Status kembali ke `MENUNGGU` dan `standDilaporkan` dikembalikan ke angka kiriman asli warga (bukan sisa angka edit verifikator).
  - **Halaman Verifikasi Petugas:** Baris data pelanggan tersebut **pulih utuh ke kondisi awal** sebelum ditimpa Mandiri (jenis input kembali ke `PETUGAS`/`MANUAL`, angka stand, pemakaian, dan foto kembali seperti semula).

---

### Skenario 2: Penghapusan Baris Bayangan / KONSUMEN Baru (Skenario B)

- **Tujuan:** Memastikan jika verifikasi mandiri dilakukan pada pelanggan yang **belum ada sama sekali** di Verifikasi Petugas, saat di-_unverify_, baris bayangan tersebut terhapus bersih.
- **Langkah-langkah:**
  1. Ambil sisa data Laporan Mandiri yang pelanggannya **belum tercatat** di 9 data Verifikasi Petugas.
  2. Lakukan **Verifikasi** data Mandiri tersebut di halaman Verifikasi Mandiri.
  3. Periksa halaman **Verifikasi Petugas**: pastikan muncul baris baru berjenis `KONSUMEN` untuk pelanggan tersebut.
  4. Kembali ke halaman Verifikasi Mandiri, lalu lakukan **Unverifikasi** pada data tersebut.
- **Expected Result:**
  - **Halaman Verifikasi Mandiri:** Status kembali ke `MENUNGGU` dan stand mandiri kembali ke data asli warga.
  - **Halaman Verifikasi Petugas:** Baris `KONSUMEN` yang tadinya dibuat otomatis oleh sistem **dihapus/ditarik kembali secara bersih** (hilang dari daftar Verifikasi Petugas).

---

### Skenario 3: Pengujian Guard & Hak Akses (Role & Periode)

- **Tujuan:** Memastikan sistem menolak pembatalan verifikasi jika melampaui batas jenjang wewenang atau periode sudah terkunci.
- **Langkah-langkah Pengujian:**
  1. **Guard Tahap Verifikasi Lanjutan (V3 / Senior):**
     - Verifikasi data mandiri hingga masuk ke Verifikasi Petugas, lalu teruskan proses verifikasinya hingga tahap V1/V2/V3.
     - Coba lakukan _Unverifikasi_ menggunakan akun berlevel **STAFF**.
     - _Expected Result:_ Sistem menolak aksi unverify dengan pesan error bahwa proses sudah berjalan di tahap lanjut atau membutuhkan role yang lebih tinggi.
  2. **Guard Periode Terkunci / Sudah Ditagih:**
     - Ambil data yang periode pembacaannya sudah berstatus _Terkunci_ atau sudah masuk ke modul _Tagihan_.
     - Coba lakukan _Unverifikasi_ pada data mandiri tersebut.
     - _Expected Result:_ Sistem menolak karena periode terkunci atau data pembacaan sudah dikunci oleh penagihan.

---

## 📝 Catatan Tambahan

- Pengujian ini merujuk pada aturan arsitektur sistem (`ARSITEKTUR.md` & `VERIFIKASI.md`) mengenai integritas data pencatatan meter.
- Pastikan menjalankan `pnpm typecheck` dan `pnpm lint` setelah melakukan penyesuaian kode terkait.
