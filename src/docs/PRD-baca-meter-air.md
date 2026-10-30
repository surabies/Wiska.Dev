# PRD — Aplikasi Baca Meter Air

**Versi:** 0.1 (draft untuk validasi pemilik produk)
**Tanggal:** 31 Oktober 2026
**Status:** rancangan kebutuhan; bukan persetujuan kebijakan tarif atau billing
**Dokumen terkait:** [Definisi MVP](./MVP-baca-meter-air.md), [Roadmap](./ROADMAP-baca-meter-air.md), [Arsitektur](./arsitektur-awal-baca-meter.md)

## 1. Ringkasan produk

Aplikasi ini membantu operator layanan air mengelola pembacaan meter dari penugasan sampai hasil yang siap dipakai dalam proses penagihan. Sistem menghubungkan pekerjaan petugas lapangan, laporan mandiri warga, verifikasi, hasil pembacaan resmi, dan jejak audit tanpa mencampur bukti mentah dengan data tagihan.

Produk dibangun di atas aplikasi yang sudah ada: Next.js untuk dashboard, Hono untuk API, PostgreSQL/Prisma untuk data, serta klien lapangan yang perlu tetap bekerja saat jaringan terbatas. Aplikasi tidak menggantikan sistem pembayaran, penetapan tarif, atau ledger keuangan kecuali ada keputusan dan ruang lingkup terpisah.

## 2. Masalah dan peluang

- Pencatatan lapangan dapat terganggu jaringan dan memerlukan bukti yang dapat ditinjau.
- Laporan warga dan petugas perlu masuk melalui jalur berbeda, tetapi hanya boleh menghasilkan satu hasil pembacaan resmi per meter/periode.
- Angka stand, pemakaian riil, dan pemakaian yang ditagihkan tidak selalu sama. CSV sampel periode `202601` menunjukkan 9.946 dari 22.549 baris memiliki `pakai_drd` berbeda dari `stma - stml`; perbedaan ini perlu dijelaskan, bukan dihapus dengan asumsi.
- Pengguna internal perlu dapat memeriksa sumber, perubahan, alasan, dan bukti pembacaan.
- Koreksi setelah tagihan terbit memerlukan perlindungan terhadap perubahan historis dan keputusan terpisah tentang dampak keuangan.

## 3. Tujuan, bukan tujuan, dan hasil bisnis

### Tujuan

1. Menghasilkan catatan pembacaan yang dapat ditelusuri ke sambungan, meter, periode, sumber, bukti, dan aktor.
2. Memungkinkan petugas mencatat di lapangan dengan dukungan kondisi jaringan buruk, kemudian menyinkronkan tanpa kehilangan atau menggandakan operasi.
3. Menerima laporan mandiri pada jendela yang dikonfigurasi; laporan tersebut tetap menunggu pemeriksaan sebelum menjadi resmi.
4. Menyatukan hasil resmi pada model `PembacaanMeter` yang menjadi sumber downstream.
5. Membuat status antrean dan koreksi dapat dipahami operator serta dapat diaudit.

### Bukan tujuan fase awal

- Mengganti core billing, payment gateway, atau pencatatan akuntansi.
- Menghitung nota debit/kredit, saldo kredit, refund, atau ledger koreksi tanpa kebijakan yang disahkan.
- Menjamin kepemilikan sambungan hanya dari tautan `LanggananWarga`; tautan tersebut adalah klaim asosiasi, bukan verifikasi identitas.
- Menetapkan sendiri rumus taksiran, pemakaian minimum, arti kode legacy, atau kebijakan tarif.
- Mengubah layanan air menjadi sistem kelistrikan.

### Ukuran keberhasilan yang diusulkan

Target berikut adalah usulan untuk disahkan sebelum pilot; jangan dianggap sebagai SLA yang sudah dijanjikan.

