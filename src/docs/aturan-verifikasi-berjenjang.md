# Aturan Verifikasi Berjenjang dan Koreksi

**Versi:** 0.3 (kontrak peran dan tabel draf; 31 Oktober 2026)

**Status:** skenario diklarifikasi oleh pemilik produk; audit berikut adalah pembacaan statis kode, bukan tes integrasi atau bukti seluruh runtime.

**Cakupan:** verifikasi laporan petugas dengan tahap V1/V2/V3, koreksi setelah verifikasi, verifikasi massal, hak administratif STAFF, dan closing.

**Terkait:** [Status proyek](./STATUS-baca-meter-air.md), [PRD](./PRD-baca-meter-air.md), [MVP](./MVP-baca-meter-air.md), [Roadmap](./ROADMAP-baca-meter-air.md).

## Kontrak perilaku yang diminta

| Peran bisnis | Boleh melakukan | Batas setelah menyimpan tahap/koreksi |
|---|---|---|
| V1 — Supervisor | Memproses alamat yang belum diverifikasi atau hasil yang perlu ditinjau; mencatat pekerjaan pada ring V1. | Tidak membuat hasil resmi. Setelah submit, aktor V1 tidak dapat mengubah/membatalkan hasil V1 miliknya sendiri; koreksi oleh role V2/V3. |
| V2 — Manager | Dapat langsung memproses alamat tanpa ring V1 sebelumnya; dapat mengoreksi hasil V1. Catat tindakan sebagai V2 saja. | Hasil V2 menunggu V3 untuk menjadi pembacaan resmi. Setelah submit, aktor V2 tidak dapat mengubah/membatalkan hasil V2 miliknya sendiri; koreksi oleh V3. |
| V3 — Senior Manager/Direksi dan role tertinggi yang disahkan | Dapat langsung memproses alamat tanpa ring V1/V2 sebelumnya; catat tindakan sebagai V3 saja. V3 membuat hasil resmi. Dapat membuka kembali hasil V3 miliknya sendiri untuk koreksi dan pengesahan ulang. | Reopen/koreksi menyimpan alasan, aktor, waktu, before/after, dan status hasil resmi/tagihan. Setelah dipakai Tagihan, tidak boleh diubah melalui jalur koreksi ini. |
| STAFF/admin operasional | Menjalankan administrasi dan closing periode; dapat mengoreksi hasil terverifikasi melalui jalur administratif yang tercatat sebelum hasil masuk Tagihan. | Tidak boleh mengisi/mengesahkan ring V1/V2/V3. Tidak boleh mengubah hasil yang sudah masuk Tagihan; koreksi pasca-Tagihan memerlukan workflow penyesuaian terpisah yang belum termasuk kontrak ini. |

### Semantik ring dan ikon progres

- Ring adalah penanda role yang benar-benar melakukan tindakan, bukan kewajiban bahwa semua ring bawah harus selesai lebih dahulu. V2 dan V3 boleh memproses alamat tanpa ring sebelumnya sesuai kewenangan role.
- Hasil V1 bukan hasil resmi; hasil V2 menunggu V3. Hanya V3 yang menghasilkan `PembacaanMeter` resmi.
- Pada ikon progres, tampilkan hanya ring dari tindakan efektif/terakhir: tindakan V2 menampilkan bar V2 terisi dan bar V1 kosong; tindakan V3 menampilkan bar V3 terisi dan bar V1/V2 kosong. Berlaku untuk tindakan satuan dan massal.
- Ikon progres adalah ringkasnya tindakan terakhir, bukan histori. Jangan menghapus event/ring terdahulu dari penyimpanan audit ketika indikator menampilkan ring lebih tinggi. Tandai nilai terdahulu sebagai superseded bila relevan.
- Koreksi V3 dilakukan melalui reopen/review lalu pengesahan ulang; selama reopen, UI harus membedakan hasil yang sedang direview dari hasil resmi aktif. Koreksi atas hasil yang sudah dipakai Tagihan tidak dilakukan dengan menghapus/mengubah hasil resmi.

Verifikasi massal mengikuti aturan role, transisi, histori, dan tampilan ring yang sama dengan verifikasi satuan; V3 massal membuat hasil resmi.

### Kontrak tabel halaman verifikasi

