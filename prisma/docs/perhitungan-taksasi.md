# Spesifikasi Logika Bisnis: Perhitungan Konsumsi & Taksasi Pemakaian Meter Air

Dokumen ini berisi standar operasional, rumus matematika, dan aturan logika bisnis untuk backend **Hono / TypeScript** dalam menentukan besaran pemakaian air ($m^3$) berdasarkan status/kondisi meter di lapangan.

---

## 1. Penggantian Meter Air di Tengah Periode (Ganti Meter)

Ketika fisik meter air lama diganti dengan meter air baru di tengah periode penagihan berjalan:

### Rumus Utama:
$$\text{Total Konsumsi} = (\text{Stand Angkat Lama} - \text{Stand Awal Lama}) + (\text{Stand Akhir Baru} - \text{Stand Awal Pemasangan Baru})$$

### Detail Variabel:
*   **Stand Awal Lama**: Angka meter lama pada awal bulan/periode.
*   **Stand Angkat Lama**: Angka pencatatan terakhir meter lama saat dicopot/diangkat.
*   **Stand Awal Pemasangan Baru**: Angka awal meter baru saat dipasang (umumnya `0`, atau angka pabrikan).
*   **Stand Akhir Baru**: Angka pencatatan meter baru saat penutupan periode (petugas cater harian/bulanan).

### Integrasi verifikasi petugas
Pada laporan petugas dengan kondisi `MB`, verifikator memasukkan **Stand Angkat Lama** dan **Stand Awal Pemasangan Baru**. `standAwal` pada laporan menjadi stand awal meter lama, sedangkan ST akhir hasil verifikasi menjadi stand akhir meter baru. Hasil perhitungan gabungan ditampilkan sebagai usulan M³ matematis; UI tidak menerapkan minimum/taksasi secara otomatis. Verifikator dapat mengubah nilai sesuai kebijakan yang berlaku. Nilai pilihan itu disimpan terpisah dari angka catat dan menjadi nilai M³ resmi saat V3.

---

## 2. Pemetaan Kode Kondisi Meter & Rumus Taksasi

Berdasarkan pilihan pada antarmuka pencatatan meter, berikut adalah pengelompokan kondisi beserta algoritma perhitungan pemakaian air ($m^3$):

### A. Pembacaan Normal / Direct Meter Reading
Pemakaian dihitung riil berdasarkan selisih stand meter:
$$\text{Pemakaian} = \text{Stand Akhir} - \text{Stand Awal}$$

| Kode Kondisi | Label UI | Rumus Pemakaian ($m^3$) | Keterangan & Aturan Sistem |
| :--- | :--- | :--- | :--- |
| `NORMAL` | Normal | $\text{Stand Akhir} - \text{Stand Awal}$ | Pembacaan rutin berhasil dan valid. |
| `STAND_TEMPEL` | Stand tempel | $\text{Stand Akhir} - \text{Stand Awal}$ | Angka dibaca dari stiker/label yang ditinggalkan pelanggan. |
| `STAND_KONSUMEN`| Stand konsumen | $\text{Stand Akhir} - \text{Stand Awal}$ | Angka dilaporkan mandiri oleh pelanggan (Lapor Mandiri/App). |
| `REVISI_PENCATAT`| Revisi pencatatan | $\text{Stand Akhir} - \text{Stand Awal}$ | Koreksi angka meter setelah dilakukan audit pencatatan. |

---

### B. Pemakaian Nol ($0 \text{ m}^3$)
Kondisi di mana tidak ada aliran air atau meter dihentikan sementara:

| Kode Kondisi | Label UI | Rumus Pemakaian | Keterangan |
| :--- | :--- | :--- | :--- |
| `TIDAK_DIPAKAI` | Tidak dipakai | $0 \text{ m}^3$ | Pelanggan aktif namun valve ditutup/tidak ada aktivitas. |
| `RUMAH_KOSONG` | Rumah kosong | $0 \text{ m}^3$ | Bangunan tidak berpenghuni. |
| `TIDAK_ADA_AIR` | Tidak ada air | $0 \text{ m}^3$ | Pasokan/distribusi air PDAM ke lokasi mati total. |
| `DICABUT` | Dicabut | $0 \text{ m}^3$ | Sambungan meter telah dicabut resmi oleh PDAM. |