| Ukuran | Target awal | Cara mengukur |
|---|---:|---|
| Pembacaan yang menjadi resmi memiliki sambungan, meter, periode, sumber, dan aktor valid | 100% | Rekonsiliasi tabel sumber dengan `PembacaanMeter` |
| Percobaan sinkronisasi ulang dengan identitas dan payload sama membuat duplikat resmi | 0 | Uji retry dan pemeriksaan unique key |
| Aksi approve/reject/koreksi tercatat dengan aktor dan waktu | 100% | Audit sampling dan query audit |
| Permintaan lintas akun/rute yang tidak berwenang berhasil | 0 | Pengujian negatif per endpoint dan role |
| Selisih data impor yang belum terjelaskan saat closing pilot | 0 baris tanpa keputusan | Laporan rekonsiliasi, bukan memaksa seluruh delta sama |
| Kiriman laporan mandiri yang diterima tetapi tidak tampak di antrean petugas | 0 | Rekonsiliasi intake, arsip kiriman, dan antrean |

## 4. Pengguna dan kebutuhan

| Peran | Kebutuhan utama |
|---|---|
| Petugas pencatat | Melihat daftar kerja yang ditugaskan; mencatat stand, kondisi kunjungan, waktu, lokasi bila diizinkan, dan bukti; melihat status sinkronisasi dan konflik. |
| Verifikator/supervisor | Meninjau kiriman warga/petugas, membandingkan bukti dan histori, menolak dengan alasan, atau menyetujui hasil sesuai wewenang. |
| Bagian Langganan | Menelusuri sambungan dan mengajukan koreksi hasil setelah tagihan terbit. Hak menyetujui koreksi, periode berlakunya, dan akibat billing masih perlu disahkan. |
| Admin sistem | Mengatur jendela laporan, akses, dan konfigurasi; perubahan kritis harus terotorisasi dan tercatat. |
| Warga/pelanggan | Mengirim stand serta foto dalam periode yang dibuka, melihat status kiriman, dan menerima instruksi jika kiriman ditolak. Satu akun dapat mempunyai beberapa sambungan tertaut. |
| Pengelola operasional/billing | Memastikan hasil yang dipakai closing dapat direkonsiliasi dan mengetahui pengecualian sebelum tagihan diterbitkan. |

## 5. Alur produk utama

1. Operator membuka periode dan daftar kerja/rute berdasarkan data pelanggan serta meter yang berlaku.
2. Petugas mengunduh tugas; aplikasi lapangan menyimpan pekerjaan lokal bila offline, lalu mengirimnya dengan identitas operasi yang idempoten saat koneksi tersedia.
3. Warga mengirim laporan lewat jalur publik anonim atau jalur akun. Periode dihitung server dengan zona waktu WIB. Jalur akun hanya boleh mengirim untuk sambungan yang tertaut; laporan anonim tidak dianggap bukti kepemilikan.
4. Kedua jenis laporan masuk antrean sesuai sumber. Kiriman, foto, dan percobaan ulang disimpan sebagai bukti; retry tidak boleh mengganti bukti sebelumnya.
5. Petugas/verifikator meninjau sambungan, meter, periode, stand, foto, kondisi, dan anomali. Kiriman warga tidak langsung menjadi hasil resmi.
6. Setelah validasi, sistem membuat/memperbarui satu `PembacaanMeter` resmi. Data stand, pemakaian riil, pemakaian tagih, sumber, metode, dan alasan harus tetap dapat dibedakan.
7. Proses closing/tagihan menggunakan hasil resmi sesuai aturan yang berlaku. Koreksi tidak menulis ulang tagihan historis secara diam-diam.
8. Bila perlu koreksi pasca-terbit, simpan pengajuan dan histori perubahan. Dampak ke tagihan/pembayaran ditangani hanya setelah workflow dan kebijakan finansial disetujui.

## 6. Kebutuhan fungsional dan kriteria penerimaan

