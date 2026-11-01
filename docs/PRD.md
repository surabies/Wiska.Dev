# PRD — Aplikasi Baca Meter Air

**Versi:** 0.3 (rekonsiliasi dokumentasi 1 November 2026; keputusan pilot dicatat; kebutuhan produksi masih perlu validasi)
**Tanggal:** 1 November 2026
**Status:** draft; keputusan ruang lingkup dan kebijakan pilot disetujui 31 Oktober 2026; kebijakan billing produksi belum disahkan
**Dokumen terkait:** [Status dan progres proyek](./STATUS.md), [Definisi MVP](./MVP.md), [Roadmap](./ROADMAP.md), [Aturan Verifikasi Berjenjang dan Koreksi](./VERIFIKASI.md), [Arsitektur](./ARSITEKTUR.md), [Matriks RBAC](./RBAC.md), [Indeks dokumentasi](./INDEKS.md)

**Peran dokumen:** spesifikasi kebutuhan produk (FR-xx dan kriteria penerimaan). Bukan sumber untuk aturan kondisi (lihat [aturan kondisi](./ATURAN-KONDISI.md)), ring V1/V2/V3 (lihat [aturan verifikasi](./VERIFIKASI.md)), role (lihat [RBAC](./RBAC.md)), atau status implementasi (lihat [STATUS](./STATUS.md)). Keputusan (DEC) dan isu terbuka (OPEN) dirujuk dengan ID dan dikelola di [Indeks](./INDEKS.md#register-open).

Aturan perilaku pilot per kondisi `KondisiCatat` ada di [Matriks Aturan Domain Kondisi Catat](./ATURAN-KONDISI.md). Definisi kode, label legacy, dan pertanyaan yang menunggu pengesahan pemilik data dicatat di [Codebook Kondisi Catat Meter](./CODEBOOK.md).

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
- Menetapkan rumus taksiran, pemakaian minimum, arti kode legacy, atau kebijakan tarif di luar yang disahkan pemilik produk. Aturan taksasi pilot ada di [aturan kondisi](./ATURAN-KONDISI.md); yang masih terbuka tercatat di [register OPEN](./INDEKS.md#register-open).
- Memperluas produk ke utilitas lain (listrik, gas); aplikasi ini hanya untuk meter air (lihat MVP bagian 4).

### Keputusan G0 untuk pilot

Pilot berlangsung 1–7 November 2026 di rute CD112, Wilayah Pelayanan 5, untuk sekitar 20–30 sambungan, dengan satu petugas dan satu HP Android. Hasil hanya untuk shadow/paralel dan rekonsiliasi, bukan untuk menerbitkan atau mengubah tagihan resmi; sebelum pilot, harus dibuktikan secara teknis bahwa data pilot tidak dapat masuk ke proses closing/tagihan resmi. Wiska Prayoga memegang akuntabilitas produk, data/billing, engineering, keamanan/privasi, dan operasi; supervisor yang menyetujui koreksi harus memiliki akun terpisah dari petugas lapangan dan ditunjuk sebelum pilot.

Untuk pembacaan `NORMAL`, sistem memakai selisih stand dengan stand terakhir resmi. Empat belas kondisi kelainan telah diklasifikasikan sebagai kandidat taksasi otomatis, tetapi validasi histori dan runtime kelompok itu belum selesai (OPEN-02). Sumber histori untuk semua jalur taksasi adalah pemakaian tagihan bulanan (`Tagihan.pemakaianM3`), termasuk angka hasil override dan minimum; `pemakaianRiil` bukan dasar taksasi. Manual Add All memakai prioritas 12 bulan → tiga pemakaian tagihan tertinggi → seluruh histori yang tersedia. Setelah Petugas dan Rute dipilih, daftar alamat yang belum disetorkan ditampilkan langsung. ST Awal dan ST Akhir selalu sama, memakai `standAkhir` dari pembacaan resmi terakhir sebelum periode berjalan pada meter aktif terbaru (DEC-01; bukan `standLalu`). Jika tidak ada tagihan historis tetapi stand resmi dan meter aktif tersedia, usulkan 5 m³ berdasar minimum Perdir; jika stand resmi atau meter aktif tidak tersedia, tandai Perlu Ditinjau tanpa nilai buatan dan cegah submit (DEC-02). Hanya alamat yang dicentang yang ditambahkan ke antrean verifikasi, bukan langsung menjadi hasil resmi/tagihan.

Warga dapat mengirim laporan baca meter melalui jalur akun atau anonim; kiriman selalu menunggu verifikasi dan foto menjadi bukti (foto petugas untuk pencatatan lapangan, foto unggahan warga untuk laporan mandiri). OTP untuk membuka data sambungan hanya dikirim ke nomor yang sudah terverifikasi pada data resmi. Tautan `LanggananWarga` bukan bukti kepemilikan. Pelaporan kerusakan umum tidak termasuk alur baru pilot dan tetap memakai kanal pengaduan yang tersedia.

Foto, koordinat GPS, kontak pelapor, dan log operasional berisi data pribadi dihapus/dianonimkan tiga bulan setelah dikumpulkan. GPS dan akurasinya dicatat saat tersedia, tetapi ketiadaan GPS tidak otomatis menolak submit. Warga diberi pemberitahuan sebelum pengumpulan. Catatan audit resmi mengikuti jadwal retensi terpisah yang harus ditetapkan sebelum go-live. Koreksi pilot hanya manual, dengan alasan, bukti, aktor, persetujuan supervisor yang berbeda dari petugas, audit, dan rekonsiliasi; tidak ada penyesuaian finansial otomatis.

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

### Batas workflow verifikasi dan Manual ADD

- V1/V2/V3 adalah penanda role yang benar-benar melakukan tindakan, bukan ring bawah wajib yang harus dilalui berurutan. V2/V3 dapat langsung memproses alamat yang belum memiliki ring sebelumnya.
- Hasil V1 tidak resmi; hasil V2 menunggu V3. V3 adalah persetujuan final dan membuat satu `PembacaanMeter` resmi. Aksi massal mengikuti aturan yang sama dengan aksi satuan.
- Ikon progres hanya menampilkan ring tindakan efektif/terakhir: jika V2 memproses, bar V2 terisi dan V1 kosong; jika V3 memproses, hanya bar V3 terisi. Riwayat aktor/ring terdahulu tetap disimpan dan tidak dihapus.
- Setelah V3, Senior Manager/Direksi atau role setara/lebih tinggi dapat mengembalikan hasil ke review untuk koreksi dan penerbitan ulang. Bila hasil sudah dipakai tagihan, perubahan memerlukan workflow koreksi finansial yang disahkan; jangan menghapusnya diam-diam. Koreksi setelah V3 hanya lewat reopen dan verifikasi ulang (DEC-06); alur yang tersedia beserta celahnya ada di [aturan verifikasi](./VERIFIKASI.md#koreksi-setelah-v3-alur-yang-berlaku-dan-celah), dan apakah reopen boleh menghapus `PembacaanMeter` tercatat di OPEN-08.
- Untuk 14 kondisi kelainan yang ditetapkan pemilik produk pada laporan petugas, sistem menghitung taksasi dengan prioritas rata-rata 12 bulan → rata-rata 3 pemakaian terbesar → rata-rata 3 bulan terakhir/riwayat yang tersedia. Taksasi dibulatkan ke atas tanpa minimum otomatis; ST Awal/ST Akhir memakai stand resmi terakhir dan Pakai menyimpan taksasi terpisah. Validitas histori, nilai saat tidak ada histori, dan pemetaan alias harus disahkan sebelum runtime.
- Manual ADD/Manual ADD All tetap opsi jika petugas tidak mencatat rute/periode, misalnya petugas sakit. Sistem dapat membuat taksasi per item dari histori; verifikator menilai dan menyesuaikan dengan alasan/audit sesuai kewenangan.
- Kasus nilai minus tidak boleh diubah menjadi nol atau diganti taksasi sebagai fallback. Simpan angka sumber/delta bertanda dan minta review sebelum hasil resmi. Kondisi yang otomatis ditaksasi, dicatat apa adanya, atau ditahan review dirinci pada [Matriks Aturan Kondisi Catat Meter](./ATURAN-KONDISI.md).
- Tabel verifikasi mengikuti urutan dan semantik kolom pada [Aturan Verifikasi Berjenjang dan Koreksi, bagian Kontrak tabel](./VERIFIKASI.md#kontrak-tabel-halaman-verifikasi); termasuk ST Revisi sebagai koreksi ST Awal, Tagihan dalam m³, Alamat, serta tanggal dan waktu pencatatan.

## 6. Kebutuhan fungsional dan kriteria penerimaan

Prioritas: **P0** = wajib sebelum pilot; **P1** = wajib sebelum penggunaan produksi berskala; **P2** = pengembangan lanjutan.

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | P0 | Mendukung beberapa sambungan untuk satu akun warga dengan akses berbasis OTP. | Akses data sambungan memerlukan OTP yang dikirim ke nomor HP terverifikasi pada data resmi; nomor yang diklaim sendiri tidak cukup. API menolak sambungan yang tidak tertaut ke akun aktif. Tautan tidak ditampilkan sebagai verifikasi kepemilikan. Bila nomor tidak cocok/tersedia, arahkan ke verifikasi petugas tanpa membuka data. |
| FR-02 | P0 | Menyediakan jendela laporan mandiri yang dapat diatur. | Admin berwenang membaca/mengubah tanggal 1–28; tanggal buka tidak melewati tanggal tutup; perubahan kedua nilai atomik; periode dan tanggal menggunakan WIB; UI publik menampilkan nilai server. |
| FR-03 | P0 | Memisahkan jalur laporan mandiri anonim dan akun. | Jalur anonim tetap pending dan tidak membuka data sambungan; jalur akun memerlukan role warga (role teknis `USER`; cakupan portal belum dikonfirmasi, OPEN-19), OTP ke nomor resmi terverifikasi untuk akses data, serta tautan sambungan; keduanya menyimpan ke model antrean canonical yang sama. |
| FR-04 | P0 | Menyimpan bukti setiap percobaan kirim. | Kirim pertama dan kirim ulang mempunyai arsip/foto terpisah; retry/status konflik tidak menimpa arsip lama. |
| FR-05 | P0 | Memastikan verifikasi adalah gerbang hasil resmi. | Sebelum verifikasi tidak ada pembacaan resmi/tagihan dari kiriman mandiri; verifikasi memastikan sambungan, meter aktif, periode, status antrean, dan aktor secara konsisten. |
| FR-06 | P0 | Menggunakan satu model hasil resmi untuk semua sumber. | Petugas dan warga menghasilkan `PembacaanMeter`; constraint mencegah duplikasi resmi untuk kunci domain yang disahkan (kunci domain belum final; lihat OPEN-06). Sumber dan nilai terukur/tagih tetap dapat dibedakan. |
| FR-07 | P0 | Menangani kondisi pembacaan, taksasi, dan nilai minus sesuai kebijakan yang disahkan. | `NORMAL`/`STAND_TEMPEL`/`STAND_KONSUMEN` menghitung delta; 14 kondisi kelainan memakai prioritas histori 12 bulan → 3 pemakaian terbesar → 3 bulan terakhir/riwayat tersedia, dibulatkan ke atas tanpa minimum; `TIDAK_ADA_AIR`/`TIDAK_DIPAKAI` ditetapkan manusia; MB/rollover memakai rumus khusus. Nilai minus dipertahankan dan tidak dijepit menjadi nol. Histori/provenance serta kondisi tanpa histori diuji; pilot tidak menerbitkan tagihan resmi dari taksasi. Mode pilot untuk 14 kondisi (taksasi otomatis atau review-only) menunggu OPEN-03; titik terbuka hierarki taksasi di OPEN-04. |
| FR-08 | P0 | Mengotorisasi objek, bukan hanya endpoint. | Uji negatif membuktikan role, akun, penugasan/rute, periode, dan sambungan yang tidak berhak tidak bisa dibaca/diubah. |
| FR-09 | P0 | Menyediakan audit tindakan kritis. | Approve/reject, pengubahan hasil, konfigurasi jendela, dan closing mencatat aktor, waktu server, referensi objek, alasan, serta before/after yang diperlukan. |
| FR-10 | P1 | Menyediakan koreksi formal pasca-tagihan tanpa mengubah dokumen lama. | Di pilot koreksi hanya manual, tercatat, disetujui supervisor yang berbeda dari petugas, dan direkonsiliasi; tidak ada penyesuaian finansial otomatis. Workflow formal pasca-tagihan hanya dirilis setelah maker-checker, alasan, bukti, histori append-only, dan perlakuan tagihan terdampak disahkan; invoice historis tetap dapat direkonstruksi. |
| FR-11 | P0 | Menjaga pencatatan lapangan saat offline dan aman terhadap retry. | Pekerjaan tersimpan lokal sampai server mengonfirmasi penerimaan; operasi memiliki ID idempotensi dan hash payload; retry identik menghasilkan hasil yang sama; ID sama dengan payload berbeda menjadi konflik; setiap item batch dan lampiran dapat dilanjutkan tanpa kehilangan data. |
| FR-12 | P0 | Menyediakan observabilitas minimum untuk operasi pilot. | Operator dapat menemukan backlog, kegagalan sinkronisasi/upload, error closing, dan perubahan kritis melalui log/metric/alert tanpa menampilkan rahasia atau data pribadi berlebih. Perluasan dashboard, SLO, dan alert untuk operasi berskala tetap menjadi pekerjaan sebelum produksi berskala. |
| FR-13 | P2 | Mendukung analisis kualitas pembacaan. | Laporan pemakaian nol/ekstrem/koreksi dapat dipilah berdasarkan periode, rute, kondisi, sumber, dan versi aturan tanpa menyamakan semua perbedaan dengan kesalahan. |
| FR-14 | P0 | Memastikan verifikasi satuan/massal mencatat ring aktor dan menampilkan indikator progres yang benar. | V1/V2/V3 dapat memproses sesuai role tanpa mewajibkan ring bawah; hanya ring aktor terakhir yang tampil di ikon dan ring terdahulu tetap di histori audit. V2 menunggu V3; hanya V3 membuat satu pembacaan resmi. Reopen V3 mencatat alasan dan before/after; hasil yang sudah masuk Tagihan tidak dapat diubah lewat jalur koreksi biasa. |
| FR-15 | P1 | Manual Add satuan dan Manual Add All untuk dasar pencatatan saat kunjungan tidak dapat dilakukan. | Satuan mencari dengan nomor langganan tepat 11 digit dan hanya mengembalikan kecocokan exact; menerima ST Awal/ST Akhir manual. Hasil yang telah melewati ring V1/V2/V3 boleh diganti hanya dengan alasan dan konfirmasi eksplisit; simpan audit before/after, reset semua ring/koreksi, dan kembalikan ke antrean verifikasi. Tolak periode terkunci, laporan pending yang belum diverifikasi, serta hasil resmi yang sudah dipakai Tagihan. Massal memfilter periode, petugas, lalu rute; setelah filter dipilih, langsung tampilkan alamat daftar kerja yang belum disetorkan tanpa langkah pratinjau; alamat yang sudah memiliki laporan/pembacaan resmi dikecualikan. Tampilkan checkbox per alamat, hitung taksasi otomatis, dan tambahkan hanya baris yang dicentang. Proses batch dengan progres yang mencerminkan batch tersimpan. Histori taksasi mengambil `Tagihan.pemakaianM3` nonnegatif lintas meter milik pelanggan, termasuk nilai override/minimum; gunakan rata-rata 12 bulan kalender sebelumnya bila lengkap, lalu rata-rata tiga pemakaian tagihan tertinggi, lalu rata-rata seluruh tagihan yang tersedia; bulatkan ke atas tanpa minimum. ST Awal = ST Akhir = `standAkhir` dari pembacaan resmi terakhir sebelum periode berjalan pada meter aktif terbaru (DEC-01; bukan `standLalu`). Jika tidak ada histori tagihan tetapi stand resmi dan meter aktif tersedia, ajukan 5 m³ sebagai usulan minimum sementara berdasar Perdir; ini bukan hasil resmi dan tetap menunggu verifikasi. Jika stand resmi atau meter aktif tidak tersedia, tampilkan `Perlu Ditinjau` tanpa nilai buatan dan cegah baris dipilih/dikirim. Kebijakan no-history untuk 14 kondisi taksasi otomatis tetap OPEN-02 dan terpisah dari Manual Add All. Simpan alasan dan provenance; hasil ditandai sebagai Manual dan menunggu verifikasi, bukan langsung menjadi hasil resmi/tagihan. |
| FR-16 | P1 | Mengizinkan STAFF melakukan koreksi administratif tanpa menjadi verifikator. | STAFF tidak dapat menjalankan V1/V2/V3; koreksi hasil terverifikasi sebelum Tagihan melalui endpoint/izin administratif tersendiri, dengan before/after, alasan, aktor, waktu. Hasil yang telah masuk Tagihan tidak diubah; penyesuaian memerlukan workflow terpisah. Syarat tambahan bukti foto dan persetujuan supervisor (G0) serta batas koreksi atas hasil V3 resmi: OPEN-09; hasil V3 resmi aktif hanya diubah lewat reopen dan verifikasi ulang (DEC-06). |
| FR-17 | P1 | Menetapkan dan menegakkan izin final closing. **Izin untuk STAFF belum disepakati (DEC-05, OPEN-01); jangan dianggap keputusan.** | Setelah OPEN-01 diputuskan: peran yang diizinkan dapat menjalankan final closing sesuai prasyarat periode yang disahkan; izin API, audit, transaksi, race, dan kegagalan parsial diuji; peran lain ditolak (`403`). Izin melihat/pratinjau tidak dianggap pengganti izin final. |
| FR-18 | P0 | Menampilkan tabel verifikasi dengan kolom dan makna yang konsisten dengan keputusan operasional. | Urutan kolom checkbox, Ring, Status, No. Pel, Nama, Alamat, Rute, Kondisi, ST Awal, ST Akhir, ST Revisi, ST Resmi, Pakai, Lalu, Dev %, Tagihan (m³), Petugas, dan Tgl Catat (tanggal+waktu) tersedia; koreksi ST Awal tersimpan dengan audit before/after dan dibedakan dari ST Resmi. Rumus Dev % belum ditetapkan (OPEN-12); sampai ditetapkan, nilainya tidak dipakai untuk keputusan otomatis. |

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
| Privasi | Pilot: foto, GPS, kontak, dan log operasional berisi data pribadi dihapus/dianonimkan tiga bulan setelah dikumpulkan; akses terbatas dan pemberitahuan diberikan sebelum pengumpulan. Jadwal retensi audit resmi harus ditetapkan sebelum go-live. Konflik penghapusan 3 bulan dengan arsip kiriman yang immutable, dan dampaknya pada bukti koreksi: OPEN-07. |
| Pemulihan | RPO/RTO ditetapkan; backup/PITR diuji dengan restore drill ke lingkungan terisolasi. |
| Kompatibilitas | Browser/perangkat target, versi OS, penggunaan offline, batas upload, dan kebijakan pembaruan aplikasi ditentukan sebelum pilot. |

## 9. Risiko dan dependensi

1. **Aturan konsumsi produksi belum lengkap:** pilot memiliki aturan konservatif dan shadow-only; codebook lengkap, pemakaian minimum, tarif, pembulatan, dan rekonsiliasi lintas periode harus disahkan sebelum penggunaan billing resmi.
2. **Koreksi setelah tagihan terbit belum lengkap:** tanpa keputusan billing tidak boleh ada klaim otomatisasi koreksi finansial.
3. **Tautan akun tidak membuktikan kepemilikan:** risiko laporan atas sambungan pihak lain tetap membutuhkan prosedur verifikasi petugas.
4. **Histori aset meter dan data legacy:** preflight, deduplikasi, dan pemetaan harus selesai sebelum constraint atau backfill diterapkan.
5. **Kualitas jaringan/perangkat:** sinkronisasi offline, foto tertunda, jam perangkat, dan retry harus diuji di lapangan.
6. **Ketersediaan tim operasional:** perlu penanggung jawab support, eskalasi, rollback, restore, dan rekonsiliasi manual.

## 10. Keputusan lanjutan sebelum produksi

- Tetapkan aktor Bagian Langganan dan pemisahan tugas maker-checker untuk koreksi pasca-tagihan.
- Putuskan apakah koreksi formal berdampak pada nota debit/kredit, saldo, pembayaran, atau refund dan sahkan rekonsiliasi akuntansinya.
- Lengkapi codebook legacy di luar aturan konservatif pilot, serta tetapkan pemakaian minimum, tarif, pembulatan, dan sumber data untuk billing resmi.
- Tetapkan jadwal retensi catatan audit resmi dan dasar/prosedur privasi yang berlaku sebelum go-live.
- Tentukan SLO/SLA produksi, volume puncak, RPO/RTO, dan kapasitas berdasarkan hasil staging/pilot.
- Tinjau kembali keputusan OTP saat implementasi: nomor tujuan harus bersumber dari data resmi yang status verifikasinya dapat dibuktikan.
- Putuskan butir pada [register OPEN](./INDEKS.md#register-open) yang memblokir implementasi, terutama OPEN-01 (closing STAFF), OPEN-02 (tanpa histori), OPEN-03 (mode pilot 14 kondisi), OPEN-06 (kunci hasil resmi), dan OPEN-07 (retensi).

## 11. Referensi internal dan eksternal

- [Indeks dokumentasi: sumber kebenaran, glosarium, keputusan, register OPEN](./INDEKS.md)
- [Matriks RBAC Aplikasi](./RBAC.md)
- [Codebook Kondisi Catat Meter](./CODEBOOK.md)
- [Hasil audit kode](./AUDIT.md)
- [Rekonsiliasi CSV ProgresCater](./REKONSILIASI.md)
- [Arsitektur dan batas implementasi](./ARSITEKTUR.md)
- [Schema Prisma kanonis](../../prisma/schema/operasional.prisma)
- [Migration kiriman mandiri](../../prisma/migrations/20261031000000_laporan_mandiri_kiriman_immutable/migration.sql)
- OWASP API Security Top 10: <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- PostgreSQL constraints: <https://www.postgresql.org/docs/current/ddl-constraints.html>
- Prisma ORM migrations: <https://www.prisma.io/docs/orm/prisma-migrate>
- Android offline-first guidance: <https://developer.android.com/topic/architecture/data-layer/offline-first>
- OIML R 49 (meter air): <https://www.oiml.org/en/publications/recommendations/en/files/pdf_r/r049-1-2-3-e24.pdf>
