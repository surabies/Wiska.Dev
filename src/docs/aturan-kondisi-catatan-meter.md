# Aturan Domain Kondisi Catat Meter

**Versi:** 0.3 (hierarki taksasi dan stand acuan; 31 Oktober 2026)  
**Status:** pemilik produk menetapkan klasifikasi kondisi, prioritas histori, pembulatan, dan stand acuan. Histori valid/no-history untuk Manual Add All sudah diputuskan; histori untuk taksasi otomatis 14 kondisi, pemetaan alias, tes integrasi, dan implementasi runtime aturan kondisi masih terbuka.
**Sumber enum:** `prisma/schema/tagihan.prisma`, enum `KondisiCatat`.  
**Tujuan:** menetapkan apa yang boleh dihitung otomatis, apa yang harus ditahan, bukti yang dibutuhkan, dan dampak terhadap hasil resmi/tagihan. Ini kontrak domain untuk menyatukan backend, UI verifikasi, impor, dan tes.

Makna dan alias kode legacy yang diketahui atau masih perlu dikonfirmasi dicatat terpisah dalam [Codebook Kondisi Catat Meter](./codebook-kondisi-catatan-meter.md). Dokumen ini membedakan pembacaan terukur, taksasi otomatis pada kondisi yang disahkan, nilai minus yang dipertahankan, dan kondisi yang harus direview.

Fondasi kontrak domain awal telah dibuat di [`aturan-kondisi-catatan.ts`](../lib/domain/aturan-kondisi-catatan.ts) dengan tes tabel-driven di [`aturan-kondisi-catatan.test.ts`](../lib/domain/aturan-kondisi-catatan.test.ts). Kontrak ini hanya menghitung pembacaan `NORMAL`; kondisi lain, termasuk `METER_RUSAK`, diarahkan ke review. Modul ini **belum dipakai oleh endpoint atau UI**, jadi implementasi runtime masih belum terbukti mengikuti matriks.

Urutan kewenangan V1/V2/V3, koreksi setelah verifikasi, serta audit implementasinya didokumentasikan terpisah di [Aturan Verifikasi Berjenjang dan Koreksi](./aturan-verifikasi-berjenjang.md).

## Invarian untuk semua kondisi

1. Simpan kondisi yang dicatat petugas dan bukti/provenance-nya; jangan mengganti kondisi mentah dengan interpretasi yang belum disahkan.
2. Pisahkan stand awal, stand akhir, ST Revisi, `pemakaianRiil`, taksasi, dan `pemakaianM3` (pemakaian tagih). Nilai tagih tidak boleh dianggap sama dengan delta stand tanpa aturan yang menyatakannya.
3. Jangan pernah mengubah nilai minus menjadi nol diam-diam. Simpan nilai input dan/atau delta bertanda sesuai sumber; tandai perlu review dan jangan mengesahkan sebagai pembacaan/tagihan final sampai ada keputusan.
4. **Pilot shadow-only:** hasil pembacaan dan taksiran tidak menerbitkan atau mengubah tagihan resmi. Formula tarif, minimum pemakaian, dan kebijakan finansial lama tidak otomatis berlaku pada pilot.
5. Semua persetujuan/koreksi manual mencatat nilai sebelum/sesudah, alasan, bukti, aktor, waktu server, serta approver. Petugas lapangan tidak boleh menyetujui koreksinya sendiri.
6. Ketiadaan foto, GPS, histori stand, meter aktif, atau data penggantian tidak boleh ditutupi dengan default yang terlihat sukses.

## Status aturan

