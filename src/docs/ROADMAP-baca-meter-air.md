# Roadmap — Aplikasi Baca Meter Air

**Versi:** 0.1 (roadmap berbasis release gate)
**Tanggal:** 31 Oktober 2026
**Status:** urutan kerja usulan; tidak menjanjikan tanggal rilis
**Dokumen terkait:** [PRD](./PRD-baca-meter-air.md), [Definisi MVP](./MVP-baca-meter-air.md), [Arsitektur](./arsitektur-awal-baca-meter.md)

## Prinsip roadmap

- Urutkan pekerjaan berdasarkan risiko operasional dan integritas tagihan, bukan jumlah halaman.
- Jangan menetapkan tanggal sebelum pemilik, kapasitas, dependensi, dan hasil audit data diketahui.
- Tiap fase harus punya evidence-based exit gate; build sukses saja bukan gate produksi.
- Pisahkan pilot, produksi awal, dan peluncuran pasar. Kesiapan teknis tidak otomatis berarti kesiapan operasional, dukungan, kontrak, atau kepatuhan.
- Perubahan database dilakukan lewat migration yang direview; jangan mengasumsikan draft migration sudah diterapkan.

## Tahap 0 — putuskan kebijakan dan garis dasar data

**Tujuan:** hilangkan asumsi yang dapat mengubah angka resmi/tagihan.

### Pekerjaan

- Sahkan PRD, persona, lingkup MVP, area pilot, pemilik keputusan, dan ukuran sukses.
- Minta codebook legacy dan pemilik data menjelaskan kondisi kunjungan, `pakai_drd`, tarif, pembulatan, pemakaian nol/negatif, meter diganti/rollover, dan taksiran.
- Rekonsiliasi beberapa periode serta sumber asli; sampel satu periode tidak cukup untuk mengesahkan rumus.
- Tentukan otoritas Bagian Langganan, pembuat/pemeriksa koreksi, dan apakah koreksi memengaruhi tagihan, saldo, pembayaran, nota, atau refund.
- Tetapkan kebijakan identitas warga, klaim `LanggananWarga`, upload anonim, foto/GPS, retensi, consent/pemberitahuan, dan dukungan.
- Tentukan rute/perangkat pilot, beban puncak, SLA/SLO, RPO/RTO, pemilik incident, dan rollback.

### Exit gate

- Keputusan bisnis, data, privasi, koreksi, dan sign-off billing tercatat.
- Tidak ada kode legacy penting yang diam-diam dipetakan atau aturan konsumsi yang dianggap benar tanpa bukti.
- Data sumber pilot dan proses rekonsiliasi dapat diakses oleh pemilik yang ditunjuk.

## Tahap 1 — tutup vertical slice MVP

**Tujuan:** menyelesaikan satu alur dari tugas sampai hasil resmi, termasuk warga.

### Pekerjaan

- Pastikan daftar kerja, autentikasi/otorisasi petugas, dan endpoint baca harian konsisten dengan penugasan/rute.
- Selesaikan offline outbox, ID operasi/idempotensi, hash payload, per-item result, retry/checkpoint attachment, dan konflik yang dapat dipulihkan.
- Pastikan jalur petugas dan warga hanya membuat satu `PembacaanMeter` resmi melalui validasi workflow yang sama.
- Selesaikan uji akses object-level, validasi meter aktif/pelanggan/periode, race pada verify/reject/closing, dan audit before/after.
- Tutup pengalaman warga: jadwal server, linked account constraint, pending/reject/retry, foto terpisah, dan akses minimal terhadap data.
- Uji kasus rollover, meter diganti, meter rusak, rumah terkunci, stand nol/abnormal; aturan yang belum disetujui tetap ke review manual.
- Berikan laporan rekonsiliasi dan tampilan pengecualian sebelum closing.

### Exit gate

