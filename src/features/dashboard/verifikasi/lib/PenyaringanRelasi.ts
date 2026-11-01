export interface OpsiFilterRelasi {
  value: string
  label: string
  disabled?: boolean
  wilayahDistId?: string
  kecamatanId?: string
  pencatatIds?: string[]
}

export interface PenugasanFilter {
  pencatatId: string
  ruteId: string
}

export type OpsiFilterPencarian = Partial<Record<string, OpsiFilterRelasi[]>>

export interface OpsiFilterUtama {
  pencatats: { id: string; namaLapangan: string }[]
  rutes: { id: string; kode: string }[]
}

export function saringOpsiPetugasRute(
  pencatats: OpsiFilterUtama["pencatats"],
  rutes: OpsiFilterUtama["rutes"],
  penugasan: PenugasanFilter[],
  pencatatId: string,
  ruteId: string
): OpsiFilterUtama {
  const pencatatIdYangTersedia = ruteId
    ? new Set(
        penugasan
          .filter((item) => item.ruteId === ruteId)
          .map((item) => item.pencatatId)
      )
    : null
  const ruteIdYangTersedia = pencatatId
    ? new Set(
        penugasan
          .filter((item) => item.pencatatId === pencatatId)
          .map((item) => item.ruteId)
      )
    : null

  return {
    pencatats: pencatatIdYangTersedia
      ? pencatats.filter((item) => pencatatIdYangTersedia.has(item.id))
      : pencatats,
    rutes: ruteIdYangTersedia
      ? rutes.filter((item) => ruteIdYangTersedia.has(item.id))
      : rutes,
  }
}

export function sertakanPenugasanPadaOpsiRute(
  opsi: OpsiFilterPencarian,
  penugasan: PenugasanFilter[],
  dimuat = true
): OpsiFilterPencarian {
  const pencatatPerRute = new Map<string, string[]>()
  for (const item of penugasan) {
    const pencatatIds = pencatatPerRute.get(item.ruteId) ?? []
    pencatatIds.push(item.pencatatId)
    pencatatPerRute.set(item.ruteId, pencatatIds)
  }

  return {
    ...opsi,
    ruteLanjutanId: opsi.ruteLanjutanId?.map((rute) => ({
      ...rute,
      disabled: !dimuat,
      ...(dimuat ? { pencatatIds: pencatatPerRute.get(rute.value) ?? [] } : {}),
    })),
    pencatatLanjutanId: opsi.pencatatLanjutanId?.map((pencatat) => ({
      ...pencatat,
      disabled: !dimuat,
    })),
  }
}

export interface NilaiFilterPencarian {
  aktif: Record<string, boolean>
  nilai: Record<string, string>
}

function nilaiAktif(keadaan: NilaiFilterPencarian, kunci: string) {
  return keadaan.aktif[kunci] ? keadaan.nilai[kunci] : ""
}

function opsiTerpilih(opsi: OpsiFilterPencarian, kunci: string, nilai: string) {
  return nilai ? opsi[kunci]?.find((item) => item.value === nilai) : undefined
}

export function saringOpsiFilterPencarian(
  kunci: string,
  daftar: OpsiFilterRelasi[],
  keadaan: NilaiFilterPencarian,
  semuaOpsi: OpsiFilterPencarian
): OpsiFilterRelasi[] {
  const wilayahDistId = nilaiAktif(keadaan, "wilayahDistId")
  const zonaId = nilaiAktif(keadaan, "zonaId")
  const ruteId = nilaiAktif(keadaan, "ruteLanjutanId")
  const pencatatId = nilaiAktif(keadaan, "pencatatLanjutanId")
  const kecamatanId = nilaiAktif(keadaan, "kecamatanId")
  const kelurahanId = nilaiAktif(keadaan, "kelurahanId")

  if (kunci === "wilayahDistId") {
    const wilayahDariZona = opsiTerpilih(
      semuaOpsi,
      "zonaId",
      zonaId
    )?.wilayahDistId
    const wilayahDariRute = opsiTerpilih(
      semuaOpsi,
      "ruteLanjutanId",
      ruteId
    )?.wilayahDistId
    const wilayahTerkait = wilayahDariZona ?? wilayahDariRute
    return wilayahTerkait
      ? daftar.filter((item) => item.value === wilayahTerkait)
      : daftar
  }

  if (kunci === "zonaId") {
    return wilayahDistId
      ? daftar.filter((item) => item.wilayahDistId === wilayahDistId)
      : daftar
  }

  if (kunci === "ruteLanjutanId") {
    return daftar.filter(
      (item) =>
        (!wilayahDistId || item.wilayahDistId === wilayahDistId) &&
        (!pencatatId ||
          !item.pencatatIds ||
          item.pencatatIds.includes(pencatatId))
    )
  }

  if (kunci === "pencatatLanjutanId") {
    const pencatatTerkait = opsiTerpilih(
      semuaOpsi,
      "ruteLanjutanId",
      ruteId
    )?.pencatatIds
    return pencatatTerkait
      ? daftar.filter((item) => pencatatTerkait.includes(item.value))
      : daftar
  }

  if (kunci === "kecamatanId") {
    const kecamatanDariKelurahan = opsiTerpilih(
      semuaOpsi,
      "kelurahanId",
      kelurahanId
    )?.kecamatanId
    return kecamatanDariKelurahan
      ? daftar.filter((item) => item.value === kecamatanDariKelurahan)
      : daftar
  }

  if (kunci === "kelurahanId") {
    return kecamatanId
      ? daftar.filter((item) => item.kecamatanId === kecamatanId)
      : daftar
  }

  return daftar
}

