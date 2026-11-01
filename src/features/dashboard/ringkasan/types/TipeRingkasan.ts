export interface TitikAnomali {
  periode: number
  DK: number
  TTB: number
  BMK_BMB: number
  MTA: number
  lainnya: number
}

export interface BarisPetugas {
  id: string
  nama: string
  total: number
  dicatat: number
  tidakTercatat: number
  persen: number
}

export interface StatPeriode {
  periode: number
  status: "terbit" | "berjalan"
  sl: number
  kubikasi: number
  nilai: number | null
}
