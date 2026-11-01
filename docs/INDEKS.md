# Indeks Dokumentasi Baca Meter Air

**Versi:** 1.0 (dibuat pada rekonsiliasi dokumentasi)
**Tanggal:** 1 November 2026
**Status:** indeks dan register; bukan spesifikasi produk
**Peran dokumen:** sumber kebenaran untuk (a) peta sumber kebenaran per topik, (b) glosarium dan pemetaan peran, (c) log keputusan (DEC) dan (d) register isu terbuka (OPEN). Dokumen lain menaut ke sini dengan ID, bukan menyalin isinya.

## Cara membaca (manusia dan AI agent)

1. Mulai dari tabel **Sumber kebenaran per topik**. Bila dua dokumen berbeda tentang satu topik, dokumen sumber kebenaran yang berlaku.
2. Bedakan empat jenis pernyataan memakai **Legenda status**. Jangan membaca klaim "sudah" sebagai bukti tanpa tanda **Terverifikasi**.
3. ID `DEC-xx` berarti keputusan tercatat. ID `OPEN-xx` berarti belum ada keputusan yang dapat dibuktikan; jangan menerapkannya sebagai aturan.
4. Istilah yang bermakna ganda dijelaskan di **Glosarium**. Pakai istilah baku di sana pada dokumen baru.

## Sumber kebenaran per topik

| Topik | Sumber kebenaran | Dokumen lain hanya menaut |
|---|---|---|
| Tujuan, pengguna, kebutuhan (FR-xx) | [PRD](./PRD.md) | MVP, ROADMAP |
| Batas pilot dan acceptance criteria | [MVP](./MVP.md) | PRD, STATUS |
| Urutan rilis dan release gate | [ROADMAP](./ROADMAP.md) | STATUS |
| Status implementasi, bukti (tes, migration, lingkungan), log keputusan G0 | [STATUS](./STATUS.md) | ROADMAP |
| Ring V1/V2/V3, reopen, koreksi, kontrak tabel verifikasi | [Aturan Verifikasi Berjenjang dan Koreksi](./VERIFIKASI.md) | PRD, MVP, STATUS, RBAC |
| Perlakuan per kondisi catat, taksasi, aturan Manual Add / Manual Add All | [Aturan Domain Kondisi Catat](./ATURAN-KONDISI.md) | PRD, MVP, codebook |
| Makna dan alias kode legacy | [Codebook Kondisi Catat](./CODEBOOK.md) | aturan kondisi |
| Role teknis, izin aksi, cakupan data | [Matriks RBAC](./RBAC.md) | aturan verifikasi |
| Rancangan teknis target | [Arsitektur](./ARSITEKTUR.md) | PRD |
| Struktur folder kode, pemisahan concern, aturan penamaan dan dependensi | [Panduan Struktur Kode](./STRUKTUR-KODE.md) | instruksi workspace `.github/instructions/struktur-kode.instructions.md` |
| Temuan audit kode (snapshot 31 Oktober 2026) dan status temuan | [Hasil Audit](./AUDIT.md) | STATUS |
| Analisis data sampel `202601` | [Rekonsiliasi ProgresCater](./REKONSILIASI.md) | codebook |
| Keputusan (DEC), isu terbuka (OPEN), glosarium, pemetaan peran | dokumen ini | semua dokumen |

## Legenda status dan bukti

- **Disepakati:** keputusan tercatat (DEC atau keputusan G0 di STATUS).
- **OPEN:** belum ada keputusan yang dapat dibuktikan. Konflik dan opsi dicatat di register; opsi adalah usulan, bukan keputusan.
- **Klaim implementasi:** dokumen menyatakan kode berperilaku demikian. Rekonsiliasi 1 November 2026 tidak membaca kode, jadi klaim ini belum diverifikasi.
- **Terverifikasi:** ada bukti dengan format `perintah, lingkungan, tanggal, hasil`. Rekonsiliasi ini tidak menambahkan status Terverifikasi baru.