- **Klarifikasi terbaru pemilik produk:** 14 kode kelainan ditetapkan sebagai kandidat taksasi otomatis dengan prioritas histori 12 bulan → rata-rata 3 pemakaian terbesar → rata-rata 3 bulan terakhir/riwayat yang tersedia. ST Awal dan ST Akhir memakai stand resmi terakhir; Pakai menyimpan taksasi secara terpisah. Hasil dibulatkan ke atas tanpa minimum otomatis. Runtime untuk kelompok ini belum diaktifkan.
- **Manual ADD/Manual ADD All:** tetap menjadi opsi jika rute tidak tercatat sama sekali, misalnya petugas sakit; bukan satu-satunya jalur taksasi.
- **Perlakuan minus:** nilai minus dari stand/pemakaian dicatat apa adanya, tidak dijepit menjadi nol atau diganti taksasi otomatis sebagai fallback, lalu ditahan untuk review sebelum pengesahan.
- **Keputusan per kategori:** pembacaan/delta untuk `NORMAL`, `STAND_TEMPEL`, dan `STAND_KONSUMEN`; nilai ditentukan manusia untuk `TIDAK_ADA_AIR` dan `TIDAK_DIPAKAI`; rumus khusus untuk `MB` dan `MUDA_KEMBALI`; serta taksasi otomatis untuk kode anomali yang didaftar di bawah.
- **Untuk taksasi otomatis 14 kondisi, belum disahkan:** definisi histori valid (termasuk apakah taksasi/koreksi lama dikecualikan), nilai tak wajar, dan pemetaan `TAA`/`RK` ke kode/alias sumber yang tepat. Manual Add All memiliki kriteria histori dan no-history tersendiri pada bagian berikut.
- **Bukan aturan pilot:** rumus minimum 5 m³, taksiran bulan lalu otomatis, atau keputusan nol otomatis. Fungsi lama/legacy boleh tetap diperlukan untuk reproduksi tagihan historis, tetapi tidak menjadi kebijakan workflow pilot.

### Klasifikasi pemilik produk per kelompok kondisi

Tabel ini mencatat klasifikasi yang diberikan pemilik produk. Ini adalah kontrak bisnis dokumenter untuk implementasi berikutnya; belum mengubah runtime. Untuk kode yang juga memiliki spesifikasi legacy berbeda, keputusan baru di sini berlaku untuk perilaku target aplikasi dan tidak mengubah tagihan historis.

| Kelompok/kode | Arah perlakuan yang dirumuskan | Status keputusan |
|---|---|---|
| `NORMAL`, `STAND_TEMPEL`, `STAND_KONSUMEN` | Gunakan pembacaan aktual: `Pakai = ST Akhir - ST Awal`. `STAND_KONSUMEN` tetap mempertahankan sumber input konsumen. Nilai minus disimpan dan direview, tidak dijepit ke nol. | Klasifikasi diberikan pemilik produk; STAND_TEMPEL/STAND_KONSUMEN tetap perlu bukti sesuai sumbernya. |
| `TIDAK_ADA_AIR`, `TIDAK_DIPAKAI` | Pemakaian tidak dibuat otomatis dari rumus; nilai ditentukan manusia. Jangan menyimpulkan otomatis dari label saja. `TAA` disebut sebagai istilah untuk tidak ada air, tetapi perlu dipetakan ke label/enum resmi. | Klasifikasi diberikan pemilik produk; pemetaan alias TAA dan alasan/nilai manual perlu dicatat. |
| `MB` | Jalur khusus penggantian meter: input stand angkat meter lama dan stand awal meter baru melalui modal; hitung gabungan segmen meter. Bila input menghasilkan minus, simpan dan minta koreksi; jangan dijepit ke nol. | Rumus dasar tersedia di dokumen perhitungan legacy; perlu menyelaraskan formula, model, UI, dan tes. |
| `MUDA_KEMBALI` | Bukan taksasi rata-rata: jalur rollover meter dengan rumus berdasarkan kapasitas meter. Contoh meter 4 digit: `(10000 - ST Awal) + ST Akhir`; kapasitas aktual harus diverifikasi. | Rumus ditemukan pada dokumen lama; kapasitas digit/validasi rollover dan jalur UI perlu disahkan. |
| `RUMAH_KOSONG`, `METER_RUSAK`, `METER_MATI_ADA_AIR`, `METER_MUNDUR`, `METER_TERBALIK`, `METER_DALAM_AIR`, `LOS_METER`, `BMK_BMB`, `TTB`, `MTA`, `TERHALANG`, `ADA_ANJING`, `DK`, `DICABUT` | Taksasi otomatis memakai prioritas: rata-rata 12 bulan; jika tak cukup, rata-rata 3 nilai pemakaian terbesar; jika tak cukup, rata-rata 3 bulan terakhir atau histori valid yang tersedia. ST Awal/ST Akhir = stand resmi terakhir; hasil taksasi di Pakai. Bulatkan ke atas tanpa minimum. | Daftar eksplisit diberikan pemilik produk; kriteria histori valid/no-history untuk runtime otomatis masih perlu ditetapkan. `DICABUT` berbeda dari logika billing historis dan hanya berlaku jika sambungan aktif pada periode terkait. |
| `REV_PENCATAT` | Penanda workflow khusus pada alamat tertentu; hanya alamat yang ditandai boleh mengedit ST Awal. Dapat dipilih petugas saat pencatatan atau diaktifkan verifikator saat mengubah kondisi ke Revisi Pencatat. Koreksi menghitung ulang Pakai dari stand yang dikoreksi. | Semantik diberikan pemilik produk; kondisi asal dan semua nilai before/after tetap disimpan di audit. |
| `RK` / `TAA` / nilai sumber tidak dikenal | Jangan membuat kode baru atau menebak alias. `RK` belum ada dalam enum; `TAA` belum dipetakan. Simpan nilai sumber dan arahkan ke pemetaan/review sampai alias disahkan. | Perlu pemetaan sumber/codebook. |

