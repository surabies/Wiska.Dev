"use client"

// features/dashboard/components/verifikasi/modal-pencarian.tsx — modal
// "Pencarian Data" (filter custom): tiap kriteria punya kotak centang; hanya
// kriteria yang DICENTANG yang dikirim lewat `onCari`. HANYA TAMPILAN —
// onCari dipakai induk bila sudah ada logikanya.
//
// Daftar kriteria berbasis konfigurasi (KIRI / KANAN / BAWAH) supaya menambah
// atau mengubah urutan kriteria cukup satu baris. Pilihan untuk dropdown yang
// datanya dari server (wilayah, zonasi, petugas, …) diberikan lewat prop `opsi`
// dan kuncinya sama dengan `kunci` kriteria; selama belum ada, dropdown mati.
import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KELAS_KONTROL_MODAL, PilihSatu, type OpsiPilihan } from "../dialog-verifikasi"
import { KerangkaModal } from "../kerangka-modal"

export type KriteriaPencarian = Record<string, string>
export type OpsiPencarian = Partial<Record<string, OpsiPilihan[]>>

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

type Jenis = "pilih" | "teks" | "rentang" | "tanggal" | "operator"
interface Bidang {
  kunci: string
  label: string
  jenis: Jenis
  /** Opsi tetap; bila kosong dipakai `opsi[kunci]` dari prop. */
  opsi?: OpsiPilihan[]
}

const KIRI: Bidang[] = [
  { kunci: "wilayah", label: "Wilayah", jenis: "pilih" },
  { kunci: "zonasi", label: "Zonasi", jenis: "pilih" },
  { kunci: "rute", label: "Rute", jenis: "teks" },
  { kunci: "jenisPelanggan", label: "Jenis Pelanggan", jenis: "pilih" },
  { kunci: "alamat", label: "Alamat", jenis: "teks" },
  { kunci: "noPel", label: "No. Pel", jenis: "teks" },
  { kunci: "nama", label: "Nama", jenis: "teks" },
  { kunci: "jenisTarif", label: "Jenis Tarif", jenis: "pilih" },
  { kunci: "standKoreksi", label: "Stand Koreksi", jenis: "pilih", opsi: YA_TIDAK },
  { kunci: "statusSpt", label: "Status SPT", jenis: "pilih", opsi: YA_TIDAK },
]

const KANAN: Bidang[] = [
  { kunci: "statusBaca", label: "Status Baca", jenis: "pilih", opsi: YA_TIDAK },
  { kunci: "tanggalBaca", label: "Tanggal Baca", jenis: "tanggal" },
  { kunci: "keteranganCatat", label: "Keterangan Catat", jenis: "pilih" },
  { kunci: "petugas", label: "Petugas", jenis: "pilih" },
  { kunci: "jenisCatat", label: "Jenis Catat", jenis: "pilih" },
  { kunci: "pemakaianRange", label: "Pemakaian Range", jenis: "rentang" },
  { kunci: "depositRange", label: "Deposit Range", jenis: "rentang" },
  { kunci: "pemakaian", label: "Pemakaian", jenis: "operator" },
  { kunci: "persentase", label: "Persentase", jenis: "operator" },
  { kunci: "kecamatan", label: "Kecamatan", jenis: "pilih" },
  { kunci: "kelurahan", label: "Kelurahan", jenis: "pilih" },
]

const BAWAH: Bidang[] = [
  { kunci: "verifWil", label: "Verifikasi Wil", jenis: "pilih", opsi: YA_TIDAK },
  { kunci: "verifKasie", label: "Verifikasi Kasie", jenis: "pilih", opsi: YA_TIDAK },
  { kunci: "verifPusat", label: "Verifikasi Pusat", jenis: "pilih", opsi: YA_TIDAK },
]

const SEMUA = [...KIRI, ...KANAN, ...BAWAH]

interface Keadaan {
  aktif: Record<string, boolean>
  nilai: Record<string, string>
}

function keadaanAwal(opsi: OpsiPencarian): Keadaan {
  const nilai: Record<string, string> = {}
  for (const b of SEMUA) {
    if (b.jenis === "pilih") nilai[b.kunci] = (b.opsi ?? opsi[b.kunci])?.[0]?.value ?? ""
    if (b.jenis === "operator") nilai[`${b.kunci}Op`] = "="
  }
  // Bawaan mengikuti form sistem lama: Status Baca = Ya, Verifikasi Wil = Tidak.
  nilai.statusBaca = "ya"
  nilai.verifWil = "tidak"
  return { aktif: { statusBaca: true, verifWil: true }, nilai }
}