## Glosarium

| Istilah | Arti baku | Hindari |
|---|---|---|
| Ring | Penanda verifikasi V1 (Supervisor), V2 (Manager), V3 (Senior Manager/Direksi; Super Admin dipetakan ke V3 pada UI aksi cepat). Bukan "ring wilayah". | "tahap" sebagai sinonim pada dokumen baru |
| Pakai | Pemakaian periode berjalan yang ditinjau pada baris verifikasi; dapat berupa delta terukur atau taksasi. | menyamakan dengan `pemakaianM3` |
| `pemakaianRiil` | Delta terukur. | |
| `pemakaianM3` / Tagihan (m³) | Pemakaian yang ditagihkan, dalam m³ (bukan rupiah). Boleh berbeda dari delta stand. | |
| Lalu | Pemakaian periode pembanding sebelumnya. **Bukan stand meter.** | membaca "Lalu" sebagai stand |
| `standLalu` | Field stand awal pada `PembacaanMeter`. Bukan nilai stand sumber Manual Add All (DEC-01). | memakainya sebagai stand sumber |
| `standAkhir` | Stand akhir resmi pada `PembacaanMeter`. Menjadi stand sumber Manual Add All (DEC-01). | |
| ST Awal, ST Akhir, ST Revisi, ST Resmi | ST Revisi adalah koreksi ST Awal oleh manusia; ST Resmi adalah stand akhir yang disahkan V3. | menyamakan ST Revisi dengan ST Resmi |
| Taksasi | Nilai pemakaian hasil perhitungan histori, disimpan terpisah dari delta stand. Penanda pada hasil resmi memakai `alasanTaksir`. | "taksiran" pada dokumen baru |
| Reopen / `/unverify` | Mengembalikan hasil ke review untuk diverifikasi ulang. | |
| Baca Ulang / cek ulang | Aksi terpisah yang meminta alasan; bukan verifikasi. | menyebutnya reopen |
| Hasil resmi | Satu `PembacaanMeter` hasil V3. Kiriman intake (laporan petugas/warga) bukan hasil resmi. | |
| Manual Add / `MANUAL_ADD` / `MANUAL_MASSAL` | Fitur Manual Add; `MANUAL_ADD` adalah nilai `alasanTaksir` pada hasil resmi V3 dari Manual Add; `MANUAL_MASSAL` adalah jenis input Manual Add All menurut STATUS. | |
| Warga / pelanggan / `USER` | Warga adalah pengguna portal; role teknisnya `USER`; pelanggan adalah data sambungan. Tautan `LanggananWarga` bukan bukti kepemilikan. | "role warga" sebagai nama enum |
| Pilot shadow-only | Hasil pilot hanya untuk paralel dan rekonsiliasi, tidak menerbitkan atau mengubah tagihan resmi. | |

## Pemetaan peran

| Istilah di dokumen | Role teknis | Status |
|---|---|---|
| V1 / Supervisor | `SUPERVISOR` | sesuai RBAC |
| V2 / Manager | `MANAGER` | sesuai RBAC |
| V3 | `SENIOR_MANAGER`, `DIREKSI`; `SUPER_ADMIN` pada UI aksi cepat | sesuai RBAC |
| STAFF / Operator Admin | `STAFF` | sesuai RBAC |
| Petugas pencatat / lapangan | `PELAKSANA` | sesuai RBAC |
| Warga / pelanggan | `USER` | arti dan cakupan portal belum dikonfirmasi (OPEN-19) |
| Supervisor Operasional / Admin Utama (G0, koreksi pilot) | belum dipetakan | OPEN-19 |
| Bagian Langganan | belum dipetakan | OPEN-19 |
| Pengelola operasional/billing | belum dipetakan | OPEN-19 |
| Admin sistem (PRD) | belum dipetakan eksplisit | OPEN-19 |

## Log keputusan

