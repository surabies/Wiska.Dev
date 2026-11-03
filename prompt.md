Bertindaklah sebagai Principal Full-Stack Architect dan Senior Code Reviewer. Lakukan audit, review mendalam, dan restrukturisasi menyeluruh pada codebase project ini (Next.js, Hono Server, Prisma ORM, TypeScript).

Berikut adalah fokus area audit yang harus Anda lakukan:

1. **Business Logic & Scenario Alignment:**
   - Periksa apakah alur logika bisnis sudah sesuai dengan arsitektur modern full-stack.
   - Pastikan penanganan _edge cases_, validasi data (menggunakan Zod atau sejenisnya), dan manajemen _error handling_ di sisi backend (Hono) maupun frontend (Next.js) sudah solid.

2. **Separation of Concerns (SoC) & Clean Architecture:**
   - **Backend (Hono):** Pastikan pemisahan yang tegas antara _Routes_, _Controllers/Handlers_, _Services/Business Logic_, dan _Data Access Layer_ (Prisma). Hindari _fat routes_.
   - **Frontend (Next.js):** Pastikan pemisahan yang jelas antara _Server Components_ dan _Client Components_, _UI Components_ (reusable), _State Management_, serta _API Client/Services_.

3. **Semantic Code & Best Practices:**
   - Periksa penamaan variabel, fungsi, komponen, dan endpoint agar deskriptif dan semantik.
   - Pastikan tipe data TypeScript (types/interfaces) terdefinisi dengan baik tanpa ada penggunaan `any` yang tidak perlu.

4. **Root Folder Structure & Layout Hygiene:**
   - Evaluasi tata letak struktur folder root project saat ini.
   - Jika ada file atau folder yang salah tempat (misalnya logic backend di folder frontend, atau konfigurasi yang berantakan), lakukan **restrukturisasi dan pemindahan file secara fisik** ke direktori yang semestinya agar bersih dan terstandarisasi.

Instruksi Eksekusi untuk Anda (Claude Opus):

1. **Analisis:** Scan seluruh struktur folder dan file utama project ini terlebih dahulu.
2. **Laporkan:** Berikan ringkasan singkat mengenai celah logika, pelanggaran SoC, atau kesalahan struktur folder yang Anda temukan.
3. **Eksekusi Perbaikan:** Langsung perbaiki kode yang salah, rapikan, dan lakukan restrukturisasi file/folder yang berantakan secara mandiri menggunakan _tools_ file editing Anda.