#### Kontrak taksasi otomatis kondisi (kriteria histori masih terbuka)

- Trigger: 14 kondisi yang tercantum pada klasifikasi di atas; kondisi/alias yang tidak dikenal tidak otomatis ditaksasi.
- Prioritas histori: (1) rata-rata 12 bulan, (2) bila data 12 bulan tidak cukup, rata-rata tiga nilai pemakaian terbesar yang tersedia, (3) bila tiga nilai belum tersedia, rata-rata tiga bulan terakhir atau seluruh histori valid yang tersedia. Bila tidak ada histori sama sekali, minta keputusan manusia.
- Pembulatan: ke atas ke m³ bulat; tanpa minimum otomatis.
- Stand Awal dan ST Akhir catatan taksasi diset ke stand resmi terakhir; sistem mencatat bahwa Pakai adalah taksasi, bukan delta stand.
- DICABUT hanya dapat ditaksasi jika sambungan aktif pada periode terkait dan tanggal efektifnya tervalidasi.
- Saat Revisi Pencatat mengubah ST Awal, hitung ulang Pakai berdasarkan stand yang direvisi; simpan nilai taksasi dan hasil sebelum/sesudah di audit.
- Kriteria histori valid (termasuk taksasi atau koreksi lama, meter aktif, dan perubahan sambungan) masih perlu ditetapkan; jangan mengasumsikan record mana pun otomatis layak.

## Matriks seluruh enum `KondisiCatat`

### A. Kondisi inti

| Enum | Makna/interpretasi yang tersedia | Aturan hitung sesuai klarifikasi | Tindakan dan data wajib | Status |
|---|---|---|---|---|
| `NORMAL` | Pembacaan lapangan normal. | `pemakaianRiil = standKini - standResmiTerakhir`. Delta minus disimpan apa adanya dan ditahan untuk review, bukan dijepit menjadi nol atau ditaksir otomatis. | Foto wajib; simpan stand sebelumnya yang dipakai, stand kini, meter, periode, petugas, waktu server, dan GPS/akurasi bila tersedia. Nilai tagih tetap terpisah dan tidak diterbitkan selama pilot. | Ditetapkan; minus perlu tes |
| `METER_RUSAK` | Meter ada tetapi angka tidak dapat dipercaya. | Taksasi otomatis rata-rata 3 bulan pada pencatatan; nilai harus diberi sumber taksasi dan tetap menunggu review/pengesahan. Jangan langsung menerbitkan tagihan resmi. | Foto kondisi meter; riwayat tiga bulan yang digunakan; catatan verifikasi dan setiap koreksi manual. | Klasifikasi owner; formula rinci perlu dites |

### B. Kode kondisi lain

