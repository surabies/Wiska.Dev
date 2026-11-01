# Matriks RBAC Aplikasi

**Status:** Aksi per role disepakati menurut dokumen ini; kolom cakupan data berstatus usulan; multi-role dan izin closing belum diputuskan  
**Versi:** 0.2 (rekonsiliasi dokumentasi; sebelumnya tanpa nomor versi)  
**Tanggal:** 1 November 2026  
**Cakupan:** role, hak aksi, cakupan data, dan temuan awal pada Verifikasi

**Peran dokumen:** sumber kebenaran untuk role teknis, izin aksi, dan cakupan data per role. Ring V1/V2/V3: [aturan verifikasi](./VERIFIKASI.md). Istilah peran yang belum dipetakan ke enum: [Indeks](./INDEKS.md#pemetaan-peran) (OPEN-19).

Dokumen ini menjadi acuan kebijakan akses lintas modul dan harus dibaca bersama [`VERIFIKASI.md`](./VERIFIKASI.md) untuk aturan domain Verifikasi. Role menentukan izin aktor, sedangkan alur tahap, konsistensi data, status tagihan, serta periode terkunci tetap menjadi invariant bisnis.

## Prinsip rancangan

- **Role menjawab siapa yang bertindak; izin menjawab aksi apa; cakupan menjawab data mana.** Role jabatan saja belum cukup untuk membatasi petugas pada wilayah, bagian, atau rute yang menjadi tanggung jawabnya.
- Gunakan hak minimum yang diperlukan (_least privilege_) dan **tolak secara default** bila role atau izin belum dipetakan.
- Periksa otorisasi pada setiap request API. Menyembunyikan atau menonaktifkan tombol di UI membantu UX, tetapi bukan pengganti pemeriksaan server.
- Pisahkan izin baca, input/perubahan, verifikasi, pengaturan, dan administrasi akun. Hak melakukan perubahan data tidak otomatis berarti hak mengesahkan perubahan tersebut.
- Perubahan sensitif—koreksi, persetujuan, pembatalan, perubahan role, dan tindakan Super Admin—perlu aktor, waktu, alasan, serta jejak audit yang sesuai.
- Untuk pembatasan berdasarkan wilayah, bagian, pemilik data, atau rute penugasan, gunakan aturan berbasis atribut/cakupan selain role (ABAC atau pemeriksaan ownership).

## Role yang ditemukan

Enum aplikasi saat ini berada di [`auth.prisma`](../../prisma/schema/auth.prisma):

| Role teknis      | Makna awal                                                          |
| ---------------- | ------------------------------------------------------------------- |
| `SUPER_ADMIN`    | Administrator teknis dengan akses istimewa aplikasi.                |
| `DIREKSI`        | Direksi/pimpinan; berbeda dari Super Admin.                         |
| `SENIOR_MANAGER` | Senior Manager; pada alur Verifikasi sekarang dipetakan ke V3.      |
| `MANAGER`        | Manager; pada alur Verifikasi sekarang dipetakan ke V2.             |
| `SUPERVISOR`     | Supervisor; pada alur Verifikasi sekarang dipetakan ke V1.          |
| `STAFF`          | Staf kantor/operator administrasi.                                  |
| `PELAKSANA`      | Petugas lapangan; tidak termasuk jenjang staf kantor.               |
| `USER`           | Akun umum/pelanggan; arti dan cakupan portalnya perlu dikonfirmasi. |

`PELAKSANA` adalah jalur kerja lapangan, bukan sekadar level yang lebih rendah dari `STAFF`. Model organisasi juga memisahkan jenis tugas petugas dari role akun.

## Kondisi implementasi yang ditemukan

1. [`rbac.ts`](../lib/server/middleware/RBAC.ts) memiliki dua pola akses:
   - `ROLE_GROUPS` berisi grup kumulatif yang dipakai sejumlah endpoint lama.
   - `MODULE_ACCESS` mendefinisikan akses per modul; `SUPER_ADMIN` memperoleh full untuk setiap modul dan melewati guard role.
2. Role `STAFF` tidak boleh disamakan dengan administrator sistem: ia memiliki kewenangan operasional yang disebutkan di bawah, bukan pengelolaan RBAC atau konfigurasi sensitif.
3. Handler klik kanan membuka menu berdasarkan baris. Hak aksi ditampilkan/diaktifkan berdasarkan role dan tahap, sedangkan API tetap menjadi penjaga akhir.
4. Ring cepat halaman Verifikasi memakai ring tertinggi role; Direksi dan Senior Manager bertindak sebagai V3, Super Admin juga dapat menjalankan kewenangan V3. Super Admin tetap harus mengikuti invariant data dan workflow.
5. RBAC yang melewati `requireRole` tidak membatalkan validasi data: laporan resmi, data meter, penagihan, dan status periode tetap tunduk pada aturan domain.
6. Akun dengan satu role teknis didukung. Pilihan “role aktif” untuk akun multi-role adalah arah kebijakan, tetapi belum didukung skema akun saat ini; jangan menganggapnya sudah diterapkan.

## Matriks keputusan awal

Kolom aksi (Verifikasi, Operasional, Pengaturan) mencatat kebijakan yang disepakati menurut dokumen ini; kolom "Cakupan yang diusulkan" masih usulan dan belum terbukti ditegakkan. “Cakupan” harus ditegakkan oleh server, bukan hanya filter UI.

| Role                       | Verifikasi                                                                                                                  | Operasional pendataan                                                                                                                                               | Pengaturan & akses administratif                                                                                                      | Cakupan yang diusulkan                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Super Admin**            | Akses penuh ke semua modul dan aksi yang diizinkan modul, termasuk kewenangan V3; bypass guard role.                        | Akses penuh ke semua modul operasional.                                                                                                                             | Pengelolaan sistem, role, akun, konfigurasi, dan seluruh modul. Semua aksi tetap mematuhi invariant domain dan tercatat sesuai audit. | Seluruh sistem, tanpa pembatasan cakupan modul/data berbasis role.                       |
| **Direksi**                | Dapat bertindak pada kewenangan V3. V3 adalah hasil akhir; **tidak ada ring atau persetujuan tambahan Direksi setelah V3**. | Dapat melakukan taksasi untuk pemakaian besar atau potensial melalui workflow aplikasi yang tersedia (definisi dan alur belum ada: OPEN-13).                        | Tidak otomatis mengelola RBAC atau konfigurasi sistem.                                                                                | Seluruh organisasi untuk kewenangan Direksi; pembatasan teknis rinci perlu diselaraskan. |
| **Senior Manager (V3)**    | Kewenangan V3/final; reopen atau koreksi harus punya alasan dan audit.                                                      | Baca dan tinjau data wilayah/bagian yang menjadi tanggung jawabnya.                                                                                                 | Tidak otomatis memiliki hak konfigurasi sistem atau administrasi akun.                                                                | Bagian/wilayah sesuai penempatan.                                                        |
| **Manager (V2)**           | Tinjau dan tandai V2; hasilnya menunggu tahap final V3. V2 boleh memproses tanpa ring yang lebih rendah.                    | Tinjau pekerjaan dan lakukan koreksi sesuai workflow yang disetujui.                                                                                                | Tidak mengelola RBAC atau pengaturan sistem.                                                                                          | Bagian/wilayah tanggung jawab.                                                           |
| **Supervisor (V1)**        | Pemeriksaan awal V1, evaluasi hasil lapangan, dan tindak lanjut sesuai proses.                                              | Mengelola pekerjaan/rute petugas sesuai kewenangan.                                                                                                                 | Pengaturan operasional terbatas bila memang dibutuhkan; bukan administrasi role.                                                      | Wilayah/rute pengawasan.                                                                 |
| **Staff / Operator Admin** | Tidak mengisi atau mengesahkan ring V1/V2/V3.                                                                               | Input/impor data, Manual ADD satuan/ALL, serta edit nilai hasil koreksi V1/V2/V3 melalui workflow dengan alasan dan audit. Dilarang mengedit setelah masuk tagihan. | Tanpa akses penuh ke pengaturan pendataan, RBAC, akun, atau konfigurasi sensitif.                                                     | Unit kerja yang ditugaskan; semua impor/koreksi sensitif diaudit.                        |
| **Pelaksana**              | Tidak melakukan verifikasi internal.                                                                                        | Membaca tugas, mencatat meter, mengirim foto, dan memperbaiki setoran sesuai aturan.                                                                                | Tidak mengakses dashboard administrasi, master data global, atau pengaturan.                                                          | Rute yang ditugaskan dan kiriman miliknya sendiri.                                       |
| **User**                   | Tidak melakukan verifikasi internal.                                                                                        | Mengakses layanan pelanggan yang tersedia.                                                                                                                          | Tidak memiliki akses administrasi internal.                                                                                           | Data pelanggan miliknya sendiri.                                                         |

### Aturan turunan

- Supervisor menjalankan V1, Manager V2, Senior Manager dan Direksi menjalankan V3. V3 adalah hasil akhir; tidak ada persetujuan Direksi tambahan setelah V3.
- V2/V3 boleh memproses tanpa ring bawah. Jika tahap V2/V3 sudah terisi, aksi tidak boleh diulang; hasil resmi hanya dibuat oleh V3.
- Direksi dapat melakukan taksasi pemakaian besar atau potensial lewat workflow aplikasi yang tersedia (definisi dan alur belum ada: OPEN-13).
- Staff/Operator Admin dapat melakukan input/impor data, Manual ADD satuan/ALL, dan mengedit nilai hasil koreksi pada tahap V1/V2/V3. Edit wajib menyertakan alasan serta audit before/after dan ditolak setelah hasil masuk tagihan. Staff tidak boleh mengesahkan tahap. Edit atas hasil V3 resmi aktif hanya lewat reopen oleh role berwenang (DEC-06); syarat bukti dan persetujuan tambahan: OPEN-09.
- Staff tidak memiliki akses penuh ke pengaturan pendataan, RBAC, akun, atau konfigurasi sensitif. Izin closing belum disepakati dan tidak boleh diasumsikan dari akses operasional.
- Supervisor, Manager, dan Senior Manager dibatasi pada bagian/wilayah penugasan. Pelaksana dibatasi pada rute yang ditugaskan dan kiriman sendiri. `USER` adalah pelanggan dengan akses pada data miliknya sendiri.
- Role aktif untuk akun dengan beberapa role adalah arah kebijakan, tetapi belum didukung model `User.role` yang hanya menyimpan satu role. Implementasi multi-role membutuhkan rancangan tersendiri; jangan menggabungkan role secara implisit.

- **Super Admin dan invariant bisnis (DEC-04):** akses penuh ke semua modul tidak membatalkan invariant: periode terkunci, validasi meter/stand, status resmi, dan perlindungan hasil yang sudah masuk tagihan tetap berlaku; aksinya tercatat atas akun Super Admin.

## Pertanyaan yang masih terbuka

1. Apakah closing termasuk tugas Operator Admin? (OPEN-01)
2. Apakah ada role internal tambahan selain `USER` pelanggan? (OPEN-19)
3. Apakah ada tindakan lain yang membutuhkan approval kedua di luar V3 final? (OPEN-19)

## Implementasi dan tindak lanjut

1. Middleware RBAC memberi `SUPER_ADMIN` akses `full` ke modul terdaftar maupun nama modul baru, dan melewati guard role; validasi invariant bisnis tetap berlaku.
2. Tes Playwright per role telah disiapkan untuk login dan memeriksa endpoint yang dibatasi. Seed hanya berjalan dengan `E2E_DATABASE_URL` khusus; tes browser belum dijalankan sampai database dan `E2E_TEST_PASSWORD` dikonfigurasi.
3. Jalankan `pnpm e2e` mengikuti [petunjuk database E2E](../../e2e/README.md), lalu lengkapi cakupan untuk aksi UI dan batas data/ownership per wilayah atau rute.
4. Putuskan pertanyaan kebijakan yang masih terbuka, khususnya izin closing Staff dan dukungan multi-role; jangan mengasumsikan izin sebelum keputusan dicatat.
5. Reproduksi masalah klik-kanan dengan akun dan baris yang sama; bedakan menu tidak tampil, aksi disabled karena tahap, dan penolakan API `403`. Audit perubahan role dan aksi istimewa secara berkala.

## Referensi

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — prinsip least privilege, deny-by-default, pengecekan otorisasi setiap request, dan tes izin.
- [NIST Role Based Access Control Project](https://csrc.nist.gov/projects/role-based-access-control) — konsep role dan privilege, role hierarchy, serta administrasi akses. Halaman proyek menandai dirinya sebagai arsip, jadi gunakan untuk konsep dasar, bukan panduan implementasi terkini.
- Dokumen organisasi aplikasi: [`organisasi.md`](../../prisma/docs/organisasi.md).
- Kontrak alur Verifikasi aplikasi: [`VERIFIKASI.md`](./VERIFIKASI.md).
- Indeks dokumentasi, glosarium, dan register OPEN: [`INDEKS.md`](./INDEKS.md).
- Implementasi role dan akses modul: [`rbac.ts`](../lib/server/middleware/RBAC.ts).
