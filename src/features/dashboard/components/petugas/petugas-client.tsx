"use client"

// features/dashboard/components/petugas/petugas-client.tsx — PERAKIT halaman
// Petugas Pencatat Meter: kartu ringkasan + DataGrid + dialog ubah jenis.
// Logikanya ada di berkas tetangga:
//   use-daftar-petugas.ts   jumlah per jenis, aksi ubah jenis
//   kolom-petugas.ts        kolom grid
//   dialog-jenis-tugas.tsx  dialog ubah jenis (sekaligus konfirmasinya)
//   kartu-jenis.tsx · konstanta.tsx · tipe.ts
import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataGrid, type FilterSelect } from "../data-grid"
import { DialogJenisTugas } from "./dialog-jenis-tugas"
import { KartuJenis } from "./kartu-jenis"
import { KOLOM_PETUGAS } from "./kolom-petugas"
import { JENIS } from "./konstanta"
import type { Pencatat } from "./tipe"
import { useDaftarPetugas } from "./use-daftar-petugas"

const FILTER: FilterSelect[] = [
  {
    param: "jenisTugas",
    label: "Jenis tugas",
    opsi: JENIS.map((j) => ({ value: j.nilai, label: j.label })),
  },
]

export function PetugasClient({ bolehUbah }: { bolehUbah: boolean }) {
  const { jumlah, galat, versi, ubahJenis } = useDaftarPetugas()
  const [dipilih, setDipilih] = React.useState<Pencatat | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {galat && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      )}

      <div className="grid shrink-0 gap-3 sm:grid-cols-2">
        {JENIS.map((j) => (
          <KartuJenis key={j.nilai} info={j} jumlah={jumlah?.[j.nilai] ?? null} />
        ))}
      </div>

      {jumlah !== null && jumlah.PENYELIA_ANOMALI === 0 && (
        <Alert className="shrink-0">
          <AlertDescription>
            Belum ada petugas bertugas sebagai <strong>penyelia anomali</strong>. Selama belum ada,
            daftar sambungan tidak terukur tidak akan pernah didatangi siapa pun.
          </AlertDescription>
        </Alert>
      )}

      {/* <p className="shrink-0 text-xs text-muted-foreground">
        {bolehUbah
          ? "Klik sebuah baris untuk mengubah jenis tugas petugas. Peran akun tetap PELAKSANA; yang diatur adalah pekerjaan dan cakupan datanya."
          : "Mengubah jenis tugas memerlukan wewenang supervisor ke atas."}
      </p> */}

      {/* Pembungkus ini yang memberi DataGrid tinggi pasti (flex-1 min-h-0):
          grid mengisi sisa layar di bawah kartu, tanpa tinggi yang dipatok. */}
      <div className="min-h-0 flex-1">
        <DataGrid
          judul="Petugas Pencatat Meter"
          endpoint="/pencatat"
          columnDefs={KOLOM_PETUGAS}
          searchParam="q"
          searchPlaceholder="Cari nama atau NIP…"
          filters={FILTER}
          refreshKey={versi}
          idTerpilih={dipilih?.id ?? null}
          onRowClicked={bolehUbah ? (baris) => setDipilih(baris as unknown as Pencatat) : undefined}
          tinggiClassName="min-h-80 flex-1"
        />
      </div>

      {dipilih && (
        <DialogJenisTugas
          key={dipilih.id}
          petugas={dipilih}
          onSimpan={(jenis) => ubahJenis(dipilih.id, jenis)}
          onTutup={() => setDipilih(null)}
        />
      )}
    </div>
  )
}
