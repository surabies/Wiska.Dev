// features/dashboard/components/pengaduan/detail-tiket/konstanta.ts
import type { StatusPengaduan } from "@/features/dashboard/components/pengaduan/tipe";

/// Status yang TIDAK boleh muncul sebagai tombol status generik:
///  - DITUTUP & DIBUKA_KEMBALI: hak PELAPOR; backend menolaknya eksplisit.
///  - DITUGASKAN: punya jalur sendiri (dropdown + Tugaskan) — tombol generik
///    akan memindahkan status TANPA ditugaskanKeId (keadaan separuh jadi).
///  - SELESAI: punya blok sendiri (wajib catatan + foto bukti).
export const BUKAN_TOMBOL_STATUS: StatusPengaduan[] = [
  "DITUTUP",
  "DIBUKA_KEMBALI",
  "DITUGASKAN",
  "SELESAI",
];
