// features/dashboard/components/pengguna/pengguna-dialog/tipe.ts — tipe &
// konstanta yang dipakai bersama oleh bagian-bagian dialog.

export interface BarisPengguna {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
  divisiId?: string | null
  divisiKode?: string | null
}

export interface Divisi {
  id: string
  kode: string
  nama: string
}

/// Nilai sentinel untuk "tanpa divisi". Select tidak menerima value kosong,
/// dan mengirim string kosong ke server berarti id tak sah — bukan null.
export const TANPA_DIVISI = "__TANPA__"
