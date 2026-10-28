// features/dashboard/components/petugas/tipe.ts — bentuk data halaman Petugas.

export type JenisTugas = "PENCATAT_METER" | "PENYELIA_ANOMALI"

export interface Pencatat {
  id: string
  namaLapangan: string
  namaLengkap: string | null
  nip: string | null
  jenisTugas: JenisTugas
  isAktif: boolean
  user: { id: string; name: string | null; email: string | null } | null
  _count?: { penugasanRute: number }
}

export type JumlahPerJenis = Record<JenisTugas, number>
