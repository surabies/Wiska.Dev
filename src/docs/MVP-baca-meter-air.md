# Definisi MVP — Aplikasi Baca Meter Air

**Versi:** 0.2 (batas pilot disetujui; acceptance criteria masih harus dibuktikan)
**Tanggal:** 31 Oktober 2026
**Status:** ruang lingkup dan kebijakan pilot disetujui Wiska Prayoga pada 31 Oktober 2026; belum berarti siap mulai pilot atau siap produksi
**Dokumen terkait:** [Status dan progres proyek](./STATUS-baca-meter-air.md), [PRD](./PRD-baca-meter-air.md), [Roadmap](./ROADMAP-baca-meter-air.md), [Aturan Verifikasi Berjenjang dan Koreksi](./aturan-verifikasi-berjenjang.md), [Arsitektur](./arsitektur-awal-baca-meter.md)

Aturan perlakuan kondisi pembacaan dan taksasi selama pilot dirinci di [Matriks Aturan Domain Kondisi Catat](./aturan-kondisi-catatan-meter.md). Verifikasi satuan/massal V1/V2/V3 adalah satu workflow; V3 menerbitkan hasil resmi. Taksasi dapat dipicu oleh 14 kondisi kelainan atau Manual ADD saat rute tidak tercatat; prioritas histori adalah 12 bulan → 3 pemakaian terbesar → 3 bulan terakhir/riwayat yang tersedia, dibulatkan ke atas tanpa minimum. Validitas histori masih perlu ditetapkan.

## 1. Tujuan MVP

Membuktikan satu alur operasional air yang utuh dan aman: tugas pembacaan diterbitkan, petugas/warga menyampaikan data, petugas meninjau bukti, hasil resmi tercatat satu kali, dan data dapat direkonsiliasi sebelum digunakan untuk closing.

MVP adalah **pilot terbatas**, bukan klaim sistem sudah memenuhi seluruh kebutuhan produksi komersial. Keputusan pilot yang disetujui: rute CD112 di Wilayah Pelayanan 5, 1–7 November 2026, sekitar 20–30 sambungan, satu petugas, dan satu HP Android. Output hanya untuk shadow/paralel serta rekonsiliasi, bukan untuk menerbitkan atau mengubah tagihan resmi; isolasi dari proses closing/tagihan harus dibuktikan sebelum pilot. Lihat [catatan keputusan G0](./STATUS-baca-meter-air.md).

## 2. Pengguna MVP

- Petugas/pencatat yang ditugaskan pada rute pilot.
- Verifikator/supervisor yang memiliki wewenang untuk memproses antrean.
- Admin sistem yang mengatur jadwal dan akun pilot.
- Warga yang mengirim laporan mandiri pada jendela yang dibuka.
- Operator billing yang memeriksa data rekonsiliasi dan memberi keputusan sebelum closing.

Koreksi selama pilot mengikuti prosedur manual dan persetujuan supervisor yang ditetapkan pada keputusan G0. Kewenangan Bagian Langganan untuk koreksi pasca-tagihan belum diputuskan dan tidak termasuk pilot.

## 3. Termasuk MVP (P0)

