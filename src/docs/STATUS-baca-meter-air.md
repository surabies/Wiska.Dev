# Status Proyek — Aplikasi Baca Meter Air

**Tanggal snapshot:** 31 Oktober 2026

**Status keseluruhan:** belum siap dinyatakan layak produksi; kesiapan pilot belum dibuktikan.

**Tujuan:** satu ringkasan progres, bukti yang tersedia di repository, dan pekerjaan tersisa menuju produksi. Dokumen ini bukan pengganti spesifikasi atau hasil pengujian.

**Fokus kerja aktif:** membuktikan dan memperbaiki kebenaran backend/domain/schema terlebih dahulu. Pilot bukan pekerjaan aktif sampai alur hitung, verifikasi, hasil resmi, dan closing lulus tes integrasi.

Kontrak peran, audit endpoint V1/V2/V3, closing, serta spesifikasi tabel verifikasi ada di [Aturan Verifikasi Berjenjang dan Koreksi](./aturan-verifikasi-berjenjang.md). Aturan per kode untuk taksasi, nilai minus, dan review ada di [Aturan Domain Kondisi Catat Meter](./aturan-kondisi-catatan-meter.md).

## Ringkasan untuk pengambilan keputusan

Proyek sudah memiliki rancangan produk dan arsitektur, model data inti, serta implementasi awal untuk beberapa alur. Namun, keberadaan kode, migration, atau dokumen tidak membuktikan bahwa perilaku sudah benar di semua jalur, database staging sudah dimigrasikan, atau operasi siap dijalankan.

**Belum ada bukti pada snapshot ini** untuk menyatakan bahwa seluruh P0 lulus, migration berhasil pada staging representatif, restore backup berhasil, pilot berjalan, atau persetujuan produksi sudah diberikan. Karena itu, jangan gunakan aplikasi untuk proses produksi/tagihan resmi sebelum gerbang di bawah lulus dan bukti hasilnya dicatat.

## Status dokumen dan keputusan G0

| Dokumen | Status | Arti status |
|---|---|---|
| [PRD](./PRD-baca-meter-air.md) | Draft kebutuhan; keputusan pilot G0 sudah dicatat | Menjelaskan tujuan dan kebutuhan produk; kebutuhan produksi di luar pilot masih perlu diputuskan. |
| [Definisi MVP](./MVP-baca-meter-air.md) | Batas pilot disetujui untuk uji coba 1–7 November 2026 | Kriteria penerimaan teknis/operasional tetap harus lulus sebelum pilot. |
| [Roadmap](./ROADMAP-baca-meter-air.md) | Urutan kerja dan release gate; bukan bukti penyelesaian | Mengatur dependensi dari keputusan produk sampai kesiapan produksi. |
| [Codebook kondisi catat](./codebook-kondisi-catatan-meter.md) | Draf untuk 22 nilai enum; belum disahkan pemilik data | Label legacy dan kandidat makna dicatat dengan jelas terpisah dari definisi resmi; kode ambigu perlu dikonfirmasi sebelum menjadi aturan runtime/billing. |
| Dokumen status ini | Snapshot progres | Menautkan bukti saat ini dan pekerjaan berikutnya; perbarui setelah ada hasil implementasi, tes, staging, atau keputusan. |

**G0 — keputusan ruang lingkup/kebijakan untuk pilot: SELESAI pada 31 Oktober 2026.** Keputusan di bawah dicatat dari persetujuan Wiska Prayoga dalam sesi kerja ini. Ini bukan persetujuan bahwa implementasi sudah memenuhi keputusan tersebut. Pekerjaan pra-pilot—misalnya menunjuk akun supervisor, memeriksa kesiapan OTP, memasang pemberitahuan, dan meluluskan acceptance criteria—tetap harus dikerjakan pada G1–G3.

G0 yang selesai tidak berarti PRD/MVP/Roadmap tidak diperlukan: PRD menyimpan kebutuhan, MVP menjadi kontrak penerimaan pilot, dan Roadmap mengurutkan pekerjaan. Ketiganya diperbarui agar mencerminkan keputusan ini.

## Catatan keputusan G0 — disetujui Wiska Prayoga, 31 Oktober 2026