function Kontrol({
  b,
  aktif,
  nilai,
  opsi,
  ubah,
}: {
  b: Bidang
  aktif: boolean
  nilai: Record<string, string>
  opsi: OpsiPencarian
  ubah: (kunci: string, v: string) => void
}) {
  const mati = !aktif
  const v = (k: string) => nilai[k] ?? ""

  switch (b.jenis) {
    case "pilih": {
      const daftar = b.opsi ?? opsi[b.kunci] ?? []
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
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">s/d</span>
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
              value={v(`${b.kunci}Op`)}
              onChange={(x) => ubah(`${b.kunci}Op`, x)}
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
  opsi,
  ubahAktif,
  ubahNilai,
}: {
  b: Bidang
  tumpuk?: boolean
  keadaan: Keadaan
  opsi: OpsiPencarian
  ubahAktif: (kunci: string, v: boolean) => void
  ubahNilai: (kunci: string, v: string) => void
}) {
  const aktif = !!keadaan.aktif[b.kunci]
  return (
    <div
      className={cn(
        "grid items-center gap-x-3 gap-y-1.5",
        tumpuk ? "grid-cols-1" : "grid-cols-[9.5rem_minmax(0,1fr)]",
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          id={`cari-${b.kunci}`}
          checked={aktif}
          onCheckedChange={(v) => ubahAktif(b.kunci, v === true)}
        />
        <Label htmlFor={`cari-${b.kunci}`} className={cn("text-sm font-normal", !aktif && "text-muted-foreground")}>
          {b.label}
        </Label>
      </div>
      <Kontrol b={b} aktif={aktif} nilai={keadaan.nilai} opsi={opsi} ubah={ubahNilai} />
    </div>
  )
}

export function ModalPencarian({
  buka,
  onBuka,
  opsi = {},
  onCari,
}: {
  buka: boolean
  onBuka: (v: boolean) => void
  /** Pilihan dropdown yang datanya dari server, dikunci dengan `kunci` kriteria. */
  opsi?: OpsiPencarian
  /** Hanya kriteria yang dicentang. Belum diberikan = tombol hanya menutup modal. */
  onCari?: (kriteria: KriteriaPencarian, jumlah: number) => void
}) {
  const [keadaan, setKeadaan] = React.useState<Keadaan>(() => keadaanAwal(opsi))
  const jumlah = SEMUA.filter((b) => keadaan.aktif[b.kunci]).length

  const ubahAktif = (kunci: string, v: boolean) =>
    setKeadaan((k) => ({ ...k, aktif: { ...k.aktif, [kunci]: v } }))
  const ubahNilai = (kunci: string, v: string) =>
    setKeadaan((k) => ({ ...k, nilai: { ...k.nilai, [kunci]: v } }))

  function cari() {
    const hasil: KriteriaPencarian = {}
    for (const b of SEMUA) {
      if (!keadaan.aktif[b.kunci]) continue
      const ambil = (k: string) => {
        const x = keadaan.nilai[k]
        if (x) hasil[k] = x
      }
      if (b.jenis === "rentang" || b.jenis === "tanggal") {
        ambil(`${b.kunci}Dari`)
        ambil(`${b.kunci}Sampai`)
      } else if (b.jenis === "operator") {
        ambil(b.kunci)
        ambil(`${b.kunci}Op`)
      } else {
        ambil(b.kunci)
      }
    }
    onCari?.(hasil, jumlah)
    onBuka(false)
  }

  const bagi = { keadaan, opsi, ubahAktif, ubahNilai }

  return (
    <KerangkaModal
      buka={buka}
      onBuka={onBuka}
      judul="Pencarian Data"
      subjudul="Centang kriteria yang ingin dipakai; kriteria tanpa centang diabaikan."
      lebar="xl"
      footer={
        <>
          {!onCari && (
            <span className="mr-auto text-[11px] text-muted-foreground">
              Tampilan saja — pencarian belum tersambung ke tabel.
            </span>
          )}
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setKeadaan(keadaanAwal(opsi))}
          >
            Atur ulang
          </Button>
          <Button className="h-9 min-w-36" onClick={cari} disabled={jumlah === 0}>
            Cari Data{jumlah > 0 ? ` (${jumlah})` : ""}
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