Keputusan DEC-01 sampai DEC-07 dicatat dari instruksi pemilik produk pada sesi rekonsiliasi dokumentasi 1 November 2026. Belum ada catatan persetujuan tertulis terpisah. Keputusan G0 untuk pilot (31 Oktober 2026) tetap tercatat di [STATUS](./STATUS.md).

| ID | Keputusan | Sumber kebenaran yang memuatnya |
|---|---|---|
| DEC-01 | Manual Add All: ST Awal = ST Akhir = `standAkhir` dari pembacaan resmi terakhir sebelum periode berjalan. `standLalu` bukan stand sumber; "Lalu" berarti pemakaian periode pembanding. | aturan kondisi (butir 7 Manual Add) |
| DEC-02 | Manual Add All tanpa histori pemakaian valid tetapi dengan stand resmi sebelumnya dan meter aktif mengusulkan 5 m³ berdasarkan minimum Perdir; ST Awal/ST Akhir memakai stand resmi terakhir (DEC-01). Usulan tetap menunggu verifikasi. Tanpa stand resmi atau meter aktif, jangan mengarang nilai: tandai Perlu Ditinjau dan jangan izinkan pengiriman. Kebijakan tanpa histori untuk 14 kondisi taksasi otomatis tetap OPEN-02. | aturan kondisi |
| DEC-03 | V2 dan V3 boleh memproses tanpa ring yang lebih rendah. Urutan V1→V2→V3 bukan prasyarat. Hanya ring aktor yang benar-benar memverifikasi yang diisi; tidak ada histori ring palsu. | aturan verifikasi |
| DEC-04 | Super Admin berakses penuh ke semua modul tetapi tunduk pada invariant bisnis: periode terkunci, validasi meter/stand, status resmi, dan perlindungan hasil yang sudah masuk tagihan. | RBAC; aturan verifikasi |
| DEC-05 | Izin final closing untuk STAFF belum disepakati. Tidak boleh ditulis sebagai keputusan atau diimplementasikan atas asumsi. Dicatat sebagai OPEN-01. | RBAC; OPEN-01 |
| DEC-06 | Koreksi setelah V3 tidak boleh menjadi jalan mengubah hasil resmi atau tagihan tanpa jejak. Hasil resmi aktif hanya berubah lewat reopen, koreksi, lalu verifikasi ulang. Celah implementasi ditandai belum selesai. | aturan verifikasi |
| DEC-07 | Pisahkan spesifikasi yang disepakati, keputusan terbuka, kondisi implementasi, dan bukti status. Jangan menulis "sudah" tanpa bukti yang dapat diverifikasi. | Legenda di dokumen ini |

## Register OPEN

Setiap butir mencatat konflik atau celah beserta bukti dokumennya. Opsi hanya usulan untuk membantu keputusan. Bila sebuah butir diputuskan, pindahkan ke log keputusan, perbarui sumber kebenaran, dan ubah dokumen lain hanya sebagai tautan.

**OPEN-01 Izin final closing STAFF.** PRD FR-17, MVP, ROADMAP, dan STATUS memperlakukannya sebagai tugas STAFF; RBAC dan aturan verifikasi menyebutnya belum disepakati. Klaim implementasi: final close dibatasi `SENIOR_UP`.
- Opsi A, STAFF boleh: operasi lebih cepat, tetapi STAFF tidak ber-ring verifikasi dan closing mengunci periode, jadi butuh prasyarat dan pemisahan tugas.
- Opsi B, tetap `SENIOR_UP`: pemisahan tugas terjaga, beban ke senior; FR-17 diubah.
- Opsi C, dua langkah (STAFF menyiapkan, `SENIOR_UP` mengesahkan): kompromi, butuh status baru pada alur closing.

**OPEN-02 Histori tidak tersedia untuk 14 kondisi taksasi otomatis.** DEC-02 mengatur fallback Manual Add All secara terpisah. Untuk 14 kondisi, belum diputuskan apakah tanpa histori valid harus menghasilkan nilai usulan, ditahan untuk review, atau mengikuti kebijakan lain; jangan menerapkan fallback Manual Add All (5 m³) ke jalur otomatis tanpa keputusan.