| Area | Keputusan pilot |
|---|---|
| Akuntabilitas | Wiska Prayoga merangkap Product Owner, Data/Billing Owner, Engineering Owner, Security/Privacy Owner, dan Operations Owner. Konsentrasi peran dicatat sebagai risiko tata kelola; approval koreksi tetap mensyaratkan aktor pengawas berbeda dari petugas lapangan. |
| Batas pilot | Satu rute CD112 di Wilayah Pelayanan 5, 1–7 November 2026 (7 hari), sekitar 20–30 sambungan/warga, 1 petugas, dan 1 HP Android. |
| Pemakaian hasil | Shadow/paralel dan rekonsiliasi saja. Output pilot tidak dipakai menerbitkan atau mengubah tagihan resmi. |
| Aturan pembacaan dan taksasi | `NORMAL`/`STAND_TEMPEL`/`STAND_KONSUMEN` memakai delta; 14 anomali memakai prioritas histori 12 bulan → 3 penggunaan terbesar → 3 bulan terakhir/riwayat tersedia, ceiling tanpa minimum; `TIDAK_ADA_AIR`/`TIDAK_DIPAKAI` ditentukan manusia; `MB`/`MUDA_KEMBALI` memakai formula khusus. Nilai minus dipertahankan dan ditinjau. |
| Nilai resmi | Taksasi tidak langsung menjadi tagihan; review dan otorisasi V3 tetap gerbang hasil resmi. Data yang sudah ditagihkan tidak diubah lewat jalur koreksi biasa. |
| Akses warga | OTP untuk akses data sambungan hanya ke nomor HP yang sudah terverifikasi pada data resmi. Jika tidak cocok/tersedia, jangan buka data; arahkan ke verifikasi petugas. Tautan `LanggananWarga` bukan bukti kepemilikan. Kiriman baca meter warga tetap mencakup jalur anonim dan akun, menggunakan foto sebagai bukti, dan menunggu verifikasi; warga tidak mendapat akses data sambungan hanya dari klaim tautan. |
| Foto/GPS | Petugas wajib mengambil foto pada setiap pencatatan lapangan; kiriman mandiri warga menyertakan foto unggahan warga. GPS dan akurasi dicatat saat tersedia; kegagalan GPS tidak memblokir submit dan dapat ditandai untuk review. Pemberitahuan sebelum pengumpulan mencakup tujuan, akses terbatas, dan retensi. |
| Retensi | Foto, GPS, kontak pelapor, dan log operasional yang mengandung data pribadi dihapus/dianonimkan 3 bulan sejak dikumpulkan. Catatan audit resmi mengikuti jadwal terpisah yang harus ditetapkan sebelum go-live. |
| Koreksi | Tidak ada penyesuaian finansial/tagihan otomatis. Koreksi manual wajib mencatat alasan, bukti foto, aktor, persetujuan supervisor, audit, dan rekonsiliasi; petugas tidak boleh menyetujui koreksinya sendiri. |
| Pelaporan kerusakan umum | Di luar alur baru pilot; gunakan kanal pengaduan yang sudah ada. Fokus MVP pilot tetap pembacaan meter. |
| Pemisahan tugas | Wiska bertanggung jawab menunjuk Supervisor Operasional/Admin Utama dengan akun terpisah dari petugas lapangan sebelum pilot dimulai. |

### Klarifikasi alur pencatatan — 31 Oktober 2026

1. Aksi satuan/massal pada verifikasi menjalankan ring V1/V2/V3 dengan akun/role yang sedang digunakan; aksi massal menerapkan aturan ring yang sama. V1/V2 merekam tindakan, sedangkan V3 mengesahkan dan membuat `PembacaanMeter` resmi.
2. Setelah V3, hasil dapat dikembalikan ke review untuk koreksi dan penerbitan ulang oleh Senior Manager/Direksi atau role setara/lebih tinggi. Pembatalan ditolak jika pembacaan sudah dipakai Tagihan; koreksi finansial memerlukan workflow terpisah.
3. Taksasi dapat dipicu otomatis oleh 14 kondisi kelainan pada laporan petugas. Prioritas histori yang diberikan owner: rata-rata 12 bulan, lalu rata-rata 3 pemakaian terbesar, lalu 3 bulan terakhir/riwayat tersedia. Manual ADD/Manual ADD All tetap opsi jika rute/periode tidak tercatat sama sekali, misalnya petugas sakit.
4. Nilai taksasi disimpan terpisah dari delta; nilai stand minus tidak diubah jadi nol. `TIDAK_ADA_AIR`/`TIDAK_DIPAKAI` memerlukan keputusan manusia; `MB` memakai hitungan segmen meter dan `MUDA_KEMBALI` memakai rollover sesuai kapasitas meter.
5. Audit kode mengonfirmasi UI massal memanggil `/laporan-harian/verif-massal` untuk V1/V2/V3; V3 massal membuat hasil resmi. Taksasi saat pencatatan adalah perilaku terpisah dari verifikasi ring, meski nilainya tetap harus diverifikasi sebelum resmi.

### Audit awal kewenangan role — 31 Oktober 2026