export function sesuaikanFilterPencarian(
  kunci: string,
  nilai: string,
  keadaan: NilaiFilterPencarian,
  opsi: OpsiFilterPencarian
): NilaiFilterPencarian {
  const nilaiBaru = { ...keadaan.nilai, [kunci]: nilai }
  const aktifBaru = { ...keadaan.aktif }
  const berubah = keadaan.nilai[kunci] !== nilai

  if (berubah && kunci === "wilayahDistId") {
    const zona = opsi.zonaId?.find((item) => item.value === nilaiBaru.zonaId)
    const rute = opsi.ruteLanjutanId?.find(
      (item) => item.value === nilaiBaru.ruteLanjutanId
    )
    if (nilai && zona?.wilayahDistId && zona.wilayahDistId !== nilai) {
      nilaiBaru.zonaId = ""
    }
    if (nilai && rute?.wilayahDistId && rute.wilayahDistId !== nilai) {
      nilaiBaru.ruteLanjutanId = ""
    }
  }

  if (berubah && kunci === "pencatatLanjutanId") {
    const ruteTerpilih = nilaiBaru.ruteLanjutanId
    const rute = opsi.ruteLanjutanId?.find(
      (item) => item.value === ruteTerpilih
    )
    if (
      nilai &&
      ruteTerpilih &&
      rute?.pencatatIds &&
      !rute.pencatatIds.includes(nilai)
    ) {
      nilaiBaru.ruteLanjutanId = ""
    }
  }

  if (berubah && kunci === "ruteLanjutanId") {
    const pencatatTerpilih = nilaiBaru.pencatatLanjutanId
    const rute = opsi.ruteLanjutanId?.find((item) => item.value === nilai)
    if (
      nilai &&
      pencatatTerpilih &&
      rute?.pencatatIds &&
      !rute.pencatatIds.includes(pencatatTerpilih)
    ) {
      nilaiBaru.pencatatLanjutanId = ""
    }
    const wilayahTerpilih = nilaiBaru.wilayahDistId
    if (
      nilai &&
      wilayahTerpilih &&
      rute?.wilayahDistId &&
      rute.wilayahDistId !== wilayahTerpilih
    ) {
      nilaiBaru.wilayahDistId = ""
      const zona = opsi.zonaId?.find((item) => item.value === nilaiBaru.zonaId)
      if (zona?.wilayahDistId !== rute.wilayahDistId) {
        nilaiBaru.zonaId = ""
      }
    }
  }

  if (berubah && kunci === "zonaId") {
    const wilayahTerpilih = nilaiBaru.wilayahDistId
    const zona = opsi.zonaId?.find((item) => item.value === nilai)
    if (
      nilai &&
      wilayahTerpilih &&
      zona?.wilayahDistId &&
      zona.wilayahDistId !== wilayahTerpilih
    ) {
      nilaiBaru.wilayahDistId = ""
    }
    const rute = opsi.ruteLanjutanId?.find(
      (item) => item.value === nilaiBaru.ruteLanjutanId
    )
    if (
      nilai &&
      rute?.wilayahDistId &&
      zona?.wilayahDistId &&
      rute.wilayahDistId !== zona.wilayahDistId
    ) {
      nilaiBaru.ruteLanjutanId = ""
    }
  }

  if (berubah && kunci === "kecamatanId") {
    const kelurahanTerpilih = nilaiBaru.kelurahanId
    const kelurahan = opsi.kelurahanId?.find(
      (item) => item.value === kelurahanTerpilih
    )
    if (
      nilai &&
      kelurahanTerpilih &&
      kelurahan?.kecamatanId &&
      kelurahan.kecamatanId !== nilai
    ) {
      nilaiBaru.kelurahanId = ""
    }
  }

  if (berubah && kunci === "kelurahanId") {
    const kecamatanTerpilih = nilaiBaru.kecamatanId
    const kelurahan = opsi.kelurahanId?.find((item) => item.value === nilai)
    if (
      nilai &&
      kecamatanTerpilih &&
      kelurahan?.kecamatanId &&
      kelurahan.kecamatanId !== kecamatanTerpilih
    ) {
      nilaiBaru.kecamatanId = ""
    }
  }

  aktifBaru[kunci] = keadaan.aktif[kunci] ?? true
  return { aktif: aktifBaru, nilai: nilaiBaru }
}