| Enum | Makna/interpretasi yang tersedia | Aturan hitung sesuai klarifikasi | Tindakan dan data wajib | Status |
|---|---|---|---|---|
| `TIDAK_DIPAKAI` | Pemilik produk menetapkan jumlah pemakaian ditentukan manusia; label saja tidak membuktikan penggunaan nol. | Bukan taksasi rata-rata otomatis. Pengguna berwenang menetapkan nilai pemakaian, default nol tidak boleh diasumsikan tanpa keputusan manusia. | Catat nilai dan alasan manual, aktor, waktu, bukti, dan approval sesuai ring. | Klasifikasi owner; workflow manual perlu dibuat |
| `RUMAH_KOSONG` | Label sumber `RMH/TANAH KSG`; aplikasi mengelompokkan sebagai diduga kosong. | Taksasi otomatis rata-rata 3 bulan; jangan otomatis mengubah menjadi nol. | Verifikasi bukti/kondisi sambungan dan tinjau taksasi; beri label estimasi. | Klasifikasi owner; formula rinci perlu dites |
| `STAND_TEMPEL` | Angka stand dibaca dari stiker/label yang ditinggalkan pelanggan. | Hitung delta aktual `ST Akhir - ST Awal`; simpan sumber stand, jangan taksir rata-rata. | Pertahankan foto/bukti dan kategori sumber; review bila stand minus/tidak valid. | Klasifikasi owner; codebook bukti perlu dilengkapi |
| `STAND_KONSUMEN` | Angka stand dilaporkan konsumen/offsite. | Hitung delta aktual `ST Akhir - ST Awal`; tidak ditaksasi rata-rata, tetapi hasil tetap menunggu verifikasi sesuai alur sumber. | Pertahankan sumber input konsumen dan bukti kiriman. | Klasifikasi owner |
| `METER_MATI_ADA_AIR` | Meter tidak bergerak saat air tersedia; masalah alat/hasil tidak terukur. | Taksasi otomatis rata-rata 3 bulan; nilai tetap berstatus taksasi dan menunggu review/pengesahan. | Bukti kondisi meter, riwayat tiga bulan, serta catatan verifikator. | Klasifikasi owner; formula rinci perlu dites |
| `METER_MUNDUR` | Stand lebih kecil dari stand sebelumnya. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner; simpan stand mentah dan label taksasi, jangan mengganti input stand. | Audit stand mentah, histori yang mendasari taksasi, dan review; jangan mengubah delta minus mentah menjadi nol. | Klasifikasi owner; beda dari kebijakan lama, perlu tes |
| `METER_TERBALIK` | Label sumber menyatakan meter terpasang/aliran terbalik. | Taksasi otomatis rata-rata 3 bulan; tetap catat kondisi dan bukti teknis. | Review teknis/kunjungan ulang dan audit taksasi. | Klasifikasi owner; codebook perlu konfirmasi |
| `METER_DALAM_AIR` | Kode legacy tentang meter terkait air; definisi operasional perlu disahkan. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner. | Bukti/keterangan kondisi dan audit nilai histori yang digunakan. | Klasifikasi owner; codebook perlu dilengkapi |
| `LOS_METER` | Akronim/istilah legacy belum didefinisikan secara resmi. | Taksasi otomatis rata-rata 3 bulan; tidak menambahkan faktor 1,25 atau denda tanpa keputusan terpisah. | Simpan kode mentah, taksasi/provenance, dan minta definisi codebook. | Klasifikasi owner; rumus legacy 1,25 tidak disahkan |
| `BMK_BMB` | Kode gabungan; arti masing-masing unsur belum disahkan. | Taksasi otomatis rata-rata 3 bulan; jangan menambahkan denda atau membagi kode tanpa keputusan. | Simpan kode mentah, taksasi/provenance, dan konfirmasi apakah BMK/BMB perlu dipisah. | Klasifikasi owner; codebook perlu dilengkapi |
| `TTB` | Akronim legacy belum terdefinisi; dokumen legacy mengartikan rumah terkunci, belum disahkan. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner. | Simpan kode mentah dan bukti hambatan akses; codebook tetap perlu sign-off. | Klasifikasi owner; definisi perlu disahkan |
| `MTA` | Akronim legacy belum terdefinisi; dokumen legacy mengusulkan meter tidak ada/hilang, belum disahkan. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner. | Simpan kode mentah dan bukti kondisi; codebook tetap perlu sign-off. | Klasifikasi owner; definisi perlu disahkan |
| `TERHALANG` | Hambatan akses/keterjangkauan; aplikasi mengelompokkan sebagai tak terjangkau. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner. | Jadwalkan ulang/akses lain bila perlu; simpan bukti dan provenance taksasi. | Klasifikasi owner |
| `ADA_ANJING` | Hambatan kunjungan menurut label; bukan pembacaan meter. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner. | Terapkan prosedur keselamatan/kunjungan ulang; simpan bukti dan provenance. | Klasifikasi owner |
| `DK` | Akronim legacy belum terdefinisi; aplikasi mengelompokkannya sebagai terhalang/terkunci. | Taksasi otomatis rata-rata 3 bulan sesuai klasifikasi owner. | Simpan kode mentah dan bukti; codebook perlu mengesahkan arti. | Klasifikasi owner; definisi perlu disahkan |
| `MB` | Dalam jalur aplikasi diperlakukan sebagai penggantian meter dan memerlukan stand meter lama/baru. | Bukan rata-rata 3 bulan. Hitung konsumsi segmen lama+baru melalui modal: `(standAngkatLama - standAwalLama) + (standAkhirBaru - standAwalMeterBaru)`. Jangan jepit nilai segmen minus menjadi nol; tandai perlu koreksi/review. | Validasi meter lama/baru, tanggal mutasi, stand angkat/pasang, foto, dan audit; perilaku pemakaian di modal harus mendukung tindak lanjut manusia. | Klasifikasi owner; implementasi/formula perlu diselaraskan |
| `MUDA_KEMBALI` | Kode legacy untuk rollover/reset meter setelah mencapai kapasitas. | Bukan rata-rata 3 bulan. Rumus contoh meter 4 digit: `(10000 - ST Awal) + ST Akhir`; gunakan kapasitas meter aktual, bukan mengasumsikan semua meter 4 digit. | Modal perlu menampilkan stand awal/akhir, kapasitas digit yang tervalidasi, dan hasil rollover; nilai sebelum/sesudah serta alasan dicatat. | Klasifikasi owner; rumus tersedia di dokumen lama, kapasitas perlu disahkan |
| `REV_PENCATAT` | Menurut klarifikasi pemilik produk, ini penanda workflow bahwa ST Awal pada alamat perlu direvisi manusia, bukan kondisi meter dan bukan pengganti kondisi asli. | Bukan pemicu rumus/taksasi; jangan mengganti kondisi sumber. Update ST Awal aktif dan ST Revisi dengan audit before/after. | Simpan kondisi awal, nilai ST Awal sebelum/sesudah, alasan, aktor, waktu, dan relasi ke hasil resmi; cek kompatibilitas enum legacy. | Semantik workflow diklarifikasi; implementasi/model belum selaras |
| `TIDAK_ADA_AIR` | Kondisi layanan; “TAA” disebut pemilik produk sebagai istilah terkait, tetapi pemetaan sumber harus dikonfirmasi. | Nilai pemakaian ditentukan manusia; bukan taksasi otomatis rata-rata dan bukan default nol diam-diam. | Catat nilai dan alasan manual, aktor, waktu, bukti gangguan, dan periode yang terdampak; hasil menunggu review. | Klasifikasi owner; alias TAA dan workflow manual perlu disahkan |