| Aturan yang diminta | Hasil audit |
|---|---|
| Role V1/V2/V3 dapat langsung memproses sesuai ringnya | `verif1` bisa langsung; `verif2` mensyaratkan V1; `verif3` mensyaratkan V1/V2. **Sebagian sesuai**; prasyarat ring bawah untuk V2/V3 bertentangan dengan keputusan pemilik produk. V2 tetap menunggu V3; V3 membuat hasil resmi. |
| Ikon progres hanya menunjukkan ring tindakan terakhir | Belum ada kontrak proyeksi satu ring aktif di UI; implementasi sekarang menampilkan tahapan berdasarkan field ring masing-masing. **Belum sesuai/terbukti**; ring lama harus tetap disimpan sebagai audit saat tidak lagi tampak aktif. |
| V1 tidak mengubah hasil V1 setelah submit; V2/V3 dapat menangani koreksi sesuai role | `verif1` menolak submit ulang, tetapi `/unverify` V1 mengizinkan `SUPERVISOR_UP`, termasuk aktor V1 sendiri, membatalkan tahap. **Tidak sesuai**; self-reopen harus ditolak. |
| V2 tidak mengubah hasil V2 setelah submit; V3 mengoreksi | `verif2` menolak submit ulang, tetapi `/unverify` V2 mengizinkan `MANAGEMENT_UP`, termasuk aktor V2 sendiri, membatalkan tahap. **Tidak sesuai**; self-reopen harus ditolak. |
| V3 bisa mengoreksi hasil V3 sendiri | Role `SENIOR_UP` dapat membuka ulang V3 sebelum hasil terkait Tagihan. **Sebagian sesuai**; before/after dan alasan reopen belum tercatat eksplisit di route yang ditinjau. |
| STAFF administratif/closing/koreksi saja, tanpa V1/V2/V3 | STAFF memang tidak masuk ring verifikasi. Tidak ditemukan endpoint koreksi administratif STAFF; final close `/closing/:periode/tutup` dibatasi `SENIOR_UP`, bukan STAFF. **Belum sesuai**; STAFF harus dapat closing dan koreksi administratif hanya sebelum Tagihan. |
| Verifikasi massal setara dengan satuan | Guard ring sama dan V3 massal membuat hasil resmi. **Belum terbukti sesuai penuh**; cek prasyarat ring bawah dan ikon perilaku yang sama, serta uji race/atomic transition. |

Audit lebih rinci dan acceptance tests ada di [Aturan Ring Verifikasi dan Koreksi](./aturan-verifikasi-berjenjang.md). Ini audit statis; otorisasi runtime belum diubah dan skenario role tersebut belum diuji melalui endpoint/integrasi.

### Tindakan wajib sebelum pilot dimulai

- [ ] Wiska menetapkan nama/akun Supervisor Operasional/Admin Utama; akun tersebut bukan akun petugas lapangan.
- [ ] Tetapkan nama petugas dan daftar sambungan pilot pada rute CD112; jangan memperluas di luar 20–30 sambungan yang disetujui.
- [ ] Buktikan secara teknis bahwa data pilot tidak dapat dipakai proses closing atau penerbitan tagihan resmi.
- [ ] Konfirmasi nomor HP pada data resmi benar-benar berstatus terverifikasi dan alur OTP tidak membuka data ke nomor yang diklaim sendiri.
- [ ] Tetapkan dan arsipkan pemberitahuan warga sebelum foto/GPS dikumpulkan serta prosedur penghapusan/anonimisasi setelah 3 bulan.
- [ ] Pastikan semua kondisi selain `NORMAL`, termasuk `METER_RUSAK`, masuk review/kunjungan ulang pada workflow verifikasi pembacaan.
- [ ] Luluskan gerbang teknis P0, staging, migration, backup/restore, keamanan akses, dan runbook sebelum menjalankan pilot.

Item di atas adalah **prasyarat mulai pilot**, bukan perubahan kebijakan G0. Jika tidak selesai, tanggal pilot harus ditunda; jangan menganggap risikonya diterima hanya karena G0 telah disetujui.

## Apa yang sudah dikerjakan di repository

| Area | Bukti yang ada | Batas klaim |
|---|---|---|
| Definisi produk | PRD, batas MVP, roadmap, rancangan arsitektur, hasil audit, dan analisis rekonsiliasi data tersedia di `src/docs/`. | Belum berarti keputusan pemilik produk, billing, keamanan, dan operasional telah disahkan. |
| Model data | Model canonical mencakup pelanggan, meter, pembacaan, tagihan, periode, laporan petugas, dan laporan mandiri. Model `KirimanLaporanMandiri` tersedia di schema Prisma. | Perubahan schema tidak membuktikan penerapan database produksi/staging atau validitas semua data historis. |
| Arsip kiriman warga | Migration `20261031000000_laporan_mandiri_kiriman_immutable` membuat tabel arsip, menyalin data lama, dan mencegah perubahan/penghapusan melalui trigger. | Belum ada bukti migration diuji pada salinan staging representatif atau diterapkan pada target produksi. |
| Laporan mandiri | Kode layanan menyimpan kiriman dan arsip bukti dalam transaksi; ada pemeriksaan sambungan tertaut untuk alur akun dan pengaturan tanggal jendela. | Perlu tes integrasi dan otorisasi seluruh jalur; arsip append-only tidak otomatis berarti keseluruhan workflow aman. |
| Alur hasil resmi | Model `PembacaanMeter` digunakan sebagai hasil resmi dan ada service bersama untuk pembacaan resmi pada alur laporan. | Perlu membuktikan seluruh jalur petugas, warga, impor, retry, dan closing menjaga invariant yang sama. |
| Audit kode | [Hasil audit](./hasil-audit-baca-meter.md) mencatat kontrol yang terlihat baik serta risiko prioritas tinggi/menengah dan tindakan sebelum produksi. | Audit tersebut pemeriksaan statis repository, bukan penetration test, audit database live, atau verifikasi bahwa temuan masih terbuka setelah perubahan. |