Prioritas: **P0** = wajib sebelum pilot; **P1** = wajib sebelum penggunaan produksi berskala; **P2** = pengembangan lanjutan.

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | P0 | Mendukung beberapa sambungan untuk satu akun warga. | Akun dapat memilih sambungan tertaut; API menolak ID sambungan yang tidak tertaut ke akun aktif. Tautan tidak ditampilkan sebagai verifikasi identitas. |
| FR-02 | P0 | Menyediakan jendela laporan mandiri yang dapat diatur. | Admin berwenang membaca/mengubah tanggal 1–28; tanggal buka tidak melewati tanggal tutup; perubahan kedua nilai atomik; periode dan tanggal menggunakan WIB; UI publik menampilkan nilai server. |
| FR-03 | P0 | Memisahkan jalur laporan mandiri anonim dan akun. | Jalur anonim tetap pending; jalur akun memerlukan role warga dan tautan sambungan; keduanya menyimpan ke model antrean canonical yang sama. |
| FR-04 | P0 | Menyimpan bukti setiap percobaan kirim. | Kirim pertama dan kirim ulang mempunyai arsip/foto terpisah; retry/status konflik tidak menimpa arsip lama. |
| FR-05 | P0 | Memastikan verifikasi adalah gerbang hasil resmi. | Sebelum verifikasi tidak ada pembacaan resmi/tagihan dari kiriman mandiri; verifikasi memastikan sambungan, meter aktif, periode, status antrean, dan aktor secara konsisten. |
| FR-06 | P0 | Menggunakan satu model hasil resmi untuk semua sumber. | Petugas dan warga menghasilkan `PembacaanMeter`; constraint mencegah duplikasi resmi untuk kunci domain yang disahkan. Sumber dan nilai terukur/tagih tetap dapat dibedakan. |
| FR-07 | P0 | Menangani nilai tidak wajar tanpa menyamarkan data. | Stand negatif, pecahan, mundur, atau melebihi kapasitas ditolak/ditahan untuk review sesuai aturan; rollover/penggantian meter tidak otomatis menjadi nol. |
| FR-08 | P0 | Mengotorisasi objek, bukan hanya endpoint. | Uji negatif membuktikan role, akun, penugasan/rute, periode, dan sambungan yang tidak berhak tidak bisa dibaca/diubah. |
| FR-09 | P0 | Menyediakan audit tindakan kritis. | Approve/reject, pengubahan hasil, konfigurasi jendela, dan closing mencatat aktor, waktu server, referensi objek, alasan, serta before/after yang diperlukan. |
| FR-10 | P0 | Mengelola koreksi pasca-tagihan tanpa mengubah dokumen lama. | Sebelum rilis billing terkait, pemilik produk menyetujui pembuat/pemeriksa, alasan, bukti, revisi append-only, dan perlakuan tagihan terdampak; invoice historis tetap dapat direkonstruksi. |
| FR-11 | P1 | Sinkronisasi lapangan aman terhadap offline/retry. | Operasi memiliki ID idempotensi dan hash payload; retry identik menghasilkan hasil yang sama; ID sama dengan payload berbeda menjadi konflik; setiap item batch memiliki status yang dapat dipulihkan. |
| FR-12 | P1 | Menyediakan observabilitas operasi. | Operator dapat menemukan backlog, kegagalan sinkronisasi/upload, error closing, dan perubahan kritis melalui log/metric/alert tanpa menampilkan rahasia atau data pribadi berlebih. |
| FR-13 | P2 | Mendukung analisis kualitas pembacaan. | Laporan pemakaian nol/ekstrem/koreksi dapat dipilah berdasarkan periode, rute, kondisi, sumber, dan versi aturan tanpa menyamakan semua perbedaan dengan kesalahan. |

## 7. Aturan domain yang harus dijaga

- Identitas pelanggan/sambungan, meter fisik, penempatan meter sepanjang waktu, periode, kiriman, hasil resmi, dan tagihan adalah konsep berbeda.
- `nometer` tidak diasumsikan unik: rekonsiliasi satu CSV menemukan 471 duplikasi tambahan.
- `pemakaianRiil` dan `pemakaianM3` tidak boleh disamakan; data sampel menunjukkan perbedaan signifikan.
- Baris intake tidak menjadi hasil resmi sebelum workflow yang berwenang selesai.
- Periode resmi ditetapkan oleh server; waktu operasional laporan mandiri menggunakan WIB.
- Invoice yang sudah terbit tidak ditulis ulang oleh koreksi hasil baca.
- Label mentah legacy disimpan; kode yang belum memiliki codebook tidak diterjemahkan dengan tebakan.
- Status akhir, periode terkunci, atau nilai tagih tidak boleh dapat diubah hanya dengan menyembunyikan tombol UI; API dan database tetap menjaga invariant.

## 8. Kebutuhan nonfungsional yang perlu disepakati

Angka di bawah adalah kandidat awal, perlu diuji dengan pola beban dan infrastruktur nyata sebelum dijadikan SLO.

