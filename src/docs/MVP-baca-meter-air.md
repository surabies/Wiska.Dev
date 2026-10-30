# Definisi MVP — Aplikasi Baca Meter Air

**Versi:** 0.1 (proposal pilot terkendali)
**Tanggal:** 31 Oktober 2026
**Status:** batas MVP usulan; perlu persetujuan pemilik produk/operasional
**Dokumen terkait:** [PRD](./PRD-baca-meter-air.md), [Roadmap](./ROADMAP-baca-meter-air.md), [Arsitektur](./arsitektur-awal-baca-meter.md)

## 1. Tujuan MVP

Membuktikan satu alur operasional air yang utuh dan aman: tugas pembacaan diterbitkan, petugas/warga menyampaikan data, petugas meninjau bukti, hasil resmi tercatat satu kali, dan data dapat direkonsiliasi sebelum digunakan untuk closing.

MVP adalah **pilot terbatas**, bukan klaim sistem sudah memenuhi seluruh kebutuhan produksi komersial. Area, periode, volume pelanggan, tim pilot, dan apakah pilot dapat menghasilkan tagihan resmi harus ditentukan pemilik produk sebelum pilot.

## 2. Pengguna MVP

- Petugas/pencatat yang ditugaskan pada rute pilot.
- Verifikator/supervisor yang memiliki wewenang untuk memproses antrean.
- Admin sistem yang mengatur jadwal dan akun pilot.
- Warga yang mengirim laporan mandiri pada jendela yang dibuka.
- Operator billing yang memeriksa data rekonsiliasi dan memberi keputusan sebelum closing.

Bagian Langganan dapat melihat/menangani koreksi hanya sebatas workflow yang disahkan. Kewenangan approval belum boleh diasumsikan.

## 3. Termasuk MVP (P0)

1. **Scope layanan:** pembacaan meter air saja.
2. **Identitas dan periode:** sambungan, meter yang berlaku, periode, rute/penugasan, serta waktu pencatatan/penerimaan server dapat ditelusuri.
3. **Intake petugas:** input stand, kondisi kunjungan, waktu, foto bila diwajibkan, lokasi/akurasi bila disetujui kebijakan, serta status sinkronisasi.
4. **Intake warga:** laporan anonim pending dan laporan akun warga yang memeriksa tautan ke sambungan; kedua jalur mengikuti jendela server WIB dan menggunakan antrean yang sama.
5. **Pengaturan jendela:** halaman admin mengatur tanggal buka/tutup 1–28, nilai disimpan atomik, dan UI publik memperlihatkan jadwal efektif.
6. **Verifikasi:** petugas berwenang dapat menyetujui/menolak dengan alasan; tidak ada laporan mandiri yang langsung menjadi resmi.
7. **Satu hasil resmi:** hasil terverifikasi ditulis ke `PembacaanMeter`; sumber, stand, pemakaian riil/tagih, dan alasan perbedaan tidak dilebur.
8. **Riwayat kiriman warga:** foto dan nilai tiap percobaan tetap tersimpan; kirim ulang tidak menimpa bukti.
9. **Kontrol akses:** pengujian positif dan negatif untuk role serta akses objek/sambungan.
10. **Rekonsiliasi closing:** laporan hasil, pengecualian, duplikasi, dan selisih terhadap sumber disediakan/ditinjau sebelum data dipakai.
11. **Operasi dasar:** log terstruktur, error yang terlihat, backup, prosedur support, rollback, dan runbook pilot.

## 4. Tidak termasuk MVP

- Koreksi otomatis atas tagihan yang sudah terbit.
- Nota debit/kredit, saldo kredit, refund, pembayaran, atau ledger baru.
- Maker-checker untuk koreksi sebelum peran dan kebijakan disahkan. Namun, bila koreksi hasil produksi diperlukan, proses manual terkendali dan audit harus ditetapkan sebagai prasyarat pilot.
- Taksiran otomatis sebagai kebijakan resmi, pemakaian minimum, atau interpretasi kode legacy tanpa codebook.
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

## 6. Batas pilot yang perlu ditetapkan

Isi sebelum go/no-go:

| Parameter | Keputusan |
|---|---|
| Unit/wilayah/rute | Belum ditetapkan |
| Periode dan tanggal pilot | Belum ditetapkan |
| Jumlah sambungan/petugas/perangkat | Belum ditetapkan |
| Apakah output pilot boleh dipakai untuk tagihan resmi | Belum ditetapkan; perlu sign-off billing |
| Jam support dan pemilik incident | Belum ditetapkan |
| RPO/RTO, SLA, dan ambang alert | Belum ditetapkan |
| Kebijakan foto, GPS, retensi, dan pemberitahuan warga | Belum ditetapkan |
| Prosedur koreksi bila hasil mempengaruhi invoice yang terbit | Belum ditetapkan; jangan melakukan perubahan finansial otomatis |

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