## Pemeriksaan awal backend dan domain

Pemeriksaan ini adalah bukti teknis awal, bukan sign-off produksi:

| Pemeriksaan | Hasil | Makna |
|---|---|---|
| `pnpm exec prisma validate` | Lulus; Prisma memvalidasi schema di `prisma/schema`. | Sintaks, model, tipe, dan relasi Prisma dapat diparse; belum membuktikan constraints domain cukup atau database aktual cocok. |
| `pnpm exec vitest run src/docs/pemakaian-meter.test.ts` | 31 tes lulus. | Hanya membuktikan fungsi murni di `src/docs/pemakaian-meter.ts`; fungsi tersebut tidak ditemukan dipakai jalur backend verifikasi. |
| `pnpm test` | 4 file dan 90 tes lulus pada 31 Oktober 2026 setelah kontrak dipisahkan. | Seluruh tes repository saat ini lulus, tetapi belum ada tes integrasi backend/PostgreSQL yang ditemukan untuk jalur verifikasi/closing yang ditinjau. |
| `pnpm typecheck` | Lulus. | TypeScript dapat dikompilasi tanpa error tipe; ini tidak membuktikan perilaku domain/runtime benar. |
| Jalur V3 satuan dan massal | Keduanya menggunakan kalkulasi lokal untuk pemakaian riil dan nilai laporan/override untuk pemakaian tagih; sebagian jalur memakai `Math.max(0, ...)`. | Perlu mempertahankan pemisahan antara verifikasi pembacaan dengan pembuatan taksasi Manual ADD. Stand mundur yang diubah menjadi nol tetap perlu dikoreksi. |
| Verifikasi massal dan V3 final | UI memanggil endpoint V1/V2/V3; V3 membuat hasil resmi. `unverify` V3 memerlukan `SENIOR_UP` dan menolak pembatalan jika pembacaan telah terkait dengan Tagihan. | V3 final sesuai; prasyarat ring bawah untuk V2/V3 dan ikon yang hanya menampilkan ring terakhir belum sesuai/terbukti. Tes integrasi harus menguji audit koreksi, race, dan perlindungan hasil yang sudah ditagihkan. |
| Pratinjau verifikasi UI | Menghitung delta sendiri dan juga membatasi nilai negatif menjadi nol. | UI, endpoint satuan, dan endpoint massal belum memakai satu fungsi domain yang menjadi sumber aturan bersama. |
| Kunci hasil resmi | Schema unik pada `[meterId, periode]`; pembatasan satu hasil per pelanggan/periode dilakukan melalui query aplikasi sebelum tulis. | Belum terbukti aman untuk request bersamaan; perlu integration/concurrency test dan keputusan apakah invariant perlu dijaga database. |
| Pemetaan kondisi | Enum Prisma `KondisiCatat` memakai kode legacy; fungsi domain uji punya enum/kondisi yang berbeda. | Integrasi harus memetakan kondisi berdasarkan kebijakan yang disetujui, bukan mengasumsikan dua enum tersebut sama. |
| Endpoint pembacaan langsung | `POST /pembacaan` menghitung selisih di endpoint dan membuat hasil resmi langsung. | Jalur ini tidak memakai workflow V1/V2/V3; pemeriksaan periode terkunci juga belum tampak di handler. Harus diputuskan sebagai jalur impor/admin khusus atau ditutup dari alur operasional. |
| Verifikasi massal | Jalur V3 melakukan `PembacaanMeter.create` sendiri, tidak melalui `simpanPembacaanResmi`. | Aturan satu hasil per pelanggan/periode dan konsistensi dengan V3 satuan tidak dijaga oleh helper bersama di jalur massal. |
| Closing | Pratinjau mengembalikan hambatan, tetapi `bisaDitutup` hanya memeriksa status terkunci; penutupan menulis tagihan secara batch sebelum transaksi yang mengunci periode. | Perlu keputusan apakah hambatan tertentu harus memblokir closing, uji retry/kegagalan batch, dan proteksi race antara closing dengan pembacaan/verifikasi. |
| Bukti tes backend | Tes fokus yang ditemukan menguji fungsi hitung murni di `src/docs`; pencarian file test untuk modul server/domain tidak menemukan pasangan tes pada jalur yang ditinjau. | Belum ada bukti tes integrasi backend/PostgreSQL untuk verifikasi, hasil resmi, konkurensi, atau closing. |