| Area | Kandidat persyaratan |
|---|---|
| Ketersediaan | SLO layanan dashboard/API disepakati berdasarkan jam operasional; monitor ketersediaan dan lama pemulihan. |
| Kinerja | API daftar/lookup umum p95 < 500 ms dan operasi tulis p95 < 1 s pada beban pilot, tidak termasuk upload file; ukur dengan data representatif. |
| Sinkronisasi | Batch dapat diulang parsial, melaporkan hasil per item, dan tidak kehilangan data lokal sebelum server mengonfirmasi penerimaan. |
| Keamanan | TLS, least privilege, secret management, rate limit endpoint publik, object-level authorization, backup terenkripsi, dan pencabutan akses. |
| Auditabilitas | Waktu server dan actor tercatat untuk aksi bernilai bisnis; log operasional punya correlation/request ID. |
| Privasi | Minimasi identitas, foto, kontak, dan GPS; tujuan pemrosesan, izin, retensi, akses, serta penghapusan disahkan sebelum pilot. |
| Pemulihan | RPO/RTO ditetapkan; backup/PITR diuji dengan restore drill ke lingkungan terisolasi. |
| Kompatibilitas | Browser/perangkat target, versi OS, penggunaan offline, batas upload, dan kebijakan pembaruan aplikasi ditentukan sebelum pilot. |

## 9. Risiko dan dependensi

1. **Aturan konsumsi lama belum dipahami:** butuh pemilik data, codebook, lebih banyak periode, dan sampel hasil yang dapat dijelaskan.
2. **Koreksi setelah tagihan terbit belum lengkap:** tanpa keputusan billing tidak boleh ada klaim otomatisasi koreksi finansial.
3. **Tautan akun tidak membuktikan kepemilikan:** risiko laporan atas sambungan pihak lain tetap membutuhkan prosedur verifikasi petugas.
4. **Histori aset meter dan data legacy:** preflight, deduplikasi, dan pemetaan harus selesai sebelum constraint atau backfill diterapkan.
5. **Kualitas jaringan/perangkat:** sinkronisasi offline, foto tertunda, jam perangkat, dan retry harus diuji di lapangan.
6. **Ketersediaan tim operasional:** perlu penanggung jawab support, eskalasi, rollback, restore, dan rekonsiliasi manual.

## 10. Keputusan yang menunggu pemilik produk

- Siapa tepatnya aktor “Bagian Langganan”; siapa boleh mengajukan dan siapa boleh menyetujui koreksi?
- Apakah koreksi setelah invoice terbit hanya catatan revisi, atau memicu nota debit/kredit, saldo,/refund? Jika ya, kebijakan akuntansi dan rekonsiliasi apa yang berlaku?
- Definisi resmi kondisi kunjungan/kode legacy termasuk `DK`, `MTA`, `TTB`, `BMK/BMB`, dan `MB`.
- Rumus taksiran, batas pemakaian, pembulatan, minimum charge, dan sumber tarif yang berlaku.
- Apakah warga perlu bukti kepemilikan sambungan, OTP, atau verifikasi lain sebelum self-service dipercaya?
- Jendela retensi foto, kontak, GPS, dan catatan audit; dasar persetujuan/pemberitahuan kepada warga.
- Wilayah, jumlah petugas, jumlah sambungan, periode pilot, target SLA, volume puncak, RPO/RTO, dan SLO.

## 11. Referensi internal dan eksternal

- [Hasil audit kode](./hasil-audit-baca-meter.md)
- [Rekonsiliasi CSV ProgresCater](./rekonsiliasi-data-progrescater.md)
- [Arsitektur dan batas implementasi](./arsitektur-awal-baca-meter.md)
- [Target delta skema](./baca-meter-target.prisma)
- [Invarian/preflight SQL](./invarian-baca-meter.sql)
- OWASP API Security Top 10: <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- PostgreSQL constraints: <https://www.postgresql.org/docs/current/ddl-constraints.html>
- Prisma ORM migrations: <https://www.prisma.io/docs/orm/prisma-migrate>
- Android offline-first guidance: <https://developer.android.com/topic/architecture/data-layer/offline-first>
- OIML R 49 (meter air): <https://www.oiml.org/en/publications/recommendations/en/files/pdf_r/r049-1-2-3-e24.pdf>
