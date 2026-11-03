Bertindaklah sebagai Principal Full-Stack Architect dan Senior Code Reviewer. Lakukan audit, review mendalam, dan perbaikan pada modul Pengaduan Air (Water Complaint) di project ini (Next.js, Hono Server, Prisma ORM).

Berikut adalah instruksi spesifik yang harus Anda kerjakan secara mandiri:

1. Audit Logika Bisnis & SLA Pengaduan Air:
   - Periksa alur pembuatan tiket pengaduan, status penanganan, penghitungan SLA (Service Level Agreement), hingga penyelesaiannya.
   - Pastikan tidak ada celah logika (edge cases) yang terlewat, seperti duplikasi tiket, perubahan status yang tidak valid, atau penugasan petugas yang keliru.

2. Koreksi Logika Ambigu & Tidak Masuk Akal:
   - Identifikasi kode, validasi, atau alur bisnis yang membingungkan (ambiguous), redundan, atau tidak logis di sisi frontend (Next.js) maupun backend (Hono).
   - Langsung perbaiki dan tulis ulang bagian kode tersebut agar bersih, semantik, aman, dan mengikuti best practices arsitektur modern.

3. Restrukturisasi & Pembersihan Kode (Separation of Concerns):
   - Pastikan pemisahan tugas terjaga ketat antara Routes/Handlers (Hono), Services, Prisma Database, dan UI Components/Hooks (Next.js).
   - Rapikan penempatan file jika ada yang tidak sesuai dengan struktur folder arsitektur project.

4. Pembuatan File Dokumentasi Skenario Nyata (.md):
   - Buat dan simpan sebuah file dokumentasi baru berformat Markdown (beri nama file arsip yang sesuai, misal: AUDIT_PENGADUAN_AIR_SCENARIOS.md) di dalam direktori project.
   - File tersebut wajib memuat daftar skenario pengujian nyata (real-world test scenarios) yang mencakup alur normal, penanganan kendala di lapangan, pengujian batas SLA, serta kriteria keberhasilannya.

Silakan mulai lakukan scan pada modul pengaduan air, eksekusi perbaikan kodenya, dan buat file dokumentasi skenarionya sekarang juga.
