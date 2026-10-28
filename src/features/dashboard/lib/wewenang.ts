// features/dashboard/lib/wewenang.ts — peran yang boleh MENULIS di halaman
// dashboard. Ini hanya untuk memutuskan tombol mana yang dipajang: penjaga
// aslinya tetap router di server, dan permintaan tulis dari peran lain akan
// ditolak di sana.

/** SUPERVISOR ke atas — selaras dengan SUPERVISOR_UP di server. */
const PERAN_SUPERVISOR_UP: readonly string[] = [
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
]

export function adalahSupervisorUp(peran: string | null | undefined): boolean {
  return !!peran && PERAN_SUPERVISOR_UP.includes(peran)
}