Matriks kondisi lengkap dan aturan pilot ada di [Aturan Domain Kondisi Catat Meter](./aturan-kondisi-catatan-meter.md). Matriks itu membedakan aturan yang diputuskan dari kode yang masih memerlukan konfirmasi; ia belum berarti implementasi sudah sesuai.

### Kesimpulan teknis sementara

**Belum dapat dinyatakan bahwa logika backend sudah sesuai dan berfungsi end-to-end.** UI verifikasi petugas kini menandai ring berikutnya lewat satu aksi tanpa modal, dan Edit laporan petugas tersambung ke endpoint koreksi dengan audit before/after. Migration yang diperlukan sudah diterapkan ke Neon dan kedua halaman terkait telah diuji manual pada database lokal yang terhubung; jalur tersebut tetap belum memiliki tes integrasi PostgreSQL otomatis, dan konsistensi endpoint satuan, massal, closing, serta hasil resmi masih perlu dibuktikan.

## Posisi pekerjaan saat ini — 31 Oktober 2026

- [x] Matriks aturan pilot mendokumentasikan seluruh 22 enum `KondisiCatat`, termasuk kondisi yang dihitung, ditahan untuk review, atau memengaruhi status sambungan.
- [x] Codebook draf mencakup seluruh 22 enum dan label legacy yang ditemukan pada sampel; makna kandidat/ambigu ditandai, belum disahkan pemilik data.
- [x] Fondasi kontrak domain awal dibuat dan diuji untuk hitung `NORMAL` serta review 21 kondisi lain; 30 tes kontrak, 90 tes total, dan `pnpm typecheck` lulus pada 31 Oktober 2026. **Kontrak ini mendahului klarifikasi taksasi kondisi tertentu dan nilai minus; belum menjadi aturan final yang siap runtime.**
- [x] Peran aksi massal telah diluruskan: ia menjalankan ring V1/V2/V3; V3 membuat hasil resmi dan bukan taksasi otomatis.
- [x] Kontrak ring berbasis role, indikator ring terakhir, larangan STAFF memverifikasi, izin STAFF closing, serta batas koreksi pasca-Tagihan diklarifikasi dan didokumentasikan.
- [x] Spesifikasi kolom tabel verifikasi, fungsi ST Revisi, makna Tagihan (m³), serta kebutuhan alamat dan waktu catat didokumentasikan.
- [x] Modal Cari Lanjutan untuk kriteria yang memiliki field sumber dan filter toolbar Kondisi Catat tersambung ke query daftar; susunan kolom tabel verifikasi dan ekspor CSV diperbarui.
- [x] Field nullable `standAwalRevisi`/`kondisiRevisi` dan migration additive sudah diterapkan ke Neon setelah persetujuan eksplisit; status migration up to date dan kedua kolom terverifikasi ada.
- [x] Modal Edit laporan petugas tersambung ke `PATCH /laporan-harian/:id/koreksi`, termasuk ST Awal revisi, ST Akhir, kondisi koreksi, MB, meter tujuan, alasan wajib, dan audit before/after. Jalur laporan mandiri masih baca-saja.
- [x] Aksi Verifikasi menu klik-kanan laporan petugas tidak lagi membuka modal: request langsung menandai ring akun; server dan UI menjaga urutan V1 → V2 → V3. V3 tetap membuat hasil resmi.
- [x] Aksi cek ulang dipisahkan dari verifikasi langsung dan memerlukan catatan alasan.
- [ ] Definisikan field sumber sebelum menambahkan kriteria Jenis Pelanggan dan Deposit Range ke Cari Lanjutan.
- [x] `pnpm run typecheck`, `prisma validate`, dan `prisma generate` lulus setelah perubahan Manual Add.
- [x] `pnpm test`: 94 tes lulus; `pnpm run build`: build produksi berhasil dan route `/laporan/manual-add` terdaftar.
- [x] Migration `20261031140000_manual_add_laporan` diterapkan setelah persetujuan eksplisit; `prisma migrate status` menyatakan database up to date.
- [x] Verifikasi lokal 31 Oktober: GET `/api/v1/laporan-harian?pageSize=100&periode=202608&ringkas=true` kembali 200 dan UI menampilkan 100 dari 1.992 laporan. Akar 500 adalah proses Next dev yang masih memakai Prisma Client hasil generate lama (field `kondisiRevisi` tidak dikenal); restart proses memuat client baru dan menyelesaikan error.
- [x] Filter Manual Add All pernah diverifikasi pada UI lokal memakai periode daftar kerja terbaru `202608`, dengan 125 opsi rute dan 9 opsi petugas. Verifikasi interaksi sebelumnya memakai tombol pratinjau dan tidak lagi mewakili alur UI terbaru; tidak ada data manual yang dikirim saat pemeriksaan tersebut.
- [ ] Lint file terubah belum dapat dijalankan: `typescript-eslint` yang terpasang belum mendukung TypeScript 7.0.2. Ini blocker kompatibilitas tooling, bukan hasil lint bersih.
- [ ] Pemeriksaan format memakai konfigurasi proyek belum dapat dijalankan karena `prettier-plugin-tailwindcss` yang direferensikan `.prettierrc.json` tidak tersedia.
- [x] Pemilik produk mengklarifikasi taksasi otomatis pada kondisi kelainan tertentu, Manual ADD sebagai opsi jika tidak ada pencatatan, penanda Revisi Pencatat, dan penyimpanan audit nilai sebelum/sesudah.
- [x] Pemilik produk mengklasifikasikan 14 kode untuk taksasi otomatis, 3 kode untuk delta aktual, 2 kode untuk nilai manual, serta MB/rollover/Revisi Pencatat sebagai jalur khusus.
- [x] Pemilik produk menetapkan prioritas histori 12 bulan → 3 pemakaian terbesar → 3 bulan terakhir/riwayat tersedia, pembulatan ke atas tanpa minimum, stand resmi terakhir sebagai ST Awal/ST Akhir taksasi, dan batas aktif periode untuk DICABUT.
- [ ] Tetapkan definisi kode legacy/alias `TAA` dan `RK`, serta keputusan/batas kewajaran untuk nilai ekstrem.
- [x] Endpoint verifikasi langsung dan indikator menu menjaga prasyarat ring sebelumnya; V2 menunggu V1 dan V3 menunggu V1/V2.
- [x] Susun ulang tabel verifikasi sesuai urutan kolom, pisahkan Ring dari Status, tampilkan alamat, Tagihan m³, dan waktu catat; filter Kondisi Catat/Cari Lanjutan yang didukung juga diteruskan ke backend.
- [ ] Perbaiki self-unverify V1/V2; uji jalur koreksi administratif STAFF sebelum Tagihan; berikan STAFF izin final closing dengan prasyarat yang diuji.
- [ ] Tes integrasi memastikan koreksi setelah V3 hanya melalui role setara/lebih tinggi, tercatat, dan tidak mengubah hasil yang sudah dipakai Tagihan.
- [ ] Taksasi otomatis pada kondisi kelainan masih memerlukan implementasi runtime dan validasi histori; workflow koreksi ST Awal juga masih perlu diuji integrasi.
- [x] Kriteria histori Manual Add All: pembacaan resmi aktual nonnegatif, `alasanTaksir` kosong; data taksasi/override dikecualikan; fallback tiga tertinggi lalu seluruh histori tersedia. Keputusan terbaru: tanpa histori/meter pakai 0 m³ dan stand 0; jika meter aktif ganda pilih yang terbaru.
- [x] Halaman Manual Add satuan/All, endpoint pencarian/daftar/penyimpanan, alasan wajib, provenance dan audit telah diimplementasikan; laporan massal menunggu verifikasi, dan hasil V3 ditandai `MANUAL_ADD` agar tidak menjadi histori aktual.
- [x] Migration provenance Manual Add diterapkan ke Neon.
- [ ] Integrasi PostgreSQL/staging representatif, tes role/duplikat/race, dan uji seluruh alur pemilihan otomatis/submit masih perlu dilakukan.
- [ ] Aturan runtime 14 kondisi belum tersambung merata ke seluruh endpoint/UI; implementasi Manual Add adalah alur terpisah dan tidak membuktikan keseragaman aturan kondisi.
- [ ] Pemilik data mengonfirmasi definisi, alias, bukti, dan dampak periode/status untuk kode yang masih ambigu. Persetujuan definisi tidak dengan sendirinya mengesahkan formula billing.
- [ ] Belum dibuktikan kesetaraan V3 satuan/massal atau integrasi PostgreSQL untuk workflow kritis; Manual Add baru diverifikasi manual pada database yang terhubung, belum pada staging representatif.

