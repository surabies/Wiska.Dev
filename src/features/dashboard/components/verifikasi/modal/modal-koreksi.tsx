"use client"

// features/dashboard/components/verifikasi/modal-koreksi.tsx — "Koreksi Data
// Pembacaan" (menu Edit dan CHN; keduanya membuka form yang SAMA).
//
// HANYA TAMPILAN: Simpan memanggil `onSimpan` bila diberikan; logika bisnis
// disambungkan belakangan. Tata letak mengikuti form sistem lama — Form Edit,
// Data Berjalan | Data Koreksi, Stand Angkat, Riwayat Deposit.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LABEL_KONDISI_CATAT } from "../../../lib/label"
import { KELAS_KONTROL_MODAL, PilihSatu } from "../dialog-verifikasi"
import { BarisForm, JudulBagian, KerangkaModal, KotakBaca } from "../kerangka-modal"

export interface BarisDeposit {
  periode: string
  stDeposit: number | null
  depositResmi: number | null
  depositPerubahan: number | null
  sisaDeposit: number | null
}

export interface DataKoreksi {
  /** Nomor pelanggan + nama, mis. "00402500200 BUDI". */
  pelanggan: string
  tarif?: string | null
  alamat?: string | null
  periode: string
  standAwal: number | null
  standAkhir: number | null
  pemakaian: number | null
  kelainan?: string | null
  /** null = tidak ada stand angkat. */
  standAngkat?: { lama: number | null; baru: number | null } | null
  riwayatDeposit?: BarisDeposit[]
}

/// Bentuk minimum baris tabel (petugas maupun mandiri) yang dibutuhkan konversi.
export interface BarisSumberModal {
  nomorLangganan?: string | null
  periode?: number | null
  standAwal?: number | null
  standAkhir?: number | null
  pemakaian?: number | null
  kondisi?: string | null
  alamatPelanggan?: string | null
  namaPelanggan?: string | null
  pelanggan?: {
    nama?: string | null
    alamat?: string | null
    tarifGolongan?: { kodeAsli: string } | null
  } | null
}

export function dataKoreksiDariBaris(b: BarisSumberModal): DataKoreksi {
  const nama = b.pelanggan?.nama ?? b.namaPelanggan ?? ""
  return {
    pelanggan: `${b.nomorLangganan ?? ""} ${nama}`.trim() || "—",
    tarif: b.pelanggan?.tarifGolongan?.kodeAsli ?? null,
    alamat: b.pelanggan?.alamat ?? b.alamatPelanggan ?? null,
    periode: b.periode ? String(b.periode) : "—",
    standAwal: b.standAwal ?? null,
    standAkhir: b.standAkhir ?? null,
    pemakaian: b.pemakaian ?? null,
    kelainan: b.kondisi ?? null,
    standAngkat: null,
    riwayatDeposit: [],
  }
}

export interface HasilKoreksi {
  standAkhir: number | null
  taksasi: boolean
  nilaiTaksasi: string
  kelainan: string
}

const angka = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("id-ID"))

