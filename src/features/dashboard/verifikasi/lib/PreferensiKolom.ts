export const KOLOM_VERIFIKASI = [
  "ring",
  "nomor",
  "nama",
  "alamat",
  "standAwal",
  "standAkhir",
  "standRevisi",
  "standResmi",
  "pakai",
  "lalu",
  "tagihan",
  "deviasi",
  "rute",
  "kondisi",
  "petugas",
  "tanggal",
  "status",
] as const

export type KolomVerifikasi = (typeof KOLOM_VERIFIKASI)[number]

export interface PreferensiKolom {
  urutan: KolomVerifikasi[]
  tampil: Record<KolomVerifikasi, boolean>
  lebar: Record<KolomVerifikasi, number>
}

export const PREFERENSI_KOLOM_AWAL: PreferensiKolom = {
  urutan: [...KOLOM_VERIFIKASI],
  tampil: Object.fromEntries(
    KOLOM_VERIFIKASI.map((kolom) => [kolom, true])
  ) as Record<KolomVerifikasi, boolean>,
  lebar: {
    ring: 76,
    status: 116,
    nomor: 132,
    nama: 220,
    alamat: 280,
    standAwal: 88,
    standAkhir: 88,
    standRevisi: 88,
    standResmi: 96,
    pakai: 72,
    lalu: 72,
    tagihan: 88,
    deviasi: 84,
    rute: 84,
    kondisi: 140,
    petugas: 130,
    tanggal: 155,
  },
}

export function normalisasiPreferensiKolom(value: unknown): PreferensiKolom {
  if (!value || typeof value !== "object") {
    return {
      urutan: [...PREFERENSI_KOLOM_AWAL.urutan],
      tampil: { ...PREFERENSI_KOLOM_AWAL.tampil },
      lebar: { ...PREFERENSI_KOLOM_AWAL.lebar },
    }
  }

  const input = value as {
    urutan?: unknown
    tampil?: unknown
    lebar?: unknown
  }
  const inputOrder = Array.isArray(input.urutan) ? input.urutan : []
  const knownOrder = inputOrder.filter(
    (kolom): kolom is KolomVerifikasi =>
      typeof kolom === "string" &&
      (KOLOM_VERIFIKASI as readonly string[]).includes(kolom)
  )
  const order = [
    ...new Set(knownOrder),
    ...KOLOM_VERIFIKASI.filter((kolom) => !knownOrder.includes(kolom)),
  ]
  const inputVisibility =
    input.tampil && typeof input.tampil === "object"
      ? (input.tampil as Record<string, unknown>)
      : {}
  const visibility = { ...PREFERENSI_KOLOM_AWAL.tampil }
  const widths = { ...PREFERENSI_KOLOM_AWAL.lebar }
  for (const kolom of KOLOM_VERIFIKASI) {
    if (typeof inputVisibility[kolom] === "boolean") {
      visibility[kolom] = inputVisibility[kolom]
    }
  }
  const inputWidths =
    input.lebar && typeof input.lebar === "object"
      ? (input.lebar as Record<string, unknown>)
      : {}
  for (const kolom of KOLOM_VERIFIKASI) {
    const lebar = inputWidths[kolom]
    if (typeof lebar === "number" && Number.isFinite(lebar)) {
      widths[kolom] = Math.min(800, Math.max(48, Math.round(lebar)))
    }
  }

  return { urutan: order, tampil: visibility, lebar: widths }
}

export function pindahkanKolom(
  preferensi: PreferensiKolom,
  dari: KolomVerifikasi,
  ke: KolomVerifikasi
): PreferensiKolom {
  const urutan = [...preferensi.urutan]
  const indexDari = urutan.indexOf(dari)
  const indexKe = urutan.indexOf(ke)
  if (indexDari < 0 || indexKe < 0 || indexDari === indexKe) return preferensi
  urutan.splice(indexDari, 1)
  urutan.splice(indexKe, 0, dari)
  return { ...preferensi, urutan }
}

export function ubahLebarKolom(
  preferensi: PreferensiKolom,
  kolom: KolomVerifikasi,
  lebar: number
): PreferensiKolom {
  const nilai = Math.min(800, Math.max(48, Math.round(lebar)))
  if (preferensi.lebar[kolom] === nilai) return preferensi
  return { ...preferensi, lebar: { ...preferensi.lebar, [kolom]: nilai } }
}