Kolom berikut adalah spesifikasi kerja berdasarkan klarifikasi pemilik produk. “Ring” berarti ring verifikasi V1/V2/V3, bukan ring wilayah. “Alamat” harus tetap ada karena merupakan identitas lokasi sambungan.

| Urutan | Kolom | Fungsi dan sumber nilai | Perilaku/kondisi |
|---:|---|---|---|
| 1 | Checkbox | Memilih baris untuk aksi massal. | Pilihan UI saja; tidak mengubah status verifikasi. |
| 2 | Ring | Menunjukkan ring verifikasi yang terakhir/tindakan efektif (V1, V2, atau V3). | Hanya ring pelaku yang tampil; jangan mengisi ring bawah secara implisit. Histori lama tetap dapat diaudit. |
| 3 | Status | Status proses yang mudah dipahami, misalnya Pending, Disetujui, atau Perlu Review. | Terpisah dari Ring. “Disetujui” hanya jika V3 telah membuat hasil resmi; hasil V1/V2 belum final. |
| 4 | No. Pel | Nomor sambungan pelanggan. | Identitas stabil untuk pencarian/pencocokan. |
| 5 | Nama | Nama pelanggan. | Ambil dari data pelanggan/sambungan yang berlaku. |
| 6 | Alamat | Alamat lokasi sambungan. | Wajib tersedia di tabel; jangan dihilangkan dari ekspor yang relevan. |
| 7 | Rute | Kode/nama rute pembacaan. | Konteks operasional/rute. |
| 8 | Ket Catat | Keterangan asli yang dicatat petugas. | Pertahankan nilai sumber; “Revisi Pencatat” adalah penanda workflow koreksi, bukan kondisi baru. |
| 9 | ST Awal | Stand awal yang dipakai untuk pencatatan/perhitungan periode. | Setelah koreksi ST Awal, tampilkan nilai aktif hasil revisi. |
| 10 | ST Akhir | Stand akhir yang dicatat petugas atau nilai operasional pada pencatatan taksasi. | Pada taksasi yang disetujui, ST Awal dan ST Akhir diset sama; pemakaian taksasi disimpan terpisah dari selisih stand. |
| 11 | ST Revisi | Nilai ST Awal hasil revisi manusia untuk periode berjalan. | Terisi saat alamat ditandai “Revisi Pencatat” oleh petugas atau verifikator lalu ST Awal dikoreksi. Hanya alamat bertanda ini yang mengaktifkan input ST Awal. Nilai setelah revisi sama dengan ST Awal aktif; nilai sebelum/sesudah tetap disimpan di audit. |
| 12 | ST Resmi | Stand akhir yang disahkan sebagai hasil resmi. | Kosong/belum resmi sebelum V3; jangan menyamakan dengan ST Revisi (koreksi ST Awal). |
| 13 | Pakai | Pemakaian periode ini yang sedang ditinjau. | Dapat berupa delta terukur atau taksasi sesuai kondisi dan kebijakan yang disahkan; jangan mengubah nilai negatif menjadi nol diam-diam. |
| 14 | Lalu | Pemakaian periode pembanding sebelumnya. | Sumber periode pembanding harus konsisten dan ditampilkan dalam satuan yang sama dengan Pakai. |
| 15 | Dev % | Perbandingan Pakai terhadap Lalu. | Rumus, perilaku jika Lalu nol/kosong, dan pembulatan perlu ditetapkan sebelum dipakai sebagai keputusan otomatis. |
| 16 | Tagihan | Pemakaian yang akan ditagihkan dalam m³, bukan nominal rupiah. | Tetap terpisah dari Pakai/hasil ukur; nominal rupiah bukan isi kolom ini. |
| 17 | Petugas | Nama petugas pencatat lapangan. | Menampilkan pencatat, bukan verifikator; verifikator terlihat pada detail/audit ring. |
| 18 | Tgl Catat | Tanggal dan waktu pencatatan. | Tampilkan waktu, bukan tanggal saja; format zona waktu harus konsisten (WIB untuk UI operasional). |

#### Alur Revisi Pencatat dan taksasi yang terkait tabel