1. **Scope layanan:** pembacaan meter air saja.
2. **Identitas dan periode:** sambungan, meter yang berlaku, periode, rute/penugasan, serta waktu pencatatan/penerimaan server dapat ditelusuri.
3. **Intake petugas:** input stand dan kondisi, waktu, foto wajib yang diambil petugas, serta GPS/akurasi bila tersedia. Kegagalan GPS tidak memblokir submit. Outbox lokal menyimpan pekerjaan offline sampai server mengonfirmasi penerimaan; retry identik tidak menggandakan hasil dan ID sama dengan payload berbeda menjadi konflik yang dapat ditinjau.
4. **Intake warga:** laporan baca meter anonim dan akun diperbolehkan, menyertakan foto bukti, dan selalu menunggu verifikasi petugas. OTP untuk melihat data sambungan hanya dikirim ke nomor yang sudah terverifikasi pada data resmi; bila tidak cocok/tersedia, warga diarahkan ke verifikasi petugas. Tautan `LanggananWarga` bukan bukti kepemilikan.
5. **Pengaturan jendela:** halaman admin mengatur tanggal buka/tutup 1–28, nilai disimpan atomik, dan UI publik memperlihatkan jadwal efektif.
6. **Verifikasi:** supervisor/petugas berwenang memeriksa bukti; laporan mandiri tidak langsung menjadi hasil resmi. Koreksi manual harus memiliki alasan, bukti, aktor, persetujuan supervisor yang berbeda dari petugas pencatat, audit, dan rekonsiliasi.
7. **Satu hasil resmi:** hasil terverifikasi ditulis ke `PembacaanMeter`; sumber, stand, pemakaian riil/tagih, dan alasan perbedaan tidak dilebur.
8. **Riwayat kiriman warga:** foto dan nilai tiap percobaan tetap tersimpan; kirim ulang tidak menimpa bukti.
9. **Kontrol akses:** pengujian positif dan negatif untuk role serta akses objek/sambungan.
10. **Rekonsiliasi closing:** laporan hasil, pengecualian, duplikasi, dan selisih terhadap sumber disediakan/ditinjau sebelum data dipakai.
11. **Operasi dasar:** log terstruktur, error yang terlihat, backup, prosedur support, rollback, dan runbook pilot. Foto, GPS, kontak pelapor, dan log operasional berisi data pribadi dihapus/dianonimkan 3 bulan sejak dikumpulkan; catatan audit resmi mengikuti jadwal terpisah sebelum go-live.

## 4. Tidak termasuk MVP

- Koreksi pasca-tagihan otomatis, nota debit/kredit, saldo kredit, refund, pembayaran, atau ledger baru. Koreksi pilot hanya prosedur manual tercatat; proses finansial otomatis memerlukan kebijakan dan release terpisah.
- Taksasi otomatis sebagai hasil resmi/tagihan. Manual Add/Manual Add All bukan jalur resmi/tagihan dan bukan acceptance scope pilot; rilis workflow ini mengikuti acceptance FR-15 di PRD dan harus tetap masuk antrean verifikasi.
- Migrasi massal semua histori sebelum data mapping dan uji hasil disepakati.
- Penggantian total aplikasi billing/ERP atau integrasi komersial dengan payment provider.
- Analitik prediktif atau penolakan otomatis berdasarkan ambang yang belum dikalibrasi.
- Perluasan ke listrik, gas, atau utilitas lain.

## 5. Acceptance criteria pilot

Semua kriteria P0 harus lulus di staging dengan dataset sintetis/tersamarkan dan pada uji proses pilot. Ambang yang bertanda “usulan” harus disahkan sebelum pilot.

### Alur dan data