**OPEN-03 Mode pilot untuk 14 kondisi.** FR-07 (P0) dan MVP menuntut taksasi; exit criteria aturan kondisi memblokir runtime sampai sign-off; klaim kontrak kode: selain `NORMAL` diarahkan ke review; STATUS pra-pilot: semua kondisi selain `NORMAL` masuk review.
- Opsi A, pilot review-only untuk 14 kondisi: aman untuk shadow; acceptance taksasi diuji kemudian.
- Opsi B, auto-taksasi aktif di pilot: butuh sign-off OPEN-04 dan OPEN-10 serta implementasi runtime sebelum pilot.

**OPEN-04 Titik terbuka hierarki taksasi.**
- (a) Tingkat 3 ("3 bulan terakhir atau seluruh histori valid") hanya tercapai bila nilai kurang dari 3, jadi praktis "seluruh histori yang ada". 14 kondisi dan Manual Add All menulisnya berbeda; konfirmasi maksud dan samakan.
- (b) Tingkat 2 (rata-rata tiga tertinggi) tidak pernah lebih rendah daripada rata-rata seluruh nilai yang sama, sehingga condong ke atas; konfirmasi memang dikehendaki.
- (c) "Stand resmi terakhir" pada 14 kondisi diasumsikan sama dengan `standAkhir` (DEC-01); belum tertulis.
- (d) Kriteria histori valid untuk 14 kondisi (taksasi/koreksi lama dikecualikan atau tidak) belum ditetapkan.
- (e) Hasil taksasi ber-ST Awal = ST Akhir harus dapat dibedakan dari pemakaian riil 0 yang valid agar tidak menurunkan taksasi berikutnya; penanda untuk 14 kondisi belum ditetapkan (Manual Add memakai `MANUAL_ADD`).

**OPEN-05 `METER_MUNDUR` versus stand minus.** `METER_MUNDUR` ada di allowlist taksasi, sedangkan invarian melarang stand minus diganti taksasi sebagai fallback. Penafsiran yang konsisten dengan keduanya: kondisi yang dipilih petugas ditaksasi; stand minus pada `NORMAL`/`STAND_TEMPEL`/`STAND_KONSUMEN` disimpan dan ditahan untuk review. Penafsiran ini belum tertulis sebagai keputusan.

**OPEN-06 Kunci hasil resmi dan kasus MB.** Arsitektur dan PRD menyebut per meter/periode; STATUS menyebut unique `[meterId, periode]` di schema tetapi per pelanggan/periode di query; FR-06 menulis "kunci domain yang disahkan". `PembacaanMeter` hanya menyimpan satu `meterId`, padahal MB melibatkan dua segmen meter.
- Opsi A, satu hasil per pelanggan/periode plus tabel segmen meter: konsisten dengan tagihan, butuh migrasi.
- Opsi B, tetap per meter/periode: tanpa migrasi, tetapi MB menjadi dua baris dan harus diagregasi; risiko dua hasil resmi per pelanggan/periode.

**OPEN-07 Retensi 3 bulan versus arsip immutable.** PRD dan G0 mewajibkan hapus/anonimkan foto, GPS, kontak, dan log pribadi setelah 3 bulan; migration `20261031000000_laporan_mandiri_kiriman_immutable` memblokir UPDATE dan DELETE lewat trigger.
- Opsi A, pengecualian trigger untuk job retensi (role/flag khusus dan audit): memenuhi retensi, melemahkan jaminan immutable.
- Opsi B, pisahkan metadata immutable dari foto/PII, hapus object dan kolom PII sementara baris tetap: jejak terjaga, butuh perubahan skema.
- Opsi C, ubah kebijakan retensi: tidak sesuai G0.
- Konsekuensi umum: foto yang sudah dihapus tidak dapat menjadi bukti koreksi pasca-tagihan; perlu batas waktu koreksi.