- Taksasi dapat terbentuk otomatis saat petugas mencatat salah satu dari 14 kondisi yang ditetapkan pada [matriks kondisi](./aturan-kondisi-catatan-meter.md); Manual ADD/Manual ADD All tetap opsi jika petugas tidak mencatat rute, misalnya sakit.
- Prioritas taksasi adalah rata-rata 12 bulan; jika data tak cukup, rata-rata tiga pemakaian terbesar; jika tiga nilai belum tersedia, rata-rata tiga bulan terakhir atau histori valid yang tersedia. Taksasi dibulatkan ke atas tanpa minimum otomatis. ST Awal dan ST Akhir memakai stand resmi terakhir, sementara Pakai menyimpan hasil taksasi terpisah.
- “Revisi Pencatat” dapat ditandai saat petugas mencatat atau oleh verifikator yang mengubah kondisi di modal. Hanya alamat dengan penanda ini yang mengaktifkan input ST Awal; koreksi menghitung ulang Pakai dari stand terkoreksi dan menyimpan before/after, alasan, aktor, serta waktu di audit.
- “Revisi Pencatat” bukan perubahan terhadap kondisi asal: kondisi petugas harus tetap tersimpan. Jika kode legacy `REV_PENCATAT` masih ada untuk kompatibilitas data, jangan gunakan sebagai pengganti kondisi asli pada data baru tanpa keputusan migrasi.
- Rumus belum siap dipakai runtime: kriteria histori valid, pengecualian nilai taksasi/koreksi lama, dan perilaku jika tidak ada histori sama sekali perlu ditetapkan pada matriks kondisi.

**Status implementasi UI/backend saat ini:** tabel mode verifikasi mengikuti urutan kolom; kolom 8 berlabel “Ket Catat”. Verifikasi dari menu klik-kanan langsung menandai ring akun tanpa membuka modal. Edit laporan petugas tersambung ke endpoint koreksi, termasuk `standAwalRevisi`, pemilihan meter, validasi kondisi MB, alasan wajib, dan audit before/after; edit laporan mandiri masih baca-saja. Server dan UI menjaga urutan V1 → V2 → V3, dan V3 tetap membuat hasil resmi. Aksi cek ulang memakai modal terpisah. Filter toolbar Kondisi Catat dan kriteria Cari Lanjutan yang memiliki padanan data sudah diteruskan ke query. Migration sudah dibuat dan Prisma Client sudah digenerate, tetapi belum diterapkan ke database. Belum ada tes integrasi endpoint/database untuk membuktikan alur end-to-end. Kriteria Jenis Pelanggan dan Deposit Range belum disediakan karena belum ada padanan field yang disepakati.

**Belum ditentukan:** apakah pada tindakan berbeda aktor yang sama boleh tercatat di ring yang berbeda; bentuk persetujuan dan audit yang tepat untuk koreksi administratif STAFF; serta syarat operasional yang memblokir final closing. STAFF memang diberi kewenangan melakukan closing, tetapi prasyarat, audit, dan kegagalan parsial tetap harus dikontrak.

## Hasil audit kode saat ini

Audit dilakukan pada `rbac.ts`, endpoint verifikasi dan unverify di `laporan-harian.router.ts`, `verif-massal.ts`, `closing.router.ts`, dan menu aksi UI verifikasi lapangan.