- [ ] Petugas dapat menyelesaikan tugas online/offline; data lokal tidak hilang sebelum penerimaan server terkonfirmasi.
- [ ] Setelah retry, operasi yang sama tidak menggandakan pembacaan resmi; payload berbeda dengan ID operasi sama dilaporkan sebagai konflik.
- [ ] Laporan akun atas sambungan tidak tertaut ditolak; laporan anonim tetap tercatat sebagai pending.
- [ ] Laporan mandiri di luar tanggal server ditolak sebelum foto diunggah; tanggal batas awal/akhir diuji pada WIB.
- [ ] Kiriman ulang menyimpan bukti terpisah, dan penolakan memuat alasan yang dapat dipahami warga.
- [ ] Persetujuan menghasilkan tepat satu pembacaan resmi yang terkait dengan meter milik sambungan dan periode yang benar.
- [ ] `NORMAL` memakai delta stand; 14 kondisi kelainan memakai prioritas taksasi yang disepakati. Kondisi lain mengikuti keputusan per kode: simpan pembacaan aktual, tetapkan nilai manual, atau tahan untuk review. Nilai minus dipertahankan apa adanya, tidak dijepit menjadi nol atau disubstitusi taksasi.
- [ ] Taksasi otomatis mencatat provenance histori dan terpisah dari delta stand; ST Awal/ST Akhir memakai stand resmi terakhir, Pakai menampilkan taksasi yang dibulatkan ke atas tanpa minimum; taksasi tidak menerbitkan tagihan resmi pada pilot. Histori tidak valid/kosong ditangani eksplisit.
- [ ] Tabel verifikasi menampilkan kolom Checkbox, Ring, Status, No. Pel, Nama, Alamat, Rute, Kondisi/Ket Catat, ST Awal, ST Akhir, ST Revisi, ST Resmi, Pakai, Lalu, Dev %, Tagihan (m³), Petugas, dan Tgl Catat (tanggal+waktu). Revisi ST Awal menyimpan audit before/after; ST Revisi dibedakan dari ST Resmi.
- [ ] Verifikasi satuan dan massal mengizinkan V1/V2/V3 memproses sesuai role tanpa mensyaratkan ring bawah; ikon hanya menampilkan ring aktor terakhir dan riwayat ring lama tetap tersedia.
- [ ] Hasil V1 tidak resmi; hasil V2 menunggu V3; V3 dapat memproses langsung dan menghasilkan tepat satu `PembacaanMeter` resmi.
- [ ] Hasil V3 dapat dikembalikan ke review oleh V3 sendiri atau role yang berwenang; koreksi/reopen mencatat alasan dan before/after serta tidak mengubah hasil yang sudah masuk Tagihan.
- [ ] Tes otorisasi membuktikan V1/V2 tidak dapat membuka tahap sendiri; STAFF tidak dapat verifikasi, dapat mengoreksi administratif hanya sebelum Tagihan, dan dapat menjalankan final closing sesuai prasyarat yang ditetapkan.
- Manual Add/Manual Add All bukan acceptance criteria pilot. Sebelum dirilis di luar pilot, verifikasi bahwa Manual Add satuan hanya dapat mengganti laporan yang sudah melewati ring verifikasi dengan alasan/konfirmasi, audit before/after, reset ring, dan blokir periode terkunci/hasil bertagihan; Manual Add All harus menampilkan petugas sebelum rute, langsung menampilkan alamat belum disetorkan tanpa pratinjau, menghitung taksasi otomatis, memproses baris yang dicentang, melaporkan progres batch tersimpan, menyimpan provenance, serta mengirim hasil bertanda Manual ke antrean verifikasi.
- [ ] Pembacaan petugas memiliki foto yang diambil petugas; laporan mandiri warga memiliki foto unggahan. GPS/akurasi disimpan saat tersedia; kegagalan GPS tidak menggagalkan submit dan dapat ditinjau.
- [ ] OTP akses data hanya menuju nomor terverifikasi pada data resmi; nomor yang dimasukkan sendiri tidak membuka data. Kiriman anonim tetap pending dan tidak membuka informasi sambungan.
- [ ] Penggunaan tagih yang berbeda dari delta stand memiliki metode/alasan atau masuk daftar pengecualian untuk diputuskan; sistem tidak memaksa nilai menjadi sama.
- [ ] Hasil intake, arsip bukti, pembacaan resmi, dan data penagihan dapat direkonsiliasi per periode.

### Akses, audit, dan keamanan

- [ ] Uji akses role dan object-level untuk daftar, detail, verifikasi, penolakan, konfigurasi, dan koreksi.
- [ ] Semua pengujian akses ilegal ditolak; tidak ada mutasi sukses tanpa hak.
- [ ] Aksi konfigurasi, persetujuan/penolakan, perubahan hasil, dan closing yang tercakup menulis aktor, waktu, alasan, serta nilai sebelum/sesudah sesuai kebutuhan.
- [ ] Validasi upload memeriksa jenis/ukuran file; bucket produksi privat dan akses bukti terbatas.
- [ ] Tidak ada secret/credential di bundle, log, atau repository; endpoint publik ber-rate-limit.