## Fokus kerja berikutnya — backend correctness

1. Tutup gap implementasi pada [audit ring verifikasi dan koreksi](./aturan-verifikasi-berjenjang.md): larangan self-reopen V1/V2, final closing STAFF dengan prasyarat, dan konsistensi verifikasi massal.
2. Tambahkan audit append-only before/after dan tes endpoint/integrasi untuk koreksi, reopen, role setara/lebih tinggi, status Tagihan, dan race.
3. Uji workflow V1/V2/V3 satuan dan massal; V2 menunggu V3, V3 langsung membuat satu hasil resmi, ikon selalu mencerminkan ring terakhir, dan koreksi V3 melalui reopen/review.
4. Sahkan allowlist per kondisi untuk taksasi otomatis, pencatatan aktual (termasuk minus), atau review; pastikan nilai minus tidak dijepit menjadi nol.
5. Tetapkan detail rerata tiga bulan: periode sumber, validitas data, data taksasi/koreksi yang dikecualikan, histori tidak lengkap, pembulatan, dan provenance.
6. Putuskan kewenangan endpoint pembacaan langsung; pastikan validasi meter-pelanggan, periode terkunci, serta audit berlaku untuk semua jalur pembuatan hasil resmi.
7. Tetapkan invariant closing, uji PostgreSQL integrasi/konkurensi, dan tinjau schema/migration sesuai kebutuhan aktual.