| Aturan | Temuan kode | Penilaian |
|---|---|---|
| Role V1/V2/V3 dapat menandai ring berikutnya lewat satu aksi | Endpoint `/:id/verifikasi-langsung` memakai role ring terkait; UI tidak membuka modal. V2 mensyaratkan V1 dan V3 mensyaratkan V1/V2; V3 membuat hasil resmi. Endpoint form lama `/:id/verif1..3` tetap tersedia. | **Sesuai untuk alur satuan baru.** Tes integrasi dan kesetaraan dengan alur massal belum dilakukan. |
| V1 tidak dapat mengubah V1 miliknya setelah verifikasi | `/unverify` hanya mensyaratkan `SUPERVISOR_UP`. Pada cabang V1 tidak ada pemeriksaan bahwa peminta lebih tinggi dari V1 atau berbeda dari `verif1ById`. UI juga menampilkan “Batalkan V1” bagi seluruh `SUPERVISOR_UP`. | **Tidak sesuai.** Supervisor yang sama dapat membatalkan V1-nya sendiri lalu mengirim ulang; role V1 lain juga dapat membatalkan. |
| V2 tidak dapat mengubah V2 miliknya setelah verifikasi; V3 yang memperbaiki berikutnya | Cabang V2 pada `/unverify` hanya memastikan `bolehManajemen` (`MANAGEMENT_UP`); tidak membandingkan dengan `verif2ById` atau mensyaratkan V3. UI menawarkan “Batalkan V2” untuk `MANAGEMENT_UP`. | **Tidak sesuai.** Manager dapat membatalkan V2 miliknya sendiri lalu mengesahkan ulang. |
| V3 boleh mengoreksi hasil V3 sendiri | Cabang hasil resmi `/unverify` mensyaratkan `SENIOR_UP`, mempertahankan V1/V2, menghapus pembacaan resmi yang belum dipakai Tagihan, lalu membuka kesempatan V3 ulang. | **Sebagian sesuai.** Reopen dapat dilakukan, tetapi alasan dan histori before/after tidak tampak ditulis pada jalur ini. Perlu pastikan implementasi menyimpan hasil resmi lama dalam audit dan menangani ring V3 langsung tanpa V1/V2. |
| STAFF tidak boleh melakukan verifikasi V1/V2/V3 | Role `STAFF` tidak masuk `SUPERVISOR_UP`, `MANAGEMENT_UP`, atau `SENIOR_UP`; UI juga tidak memberi STAFF tombol ring tersebut. | **Sesuai untuk endpoint ring yang ditinjau.** |
| STAFF boleh koreksi administratif hasil terverifikasi sebelum Tagihan | Endpoint `/:id/koreksi` mengizinkan STAFF, menolak periode terkunci dan pembacaan yang sudah dipakai Tagihan; menu Edit laporan petugas tersambung. | **Implementasi tersedia, belum teruji integrasi.** Jalur penyesuaian setelah Tagihan tetap di luar koreksi biasa. |

### Perubahan implementasi setelah audit

- Menu Verifikasi laporan petugas memanggil `PATCH /:id/verifikasi-langsung`; aksi ini tidak lagi membuka modal. Urutan ring diperiksa di UI dan server: V2 membutuhkan V1, V3 membutuhkan V1 dan V2.
- Menu Edit laporan petugas memanggil `PATCH /:id/koreksi`; endpoint memeriksa role berdasarkan tahap, periode terkunci, Tagihan, data meter, dan nilai stand, lalu menyimpan audit before/after. Jalur laporan mandiri belum tersambung ke endpoint koreksi.
- Aksi Baca Ulang/cek ulang tetap memakai modal terpisah karena membutuhkan alasan, bukan bagian dari verifikasi satu klik.
- Temuan audit lama tentang koreksi STAFF perlu dibaca bersama implementasi baru: endpoint koreksi kini mengizinkan STAFF selama pembacaan belum dipakai Tagihan. Tes integrasi dan closing STAFF masih belum dibuktikan.
| STAFF boleh melakukan closing final | Endpoint daftar/pratinjau closing memakai `STAFF_UP`, tetapi `POST /closing/:periode/tutup` dan buka bulan baru memakai `SENIOR_UP`. | **Tidak sesuai.** Kontrak meminta STAFF dapat melakukan closing; endpoint final dan aturan akses harus diselaraskan dengan syarat closing yang disahkan. |
| Verifikasi massal menerapkan ring role yang sama | `/verif-massal` memeriksa `RING_ROLE[ring]` yang sama dengan endpoint satuan dan V3 massal membuat hasil resmi. | **Sesuai pada guard role dasar.** Proteksi transisi/konkurensi dan aturan siapa boleh reopen belum terbukti aman. |
| Ikon progres hanya menunjukkan ring tindakan efektif terakhir | UI saat ini menampilkan status/tombol ring berdasar field tiap tahap; belum ada kontrak proyeksi satu ring aktif untuk indikator progres. | **Belum sesuai/terbukti.** Tampilkan ring tertinggi/terakhir yang benar-benar dikerjakan saja; histori ring lama tetap tersedia di audit, bukan dihapus. |
| Menu edit tidak melewati kunci tahap | Menu konteks UI menawarkan “Edit” ke `SUPERVISOR_UP` tanpa memeriksa tahap; modal `ModalKoreksi` yang dibuka tidak diberi handler simpan. | **Tidak ada mutasi server yang terbukti dari modal ini**, tetapi label/menu membingungkan dan perlu dinonaktifkan atau diberi kontrak yang jelas setelah tahap dikunci. |
| Koreksi memiliki jejak yang dapat diaudit | Endpoint menyimpan actor/waktu per ring, tetapi route V1/V2/V3/unverify yang ditinjau tidak memanggil `recordAudit`; koreksi mengubah field laporan dan V3 dapat menghapus pembacaan belum tertagih. | **Belum cukup untuk kontrak koreksi.** Perlu audit eksplisit before/after, alasan, aktor, waktu, dan relasi ke hasil yang dibuka ulang. |
| Reopen menjaga semua nilai koreksi konsisten | Unverify V1 mengosongkan beberapa field V1 tetapi tidak tampak mereset semua field koreksi terkait, seperti `standAngkatLama`, `standAwalMeterBaru`, dan `pemakaianTagihVerif`. | **Perlu diperiksa/diperbaiki.** Data koreksi lama dapat tertinggal saat ring diulang jika tidak direset atau dipertahankan secara sengaja dan terlihat. |
| Transisi tahap atomik terhadap request bersamaan | Endpoint membaca tahap, lalu memperbarui baris; pemeriksaan tahap tidak tampak menjadi bagian dari update bersyarat/compare-and-set. V3 massal juga membaca antrean sebelum transaksi per item. | **Belum terbukti aman terhadap race.** Tambahkan guard atomik dan tes konkurensi sebelum mengandalkan kunci tahap. |