---

### C. Taksasi Rata-Rata 3 Bulan ($\text{RATA\_3B}$)
Metode taksasi otomatis menggunakan rata-rata pemakaian $3\text{ bulan}$ sebelumnya apabila angka meter tidak dapat dibaca karena masalah fisik atau kendala akses.

$$\text{Taksasi Pemakaian} = \left\lceil \frac{\text{Pemakaian}_{M-1} + \text{Pemakaian}_{M-2} + \text{Pemakaian}_{M-3}}{3} \right\rceil$$
*(Note: Hasil selalu dibulatkan ke atas / `Math.ceil`, minimum $10 \text{ m}^3$ sesuai batas minimum pemakaian standar PDAM).*

| Kode Kondisi | Label UI | Metode | Alasan Taksasi |
| :--- | :--- | :--- | :--- |
| `METER_RUSAK` | Meter rusak | `RATA_3B` | Angka/kaca meter pecah atau tidak terbaca. |
| `METER_MATI` | Meter mati, ada air| `RATA_3B` | Air mengalir namun jarum/angka meter tidak berputar. |
| `METER_MUNDUR` | Meter mundur | `RATA_3B` | Angka meter berjalan berlawanan arah. |
| `METER_TERBALIK`| Meter terbalik | `RATA_3B` | Pemasangan fisik inlet/outlet terbalik. |
| `METER_DALAM_AIR`| Meter dalam air | `RATA_3B` | Meter terendam banjir/genangan air keruh. |
| `TERHALANG` | Terhalang | `RATA_3B` | Terhalang material/pembangunan/kendaraan. |
| `ADA_ANJING` | Ada anjing | `RATA_3B` | Petugas tidak dapat mendekati lokasi demi keselamatan. |
| `TTB` | TTB (Rumah Terkunci) | `RATA_3B` | **T**erkunci / **T**idak **B**isa Masuk lokasi. |
| `MTA` | MTA (Meter Tidak Ada) | `RATA_3B` | **M**eter **T**idak **A**da / hilang di tempat. |
| `BMK` / `BMB` | BMK/BMB | `RATA_3B` | **B**angunan **M**ampet/**B**untu / **B**ongkar. |
| `DK` | DK (Dinding Kunci) | `RATA_3B` | **D**inding / **K**unci pagar lokasi terhalang. |

---

### D. Penanganan Khusus & Anomali (Manual / Minimum Bill)

| Kode Kondisi | Label UI | Aturan Perhitungan | Keterangan |
| :--- | :--- | :--- | :--- |
| `LOS_METER` | Los meter | Taksasi $\text{RATA\_3B} \times 1.25$ | Pelanggan memakai air tanpa meteran (bypass/los). Diberikan beban taksasi + $25\%$ denda. |
| `MB` | MB (Minimum Bill) | $\max(\text{Riil}, \text{Beban Min})$ | Minimum pemakaian bulanan (misal $10 \text{ m}^3$). |
| `MUDA_KEMBALI` | Muda kembali | Reset rollover ($9999 \rightarrow 0000$) | Angka meter telah melewati batas maksimum (00000). Rumus: $(10000 - \text{Stand Awal}) + \text{Stand Akhir}$. |

---

## 3. Implementasi Kode TypeScript & Hono Backend

Berikut skema dan struktur helper fungsi TypeScript yang bisa langsung digunakan oleh **Claude Code**:

```typescript
// types/meter.ts

export type KodeKondisiMeter =
  | "NORMAL"
  | "TIDAK_DIPAKAI"
  | "RUMAH_KOSONG"
  | "STAND_TEMPEL"
  | "STAND_KONSUMEN"
  | "METER_RUSAK"
  | "METER_MATI"
  | "METER_MUNDUR"
  | "METER_TERBALIK"
  | "METER_DALAM_AIR"
  | "LOS_METER"
  | "BMK_BMB"
  | "TTB"
  | "MTA"
  | "TERHALANG"
  | "TIDAK_ADA_AIR"
  | "ADA_ANJING"
  | "DK"
  | "MB"
  | "MUDA_KEMBALI"
  | "REVISI_PENCATAT"
  | "DICABUT";

export interface InputHitungKonsumsi {
  kondisi: KodeKondisiMeter;
  standAwal: number;
  standAkhir?: number;
  riwayat3Bulan?: number[]; // [M-1, M-2, M-3]
  isGantiMeter?: boolean;
  dataGantiMeter?: {
    standAngkatLama: number;
    standAwalBaru: number;
    standAkhirBaru: number;
  };
}

export function hitungKonsumsiAir(input: InputHitungKonsumsi): {
  pemakaianM3: number;
  isTaksasi: boolean;
  catatan: string;
} {
  // 1. Kasus Khusus: Penggantian Meter di Tengah Periode
  if (input.isGantiMeter && input.dataGantiMeter) {
    const { standAngkatLama, standAwalBaru, standAkhirBaru } = input.dataGantiMeter;
    const pemakaianLama = Math.max(0, standAngkatLama - input.standAwal);
    const pemakaianBaru = Math.max(0, standAkhirBaru - standAwalBaru);
    return {
      pemakaianM3: pemakaianLama + pemakaianBaru,
      isTaksasi: false,
      catatan: "Perhitungan kombinasi ganti meter (Lama + Baru)",
    };
  }

  // 2. Kondisi Pemakaian Nol
  const kondisiNol: KodeKondisiMeter[] = [
    "TIDAK_DIPAKAI",
    "RUMAH_KOSONG",
    "TIDAK_ADA_AIR",
    "DICABUT",
  ];
  if (kondisiNol.includes(input.kondisi)) {
    return { pemakaianM3: 0, isTaksasi: false, catatan: "Kondisi tidak ada penggunaan air" };
  }

  // 3. Kondisi Pembacaan Riil (Normal / Stand Tempel / Stand Konsumen / Revisi)
  const kondisiRiil: KodeKondisiMeter[] = [
    "NORMAL",
    "STAND_TEMPEL",
    "STAND_KONSUMEN",
    "REVISI_PENCATAT",
  ];
  if (kondisiRiil.includes(input.kondisi) && input.standAkhir !== undefined) {
    const pemakaian = input.standAkhir - input.standAwal;
    return {
      pemakaianM3: pemakaian < 0 ? 0 : pemakaian,
      isTaksasi: false,
      catatan: "Pembacaan riil meter",
    };
  }

  // 4. Kondisi Rollover (Muda Kembali / Meter Putar Ulang dari 9999 ke 0000)
  if (input.kondisi === "MUDA_KEMBALI" && input.standAkhir !== undefined) {
    const BATAS_METER = 10000; // Sesuaikan dengan digit meter (misal 4 digit = 10000)
    const pemakaian = (BATAS_METER - input.standAwal) + input.standAkhir;
    return { pemakaianM3: pemakaian, isTaksasi: false, catatan: "Pencatatan meter rollover (muda kembali)" };
  }

  // 5. Kondisi Taksasi Rata-rata 3 Bulan
  const riwayat = input.riwayat3Bulan ?? [];
  const sum3Bulan = riwayat.reduce((acc, curr) => acc + curr, 0);
  const rata2 = riwayat.length > 0 ? Math.ceil(sum3Bulan / riwayat.length) : 10; // default 10m3 jika tidak ada riwayat
  const taksasiStandar = Math.max(10, rata2); // Batas minimum pemakaian PDAM (10 m3)

  if (input.kondisi === "LOS_METER") {
    return {
      pemakaianM3: Math.ceil(taksasiStandar * 1.25),
      isTaksasi: true,
      catatan: "Taksasi Los Meter (Rata-rata 3B + 25%)",
    };
  }

  // Default untuk seluruh kondisi taksasi (METER_RUSAK, TTB, MTA, TERHALANG, Dll)
  return {
    pemakaianM3: taksasiStandar,
    isTaksasi: true,
    catatan: `Taksasi otomatis akibat kondisi meter ${input.kondisi}`,
  };
}
```