## Gerbang menuju produksi

Urutan berikut adalah **backlog release-gate**, bukan daftar fitur tambahan yang terpisah dari roadmap. Untuk tiap gerbang, simpan tautan PR/commit, hasil tes, keputusan, dan penanggung jawab sebelum menandainya selesai.

### G0 — Sahkan ruang lingkup dan kebijakan

- [x] Tetapkan pemilik keputusan dan batas pilot.
- [x] Sahkan aturan pilot untuk kondisi pembacaan, akses warga, bukti/GPS, retensi, serta koreksi manual.
- [x] Tegaskan pilot shadow-only; tanpa penerbitan atau perubahan tagihan resmi.
- **Bukti lulus:** keputusan tercatat di bagian Catatan Keputusan G0 di atas, disetujui Wiska Prayoga pada 31 Oktober 2026.

### G1 — Tutup risiko akses dan integritas data

- [ ] Tinjau dan tutup temuan audit tentang akses sambungan, kecocokan meter-pelanggan, jalur pembuatan pembacaan yang melewati approval, dan komponen nominal tagihan dari client.
- [ ] Verifikasi temuan lain: identitas pencatat dari client, state transition yang bersamaan, histori koreksi, periode invalid, rollover, dan meter pengganti.
- [ ] Tegakkan invariant penting pada transaksi/database bila sesuai; tentukan aturan satu hasil resmi untuk pelanggan/periode dan kasus pergantian meter.
- [ ] Tambahkan tes negatif lintas akun/objek/role, tes transisi bersamaan, retry, dan rekonsiliasi hasil terhadap tagihan.
- **Bukti lulus:** setiap temuan memiliki status (fixed/not applicable/accepted), referensi perubahan, dan tes yang lulus; tidak ada temuan blocker tanpa risk owner yang menyetujui.

### G2 — Buktikan vertical slice MVP

- [ ] Uji alur tugas petugas, penyimpanan offline, outbox, retry/idempotensi, konflik payload, dan pemulihan lampiran.
- [ ] Uji laporan warga anonim/akun, jendela WIB, penolakan/kirim ulang, arsip bukti, dan verifikasi.
- [ ] Buktikan kedua sumber menghasilkan satu hasil resmi yang benar untuk sambungan, meter, dan periode terkait.
- [ ] Uji pengecualian domain: stand mundur, meter diganti/rollover/rusak, data tidak wajar, dan penggunaan tagih yang berbeda dari delta stand.
- [ ] Sediakan laporan rekonsiliasi dan daftar pengecualian sebelum closing.
- **Bukti lulus:** acceptance criteria P0 pada [Definisi MVP](./MVP-baca-meter-air.md) lulus otomatis dan di staging; hasil uji serta disposition tiap selisih tersimpan.

### G3 — Lulus kesiapan staging dan operasi

- [ ] Jalankan preflight data dan migration pada database staging representatif; tinjau konflik/backfill, waktu, lock, dan strategi pemulihan.
- [ ] Buktikan backup dapat dipulihkan ke lingkungan terisolasi; setujui RPO/RTO.
- [ ] Siapkan storage bukti privat, pengelolaan secret, log/metric/alert, health checks, serta runbook incident/support/rollback.
- [ ] Jalankan tes integrasi PostgreSQL, konkurensi, beban representatif, dan pemeriksaan keamanan yang sesuai cakupan.
- [ ] Latih penanganan kegagalan jaringan, antrean tertunda, upload yatim, closing gagal, dan koreksi manual.
- **Bukti lulus:** sign-off engineering, data, keamanan, dan operasi; migration, restore, monitoring, serta recovery drill mempunyai hasil terdokumentasi.

### G4 — Jalankan pilot terbatas dan putuskan go/no-go

- [ ] Jalankan pada ruang lingkup yang disetujui dengan dukungan dan fallback yang jelas.
- [ ] Rekonsiliasi terhadap proses/sumber lama sesuai keputusan billing.
- [ ] Pantau kehilangan/duplikasi sync, konflik, backlog, kualitas bukti, selisih billing, insiden, dan tiket support.
- [ ] Tinjau hasil dengan petugas, supervisor, billing, keamanan, operasional, dan Product Owner.
- **Bukti lulus:** kriteria keberhasilan MVP dipenuhi; seluruh selisih dan insiden memiliki keputusan; go/no-go tertulis.

### G5 — Penuhi persyaratan produksi

- [ ] Tutup blocker pilot; sahkan SLO/SLA, kapasitas, support/on-call, incident response, release/rollback, dan disaster recovery.
- [ ] Selesaikan security/privacy review dan remediasi temuan sesuai risiko.
- [ ] Dapatkan persetujuan produk, engineering, billing, keamanan, operasional, dan bisnis.
- [ ] Jika produksi mencakup koreksi pasca-tagihan, implementasikan dan uji workflow append-only maker-checker serta dampak finansial secara terpisah sebelum mengaktifkannya.
- **Bukti lulus:** keputusan produksi tertulis dari pemilik berwenang dengan risiko tersisa dan rencana mitigasi yang eksplisit.