### Kesiapan operasi

- [ ] Migration diuji pada database staging yang menyerupai kondisi dan ukuran data target; hasil preflight konflik ditangani dan dicatat.
- [ ] Backup dipulihkan pada lingkungan terisolasi; RPO/RTO telah disetujui.
- [ ] Prosedur gangguan, antrean offline, item gagal, upload yatim, koreksi manual, dan rollback telah dilatih.
- [ ] p95 API, kegagalan sync, jumlah antrean pending, error closing, koneksi DB, dan storage dipantau; batas alert ditentukan dari hasil baseline.
- [ ] Operator, support, owner data, dan penanggung jawab incident telah ditetapkan.

## 6. Batas pilot yang disetujui dan prasyarat

| Parameter | Keputusan |
|---|---|
| Unit/wilayah/rute | Wilayah Pelayanan 5, rute CD112 |
| Periode dan tanggal pilot | 1–7 November 2026 (7 hari) |
| Jumlah sambungan/petugas/perangkat | Sekitar 20–30 sambungan, 1 petugas, 1 HP Android |
| Penggunaan output | Shadow/paralel dan rekonsiliasi; bukan dasar tagihan resmi |
| Akuntabilitas | Wiska Prayoga merangkap owner produk, data/billing, engineering, keamanan/privasi, dan operasi |
| Supervisor koreksi | Supervisor Operasional/Admin Utama dengan akun terpisah, ditunjuk Wiska sebelum pilot; tidak boleh merupakan petugas pencatat |
| Foto/GPS/pemberitahuan | Foto wajib dari petugas; foto warga untuk laporan mandiri; GPS/akurasi dicatat saat tersedia dan tidak wajib untuk submit; pemberitahuan sebelum pengumpulan |
| Retensi | Data foto/GPS/kontak/log operasional berisi data pribadi: 3 bulan sejak pengumpulan; jadwal retensi audit resmi ditetapkan sebelum go-live |
| Koreksi | Manual, dengan alasan, bukti, aktor, persetujuan supervisor, audit, dan rekonsiliasi; tanpa penyesuaian finansial otomatis |
| Prasyarat go/no-go pilot | P0 lulus, migration/staging/restore terverifikasi, OTP dan sumber nomor terverifikasi diperiksa, pemberitahuan serta penghapusan data disiapkan, supervisor ditunjuk, dan runbook/support tersedia |

## 7. Definisi hasil pilot berhasil

Pilot dinyatakan berhasil bila:

1. P0 acceptance criteria di atas lulus dan bukti hasil tersimpan.
2. Seluruh selisih billing yang ditemukan dapat dijelaskan, ditandai untuk review, atau secara eksplisit diterima pemilik proses; tidak ada perbedaan yang dihapus diam-diam.
3. Operasional dapat memproses kegagalan jaringan, retry, penolakan, dan rekonsiliasi tanpa kehilangan data atau tindakan manual yang tidak tercatat.
4. Pemilik produk, billing, keamanan, dan operasional menyetujui keputusan lanjut/rollback secara tertulis.

## 8. Keputusan rilis

- **Go pilot terbatas:** semua gerbang akses, backup, migration, rekonsiliasi, dan fallback lulus.
- **Go produksi untuk pembacaan yang belum ditagihkan:** pilot lulus dan alur koreksi sebelum closing jelas.
- **Go produksi yang mencakup koreksi pasca-terbit:** hanya setelah workflow revisi, pemisahan tugas, dampak finansial, audit, dan rekonsiliasi billing disahkan serta diuji.
- **No-go:** migration belum diverifikasi, konflik data belum ditangani, audit tidak lengkap, restore belum diuji, atau operasional tidak memiliki prosedur saat sistem gagal.