export function ModalKoreksi({
  data,
  onTutup,
  onSimpan,
  onRata3,
}: {
  data: DataKoreksi
  onTutup: () => void
  /** Belum diberikan = Simpan hanya menutup modal (logika menyusul). */
  onSimpan?: (h: HasilKoreksi) => void
  onRata3?: () => void
}) {
  const [standAkhir, setStandAkhir] = React.useState(data.standAkhir == null ? "" : String(data.standAkhir))
  const [taksasi, setTaksasi] = React.useState(false)
  const [nilaiTaksasi, setNilaiTaksasi] = React.useState("")
  const [kelainan, setKelainan] = React.useState(data.kelainan ?? "")

  const akhirNum = standAkhir === "" ? null : Number(standAkhir)
  const pakai =
    data.standAwal != null && akhirNum != null && Number.isFinite(akhirNum)
      ? Math.max(0, akhirNum - data.standAwal)
      : null
  const riwayat = data.riwayatDeposit ?? []

  return (
    <KerangkaModal
      buka
      onBuka={(v) => !v && onTutup()}
      judul="Koreksi Data Pembacaan"
      subjudul={`${data.pelanggan} · periode ${data.periode}`}
      lebar="xl"
      footer={
        <>
          {!onSimpan && (
            <span className="mr-auto text-[11px] text-muted-foreground">
              Tampilan saja — Simpan belum tersambung ke server.
            </span>
          )}
          <Button variant="outline" className="h-9" onClick={onTutup}>
            Batal
          </Button>
          <Button
            className="h-9"
            onClick={() => {
              onSimpan?.({
                standAkhir: akhirNum != null && Number.isFinite(akhirNum) ? akhirNum : null,
                taksasi,
                nilaiTaksasi,
                kelainan,
              })
              onTutup()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
        {/* ── Kiri: form edit + data berjalan/koreksi ───────────────────── */}
        <section className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <JudulBagian>Form Edit</JudulBagian>
            <BarisForm label="Pelanggan"><KotakBaca nilai={data.pelanggan} /></BarisForm>
            <BarisForm label="Tarif"><KotakBaca nilai={data.tarif} /></BarisForm>
            <BarisForm label="Alamat"><KotakBaca nilai={data.alamat} /></BarisForm>
            <BarisForm label="Periode"><KotakBaca nilai={data.periode} /></BarisForm>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2.5">
              <JudulBagian>Data Berjalan</JudulBagian>
              <BarisForm label="Stand Awal"><KotakBaca nilai={data.standAwal} /></BarisForm>
              <BarisForm label="Stand Akhir"><KotakBaca nilai={data.standAkhir} /></BarisForm>
              <BarisForm label="Pemakaian"><KotakBaca nilai={data.pemakaian} /></BarisForm>
              <BarisForm label="Kelainan">
                <KotakBaca nilai={data.kelainan ? (LABEL_KONDISI_CATAT[data.kelainan] ?? data.kelainan) : null} />
              </BarisForm>
              <BarisForm label="Stand Angkat" tone="destruktif">
                <KotakBaca nilai={data.standAngkat?.lama} />
              </BarisForm>
            </div>

            <div className="flex min-w-0 flex-col gap-2.5">
              <JudulBagian>Data Koreksi</JudulBagian>
              <BarisForm label="Stand Awal"><KotakBaca nilai={data.standAwal} /></BarisForm>
              <BarisForm label="Stand Akhir" htmlFor="koreksi-akhir">
                <Input
                  id="koreksi-akhir"
                  type="number"
                  min={0}
                  value={standAkhir}
                  onChange={(e) => setStandAkhir(e.target.value)}
                  className={KELAS_KONTROL_MODAL}
                />
              </BarisForm>
              <BarisForm label="Pakai"><KotakBaca nilai={pakai} /></BarisForm>

              <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                <Label htmlFor="koreksi-taksasi" className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <Checkbox
                    id="koreksi-taksasi"
                    checked={taksasi}
                    onCheckedChange={(v) => setTaksasi(v === true)}
                  />
                  Taksasi
                </Label>
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    disabled={!taksasi}
                    value={nilaiTaksasi}
                    onChange={(e) => setNilaiTaksasi(e.target.value)}
                    className={KELAS_KONTROL_MODAL}
                    aria-label="Nilai taksasi"
                  />
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto shrink-0 p-0 text-xs text-blue-600 dark:text-blue-400"
                    onClick={onRata3}
                  >
                    Rata3
                  </Button>
                </div>
              </div>

              <BarisForm label="Kelainan">
                <PilihSatu
                  ariaLabel="Kelainan"
                  value={kelainan}
                  onChange={setKelainan}
                  placeholder="- Kelainan -"
                  opsi={Object.entries(LABEL_KONDISI_CATAT).map(([kode, nama]) => ({
                    value: kode,
                    label: nama,
                  }))}
                />
              </BarisForm>
            </div>
          </div>
        </section>

        {/* ── Tengah: stand angkat ─────────────────────────────────────── */}
        <section className="flex min-w-0 flex-col gap-2.5 lg:border-l lg:border-border/70 lg:pl-6">
          <JudulBagian>Stand Angkat</JudulBagian>
          {data.standAngkat ? (
            <>
              <BarisForm label="Meter lama"><KotakBaca nilai={data.standAngkat.lama} /></BarisForm>
              <BarisForm label="Meter baru"><KotakBaca nilai={data.standAngkat.baru} /></BarisForm>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Tidak ada stand angkat.</p>
          )}
        </section>

        {/* ── Kanan: riwayat deposit ───────────────────────────────────── */}
        <section className="flex min-w-0 flex-col gap-2.5 lg:border-l lg:border-border/70 lg:pl-6">
          <JudulBagian>Riwayat Deposit</JudulBagian>
          <div className="overflow-hidden rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-9 w-8 text-[11px]">No</TableHead>
                  <TableHead className="h-9 text-[11px]">Periode</TableHead>
                  <TableHead className="h-9 text-right text-[11px]">St Deposit</TableHead>
                  <TableHead className="h-9 text-right text-[11px]">Deposit Resmi</TableHead>
                  <TableHead className="h-9 text-right text-[11px]">Deposit Perubahan</TableHead>
                  <TableHead className="h-9 text-right text-[11px]">Sisa Deposit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riwayat.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      Belum ada riwayat deposit.
                    </TableCell>
                  </TableRow>
                ) : (
                  riwayat.map((r, i) => (
                    <TableRow key={`${r.periode}-${i}`}>
                      <TableCell className="py-2 text-xs tabular-nums">{i + 1}</TableCell>
                      <TableCell className="py-2 text-xs">{r.periode}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">{angka(r.stDeposit)}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">{angka(r.depositResmi)}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">{angka(r.depositPerubahan)}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">{angka(r.sisaDeposit)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </KerangkaModal>
  )
}