## Perbaikan yang diperlukan sebelum kontrak dinyatakan terpenuhi

1. Izinkan V2/V3 memproses alamat tanpa ring bawah; V2 tetap nonfinal dan menunggu V3, sementara V3 membuat hasil resmi. Terapkan aturan sama pada endpoint satuan dan massal.
2. Pada UI, proyeksikan ikon ke satu ring tindakan terakhir saja; simpan ring lama sebagai audit/histori. Bedakan hasil sementara, hasil resmi aktif, dan hasil yang sedang direopen.
3. Terapkan aturan aktor pada `/unverify`: V1 hanya dapat dibuka kembali oleh V2/V3, V2 hanya oleh V3, dan V3 dapat reopen hasilnya sendiri. Tolak self-reopen V1/V2.
4. Rancang endpoint koreksi administratif STAFF yang terpisah dari ring; izinkan sebelum Tagihan dengan alasan/audit, dan larang perubahan hasil yang sudah masuk Tagihan melalui jalur ini.
5. Berikan STAFF kewenangan final closing sesuai kontrak; tetap validasi prasyarat closing, audit, transaksi, race, dan kegagalan parsial.
6. Catat audit append-only before/after untuk koreksi, reopen, dan penerbitan ulang; jangan mengandalkan field ring aktif sebagai satu-satunya histori.
7. Gunakan update bersyarat/transactional guard dan tes race/retry/partial failure; samakan guard dan perilaku satuan dengan massal.

## Kriteria tes minimum

- V2/V3 dapat memproses alamat yang belum memiliki ring bawah; hanya ring aktor yang terisi di indikator, tanpa membuat log verifikasi palsu.
- Hasil V2 menunggu V3 dan belum membuat `PembacaanMeter`; V3 dapat memproses langsung dan membuat tepat satu hasil resmi.
- Setelah tindakan V2/V3, ring sebelumnya tidak tampil sebagai aktif, tetapi histori aktor/waktu/nilai tetap ada dan dapat diaudit.
- V1/V2 tidak dapat membatalkan tahap sendiri setelah submit; koreksi sesuai kewenangan ring lebih tinggi. V3 dapat reopen hasilnya sendiri sebelum Tagihan.
- Reopen V3 mempertahankan before/after dan alasan; setelah dipakai Tagihan, koreksi biasa ditolak.
- Setiap role di luar aturan menerima `403`; menyembunyikan tombol UI tidak dianggap kontrol otorisasi.
- STAFF tidak dapat memanggil endpoint V1/V2/V3 atau unverify; STAFF hanya mengoreksi lewat endpoint administratif sebelum Tagihan dan dapat menjalankan final closing sesuai prasyarat yang ditetapkan.
- Perubahan/rollback koreksi memiliki histori before/after yang tidak hilang setelah diterbitkan ulang.
- Dua permintaan serentak pada ring yang sama tidak membuat state/hasil resmi ganda atau melewati urutan ring.
- Verifikasi massal menghasilkan perilaku role dan transisi yang sama dengan aksi satuan, dengan hasil per item dan kegagalan parsial yang jelas.
