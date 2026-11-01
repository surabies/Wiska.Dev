# Codebook Kondisi Catat Meter

**Versi:** 0.3 (draf untuk validasi pemilik data; rekonsiliasi dokumentasi 1 November 2026)  
**Status:** belum disahkan untuk billing atau produksi. Tidak ada definisi dalam dokumen ini yang dianggap resmi sampai pemilik data menyetujui catatan sign-off.  
**Cakupan:** seluruh nilai enum `KondisiCatat` pada `prisma/schema/tagihan.prisma`, normalisasi label legacy, dan makna bisnis kondisi catat.  
**Sumber bukti awal:** enum aplikasi dan sampel `ProgresCater-PW5.csv` periode `202601` yang direkonsiliasi di [rekonsiliasi data ProgresCater](./REKONSILIASI.md).

**Peran dokumen:** sumber kebenaran untuk makna dan alias kode legacy `KondisiCatat`. Perlakuan hitung per kondisi ada di [aturan kondisi](./ATURAN-KONDISI.md); keputusan (DEC) dan isu terbuka (OPEN): [Indeks](./INDEKS.md#register-open).

## Tujuan dan batas penggunaan

Codebook ini menjawab **“apa arti kode ini menurut pemilik proses?”** Codebook bukan rumus pemakaian, keputusan tarif, atau izin untuk membuat hasil/tagihan otomatis. Perilaku aplikasi selama pilot diatur terpisah pada [Matriks Aturan Domain Kondisi Catat](./ATURAN-KONDISI.md).

Sampai definisi dan dampaknya disahkan:

- Pertahankan nilai kondisi dan label sumber mentah; simpan hasil normalisasi secara terpisah.
- Jangan menebak arti singkatan dari nama kode atau menggabungkan kode yang tampak serupa.
- Kode dengan definisi atau dampak yang belum jelas harus masuk review; jangan mengubahnya menjadi pemakaian/tagihan nol. Taksasi otomatis pada kode yang definisinya belum disahkan (mis. `TTB`, `MTA`, `DK`, `LOS_METER`, `BMK_BMB`, `METER_DALAM_AIR`) ditetapkan pemilik produk sebagai target di [aturan kondisi](./ATURAN-KONDISI.md), tetapi aktivasinya di runtime menunggu sign-off definisi dan exit criteria di sana (OPEN-03, OPEN-10); sampai itu kode tersebut masuk review.
- Label pada sampel historis adalah bukti penggunaan, bukan bukti definisi resmi maupun kebijakan billing.

## Arti status

- **Kandidat dari label:** makna literal/operasional sementara yang didukung oleh label sumber atau perilaku aplikasi; perlu pengesahan pemilik data.
- **Perlu klarifikasi:** makna atau pembedaan operasional belum cukup jelas untuk menetapkan definisi.
- **Belum ditemukan di sampel:** nilai enum tidak muncul pada kolom `ketcatat` sampel; alias dan definisinya belum dapat dibuktikan dari sampel tersebut.

Semua status di bawah adalah status dokumentasi draf, bukan tanda persetujuan.

**Klarifikasi awal pemilik produk, 31 Oktober 2026:** `DK` dan `TTB` mula-mula disebut sebagai contoh kelainan; klarifikasi berikutnya memasukkan keduanya ke daftar 14 pemicu taksasi, dengan hierarki histori yang tercantum di [matriks aturan kondisi](./ATURAN-KONDISI.md). Makna kode tetap perlu disahkan sebelum otomatisasi. `RK` disebut, tetapi belum ditemukan sebagai enum/alias; identifikasi nilai sumbernya terlebih dahulu.

Klarifikasi berikutnya menetapkan allowlist taksasi untuk seluruh kode anomali yang tercantum pada matriks. `TAA` dipakai pemilik produk untuk menyebut kondisi tidak ada air, tetapi belum terbukti sebagai alias sumber kanonis `TIDAK_ADA_AIR`; pertahankan teks sumber dan petakan hanya setelah format sumber dikonfirmasi.

## Daftar kode dan definisi draf

| Kode kanonis | Label legacy yang ditemukan | Definisi draf / batas interpretasi | Status |
|---|---|---|---|
| `NORMAL` | `Normal` | Kandidat: pencatatan stand normal. Perlu disahkan sumber stand yang berwenang, syarat bukti, dan apakah kondisi ini hanya berlaku untuk pembacaan onsite. | Kandidat dari label |
| `TIDAK_DIPAKAI` | `TIDAK DIPAKAI` | Kandidat: pelanggan/sambungan dilaporkan tidak menggunakan air. Tidak berarti stand nol, sambungan tidak aktif, atau bea tetap dihapus. | Kandidat dari label |
| `RUMAH_KOSONG` | `RUMAH KOSONG` | Kandidat: rumah/lokasi dilaporkan kosong saat kunjungan. Perlu dibedakan dari tanah kosong, bangunan tidak dihuni, dan sambungan tidak aktif. | Perlu klarifikasi |
| `STAND_TEMPEL` | `STAND TEMPEL` | Makna belum jelas. Konfirmasi apakah stand terlihat pada alat, disampaikan/ditempel oleh pihak lain, atau berasal dari bukti lain; tetapkan bukti yang membuatnya dapat diterima. | Perlu klarifikasi |
| `STAND_KONSUMEN` | `STAND-KONSUMEN` | Kandidat: angka stand dilaporkan konsumen/offsite. Konfirmasi siapa pelapor yang sah, kanal, bukti, dan kapan angka boleh dianggap terverifikasi. | Perlu klarifikasi |
| `METER_RUSAK` | `METER RUSAK` | Kandidat: meter rusak atau tidak dapat diandalkan. Tetapkan kriteria kerusakan, bukti teknis, dan pembedaan dari meter mati, terbalik, atau tidak terbaca. | Kandidat dari label |
| `METER_MATI_ADA_AIR` | `MATI ADA AIR` | Kandidat: meter tidak bergerak ketika pasokan air tersedia. Tetapkan cara memastikan pasokan tersedia dan membedakannya dari kerusakan/kemacetan alat. | Kandidat dari label |
| `METER_MUNDUR` | `METER MUNDUR` | Kandidat: stand yang dicatat lebih kecil daripada pembanding sebelumnya. Konfirmasi bahwa kode hanya untuk anomali nilai stand; jangan samakan dengan rollover, penggantian meter, koreksi, atau salah input. | Kandidat dari label |
| `METER_TERBALIK` | `METER TERBALIK` | Label mengarah pada pemasangan atau arah aliran terbalik, tetapi cakupan teknis belum disahkan. Tetapkan siapa yang memeriksa dan tindakan operasionalnya. | Perlu klarifikasi |
| `METER_DALAM_AIR` | Tidak ditemukan pada `ketcatat` sampel | Belum ada definisi terverifikasi. Konfirmasi apakah meter terendam/tergenang, lokasi meter berada di dalam air, atau makna lain; tetapkan implikasi keselamatan dan keterbacaan. | Belum ditemukan di sampel |
| `LOS_METER` | `LOS METER` | Akronim/istilah belum terdefinisi. Jangan mengembangkan kepanjangannya tanpa codebook sumber; minta definisi dan contoh kasus dari pemilik proses. | Perlu klarifikasi |
| `BMK_BMB` | `BMK/BMB` | Kode gabungan belum terdefinisi. Minta arti setiap unsur dan konfirmasi apakah ini satu kondisi atau dua kondisi yang seharusnya terpisah. | Perlu klarifikasi |
| `TTB` | `TTB` | Akronim belum terdefinisi. Pemilik produk menyebutnya sebagai kandidat kondisi taksasi; minta kepanjangan, kepastian pemicu, contoh kasus, dan tindakan yang diharapkan sebelum otomatisasi. | Perlu klarifikasi |
| `MTA` | `MTA` | Akronim belum terdefinisi. Minta kepanjangan, kondisi pemicu, contoh kasus, dan tindakan yang diharapkan. | Perlu klarifikasi |
| `TERHALANG` | `TERHALANG` | Kandidat: petugas tidak dapat mengakses atau membaca meter karena hambatan. Tetapkan apakah hambatan akses, meter tertutup, dan lokasi tidak ditemukan memakai kode yang sama. | Kandidat dari label |
| `TIDAK_ADA_AIR` | `TIDAK ADA AIR` | Kandidat: pasokan air tidak tersedia saat/selama periode tertentu. Definisikan bukti, waktu mulai/selesai, cakupan gangguan, dan dampak billing secara terpisah. | Kandidat dari label |
| `ADA_ANJING` | `ADA ANJING` | Kandidat: kunjungan terhambat atau tidak aman karena ada anjing. Konfirmasi apakah kode berarti kunjungan batal, akses tertunda, atau kondisi keselamatan lain; tetapkan prosedur kunjungan ulang. | Kandidat dari label |
| `DK` | `DK` | Akronim belum terdefinisi. Aplikasi saat ini mengelompokkannya sebagai terhalang/terkunci; pengelompokan kode bukan bukti definisi resmi. Pemilik produk menyebutnya sebagai kandidat kondisi taksasi, tetapi perlu definisi, kepastian pemicu, dan contoh kasus sebelum otomatisasi. | Perlu klarifikasi |
| `MB` | `MB` | Dalam workflow aplikasi, kode ini diperlakukan seperti kasus meter baru/penggantian. Arti singkatan dan apakah kode benar-benar berarti penggantian belum disahkan. Konfirmasi event, tanggal efektif, data meter lama/baru, dan stand yang wajib dicatat. | Perlu klarifikasi |
| `MUDA_KEMBALI` | `MUDA KEMBALI` | Dokumen formula legacy menjelaskan rollover/reset meter dan rumus berbasis kapasitas meter. Pemilik produk mengklasifikasikannya sebagai jalur khusus, bukan taksasi rata-rata; validasi kapasitas digit dan contoh kasus masih diperlukan. | Arti/formula kandidat terdokumentasi; perlu validasi |
| `REV_PENCATAT` | `REV.PENCATAT` | Klarifikasi pemilik produk: penanda workflow bahwa ST Awal perlu direvisi oleh manusia, bukan kondisi meter dan bukan pengganti kondisi asli. Revisi menyimpan nilai lama/baru, alasan, aktor, waktu, dan relasi ke hasil resmi di audit. Nilai enum legacy ini masih perlu pemetaan/kompatibilitas; jangan tulis sebagai kondisi sumber baru tanpa keputusan migrasi. | Semantik workflow diklarifikasi; pemetaan enum/migrasi perlu keputusan |
| `DICABUT` | `DICABUT` | Kandidat: meter atau sambungan dicabut; belum jelas objek yang dicabut dan tanggal efektifnya. Tetapkan bukti mutasi, status sambungan, periode pengaruh, dan dampak billing. | Perlu klarifikasi |

## Alias dan pemetaan data

1. `kode kanonis` adalah nilai enum aplikasi. `label legacy` adalah teks sumber yang benar-benar ditemukan pada sampel, bukan daftar alias lengkap.
2. Normalisasi harus mempertahankan teks sumber persis (termasuk tanda baca/ejaan) bersama kode kanonis, sumber file, periode, dan identitas record.
3. Jangan menormalkan label yang belum dipetakan secara otomatis ke kode terdekat. Simpan sebagai nilai tidak dikenal untuk review dan pelaporan kualitas data.
4. Tambahkan alias baru hanya dengan bukti dari data sumber serta persetujuan pemilik data. Catat perubahan alias dan tanggal berlakunya pada riwayat perubahan codebook.
5. Tidak ditemukannya label pada sampel `202601` tidak membuktikan bahwa kode tidak dipakai pada periode atau sistem lain.

## Keputusan yang perlu diminta dari pemilik data

Untuk setiap kode, pemilik data perlu mengonfirmasi:

1. Definisi resmi dengan bahasa operasional yang dapat dipahami petugas dan reviewer.
2. Objek/kondisi yang dicatat: meter, sambungan, lokasi/akses, pasokan air, sumber angka, atau proses koreksi.
3. Kapan dan oleh siapa kode boleh dipilih; contoh kasus yang termasuk dan tidak termasuk.
4. Bukti minimum, kebutuhan kunjungan ulang, dan peran yang boleh memutuskan hasil.
5. Dampak terhadap status sambungan dan periode efektif, bila relevan.
6. Alias historis yang sah serta apakah kode lama perlu dipisah atau dipertahankan.
7. Hubungan ke perhitungan pemakaian/taksiran/tagihan. Persetujuan definisi kode **tidak otomatis** menyetujui formula atau kebijakan tarif.

## Catatan pengesahan

Belum ada sign-off pemilik data yang tercatat untuk definisi dalam draf ini. Isi tabel berikut saat konfirmasi dilakukan; jangan mengubah status menjadi disahkan tanpa bukti persetujuan yang dapat ditelusuri.

| Cakupan kode/keputusan | Nama dan peran pemberi persetujuan | Tanggal | Bukti/referensi keputusan | Versi codebook |
|---|---|---|---|---|
| Belum disahkan | — | — | — | — |

## Riwayat perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 0.1 | 31 Oktober 2026 | Draf awal untuk 22 nilai enum; mencatat label dari sampel `202601` dan pertanyaan klarifikasi tanpa menganggap makna belum terkonfirmasi sebagai fakta. |
| 0.2 | 31 Oktober 2026 | Entri tidak dicatat saat itu. Direkonstruksi dari isi dokumen (bukan dari git): klarifikasi pemilik produk 31 Oktober (daftar taksasi, `REV_PENCATAT`, `TAA`/`RK`) dan definisi `MB`/`MUDA_KEMBALI`. |
| 0.3 | 1 November 2026 | Rekonsiliasi: batas taksasi otomatis diselaraskan dengan allowlist pemilik produk (aktivasi runtime menunggu sign-off); peran dokumen dan tautan Indeks/OPEN. |

## Referensi

- [Enum `KondisiCatat`](../../prisma/schema/tagihan.prisma)
- [Rekonsiliasi label legacy](./REKONSILIASI.md)
- [Aturan domain per kondisi](./ATURAN-KONDISI.md)
- [Indeks dokumentasi dan register OPEN](./INDEKS.md)
