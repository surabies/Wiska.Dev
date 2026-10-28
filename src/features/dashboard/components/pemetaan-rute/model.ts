// features/dashboard/components/pemetaan-rute/model.ts — bentuk data halaman
// Pemetaan Rute dan pemetaan murni (tanpa React) dari data server ke baris UI.

/** Satu baris petugas dari GET /pencatat. */
export interface PencatatBaris {
  id: string
  namaLapangan: string
  namaLengkap: string | null
  isAktif: boolean
  user: { id: string; name: string | null } | null
  _count?: { penugasanRute: number }
}

/** Satu penugasan dari GET /penugasan-rute?pencatatId=. */
export interface PenugasanBaris {
  id: string
  ruteId: string
  urutan: number
  target: number
  rute: {
    id: string
    kode: string
    seksiCater?: { kode: string | null; nama: string | null } | null
  }
}

/** Baris daftar seret. `id` = ruteId supaya `onUrut` mengembalikan ruteIds
 *  (untuk PATCH /urutan); id penugasan aslinya dipisah untuk aksi lepas. */
export interface BarisRuteSeret {
  id: string
  penugasanId: string
  kode: string
  namaSeksi: string | null
  target: number
}

export function namaTampil(p: Pick<PencatatBaris, "namaLengkap" | "namaLapangan">): string {
  return p.namaLengkap ?? p.namaLapangan
}

export function keBarisSeret(p: PenugasanBaris): BarisRuteSeret {
  return {
    id: p.ruteId,
    penugasanId: p.id,
    kode: p.rute.kode,
    namaSeksi: p.rute.seksiCater?.nama ?? null,
    target: p.target,
  }
}