**OPEN-08 Penghapusan `PembacaanMeter` saat reopen dan Manual Add.** PRD dan arsitektur menuntut "jangan dihapus diam-diam" dan histori append-only. Klaim implementasi: `/unverify` V3 dan Manual Add satuan menghapus pembacaan yang belum ditagihkan; alasan dan before/after pada jalur reopen belum tercatat.
- Opsi A, tetap hapus tetapi audit wajib lengkap (snapshot sebelum, alasan, aktor): perubahan skema minimal, histori hanya di audit log.
- Opsi B, tandai `superseded` dan buat versi baru: histori kuat, tetapi butuh perubahan skema dan query downstream memilih baris aktif.

**OPEN-09 Syarat koreksi STAFF dan cakupannya.** G0: koreksi manual wajib alasan, bukti foto, dan persetujuan supervisor yang berbeda dari petugas. FR-16 dan RBAC: alasan dan audit saja. RBAC membolehkan STAFF mengedit nilai "hasil koreksi V1/V2/V3". Klaim implementasi: `/:id/koreksi` menolak periode terkunci dan hasil bertagihan, tetapi tidak disebut menolak hasil V3 resmi aktif (bertentangan dengan DEC-06).
- Opsi A, syarat G0 berlaku untuk semua koreksi manual termasuk STAFF: ketat, lambat.
- Opsi B, syarat G0 hanya untuk pilot; STAFF cukup alasan dan audit: cepat, tanpa maker-checker.
- Opsi C, STAFF hanya pada hasil belum resmi atau yang sedang di-reopen; perubahan hasil V3 lewat V3 ulang: sejalan DEC-06.

**OPEN-10 Definisi kode dan alias; aktivasi taksasi pada kode belum terdefinisi.** Allowlist 14 kondisi memuat kode yang belum didefinisikan (`TTB`, `MTA`, `DK`, `LOS_METER`, `BMK_BMB`, `METER_DALAM_AIR`). Alias `TAA` dan `RK` belum dipetakan; `STAND_TEMPEL` belum jelas; kapasitas digit `MUDA_KEMBALI` belum disahkan.
- Opsi A, sign-off definisi per kode sebelum aktivasi: aman, lambat.
- Opsi B, aktivasi sesuai allowlist dengan label estimasi dan review: cepat, risiko salah arti.

**OPEN-11 Workflow nilai manual `TIDAK_ADA_AIR` dan `TIDAK_DIPAKAI`.** Nilai ditentukan manusia, tetapi workflow-nya berstatus "perlu dibuat". Pada sampel `202601` kedua label mencakup 3.057 baris (2.718 + 339 dari 22.549, sekitar 13,6%). Bentuk antrean/UI dan siapa yang menetapkan nilai belum diputuskan.

**OPEN-12 Rumus Dev %.** Kolom wajib (FR-18, P0), tetapi rumus, perilaku saat Lalu nol/kosong, dan pembulatan belum ditetapkan. Sampai ditetapkan, jangan dipakai untuk keputusan otomatis.

**OPEN-13 "Taksasi pemakaian besar atau potensial" oleh Direksi.** Hanya disebut di RBAC dan aturan verifikasi; definisi ambang dan alurnya tidak ada.

**OPEN-14 Pemetaan kolom taksasi.** Belum jelas taksasi disimpan di `pemakaianRiil`, `pemakaianM3`, atau kolom lain, dan apa isi kolom Pakai untuk taksasi. Invarian mewajibkan taksasi terpisah dari delta stand.

**OPEN-15 Reopen dan aktor.** "Role setara atau lebih tinggi dari V3" tidak terdefinisi, dan belum diputuskan apakah aktor yang sama boleh tercatat pada ring berbeda.