- Semua kriteria P0 pada [Definisi MVP](./MVP-baca-meter-air.md) lulus di test otomatis dan staging.
- Tidak ada duplikasi hasil resmi saat retry atau race yang diuji.
- Semua perbedaan konsumsi memiliki provenance/alasan atau disposition review yang disetujui.

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

### Pekerjaan

- Jalankan pada area/periode/jumlah sambungan dan petugas yang disetujui.
- Jalankan operasi paralel atau rekonsiliasi manual terhadap sumber lama sesuai keputusan billing.
- Pantau sync success, backlog, duplicate/conflict, kualitas foto, waktu verifikasi, perbedaan konsumsi, koreksi, dan tiket support.
- Catat gangguan jaringan/perangkat, kegagalan upload, item dead-letter, keberhasilan pemulihan, dan semua tindakan manual.
- Adakan review berkala dengan petugas, supervisor, billing, warga/support, keamanan, dan pemilik produk.

### Exit gate

- Kriteria berhasil MVP terpenuhi pada [Definisi MVP](./MVP-baca-meter-air.md).
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
- Siapkan onboarding organisasi/area, konfigurasi, pelatihan, dokumentasi operator/pelanggan, SLA, support, dan proses upgrade.
- Perluas per wilayah secara bertahap dengan canary dan review pasca-rilis.

### Exit gate

- Semua blocker produksi ditutup atau diterima oleh risk owner yang berwenang.
- Operasi restore, incident, rollback, on-call/support, dan rilis telah diuji.
- Persetujuan produk, engineering, keamanan, operasi, billing, dan bisnis tersedia.

## Snapshot kesiapan berdasarkan repository (31 Oktober 2026)

Ini snapshot pekerjaan kode, bukan penilaian audit independen baru.

| Area | Status saat ini | Bukti / pekerjaan berikutnya |
|---|---|---|
| Arsitektur dan scope air | Sebagian besar dirancang | Dokumen menyelaraskan sumber model aktual; validasi kebutuhan operasional masih diperlukan. |
| Laporan mandiri dan jendela tanggal | Implementasi awal tersedia | Backend memakai periode WIB, arsip kiriman, UI jadwal, dan halaman admin; uji integrasi dan hak akses di staging masih perlu dilakukan. |
| Skema dan migration arsip | Draft tersedia, belum terbukti di DB | Prisma validate/build lulus, tetapi migration harus direview, dipreflight, dan diuji di staging sebelum dijalankan. |
| Pembacaan resmi petugas/warga | Alur existing dan perubahan awal tersedia | Buktikan semua jalur serta retry/race memakai aturan dan model canonical yang sama. |
| Offline sync/idempotensi | Belum dinyatakan selesai | Tetapkan kontrak event, payload hash, checkpoint, attachment resume, konflik, dan test lapangan. |
| Data legacy dan formula pemakaian | Belum disahkan | Satu periode CSV menemukan banyak delta stand/tagih berbeda; perlu codebook, data lintas periode, dan sign-off pemilik. |
| Koreksi pasca-tagihan/financial adjustment | Belum diimplementasikan | Tentukan maker-checker, kebijakan billing, invoice terbayar, nota, saldo, dan refund. |
| Test dan build | Build lulus, test ada | `pnpm test` menjalankan 60 tes; tetap tambahkan integration/concurrency/security/performance/restore test. |
| Readiness produksi komersial | Belum tercapai | Lengkapi semua exit gate di atas, termasuk operasi, support, privasi, keamanan, dan penerapan database. |

## Cadence dan pengelolaan

- Tunjuk satu **Product Owner** untuk keputusan dan prioritas.
- Tunjuk **Data/Billing Owner** untuk codebook, formula, closing, dan koreksi uang.
- Engineering lead mengelola migration, kontrak API, test, dan release gate.
- Security/privacy owner meninjau akses, data sensitif, retention, dan threat model.
- Operations lead memiliki pilot, monitoring, restore, support, dan incident response.
- Review roadmap setelah setiap exit gate; perubahan lingkup/target harus memperbarui PRD dan Definisi MVP.
