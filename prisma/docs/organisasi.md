# 📘 DOKUMENTASI SPESIFIKASI DAN ARSITEKTUR SISTEM TERINTEGRASI
## PERUMDA TIRTAWENING KOTA BANDUNG

---

## 📄 DAFTAR ISI
1. [Pendahuluan & Tujuan Sistem](#1-pendahuluan--tujuan-sistem)
2. [Struktur Organisasi & Matriks Jabatan](#2-struktur-organisasi--matriks-jabatan)
3. [Arsitektur Sistem & Ekosistem Aplikasi](#3-arsitektur-sistem--ekosistem-aplikasi)
4. [Matriks RBAC (Role-Based Access Control)](#4-matriks-rbac-role-based-access-control)
5. [Struktur Menu Navigasi & Modul Utama](#5-struktur-menu-navigasi--modul-utama)
6. [Spesifikasi Portal Aplikasi](#6-spesifikasi-portal-aplikasi)
7. [Alur Kerja Data Usaha (Data Pipeline)](#7-alur-kerja-data-usaha-data-pipeline)
8. [Panduan Integrasi & Keamanan Data](#8-panduan-integrasi--keamanan-data)

---

## 1. PENDAHULUAN & TUJUAN SISTEM

### 1.1 Latar Belakang
Pengelolaan air minum dan pemeliharaan instalasi air limbah di Kota Bandung memerlukan keterpaduan alur data dari tingkat operasional lapangan (pencatatan meter/cater) hingga penyusunan rekening tagihan (DRD) serta pemantauan oleh jajaran Direksi dan Kuasa Pemilik Modal (KPM).

### 1.2 Tujuan Utama
- **Digitalisasi End-to-End**: Mengintegrasikan proses bisnis dari pembacaan meter air, mutasi pelanggan, validasi, pemetaan GIS, hingga penutupan periode billing bulanan.
- **Transparansi & Akuntabilitas**: Meminimalkan potensi fraud (anomali angka meter, manipulasi data foto meter) dengan mekanisme verifikasi bertingkat.
- **Tata Kelola Akses Terpusat**: Menerapkan RBAC berstandar tinggi untuk memastikan setiap role pegawai/petugas memiliki akses sesuai tingkat kewenangannya.

---

## 2. STRUKTUR ORGANISASI & MATRIKS JABATAN

Sistem terintegrasi ini dirancang menyesuaikan hirarki organisasi resmi PERUMDA Tirtawening Kota Bandung.

### 2.1 Pucuk Pimpinan & Direktorat
1. **Kuasa Pemilik Modal (KPM)** & **Dewan Pengawas**
2. **Direktorat Utama**
   - Bagian Sekretariat
   - Bagian SDM
   - Satuan Pengawasan Intern (SPI)
   - Bagian Penelitian & Pengembangan (Litbang) *(Penugasan Khusus / Parkir Jabatan SM & Manager)*
3. **Direktorat Teknik**
   - Bagian Perencanaan
   - Bagian Produksi
   - Bagian Operasional Air Limbah (Bopal)
   - Bengkel & Tera Meter
4. **Direktorat Pelayanan**
   - **Bagian Pelayanan Wilayah 1 s.d. Wilayah 6** (Dipimpin oleh Senior Manager Wilayah), membawahi Subbagian:
     - Subbagian Distribusi / Zona
     - Subbagian Pencatat Meter (*Cater*)
     - Subbagian RPM (Rehab, Meter, Jaringan)
     - Subbagian Langganan (Hubungan Pelanggan & Data)
5. **Direktorat Umum**
   - Bagian Penagihan
   - Bagian K3LH (Kesehatan, Keselamatan Kerja, dan Lingkungan Hidup)
   - Bagian Hukum, Aset, & Umum
   - Bagian STI

### 2.2 Hirarki Level Jabatan Matriks (Per-Bagian / Subbagian)
Di setiap struktur bagian dan subbagian berlaku hierarki jenjang jabatan sebagai berikut:
1. **Senior Manager (SM)** / Kepala Bagian Utama
2. **Manager / Sederajat** (Kasubag / Kepala Subbagian)
3. **Supervisor / Sederajat** (Penyelia / Koordinator Lapangan)
4. **Administrator** (Admin Operasional / Data Entry)
5. **Pelaksana / Anggota / Staff** (Cater, Petugas Lapangan, Kasir, Teknis)

---

## 3. ARSITEKTUR SISTEM & EKOSISTEM APLIKASI

Sistem ini dibagi menjadi 3 (tiga) layer utama yang saling terintegrasi melalui API Gateway terpusat:

[ Mobile App (Android/iOS) ]  <--->  [ API Gateway & Middleware ]  <--->  [ Database Terpusat (PostgreSQL/PostGIS) ]

Petugas Cater Lapangan

Pelanggan (Mandiri)

^
[ Portal Web Admin / Backoffice ] <-----------------------------------------------|

Management & Billing System

GIS / Peta Pelanggan

Audit & Monitoring System


### 3.1 Komponen Ekosistem
1. **Mobile Catering App**: Digunakan oleh petugas cater untuk foto meter, pencatatan koordinat GPS, dan pembacaan offline/online.
2. **Backoffice Admin Portal**: Web app internal untuk pengolahan data meter, mutasi, pembuatan DRD, sinkronisasi, dan laporan.
3. **Portal Executive Dashboard**: Khusus Direksi, Dewas, dan KPM untuk pemantauan realtime progress cater, pencapaian pendapatan, dan indikator pemakaian ekstrem.

---

## 4. MATRIKS RBAC (ROLE-BASED ACCESS CONTROL)

Hak akses dikelompokkan berdasarkan tingkatan struktur organisasi PERUMDA Tirtawening.

### 4.1 Definisi Role Sistem
| Role ID | Kode Role | Deskripsi Role / Jabatan |
| :--- | :--- | :--- |
| `ROLE_DIRUT` | Direktur Utama | Akses menyeluruh laporan eksekutif & monitoring audit |
| `ROLE_DIR_TEKNIK` | Direktur Teknik | Akses GIS, monitoring debit air, pemetaan & kebocoran |
| `ROLE_DIR_PELAYANAN`| Direktur Pelayanan | Akses pengolahan data, laporan cater, mutasi & pelayanan |
| `ROLE_DIR_UMUM` | Direktur Umum | Akses DRD, penagihan, K3LH, hukum & laporan keuangan |
| `ROLE_SENIOR_MANAJER`| Senior Manager Bagian/Wilayah| Pengawasan & otorisasi data wilayah/bagian operasional |
| `ROLE_MANAJER_KASUBAG`| Manager / Kasubag | Eksekusi operasional bagian & otorisasi rute/data |
| `ROLE_SUPERVISOR` | Supervisor / Penyelia | Otorisasi rute, verifikasi anomali, evaluasi foto & penggantian rute |
| `ROLE_ADMIN` | Administrator Data | Input/Edit manual, hitung rata-rata, import backup, proses data |
| `ROLE_PELAKSANA_CATER`| Pelaksana Cater / Lapangan | Akses aplikasi mobile untuk catat meter rute harian |

### 4.2 Matriks Hak Akses Modul Utama
| Kelompok Modul | DIREKSI | SENIOR MANAGER | MANAGER / KASUBAG | SUPERVISOR | ADMIN | PELAKSANA CATER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Master Data** | Read | Read | Read / Write | Full Control | Full Control | No Access |
| **Pengolahan Data** | Read | Read | Read / Write | Full Control | Full Control | No Access |
| **Peta (GIS)** | Read | Read | Read | Read / Write | Read / Write | Read (Rute Sendiri) |
| **Progress & Monitoring**| Read (All) | Read (Wilayah/Bagian) | Read (Wilayah/Bagian) | Read (Wilayah) | Read (Wilayah) | Read (Pribadi) |
| **Laporan & DRD** | Read | Read | Read | Read / Write | Read / Write | No Access |
| **Tool Tutup Bulan** | Read | Read / Approve | Execute | Execute | Execute | No Access |
| **Tools & Sync** | No Access | No Access | Execute | Execute | Execute | No Access |

---

## 5. STRUKTUR MENU NAVIGASI & MODUL UTAMA

Berikut adalah hirarki menu navigasi terintegrasi pada portal Backoffice Web Application:

├── 💼 1. Master
│   ├── 1.1 Kelainan
│   ├── 1.2 Otorisasi Menu
│   ├── 1.3 User
│   ├── 1.4 Petugas
│   ├── 1.5 Pemetaan Petugas
│   ├── 1.6 Pengurutan Rute Petugas
│   ├── 1.7 Penggabungan Rute
│   ├── 1.8 Pindah Rute
│   └── 1.9 Pindah Rute Monitoring
│
├── 🧩 2. Pengolahan Data
│   ├── 2.1 Baca Meter CHN (Wilayah 1-6)
│   ├── 2.2 Info Pelanggan
│   ├── 2.3 Mutasi PB-PK
│   ├── 2.4 No HP Pelanggan
│   ├── 2.5 Pindah Jenis Pelanggan
│   ├── 2.6 Manual ADD
│   ├── 2.7 Manual Add All
│   ├── 2.8 Hitung Rata-Rata
│   ├── 2.9 Cek Foto Petugas
│   └── 2.10 Verifikasi Catat Mandiri
│
├── 📍 3. Peta (GIS)
│   └── 3.1 Pemetaan Pelanggan & Rute Cater
│
├── 📊 4. Progress
│   ├── 4.1 Grafik Pelanggan
│   ├── 4.2 Progress per Wilayah
│   ├── 4.3 Progress per Cater
│   ├── 4.4 Presentase Koreksi
│   ├── 4.5 Ikhtisar Pemakaian Ekstrim
│   ├── 4.6 Ikhtisar Pemakaian Turun
│   ├── 4.7 Ikhtisar Pemakaian 0
│   └── 4.8 Hasil Foto Petugas
│
├── 📄 5. Laporan
│   ├── 5.1 Laporan DRD
│   ├── 5.2 Lap. Mutasi Pelanggan
│   ├── 5.3 Lap. Mutasi PB-PK
│   ├── 5.4 Lap. Periode Cater
│   ├── 5.5 Lap Data Meter
│   ├── 5.6 Lap Kelainan Meter
│   ├── 5.7 Lap Evaluasi
│   ├── 5.8 Lap Pelanggan
│   ├── 5.9 Lap. Selisih Hari
│   ├── 5.10 Lap Data Stand Awal & Akhir
│   ├── 5.11 Lap Data Stand 0 (Nol)
│   ├── 5.12 Lap History
│   ├── 5.13 Lap Perubahan Pelanggan
│   ├── 5.14 Lap. Data dan Foto
│   └── 5.15 Lap. Monitoring Kubikasi Koreksi
│
├── ✅ 6. Tool Tutup Bulan
│   ├── 6.1 PBPK
│   ├── 6.2 Stand Angkat
│   ├── 6.3 Update Zonasi
│   ├── 6.4 Posting Datameter
│   ├── 6.5 Create Closed DRD
│   ├── 6.6 Create Perbandingan
│   ├── 6.7 Create Bulan Baru
│   ├── 6.8 Upload Master Pelanggan
│   ├── 6.9 Sync Pelanggan Baru
│   ├── 6.10 Update Data Pelanggan
│   ├── 6.11 Cek Selisih Pelanggan
│   └── 6.12 Monitoring Tutup Bulan
│
├── ⚙️ 7. Tools & Utilities
│   ├── 7.1 Running Text
│   ├── 7.2 Import Stand Angkat
│   ├── 7.3 Import PB-PK
│   ├── 7.4 Proses PBPK
│   ├── 7.5 Import Backup Photo
│   ├── 7.6 Import Backup Photo GWM
│   ├── 7.7 Import Backup Data
│   ├── 7.8 Import Data SPT
│   ├── 7.9 Import Data Anomali
│   ├── 7.10 Import Data GWM
│   └── 7.11 Import Tutup
│
└── 🔄 8. SYNC Tutup Bulan
├── 8.1 Sync (1) KIRIM MUTASI
├── 8.2 Sync (2) KIRIM DATAMETER
├── 8.3 Sync (3) IMPORT STI
└── 8.4 Sync (4) BULAN BARU

---

## 6. SPESIFIKASI PORTAL APLIKASI

### 6.1 Portal Administrator Backoffice (Web Based)
- **Teknologi**: React.js / Next.js dengan Tailwind CSS & Shadcn UI.
- **Fungsi**: Seluruh eksekusi menu Master, Pengolahan Data, GIS, Laporan, dan Proses Tutup Bulan.

### 6.2 Portal Eksekutif / Dashboard Direksi
- **Teknologi**: Dashboard interaktif dengan Chart.js / Recharts.
- **Fungsi Key Performance Indicator (KPI)**:
  - Total Kubikasi Air Terjual vs Pemakaian Ekstrem.
  - Persentase Pencapaian Catat Meter Harian Per-Wilayah CHN (1-6).
  - Grafik Tingkat Kebocoran / Pemakaian 0 m³.

### 6.3 Aplikasi Mobile Field Officer (Cater App)
- **Teknologi**: React Native / Flutter.
- **Fitur Utama**:
  - Offline-first storage dengan SQLite local.
  - Watermark Foto Otomatis (Koordinat GPS, Stand Meter, Timestamp, User ID).
  - Validasi Input Angka Stand Meter (Warning jika terjadi lonjakan/penurunan ekstrem melebihi ambang batas).

---

## 7. ALUR KERJA DATA USAHA (DATA PIPELINE)

[1. Periode Baru Dibuat] -> [2. Petugas Ambil Data Rute] -> [3. Input Stand & Foto di Field]
│
[6. Billing DRD Terbentuk] <- [5. Proses Tutup Bulan] <- [4. Verifikasi & Hitung Rata-Rata]

1. **Inisiasi Periode**: Pembuatan bulan baru melalui modul `Tool Tutup Bulan -> Create Bulan Baru`.
2. **Pencatatan Lapangan**: Petugas Cater mengambil data rute harian dan melakukan pembacaan meter air pelanggan di lokasi.
3. **Pemeriksaan Anomali**: Modul `Pengolahan Data -> Cek Foto Petugas` dan `Verifikasi Catat Mandiri` mengidentifikasi stand meter mencurigakan atau angka ekstrem.
4. **Verifikasi & Koreksi**: Pengolahan data rata-rata dilakukan untuk pelanggan dengan kondisi rumah terkunci / meter terhalang (`Hitung Rata-Rata`).
5. **Posting & Rekonsiliasi**: Eksekusi `Posting Datameter` dan `Create Closed DRD`.
6. **Integrasi Kasir/Billing**: Data DRD dikirim ke payment gateway & sistem kasir pembayaran air.

---

## 8. PANDUAN INTEGRASI & KEAMANAN DATA

1. **Enkripsi Data Sensitif**: Seluruh kunci API, kredensial OAuth, dan koneksi database harus menggunakan enkripsi TLS/SSL serta disimpan pada environment variable (`.env`).
2. **Audit Logging**: Setiap aktivitas penting (seperti *Edit Manual Stand Meter*, *Tutup Bulan*, dan *Pindah Rute*) harus dicatat pada log audit sistem secara rinci.
3. **Backup Strategy**: Modul `Tools -> Import Backup Data` harus terhubung dengan jadwal automatisasi backup database harian (PostgreSQL Dump).