### C. Kondisi yang memengaruhi status sambungan/tagihan

| Enum | Makna/interpretasi yang tersedia | Aturan hitung sesuai klarifikasi | Tindakan dan data wajib | Status |
|---|---|---|---|---|
| `DICABUT` | Sambungan/meter dicabut; tanggal efektif dan status historis harus dapat ditelusuri. | Menurut klasifikasi owner, taksasi otomatis rata-rata 3 bulan; bukan otomatis nol. Periode setelah pencabutan dan data historis perlu ditinjau sebelum pengesahan. | Cocokkan tanggal efektif dengan mutasi/penutupan sambungan; audit taksasi dan pastikan tidak mengubah tagihan historis. | Klasifikasi owner baru; bertentangan dengan logika billing historis, perlu kontrol periode |

## Batas antara verifikasi bertingkat dan Manual ADD

1. Verifikasi satuan dan massal menjalankan tahapan V1/V2/V3 dengan akun dan kewenangan yang sedang digunakan; aksi massal mengikuti aturan ring yang sama dengan aksi satuan dan mencatat aktor/tahap verifikasinya.
2. V1/V2 mencatat tahapan review. **V3 adalah persetujuan final** dan membuat `PembacaanMeter` resmi. V3 boleh memakai stand yang dikoreksi dan override pemakaian oleh verifikator berwenang; koreksi harus punya actor/provenance dan tidak boleh menjadi taksasi otomatis diam-diam.
3. Setelah V3, koreksi dilakukan melalui unverify/review ulang oleh role yang setara atau lebih tinggi dari persetujuan final (misalnya Senior Manager atau Direksi), lalu hasil diperiksa dan diterbitkan ulang. Hasil yang sudah dipakai tagihan tidak boleh dihapus/diubah tanpa workflow koreksi finansial yang disahkan.
4. Empat belas kondisi yang tercantum pada klasifikasi pemilik produk dapat memicu taksasi otomatis saat pencatatan. Taksasi bukan verifikasi final dan tidak boleh langsung mengubah tagihan resmi.
5. **Manual Add satuan** mencari pelanggan dengan nomor langganan dan menerima ST Awal/ST Akhir yang dimasukkan operator. Pakai adalah selisih stand; alasan dan asal input disimpan. **Manual Add All** memilih periode, petugas, lalu rute dari daftar catat yang dibekukan, menghitung rata-rata pemakaian per pelanggan, dan hanya menambahkan alamat yang dicentang. Keduanya menunggu verifikasi dan tidak langsung membuat pembacaan resmi/tagihan.
6. Histori valid untuk taksasi Manual Add All adalah pembacaan resmi dengan `pemakaianRiil` nonnegatif dan `alasanTaksir` kosong. Data taksasi/override dikecualikan. Gunakan rata-rata 12 bulan kalender sebelum periode target jika lengkap; jika tidak, rata-rata tiga pemakaian valid tertinggi; jika kurang dari tiga, rata-rata seluruh histori valid yang tersedia. Bulatkan ke atas tanpa minimum. Jika histori pemakaian valid tidak tersedia, Pakai 0 m³.
7. Pada Manual Add All, ST Awal dan ST Akhir bernilai sama: gunakan field ST Awal (`PembacaanMeter.standLalu`) dari pencatatan resmi terakhir pada meter aktif terbaru. Nilai ini tetap dipakai walaupun pencatatan terakhir bukan histori pemakaian yang layak untuk taksasi. Jika tidak ada pencatatan resmi sebelumnya atau meter aktif, kedua stand bernilai 0. Sumber dan alasan Manual Add terlihat pada baris verifikasi. Saat V3 mengesahkan hasil itu, `PembacaanMeter.alasanTaksir` menyimpan `MANUAL_ADD` agar angka tersebut tidak dipakai sebagai histori aktual berikutnya.
8. Petugas dapat memilih `Revisi Pencatat` saat pencatatan; verifikator juga dapat mengaktifkannya saat mengubah kondisi di modal. Hanya alamat bertanda ini yang membuka koreksi ST Awal. Koreksi menghitung ulang Pakai dan mengaudit nilai lama/baru, kondisi sumber, alasan, aktor, serta waktu; kondisi sumber tidak ditimpa.
9. Batas kewajaran angka usulan Manual Add belum ditetapkan. Nilai ekstrem harus tetap terlihat dan ditinjau; jangan mengubahnya menjadi nol atau mengganti dengan taksasi lain secara diam-diam.

