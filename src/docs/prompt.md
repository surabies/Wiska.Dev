Bertindaklah sebagai Senior Full-Stack Architect dan Domain Expert Sistem Manajemen Utilities (PPOB/PDAM/PLN).

Saya sedang membangun aplikasi sistem baca meter air/listrik. Saya membutuhkan audit menyeluruh terhadap basis kode dan arsitektur aplikasi saya untuk memastikan logika bisnisnya memenuhi standar industri serta siap untuk diproduksi (production-ready).

Berikut adalah gambaran umum stack dan fitur aplikasi saya:
- Tech Stack Backend: Hono JS, PostgreSQL, Prisma ORM, Next.js (Dashboard Admin/Pengawas).
- Fitur Utama: Pembacaan meter oleh petugas lapangan, verifikasi data/foto meteran, pengeditan koreksi, pengawasan (monitoring) oleh supervisor/admin, serta integrasi dashboard.

Tolong audit dan evaluasi sistem saya berdasarkan poin-poin berikut:

1. Evaluasi Logika Bisnis (Standar Industri):
   - Apakah flow baca meter (input stan awal/akhir, foto bukti, geotagging, kalkulasi pemakaian, dan validasi abnormalitas) sudah sesuai best practice industri?
   - Apakah skenario edge-cases seperti pencatatan meter lewati batas (rollover/reset angka), meter rusak, rumah terkunci, atau koreksi tagihan pasca-verifikasi sudah tertangani dengan aman?

2. Audit Skema Database (Prisma / PostgreSQL):
   - Apakah relasi tabel (Pelanggan, Petugas, Rute/Wilayah, Hasil Bacaan/Stand, Invoice/Billing, Audit Log) sudah ternormalisasi dan efisien?
   - Apakah penanganan indexing, status siklus penagihan (pending, verified, rejected, edited), serta riwayat perubahan data (audit trail) sudah sesuai standar keamanan audit industri?

3. Audit Backend (Hono JS):
   - Apakah penanganan error (error handling), validasi request (Zod/type-check), auth & authorization (Role-Based Access Control: Admin, Supervisor, Petugas), dan transaksi database (Prisma Transaction) sudah solid untuk menangani concurrency di lapangan?
   - Apakah pipeline/endpoint untuk logika verifikasi, pengeditan data oleh supervisor, dan persetujuan (approval flow) sudah memiliki batasan hak akses yang aman dan tidak bisa dimanipulasi?

4. Kelayakan Produksi (Production Readiness Checklist):
   - Tentukan indikator utama (checklist) yang harus dipenuhi agar backend Hono + PostgreSQL ini aman di-deploy ke lingkungan produksi.
   - Apa saja potensi bottleneck (terutama saat sync data massal dari mobile app di daerah minim sinyal) dan cara mitigasinya?

Mohon berikan analisis, koreksi, saran arsitektur, dan contoh perbaikan kode/skema jika ada bagian yang dianggap berisiko atau belum memenuhi standar produksi.