## Urutan praktis berikutnya

1. G0 untuk kebijakan pilot sudah selesai; tuntaskan prasyarat pra-pilot yang tercantum di atas.
2. Mulai dari temuan audit akses/integritas yang berpotensi mengubah atau membocorkan data (G1).
3. Tuntaskan dan tes vertical slice MVP sesuai keputusan G0 (G2).
4. Verifikasi migration, data, isolasi dari closing/tagihan, restore, observability, dan prosedur di staging (G3).
5. Jalankan pilot terbatas hanya setelah go/no-go, evaluasi hasil, lalu baru putuskan produksi (G4–G5).

Jangan menyebut proyek “siap produksi” hanya karena build sukses, migration ada, atau halaman fitur sudah selesai. Status kesiapan berubah hanya saat bukti untuk exit gate terkait tersedia.

## Koreksi workflow Manual Add — 31 Oktober 2026

Perilaku yang diminta pemilik produk sudah diterjemahkan ke perubahan implementasi berikut; perubahan ini **belum dinyatakan lulus sampai seluruh validasi pada akhir sesi selesai**.

- Manual Add satuan mengizinkan penggantian hanya atas laporan yang pernah melewati ring V1/V2/V3. Penggantian mengharuskan alasan, menyimpan audit before/after, menghapus pembacaan resmi yang terhubung jika belum ditagihkan, mereset seluruh ring/koreksi, dan mengembalikan laporan ke verifikasi. Periode terkunci, laporan pending, pembacaan lain yang tidak terkait, atau hasil yang sudah masuk Tagihan ditolak.
- Manual Add All memfilter Petugas terlebih dahulu lalu Rute. Setelah keduanya dipilih, daftar kerja berstatus belum dicatat langsung ditampilkan beserta taksasi yang dihitung server; alamat dengan laporan/pembacaan resmi dikecualikan. Checkbox menentukan alamat yang akan ditambahkan ke antrean verifikasi.
- Tabel Manual Add All tidak menampilkan kolom Status, memisahkan ST Awal dan ST Akhir, serta menampilkan nilai stand yang sama. Semua alamat yang tampil dapat dipilih; tidak ada klasifikasi siap/ditahan. Pakai 0 hanya jika tidak ada histori pemakaian valid; stand mengambil `standLalu` dari pencatatan resmi terakhir, atau 0 jika belum ada pencatatan/meter aktif.
- Tombol proses hanya nonaktif saat belum ada pilihan atau proses sedang berjalan; alasan audit memiliki nilai umum otomatis sehingga tidak menghalangi aksi setelah checkbox dipilih.
- Batch massal diproses per 25 alamat. Progress diperbarui setelah setiap batch sukses disimpan; kegagalan parsial menyebut jumlah alamat yang selesai dan mempertahankan pilihan yang belum diproses.
- Hasil batch tetap dicatat sebagai `MANUAL_MASSAL` dengan alasan/provenance, masuk ke alur verifikasi, dan tidak langsung membuat pembacaan/tagihan resmi.
- **Koreksi terbaru:** langkah pratinjau dan tombolnya dihapus. Daftar belum disetorkan muncul otomatis setelah filter Petugas lalu Rute dipilih; taksasi dihitung pada pemuatan daftar dan tombol aksi hanya memproses pilihan checkbox.
- **Validasi 31 Oktober 2026:** `pnpm test` (94 tes), `pnpm run typecheck`, `pnpm run build`, dan `git diff --check` lulus setelah kolom/status serta fallback taksasi diperbarui. Tes transaksi overwrite dan pemeriksaan UI/API aktual masih tertunda; jangan gunakan alur ini untuk data produksi sebelum validasi integrasi tercatat.
- Kontrak produk telah diselaraskan pada [PRD](./PRD-baca-meter-air.md), batas pilot pada [MVP](./MVP-baca-meter-air.md), dan urutan release pada [Roadmap](./ROADMAP-baca-meter-air.md).

## Cara memperbarui status

- Gunakan tanggal pembaruan baru; jangan mempertahankan klaim lama seperti “build lulus” tanpa hasil CI terbaru.
- Tandai item hanya setelah ada bukti yang dapat ditinjau. Untuk keputusan, catat pemilik dan tanggal; untuk tes, catat perintah/lingkungan/hasil; untuk implementasi, tautkan PR atau commit.
- Jika satu item tidak berlaku, catat alasan dan siapa yang menyetujuinya—jangan menghapusnya diam-diam.
- Sinkronkan perubahan ruang lingkup ke [PRD](./PRD-baca-meter-air.md), acceptance criteria ke [MVP](./MVP-baca-meter-air.md), dan urutan/gate ke [Roadmap](./ROADMAP-baca-meter-air.md).
