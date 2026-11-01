"use client"

// features/dashboard/verifikasi/components/modalPencarian.tsx — modal
// "Pencarian Data" (filter custom): hanya kriteria yang dicentang dan diisi
// dikirim ke induk untuk diterapkan pada endpoint laporan harian.
//
// Daftar kriteria berbasis konfigurasi (KIRI / KANAN / BAWAH) supaya menambah
// atau mengubah urutan kriteria cukup satu baris. Pilihan untuk dropdown yang
// datanya dari server (wilayah, zonasi, petugas, …) diberikan lewat prop `opsi`
// dan kuncinya sama dengan `kunci` kriteria; selama belum ada, dropdown mati.
import * as React from "react"
import { cn } from "@/lib/Utilitas"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LABEL_KONDISI_CATAT } from "@/features/dashboard/lib/LabelPencatatan"
import {
  KELAS_KONTROL_MODAL,
  PilihSatu,
  type OpsiPilihan,
} from "../DialogVerifikasi"
import { KerangkaModal } from "../KerangkaModal"
import {
  saringOpsiFilterPencarian,
  sesuaikanFilterPencarian,
  type OpsiFilterPencarian,
} from "../../lib/PenyaringanRelasi"

export type KriteriaPencarian = Record<string, string>
export type OpsiPencarian = OpsiFilterPencarian

