# Roadmap — Aplikasi Baca Meter Air

**Versi:** 0.4 (progres implementasi dicatat 2 November 2026; release gate tetap berbasis bukti)
**Tanggal:** 2 November 2026
**Status:** urutan kerja usulan; tidak menjanjikan tanggal rilis
**Dokumen terkait:** [Status dan progres proyek](./STATUS.md), [PRD](./PRD.md), [Definisi MVP](./MVP.md), [Aturan Verifikasi Berjenjang dan Koreksi](./VERIFIKASI.md), [Arsitektur](./ARSITEKTUR.md), [Matriks RBAC](./RBAC.md), [Indeks dokumentasi](./INDEKS.md)

**Peran dokumen:** urutan kerja dan release gate. Bukan bukti penyelesaian; status implementasi ada di [STATUS](./STATUS.md); ID DEC dan OPEN dikelola di [Indeks](./INDEKS.md#register-open).

## Prinsip roadmap

- Urutkan pekerjaan berdasarkan risiko operasional dan integritas tagihan, bukan jumlah halaman.
- Jangan menetapkan tanggal sebelum pemilik, kapasitas, dependensi, dan hasil audit data diketahui.
- Tiap fase harus punya evidence-based exit gate; build sukses saja bukan gate produksi.
- Pisahkan pilot, produksi awal, dan peluncuran pasar. Kesiapan teknis tidak otomatis berarti kesiapan operasional, dukungan, kontrak, atau kepatuhan.
- Perubahan database dilakukan lewat migration yang direview; jangan mengasumsikan draft migration sudah diterapkan.

## Tahap 0 — kebijakan pilot disetujui; garis dasar billing produksi masih perlu

**Tujuan:** hilangkan asumsi yang dapat mengubah angka resmi/tagihan.

**Status:** keputusan scope dan kebijakan khusus pilot disetujui Wiska Prayoga pada 31 Oktober 2026 dan dicatat di [status proyek](./STATUS.md). Ini menutup G0 untuk pilot, bukan mengesahkan formula billing produksi atau membuktikan kesiapan teknis pilot.

### Pekerjaan

- [x] Sahkan batas pilot: rute CD112 di Wilayah Pelayanan 5, 1–7 November 2026, 20–30 sambungan, satu petugas/HP Android, hasil shadow-only.
- [x] Sahkan aturan kondisi pembacaan konservatif, akses OTP warga, kiriman mandiri anonim/akun, bukti foto/GPS, retensi, dan koreksi manual.
- [x] Tetapkan akuntabilitas G0 pada Wiska Prayoga; pengawas koreksi harus berbeda dari petugas dan ditunjuk sebelum pilot.
- Sebelum billing resmi, sahkan [codebook kondisi catat](./CODEBOOK.md), pemakaian minimum, tarif/pembulatan, `pakai_drd`, serta rekonsiliasi beberapa periode dan sumber asli. Aturan pilot tidak mengesahkan formula billing produksi.
- Sebelum go-live, tetapkan retensi catatan audit resmi, SLO/SLA, volume puncak, RPO/RTO, dan proses koreksi pasca-tagihan.
- **Pra-pilot (belum selesai):** tetapkan petugas dan daftar sambungan, tunjuk akun supervisor, buktikan data pilot terisolasi dari closing/tagihan, periksa sumber nomor HP terverifikasi untuk OTP, publikasikan pemberitahuan, siapkan prosedur penghapusan/anonimisasi, dan luluskan seluruh gerbang teknis.

### Exit gate kebijakan pilot

- Keputusan G0 khusus pilot telah tercatat di [status proyek](./STATUS.md).
- Output pilot tetap shadow-only; tidak ada keputusan di tahap ini yang memberi izin menerbitkan atau mengubah tagihan resmi.
- **Status:** lulus untuk keputusan pilot; pekerjaan pra-pilot dan baseline billing produksi tetap menjadi blocker di tahap berikutnya.

## Tahap 1 — tutup vertical slice MVP

**Tujuan:** menyelesaikan satu alur dari tugas sampai hasil resmi, termasuk warga.

### Pekerjaan

- Pastikan daftar kerja, autentikasi/otorisasi petugas, dan endpoint baca harian konsisten dengan penugasan/rute.
- Selesaikan offline outbox, ID operasi/idempotensi, hash payload, per-item result, retry/checkpoint attachment, dan konflik yang dapat dipulihkan.
- Pastikan jalur petugas dan warga hanya membuat satu `PembacaanMeter` resmi melalui validasi workflow yang sama.
- Selesaikan uji akses object-level, validasi meter aktif/pelanggan/periode, race pada verify/reject/closing, dan audit before/after.
- Implementasikan matriks per kondisi: `NORMAL` memakai delta; 14 anomali memakai prioritas taksasi rata-rata 12 bulan → 3 pemakaian terbesar → 3 bulan terakhir/riwayat tersedia, dibulatkan ke atas tanpa minimum; kondisi lain dicatat aktual atau ditahan untuk review; nilai minus tidak dijepit menjadi nol. Manual ADD tetap opsi jika rute/periode tidak tercatat.
- Sesuaikan verifikasi satuan/massal dengan kontrak ring berbasis aktor: V2/V3 boleh langsung memproses tanpa ring bawah; V2 menunggu V3 dan V3 membuat hasil resmi. Ikon menampilkan hanya ring terakhir, sedangkan audit mempertahankan histori.
- Tutup gap pada [audit ring verifikasi dan koreksi](./VERIFIKASI.md): larang self-reopen V1/V2; sediakan koreksi administratif STAFF hanya sebelum Tagihan dan hanya pada hasil yang belum resmi atau sedang di-reopen (DEC-06; syarat tambahan OPEN-09). Izin final closing STAFF belum disepakati (OPEN-01): implementasikan hanya setelah diputuskan; sampai itu final closing mengikuti implementasi yang ada (klaim dokumen: `SENIOR_UP`).
- Tutup pengalaman warga: jadwal server, linked account constraint, pending/reject/retry, foto terpisah, dan akses minimal terhadap data.
- Uji kasus rollover, meter diganti, meter rusak, rumah terkunci, stand nol/abnormal; aturan yang belum disetujui tetap ke review manual.
- Berikan laporan rekonsiliasi dan tampilan pengecualian sebelum closing.

### Exit gate

- Semua kriteria P0 pada [Definisi MVP](./MVP.md) lulus di test otomatis dan staging.
- Tidak ada duplikasi hasil resmi saat retry atau race yang diuji.
- Semua perbedaan konsumsi memiliki provenance/alasan atau disposition review yang disetujui.

### Backlog lanjutan di luar pilot

- **Koreksi workflow Manual Add (aktif):** Manual Add satuan dapat mengganti hasil yang sudah melewati verifikasi hanya pada periode terbuka dan sebelum hasil masuk Tagihan; penggantian wajib beralasan, diaudit before/after, mereset ring, dan mengembalikan laporan ke verifikasi. Manual Add All memfilter Petugas lalu Rute, langsung menampilkan alamat belum disetorkan, menghitung taksasi otomatis, menambahkan hanya pilihan checkbox, serta melaporkan progres batch tersimpan. Rilis tetap menunggu validasi integrasi role/duplikat/race, migration staging, dan uji hasil Manual melalui V1/V2/V3.
- Histori semua jalur taksasi memakai `Tagihan.pemakaianM3` nonnegatif, termasuk nilai override/minimum; Manual Add All menggunakan 12 bulan tagihan, tiga nilai tertinggi, atau seluruh histori yang tersedia. ST Awal dan ST Akhir sama, menggunakan `standAkhir` dari pembacaan resmi terakhir sebelum periode berjalan (DEC-01; bukan `standLalu`). Jika tidak ada histori tagihan tetapi stand resmi sebelumnya dan meter aktif tersedia, usulkan 5 m³ sesuai minimum Perdir; jika stand atau meter aktif tidak tersedia, tandai Perlu Ditinjau dan jangan izinkan baris dipilih/dikirim (DEC-02). No-history untuk 14 kondisi otomatis tetap OPEN-02. Hasil Manual Add tetap menunggu verifikasi; `MANUAL_ADD` pada hasil resmi mengecualikannya dari histori taksasi berikutnya.
- Tetapkan dan uji batas kewajaran/manual-review atas angka ekstrem sebelum rilis produksi; jangan menerbitkan atau menagihkan taksasi otomatis sebelum alur verifikasi.

### Kemajuan implementasi tercatat 2 November 2026

- Filter sumber laporan di halaman Verifikasi Petugas tersedia untuk Petugas, Mandiri, Manual Add satuan, dan Manual Add All; filter diterapkan pada endpoint daftar, bukan hanya pada baris yang sedang dimuat.
- Ikon sumber Mandiri/Manual Add berada di kiri angka ST Akhir, dengan warna berbeda dan label tooltip; label teks sumber di kolom Ket Catat dihapus. Kode rute snapshot/fallback ditampilkan pada rincian pencatatan Info Pelanggan.
- Perbaikan pemetaan petugas Manual Add satuan dan sinkronisasi Mandiri beserta fallback penugasan rute telah masuk repository.
- Bukti lokal: commit `a3028f3` (filter dan ikon), commit `44f575a` (pembaruan Manual Add, Mandiri, panel verifikasi, halaman konsumen, rincian rute); `pnpm build`, `pnpm typecheck`, Prettier, `git diff --check`, dan 7 tes `LaporanMandiri.router.test.ts` lulus pada 2 November. E2E Manual Add terhenti sebelum tes berjalan akibat argumen direktori yang salah pada `webServer` Playwright; lint terblokir karena dukungan TypeScript 7 belum tersedia.
- **Dampak fase:** ini adalah progres implementasi dan validasi lokal pada bagian dari Tahap 1/backlog Manual Add. Exit gate Tahap 1 serta G1–G3 tetap terbuka sampai tes E2E/integrasi, role/race, staging, dan prasyarat lain pada gate terkait memiliki bukti yang disyaratkan. Jadwal pilot juga tetap tunduk pada OPEN-16; tidak ada go/no-go baru yang dicatat.

## Tahap 2 — migration dan readiness staging

**Tujuan:** membuktikan perubahan aman terhadap database dan operasi mendekati nyata.

### Pekerjaan

- Review draft `KirimanLaporanMandiri` migration, foreign key, backfill, unique index, trigger append-only, pemulihan object yatim, dan kebijakan penghapusan.
- Jalankan preflight duplikasi meter/nomor meter dan analisis data di salinan staging; rekam jumlah sebelum/sesudah dan exceptions.
- Uji migration dari versi schema saat ini, waktu/lock, rollback atau forward-fix, serta deploy aplikasi dan migration dengan kredensial terpisah.
- Uji integrasi konkurensi PostgreSQL untuk duplicate submit, kirim ulang setelah reject, approve bersamaan, meter aktif, dan closing.
- Jalankan pengujian beban rute/batch, upload, connection pool, dan query plans menggunakan volume representatif.
- Terapkan observability, dashboards, alert, request/correlation ID, health/readiness, dan runbook.
- Uji backup restore, disaster recovery, secret rotation, storage privacy, dan hak akses.

### Exit gate

- Migration lulus di staging dan hasil preflight disetujui pemilik data; belum ada penerapan produksi otomatis.
- Backup restore dan rollback/recovery drill terdokumentasi.
- Pengujian keamanan/otorisasi negatif dan tes beban tidak memiliki blocker yang belum diterima secara tertulis.

## Tahap 3 — pilot lapangan terbatas

**Tujuan:** memvalidasi produk, kualitas data, dan kesiapan tim dengan risiko terbatasi.

**Catatan jadwal per 1 November 2026:** jadwal pilot 1–7 November disetujui pada G0, tetapi prasyarat pra-pilot dan gerbang G1–G3 belum tercatat lulus dan tidak ada bukti go/no-go. Roadmap tidak menetapkan tanggal baru; penundaan formal atau bukti kelulusan: OPEN-16.

### Pekerjaan

- Jalankan pada area/periode/jumlah sambungan dan petugas yang disetujui.
- Jalankan operasi paralel atau rekonsiliasi manual terhadap sumber lama sesuai keputusan billing.
- Pantau sync success, backlog, duplicate/conflict, kualitas foto, waktu verifikasi, perbedaan konsumsi, koreksi, dan tiket support.
- Catat gangguan jaringan/perangkat, kegagalan upload, item dead-letter, keberhasilan pemulihan, dan semua tindakan manual.
- Adakan review berkala dengan petugas, supervisor, billing, warga/support, keamanan, dan pemilik produk.

### Exit gate

- Kriteria berhasil MVP terpenuhi pada [Definisi MVP](./MVP.md).
- Selisih hasil/tagihan dan tindak lanjut mempunyai disposition dari pemilik proses.
- Tidak ada insiden keamanan/data integrity yang belum ditangani; rencana operasi dan support terbukti berjalan.
- Pemilik produk dan billing menandatangani go/no-go untuk rilis berikutnya.

## Tahap 4 — koreksi hasil pasca-tagihan dan kontrol billing

**Tujuan:** mendukung koreksi formal tanpa mengubah histori tagihan atau ledger secara tak terkendali.

### Pekerjaan

- Model revisi pembacaan append-only dengan nilai lama/baru, alasan, bukti, pembuat, pemeriksa, cap waktu, versi aturan, dan referensi invoice terdampak.
- Definisikan role Bagian Langganan, pemisahan tugas, quorum/approval bila perlu, eskalasi, pembatalan, dan batas periode.
- Tentukan apakah output koreksi berupa perbedaan pembacaan saja, nota, debit/kredit, saldo, refund, atau koreksi pada siklus berikut; libatkan pemilik billing/keuangan.
- Implementasi idempotent adjustment dan rekonsiliasi dengan pembayaran hanya setelah aturan akuntansi dan integrasi disahkan.
- Uji invariants bahwa tagihan lama tidak diubah, adjustment tidak ganda, dan setiap nilai dapat direkonstruksi.

### Exit gate

- Kebijakan tertulis disahkan pemilik billing/keuangan dan operasional.
- Uji end-to-end correction termasuk approval, invoice sudah dibayar/belum dibayar, reversal, retry, audit, dan rekonsiliasi lulus.
- Pelatihan operator dan laporan kontrol tersedia.

## Tahap 5 — produksi dan kesiapan komersial

**Tujuan:** memperluas operasi dengan pengendalian reliabilitas, privasi, dukungan, dan perubahan.

### Pekerjaan

- Lakukan security review dan penetration test yang terotorisasi; remediasi temuan sesuai severity.
- Tetapkan SLO, jam support, escalation path, incident response, status page, release/rollback, perubahan schema, dan disaster recovery.
- Uji kapasitas dan rencana scale berdasarkan volume yang disepakati; pantau koneksi DB, query, storage, queue, dan worker.
- Sahkan DPIA/privacy review dan ketentuan penggunaan foto/GPS/kontak sesuai hukum dan kontrak yang berlaku.
- Kurangi risiko konsentrasi akuntabilitas: tunjuk reviewer independen untuk sign-off produksi dan keputusan berisiko tinggi.
- Siapkan onboarding organisasi/area, konfigurasi, pelatihan, dokumentasi operator/pelanggan, SLA, support, dan proses upgrade.
- Perluas per wilayah secara bertahap dengan canary dan review pasca-rilis.

### Exit gate

- Semua blocker produksi ditutup atau diterima oleh risk owner yang berwenang.
- Operasi restore, incident, rollback, on-call/support, dan rilis telah diuji.
- Persetujuan produk, engineering, keamanan, operasi, billing, dan bisnis tersedia.

## Snapshot kesiapan berdasarkan repository (diperbarui 2 November 2026)

Ini snapshot pekerjaan kode, bukan penilaian audit independen baru.

| Area | Status saat ini | Bukti / pekerjaan berikutnya |
|---|---|---|
| Keputusan G0 pilot | Selesai untuk scope dan kebijakan pilot | Disetujui Wiska Prayoga 31 Oktober 2026; supervisor, OTP, pemberitahuan, acceptance criteria, dan staging tetap prasyarat mulai pilot. |
| Arsitektur dan scope air | Sebagian besar dirancang | Dokumen menyelaraskan sumber model aktual; validasi kebutuhan operasional masih diperlukan. |
| Laporan mandiri dan jendela tanggal | Implementasi awal tersedia | Backend memakai periode WIB, arsip kiriman, UI jadwal, dan halaman admin; uji integrasi dan hak akses di staging masih perlu dilakukan. |
| Skema dan migration arsip | Model Prisma dan migration sudah ada di repository; penerapan database belum diverifikasi | Review migration, jalankan preflight konflik, lalu uji pada staging yang representatif. Keberadaan file migration bukan bukti bahwa staging atau produksi sudah dimigrasikan. STATUS menyebut migration "diterapkan ke Neon" tanpa label lingkungan (OPEN-17); itu tidak mengubah status "belum diverifikasi" untuk staging/produksi. |
| Pembacaan resmi petugas/warga | Alur existing dan perubahan awal tersedia | Buktikan semua jalur serta retry/race memakai aturan dan model canonical yang sama. |
| Offline sync/idempotensi | Belum dinyatakan selesai | Tetapkan kontrak event, payload hash, checkpoint, attachment resume, konflik, dan test lapangan. |
| Data legacy dan formula pemakaian | Aturan konservatif pilot disahkan; billing produksi belum | Satu periode CSV menemukan banyak delta stand/tagih berbeda; perlu codebook produksi, data lintas periode, dan sign-off sebelum hasil dipakai untuk tagihan. |
| Koreksi pasca-tagihan/financial adjustment | Belum diimplementasikan | Tentukan maker-checker, kebijakan billing, invoice terbayar, nota, saldo, dan refund. |
| Test dan build | `pnpm build`, `pnpm typecheck`, Prettier, `git diff --check`, dan 7 tes Mandiri lulus lokal 2 November 2026; bukan bukti staging. | E2E Manual Add belum berjalan karena konfigurasi Playwright `webServer`; lint terblokir oleh kompatibilitas TypeScript 7; lanjutkan tes integrasi, concurrency, security, performance, restore, dan CI sesuai gate. |
| Readiness produksi komersial | Belum tercapai | Lengkapi semua exit gate di atas, termasuk operasi, support, privasi, keamanan, dan penerapan database. |

## Cadence dan pengelolaan

- Wiska Prayoga adalah pemilik akuntabilitas G0 untuk produk, data/billing, engineering, keamanan/privasi, dan operasi; perangkapan ini dicatat sebagai risiko tata kelola.
- Sebelum pilot, tunjuk Supervisor Operasional/Admin Utama dengan akun tersendiri, berbeda dari petugas lapangan.
- Engineering mengelola migration, kontrak API, test, dan release gate; Operations menyiapkan pilot, monitoring, restore, support, dan incident response.
- Review roadmap setelah setiap exit gate; perubahan lingkup/target harus memperbarui PRD dan Definisi MVP.