## Perbedaan dengan implementasi saat ini yang harus ditutup

1. `src/lib/domain/tagihan.ts` memiliki perilaku historis berupa minimum 5 m³, taksiran bulan lalu, dan `DICABUT`/`TIDAK_ADA_AIR` menjadi nol. Itu bukan kontrak baru; jangan mengubah ulang tagihan historis, dan jangan pakai fungsi ini sebagai sumber taksasi baru tanpa pemisahan kebijakan.
2. Jalur verifikasi pembacaan satuan/massal, laporan mandiri, endpoint pembacaan langsung, dan UI memiliki penghitungan/aksi tersendiri. Modal dan endpoint menggunakan `Math.max(0, ...)` pada beberapa kalkulasi sehingga dapat menyamarkan angka minus sebagai nol. Perlu hapus perilaku itu atau buat review eksplisit sesuai klasifikasi kondisi.
3. `src/docs/pemakaian-meter.ts` adalah helper uji terisolasi dengan daftar kondisi berbeda dari enum Prisma dan bukan sumber aturan runtime. Jangan menganggap unit test helper ini menguji backend.
4. `MB` punya field/formulir penggantian di workflow V1–V3, tetapi verifikasi massal tidak tampak memakai formula segmen yang sama. Helper sekarang menjepit tiap segmen minus menjadi nol. Model `PembacaanMeter` hanya menyimpan satu `meterId`, `standLalu`, dan `standAkhir`; belum cukup untuk merekonstruksi kedua segmen meter lama dan baru secara mandiri. Perlu schema/provenance penggantian yang menyimpan meter lama, stand cabut, meter baru, stand pasang, dan tanggal efektif.
5. Manual Add kini menyimpan `jenisInput`, alasan, serta `manualProvenance` dengan metode dan pembacaan sumber; hasil V3 massal ditandai `AlasanTaksir.MANUAL_ADD`. Migration additive masih harus diterapkan dan diverifikasi pada staging sebelum fitur dipakai.
6. Dokumen legacy [perhitungan-taksasi](../../prisma/docs/perhitungan-taksasi.md) mengandung kebijakan lama: minimum 10 m³, faktor LOS_METER 1.25, dan kelompok nol/taksasi yang bertentangan dengan klasifikasi baru. Pembulatan ke atas kini ditentukan sebagai kebijakan target, tetapi contoh legacy tetap bukan sumber runtime.