const YA_TIDAK: OpsiPilihan[] = [
  { value: "ya", label: "Ya" },
  { value: "tidak", label: "Tidak" },
]
const OPERATOR: OpsiPilihan[] = [
  { value: "=", label: "=" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
]
const JENIS_CATAT: OpsiPilihan[] = [
  { value: "ONSITE", label: "Kunjungan langsung" },
  { value: "OFFSITE", label: "Di luar lokasi" },
]
const KONDISI_CATAT: OpsiPilihan[] = Object.entries(LABEL_KONDISI_CATAT).map(
  ([value, label]) => ({ value, label })
)

type Jenis = "pilih" | "teks" | "rentang" | "tanggal" | "operator"
interface Bidang {
  kunci: string
  label: string
  jenis: Jenis
  /** Opsi tetap; bila kosong dipakai `opsi[kunci]` dari prop. */
  opsi?: OpsiPilihan[]
}

const KIRI: Bidang[] = [
  { kunci: "wilayahDistId", label: "Wilayah", jenis: "pilih" },
  { kunci: "zonaId", label: "Zonasi", jenis: "pilih" },
  { kunci: "ruteLanjutanId", label: "Rute", jenis: "pilih" },
  { kunci: "alamat", label: "Alamat", jenis: "teks" },
  { kunci: "noPel", label: "No. Pel", jenis: "teks" },
  { kunci: "nama", label: "Nama", jenis: "teks" },
  { kunci: "tarifGolonganId", label: "Jenis Tarif", jenis: "pilih" },
  {
    kunci: "standKoreksi",
    label: "Stand Koreksi",
    jenis: "pilih",
    opsi: YA_TIDAK,
  },
  { kunci: "statusSpt", label: "Status SPT", jenis: "pilih", opsi: YA_TIDAK },
]

const KANAN: Bidang[] = [
  { kunci: "statusBaca", label: "Status Baca", jenis: "pilih", opsi: YA_TIDAK },
  { kunci: "tanggalBaca", label: "Tanggal Baca", jenis: "tanggal" },
  {
    kunci: "kondisiLanjutan",
    label: "Keterangan Catat",
    jenis: "pilih",
    opsi: KONDISI_CATAT,
  },
  { kunci: "pencatatLanjutanId", label: "Petugas", jenis: "pilih" },
  {
    kunci: "kategori",
    label: "Jenis Catat",
    jenis: "pilih",
    opsi: JENIS_CATAT,
  },
  { kunci: "pemakaianRange", label: "Pemakaian Range", jenis: "rentang" },
  { kunci: "pemakaian", label: "Pemakaian", jenis: "operator" },
  { kunci: "persentase", label: "Persentase", jenis: "operator" },
  { kunci: "kecamatanId", label: "Kecamatan", jenis: "pilih" },
  { kunci: "kelurahanId", label: "Kelurahan", jenis: "pilih" },
]

const BAWAH: Bidang[] = [
  {
    kunci: "verifWil",
    label: "Verifikasi Wil",
    jenis: "pilih",
    opsi: YA_TIDAK,
  },
  {
    kunci: "verifKasie",
    label: "Verifikasi Kasie",
    jenis: "pilih",
    opsi: YA_TIDAK,
  },
  {
    kunci: "verifPusat",
    label: "Verifikasi Pusat",
    jenis: "pilih",
    opsi: YA_TIDAK,
  },
]

const SEMUA = [...KIRI, ...KANAN, ...BAWAH]

export function hitungKriteriaPencarian(kriteria: KriteriaPencarian): number {
  return SEMUA.filter((b) =>
    b.jenis === "rentang" || b.jenis === "tanggal"
      ? Boolean(kriteria[`${b.kunci}Dari`] || kriteria[`${b.kunci}Sampai`])
      : Boolean(kriteria[b.kunci])
  ).length
}

interface Keadaan {
  aktif: Record<string, boolean>
  nilai: Record<string, string>
}

function keadaanAwal(nilaiAwal: KriteriaPencarian): Keadaan {
  const nilai: Record<string, string> = { ...nilaiAwal }
  for (const b of SEMUA) {
    if (b.jenis === "pilih") nilai[b.kunci] ??= ""
    if (b.jenis === "operator") nilai[`${b.kunci}Operator`] ??= "="
  }
  const aktif: Record<string, boolean> = {}
  for (const b of SEMUA) {
    const punyaNilai =
      b.jenis === "rentang" || b.jenis === "tanggal"
        ? Boolean(nilai[`${b.kunci}Dari`] || nilai[`${b.kunci}Sampai`])
        : Boolean(nilai[b.kunci])
    aktif[b.kunci] = punyaNilai
  }
  return { aktif, nilai }
}

function Kontrol({
  b,
  aktif,
  nilai,
  nilaiAktif,
  opsi,
  ubah,
}: {
  b: Bidang
  aktif: boolean
  nilai: Record<string, string>
  nilaiAktif: Record<string, boolean>
  opsi: OpsiPencarian
  ubah: (kunci: string, v: string) => void
}) {
  const mati = !aktif
  const v = (k: string) => nilai[k] ?? ""

  switch (b.jenis) {
    case "pilih": {
      const semuaOpsi = b.opsi ?? opsi[b.kunci] ?? []
      const daftar = saringOpsiFilterPencarian(
        b.kunci,
        semuaOpsi,
        { aktif: nilaiAktif, nilai },
        opsi
      )
      return (
        <PilihSatu
          ariaLabel={b.label}
          value={v(b.kunci)}
          onChange={(x) => ubah(b.kunci, x)}
          opsi={daftar}
          placeholder={`- ${b.label} -`}
          disabled={mati || daftar.length === 0}
        />
      )
    }
    case "teks":
      return (
        <Input
          value={v(b.kunci)}
          onChange={(e) => ubah(b.kunci, e.target.value)}
          disabled={mati}
          className={KELAS_KONTROL_MODAL}
          aria-label={b.label}
        />
      )
    case "rentang":
    case "tanggal": {
      const tipe = b.jenis === "tanggal" ? "date" : "number"
      return (
        <div className="flex items-center gap-1.5">
          <Input
            type={tipe}
            value={v(`${b.kunci}Dari`)}
            onChange={(e) => ubah(`${b.kunci}Dari`, e.target.value)}
            disabled={mati}
            className={KELAS_KONTROL_MODAL}
            aria-label={`${b.label} dari`}
          />
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">
            s/d
          </span>
          <Input
            type={tipe}
            value={v(`${b.kunci}Sampai`)}
            onChange={(e) => ubah(`${b.kunci}Sampai`, e.target.value)}
            disabled={mati}
            className={KELAS_KONTROL_MODAL}
            aria-label={`${b.label} sampai`}
          />
        </div>
      )
    }
    case "operator":
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-24 shrink-0">
            <PilihSatu
              ariaLabel={`${b.label} operator`}
              value={v(`${b.kunci}Operator`)}
              onChange={(x) => ubah(`${b.kunci}Operator`, x)}
              opsi={OPERATOR}
              disabled={mati}
            />
          </div>
          <Input
            type="number"
            value={v(b.kunci)}
            onChange={(e) => ubah(b.kunci, e.target.value)}
            disabled={mati}
            className={KELAS_KONTROL_MODAL}
            aria-label={b.label}
          />
        </div>
      )
  }
}