**OPEN-16 Jadwal pilot 1–7 November 2026 versus gerbang.** Seluruh item pra-pilot dan gerbang G1–G3 di STATUS tercatat belum selesai, dan tidak ada bukti go/no-go. Aturan STATUS sendiri: tanggal pilot harus ditunda bila prasyarat belum selesai. Dokumen ini tidak menetapkan tanggal baru. Keputusan yang dibutuhkan: penundaan formal, atau bukti kelulusan gerbang.

**OPEN-17 Lingkungan migration Neon.** STATUS menyebut migration "diterapkan ke Neon" tanpa label dev/staging/prod; ROADMAP menyatakan penerapan ke staging/produksi belum diverifikasi. Jangan membaca klaim itu sebagai bukti staging atau produksi.

**OPEN-18 `REV.PENCATAT` pada data legacy.** Pada sampel, 490 baris memakai label ini di `ketcatat` sementara `kondisimeternama`/`kondisimeterkode` kosong, sehingga kondisi asli baris itu tidak tersedia. Alur baru memperlakukannya sebagai penanda workflow, bukan kondisi meter. Cara mengimpor baris legacy tanpa kehilangan kondisi asli belum diputuskan.

**OPEN-19 Pemetaan peran.** Lihat tabel Pemetaan peran: warga/`USER`, Supervisor Operasional/Admin Utama, Bagian Langganan, pengelola billing, dan Admin sistem belum dipetakan penuh. Juga terbuka: role internal tambahan, approval kedua di luar V3, dan dukungan multi-role (model `User.role` hanya satu role).

**OPEN-20 Kewenangan endpoint `POST /pembacaan`.** Klaim audit: jalur ini membuat hasil resmi langsung tanpa V1/V2/V3 dan tanpa pemeriksaan periode terkunci. Perlu diputuskan sebagai jalur impor/admin khusus dengan izin sempit dan audit, atau ditutup.

**OPEN-21 Lint terblokir; format sudah dipulihkan.** Lint masih tertahan karena `typescript-eslint` yang terpasang belum mendukung TypeScript 7.0.2 (lihat STATUS). Prettier sudah dipulihkan 1 November 2026 dengan memasang plugin Tailwind yang dirujuk konfigurasi dan mengaktifkan Format On Save di workspace; verifikasi format lanjutan masih perlu dijalankan sesuai file yang diubah.

## Konvensi penulisan

1. Satu sumber kebenaran per topik; dokumen lain menaut, tidak menyalin aturan.
2. Header setiap dokumen: Versi, Tanggal, Status, dan Peran dokumen (sumber kebenaran untuk apa; bergantung pada apa).
3. ID stabil: `FR-xx` (PRD), `DEC-xx` dan `OPEN-xx` (dokumen ini). ID aturan per baris untuk aturan kondisi dan verifikasi diusulkan tetapi belum dibuat.
4. Hindari kata relatif waktu ("kini", "terbaru", "saat ini") tanpa tanggal; catat perubahan sebagai entri bertanggal.
5. Klaim "sudah/lulus" wajib menyertakan bukti (`perintah, lingkungan, tanggal, hasil`); bila tidak ada, tulis "klaim; belum diverifikasi".
6. Pakai istilah baku di Glosarium: taksasi, ring, Manual Add.

## Riwayat perubahan dan batas rekonsiliasi

**1 November 2026, rekonsiliasi dokumentasi.** Dokumen ini dibuat. Dokumen lain diperbarui secara terarah: kebijakan stand Manual Add All, status klaim ring V2/V3, izin closing STAFF, jadwal pilot, hierarki taksasi, label data, header (versi, tanggal, peran dokumen), dan tautan.

**Yang tidak dilakukan atau tidak diverifikasi:** kode, schema, migration, dan database tidak dibaca atau diubah; tes, build, E2E, pilot, dan deployment tidak dijalankan; `git status` tidak dapat diperiksa karena repo tidak tersedia pada sesi rekonsiliasi. Semua klaim implementasi di dokumen tetap berstatus klaim sampai diverifikasi terhadap repo.