## Exit criteria sebelum aturan diterapkan

- [ ] Pemilik data mengesahkan definisi dan tindakan untuk kode ambigu: `DK`, `BMK_BMB`, `TTB`, `MTA`, `MB`, `MUDA_KEMBALI`, `REV_PENCATAT`, `LOS_METER`, `METER_DALAM_AIR`.
- [ ] Petakan alias sumber `TAA` ke `TIDAK_ADA_AIR`; validasi tanggal efektif `DICABUT` dan pastikan keputusan baru tidak mengubah tagihan historis.
- [x] Pemilik produk menetapkan histori valid Manual Add All: pemakaian aktual resmi nonnegatif; taksasi/override dikecualikan; tanpa histori valid ditahan untuk penanganan manual. Hierarki 12 bulan → tiga tertinggi → histori tersedia dan ceiling tanpa minimum juga ditetapkan.
- [ ] Tetapkan input ST Awal/ST Akhir taksasi dan tes bahwa koreksi ST Awal menghitung ulang Pakai sesuai aturan serta mengaudit before/after.
- [x] Kebijakan Manual Add satuan/massal dicatat: alasan wajib, asal-usul, histori valid, metode pembulatan, hasil tanpa histori, status menunggu verifikasi, dan tidak langsung menjadi hasil resmi/tagihan.
- [ ] Verifikasi satuan/massal mengikuti ring V1/V2/V3 dan actor/role yang sama; V3 menghasilkan satu pembacaan resmi. Koreksi pasca-V3 harus melalui unverify/review ulang sesuai role dan status tagihan.
- [ ] Backend/UI menerapkan kelompok aturan aktual, taksasi 14 kondisi, nilai manual dua kondisi, rumus khusus MB/rollover, Revisi Pencatat, dan review tanpa fallback diam-diam ke nol.
- [ ] Tes tabel-driven mencakup setiap enum Prisma, nilai batas, stand mundur, histori hilang, perubahan meter, dan kondisi tidak dikenal.
- [ ] Tes integrasi membuktikan verifikasi satuan/massal mengikuti ring V1/V2/V3 yang sama, V3 menghasilkan satu pembacaan resmi, dan koreksi pasca-V3 mengikuti role/status tagihan; Manual ADD dan ADD All memiliki workflow taksasi/review terpisah serta tidak menerbitkan tagihan pilot.

## Sumber internal

- [Schema Prisma](../../prisma/schema/tagihan.prisma)
- [Rekonsiliasi label legacy](./rekonsiliasi-data-progrescater.md)
- [Pengelompokan anomali saat ini](../lib/domain/anomali.ts)
- [Aturan tagihan historis/seed](../lib/domain/tagihan.ts)
- [Helper hitung terisolasi yang belum dipakai backend](./pemakaian-meter.ts)
- [Status progres dan audit teknis](./STATUS-baca-meter-air.md)