function BarisBidang({
  b,
  tumpuk,
  keadaan,
  nilaiAktif,
  opsi,
  ubahAktif,
  ubahNilai,
}: {
  b: Bidang
  tumpuk?: boolean
  keadaan: Keadaan
  nilaiAktif: Record<string, boolean>
  opsi: OpsiPencarian
  ubahAktif: (kunci: string, v: boolean) => void
  ubahNilai: (kunci: string, v: string) => void
}) {
  const aktif = !!keadaan.aktif[b.kunci]
  return (
    <div
      className={cn(
        "grid items-center gap-x-3 gap-y-1.5",
        tumpuk ? "grid-cols-1" : "grid-cols-[9.5rem_minmax(0,1fr)]"
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          id={`cari-${b.kunci}`}
          checked={aktif}
          onCheckedChange={(v) => ubahAktif(b.kunci, v === true)}
        />
        <Label
          htmlFor={`cari-${b.kunci}`}
          className={cn(
            "text-sm font-normal",
            !aktif && "text-muted-foreground"
          )}
        >
          {b.label}
        </Label>
      </div>
      <Kontrol
        b={b}
        aktif={aktif}
        nilai={keadaan.nilai}
        nilaiAktif={nilaiAktif}
        opsi={opsi}
        ubah={ubahNilai}
      />
    </div>
  )
}

export function ModalPencarian({
  buka,
  onBuka,
  opsi = {},
  nilaiAwal = {},
  onCari,
}: {
  buka: boolean
  onBuka: (v: boolean) => void
  /** Pilihan dropdown yang datanya dari server, dikunci dengan `kunci` kriteria. */
  opsi?: OpsiPencarian
  /** Kriteria yang sedang diterapkan; dipakai untuk mengisi ulang modal. */
  nilaiAwal?: KriteriaPencarian
  onCari: (kriteria: KriteriaPencarian, jumlah: number) => void
}) {
  const [keadaan, setKeadaan] = React.useState<Keadaan>(() =>
    keadaanAwal(nilaiAwal)
  )
  const [galat, setGalat] = React.useState<string | null>(null)

  const ubahAktif = (kunci: string, v: boolean) =>
    setKeadaan((k) => ({ ...k, aktif: { ...k.aktif, [kunci]: v } }))
  const ubahNilai = (kunci: string, v: string) =>
    setKeadaan((k) => sesuaikanFilterPencarian(kunci, v, k, opsi))

  function cari() {
    const hasil: KriteriaPencarian = {}
    let jumlah = 0
    for (const b of SEMUA) {
      if (!keadaan.aktif[b.kunci]) continue
      const sebelum = Object.keys(hasil).length
      const ambil = (k: string) => {
        const x = keadaan.nilai[k]
        if (x) hasil[k] = x
      }
      if (b.jenis === "rentang" || b.jenis === "tanggal") {
        ambil(`${b.kunci}Dari`)
        ambil(`${b.kunci}Sampai`)
      } else if (b.jenis === "operator") {
        ambil(b.kunci)
        if (keadaan.nilai[b.kunci]) ambil(`${b.kunci}Operator`)
      } else {
        ambil(b.kunci)
      }
      if (Object.keys(hasil).length > sebelum) jumlah += 1
    }
    for (const kunci of [
      "pemakaianRangeDari",
      "pemakaianRangeSampai",
      "pemakaian",
      "persentase",
    ]) {
      const nilai = hasil[kunci]
      if (nilai && !Number.isInteger(Number(nilai))) {
        setGalat("Pemakaian dan persentase harus berupa bilangan bulat.")
        return
      }
    }
    for (const b of SEMUA.filter(
      (bidang) => bidang.jenis === "rentang" || bidang.jenis === "tanggal"
    )) {
      const dari = hasil[`${b.kunci}Dari`]
      const sampai = hasil[`${b.kunci}Sampai`]
      const terbalik =
        dari && sampai
          ? b.jenis === "rentang"
            ? Number(dari) > Number(sampai)
            : dari > sampai
          : false
      if (terbalik) {
        setGalat(`${b.label}: nilai awal tidak boleh melewati nilai akhir.`)
        return
      }
    }
    setGalat(null)
    onCari(hasil, jumlah)
    onBuka(false)
  }

  const bagi = {
    keadaan,
    opsi,
    ubahAktif,
    ubahNilai,
    nilaiAktif: keadaan.aktif,
  }

  return (
    <KerangkaModal
      buka={buka}
      onBuka={onBuka}
      judul="Pencarian Data"
      subjudul="Centang kriteria yang ingin dipakai; filter diterapkan pada data laporan dan sambungan."
      lebar="xl"
      footer={
        <>
          {galat && (
            <span role="alert" className="mr-auto text-xs text-destructive">
              {galat}
            </span>
          )}
          <Button
            variant="outline"
            className="h-9"
            onClick={() => {
              setKeadaan(keadaanAwal({}))
              setGalat(null)
            }}
          >
            Atur ulang
          </Button>
          <Button className="h-9 min-w-36" onClick={cari}>
            Cari Data
          </Button>
        </>
      }
    >
      <div className="grid gap-x-16 gap-y-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          {KIRI.map((b) => (
            <BarisBidang key={b.kunci} b={b} {...bagi} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {KANAN.map((b) => (
            <BarisBidang key={b.kunci} b={b} {...bagi} />
          ))}
        </div>

        <div className="grid gap-3 border-t border-border/70 pt-4 md:col-span-2 md:grid-cols-3">
          {BAWAH.map((b) => (
            <BarisBidang key={b.kunci} b={b} tumpuk {...bagi} />
          ))}
        </div>
      </div>
    </KerangkaModal>
  )
}
