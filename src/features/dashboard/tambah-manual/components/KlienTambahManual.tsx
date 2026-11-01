"use client"

import * as React from "react"
import { id as localeId } from "react-day-picker/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import { CalendarDaysIcon } from "@hugeicons/core-free-icons"
import { AreaTinggiLayar } from "@/components/layout/page/AreaTinggiLayar"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ALASAN_MANUAL } from "../lib/AlasanManual"
import { ambilSatu, kirimJson } from "@/features/dashboard/api/ApiDashboard"

type KunciTab = "satuan" | "massal"

const TAB: ItemTab<KunciTab>[] = [
  { kunci: "satuan", label: "Manual Add" },
  { kunci: "massal", label: "Manual Add All" },
]

type Pelanggan = {
  id: string
  nomorLangganan: string
  nama: string
  alamat: string
  nomorMeter: string | null
  meterAktif: boolean
  meterAmbigu: boolean
  standTerakhir: number | null
  pemakaianTerakhir: number | null
  sudahAdaLaporan: boolean
  bolehTimpaLaporan: boolean
}

type Opsi = {
  periode: number | null
  rute: { id: string; kode: string }[]
  pencatat: { id: string; nama: string }[]
}

type ItemManualAdd = {
  daftarCatatId: string
  pelangganId: string
  nomorLangganan: string
  nama: string
  alamat: string
  taksasi: number | null
  metode?:
    | "RATA_RATA_12_BULAN"
    | "TIGA_TERTINGGI"
    | "RIWAYAT_TERSEDIA"
    | "TANPA_HISTORI"
  standTerakhir: number | null
  pemakaianLalu: number | null
  nomorMeter: string | null
  bolehDitambahkan: boolean
  alasanPeninjauan: string | null
  manualProvenance?: {
    standSumber: { id: string; periode: string; standAwal: number } | null
    sumberTagihan: { id: string; periode: string; pemakaianM3: number }[]
  }
}

type HasilMassal = {
  dibuat: number
  duplikat: number
  totalDipilih: number
}

const LABEL_CLASS = "grid gap-1.5 text-sm font-medium text-foreground"
const UKURAN_BATCH = 25
const ALASAN_MASSAL_DEFAULT =
  "Alamat belum disetorkan petugas; pencatatan dilakukan melalui Manual Add All."

function periodeDariInput(nilai: string) {
  const [tahun, bulan] = nilai.split("-").map(Number)
  return tahun && bulan ? tahun * 100 + bulan : null
}

function tanggalDariInput(nilai: string) {
  if (!nilai) return undefined
  const [tahun, bulan, hari] = nilai.split("-").map(Number)
  return new Date(tahun!, bulan! - 1, hari!)
}

function inputDariTanggal(tanggal: Date) {
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}-${String(tanggal.getDate()).padStart(2, "0")}`
}

function labelTanggal(nilai: string) {
  const tanggal = tanggalDariInput(nilai)
  return tanggal
    ? tanggal.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Pilih tanggal pencatatan"
}

function pesanError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui."
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className={LABEL_CLASS}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

function PilihTanggalCatat({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const tanggal = tanggalDariInput(value)
  const [terbuka, setTerbuka] = React.useState(false)

  return (
    <Popover open={terbuka} onOpenChange={setTerbuka}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 font-normal"
          aria-label={`Tanggal pencatatan: ${labelTanggal(value)}`}
        >
          <HugeiconsIcon
            icon={CalendarDaysIcon}
            strokeWidth={2}
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          {labelTanggal(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={localeId}
          selected={tanggal}
          defaultMonth={tanggal}
          onSelect={(pilihan) => {
            if (pilihan) {
              onChange(inputDariTanggal(pilihan))
              setTerbuka(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function Notifikasi({
  error,
  pesan,
}: {
  error: string | null
  pesan: string | null
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    )
  }
  if (pesan) {
    return (
      <p
        role="status"
        className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
      >
        {pesan}
      </p>
    )
  }
  return null
}

export function ManualAddClient() {
  const [tab, setTab] = React.useState<KunciTab>("satuan")
  const [tanggalCatat, setTanggalCatat] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pesan, setPesan] = React.useState<string | null>(null)

  const [nomor, setNomor] = React.useState("")
  const [pelanggan, setPelanggan] = React.useState<Pelanggan[]>([])
  const [pilihan, setPilihan] = React.useState<Pelanggan | null>(null)
  const [standAwal, setStandAwal] = React.useState("")
  const [standAkhir, setStandAkhir] = React.useState("")
  const [pemakaianInput, setPemakaianInput] = React.useState<string | null>(
    null
  )
  const [mencari, setMencari] = React.useState(false)
  const [menyimpanSatuan, setMenyimpanSatuan] = React.useState(false)
  const pencarianId = React.useRef(0)

  const [opsi, setOpsi] = React.useState<Opsi>({
    periode: null,
    rute: [],
    pencatat: [],
  })
  const [opsiLoading, setOpsiLoading] = React.useState(false)
  const [ruteId, setRuteId] = React.useState("")
  const [pencatatId, setPencatatId] = React.useState("")
  const [alasanMassal, setAlasanMassal] = React.useState(ALASAN_MASSAL_DEFAULT)
  const [daftarManualAdd, setDaftarManualAdd] = React.useState<
    ItemManualAdd[] | null
  >(null)
  const [pilihanIds, setPilihanIds] = React.useState<Set<string>>(new Set())
  const [memuatDaftar, setMemuatDaftar] = React.useState(false)
  const [menyimpanMassal, setMenyimpanMassal] = React.useState(false)
  const [progresMassal, setProgresMassal] = React.useState<{
    selesai: number
    total: number
  } | null>(null)

  const nomorPeriode =
    periodeDariInput(tanggalCatat.slice(0, 7)) ?? opsi.periode
  const pemakaianHitung =
    standAwal !== "" && standAkhir !== ""
      ? String(Number(standAkhir) - Number(standAwal))
      : ""
  const pemakaianSatuan = pemakaianInput ?? pemakaianHitung
  const daftarYangBisaDipilih =
    daftarManualAdd?.filter((item) => item.bolehDitambahkan) ?? []

  React.useEffect(() => {
    let active = true
    setOpsiLoading(true)
    setError(null)
    ambilSatu<Opsi>("/manual-add/opsi", {
      periode: nomorPeriode ?? undefined,
      pencatatId: pencatatId || undefined,
      ruteId: ruteId || undefined,
    })
      .then((data) => {
        if (active) {
          setOpsi(data)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(pesanError(cause))
      })
      .finally(() => {
        if (active) setOpsiLoading(false)
      })
    return () => {
      active = false
    }
  }, [nomorPeriode, pencatatId, ruteId])

  React.useEffect(() => {
    let active = true
    setDaftarManualAdd(null)
    setPilihanIds(new Set())
    setProgresMassal(null)
    if (nomorPeriode === null || !pencatatId || !ruteId) {
      setMemuatDaftar(false)
      return () => {
        active = false
      }
    }

    setError(null)
    setPesan(null)
    setMemuatDaftar(true)
    ambilSatu<ItemManualAdd[]>("/manual-add/daftar", {
      periode: nomorPeriode,
      ruteId,
      pencatatId,
    })
      .then((hasil) => {
        if (active) setDaftarManualAdd(hasil)
      })
      .catch((cause: unknown) => {
        if (active) {
          setDaftarManualAdd(null)
          setError(pesanError(cause))
        }
      })
      .finally(() => {
        if (active) setMemuatDaftar(false)
      })

    return () => {
      active = false
    }
  }, [nomorPeriode, pencatatId, ruteId])

  async function cariPelanggan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nomorNormal = nomor.trim()
    if (
      nomorPeriode === null ||
      !tanggalCatat ||
      !/^\d{10,11}$/.test(nomorNormal)
    )
      return
    const requestId = ++pencarianId.current
    setError(null)
    setPesan(null)
    setMencari(true)
    setPilihan(null)
    setPelanggan([])
    try {
      const hasil = await ambilSatu<Pelanggan[]>("/manual-add/cari-pelanggan", {
        nomor: nomorNormal.padStart(11, "0"),
        periode: nomorPeriode,
      })
      if (requestId === pencarianId.current) {
        if (hasil.length === 1) {
          setPelanggan([])
          pilihPelanggan(hasil[0]!)
        } else {
          setPelanggan(hasil)
          if (hasil.length === 0) {
            setPesan("Pelanggan aktif tidak ditemukan.")
          } else {
            setPesan(
              "Nomor ini cocok dengan beberapa data pelanggan. Pilih data yang sesuai."
            )
          }
        }
      }
    } catch (cause) {
      if (requestId === pencarianId.current) setError(pesanError(cause))
    } finally {
      if (requestId === pencarianId.current) setMencari(false)
    }
  }

  function pilihPelanggan(item: Pelanggan) {
    setPilihan(item)
    setStandAwal(item.standTerakhir == null ? "" : String(item.standTerakhir))
    setStandAkhir(item.standTerakhir == null ? "" : String(item.standTerakhir))
    setPemakaianInput(null)
    setPesan(null)
    setError(null)
  }

  async function simpanSatuan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pilihan || nomorPeriode === null || !tanggalCatat) return
    setError(null)
    setPesan(null)
    setMenyimpanSatuan(true)
    try {
      await kirimJson("/manual-add/satuan", "POST", {
        pelangganId: pilihan.id,
        periode: nomorPeriode,
        tanggalCatat,
        standAwal: Number(standAwal),
        standAkhir: Number(standAkhir),
        pemakaian: Number(pemakaianSatuan),
        alasanManual: pilihan.sudahAdaLaporan
          ? ALASAN_MANUAL.koreksi
          : ALASAN_MANUAL.pencatatan,
      })
      setPesan(
        pilihan.bolehTimpaLaporan
          ? `Hasil lama ${pilihan.nomorLangganan} diganti. Status verifikasi direset; laporan menunggu verifikasi ulang.`
          : `Laporan ${pilihan.nomorLangganan} tersimpan dan menunggu verifikasi.`
      )
      setPelanggan((items) =>
        items.map((item) =>
          item.id === pilihan.id
            ? {
                ...item,
                sudahAdaLaporan: true,
                bolehTimpaLaporan: false,
              }
            : item
        )
      )
      setPilihan((item) =>
        item
          ? {
              ...item,
              sudahAdaLaporan: true,
              bolehTimpaLaporan: false,
            }
          : item
      )
    } catch (cause) {
      setError(pesanError(cause))
    } finally {
      setMenyimpanSatuan(false)
    }
  }

  async function simpanMassal() {
    if (nomorPeriode === null || !tanggalCatat || !ruteId || !pencatatId) return
    const dipilih = (daftarManualAdd ?? []).filter((item) =>
      pilihanIds.has(item.daftarCatatId)
    )
    if (dipilih.length === 0) return
    const alasanManual = alasanMassal.trim() || ALASAN_MASSAL_DEFAULT
    setError(null)
    setPesan(null)
    setAlasanMassal(alasanManual)
    setMenyimpanMassal(true)
    setProgresMassal({ selesai: 0, total: dipilih.length })
    let selesai = 0
    try {
      let totalDibuat = 0
      let totalDuplikat = 0
      for (let offset = 0; offset < dipilih.length; offset += UKURAN_BATCH) {
        const batch = dipilih.slice(offset, offset + UKURAN_BATCH)
        const hasil = await kirimJson<HasilMassal>(
          "/manual-add/massal",
          "POST",
          {
            periode: nomorPeriode,
            tanggalCatat,
            ruteId,
            pencatatId,
            daftarCatatIds: batch.map((item) => item.daftarCatatId),
            alasanManual,
          }
        )
        totalDibuat += hasil.dibuat
        totalDuplikat += hasil.duplikat
        selesai += batch.length
        setProgresMassal({ selesai, total: dipilih.length })
        setDaftarManualAdd(
          (daftar) =>
            daftar?.filter(
              (item) =>
                !batch.some(
                  (diproses) => diproses.daftarCatatId === item.daftarCatatId
                )
            ) ?? null
        )
        setPilihanIds((sebelumnya) => {
          const berikutnya = new Set(sebelumnya)
          batch.forEach((item) => berikutnya.delete(item.daftarCatatId))
          return berikutnya
        })
      }
      setPesan(
        `Selesai: ${totalDibuat} laporan ditambahkan; ${totalDuplikat} duplikat yang muncul saat proses dilewati.`
      )
    } catch (cause) {
      setError(
        selesai > 0
          ? `Proses berhenti setelah ${selesai} dari ${dipilih.length} alamat diproses. ${pesanError(cause)}`
          : pesanError(cause)
      )
    } finally {
      setMenyimpanMassal(false)
    }
  }

  return (
    <AreaTinggiLayar className="flex min-h-0 flex-col">
      <TabLembaran
        label="Manual Add"
        tab={TAB}
        aktif={tab}
        onGanti={(value) => {
          setTab(value)
          setError(null)
          setPesan(null)
        }}
        className="min-h-0 flex-1"
        panelClassName="min-h-0 overflow-hidden p-5 sm:p-6"
      >
        {tab === "satuan" ? (
          <section className="mx-auto grid h-full min-h-0 w-full content-start gap-5 overflow-y-auto p-1 lg:w-3/4">
            <header>
              <h2 className="text-lg font-semibold">
                Tambah laporan satu pelanggan
              </h2>
            </header>
            <Notifikasi error={error} pesan={pesan} />
            <form
              onSubmit={cariPelanggan}
              className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
            >
              <Field label="Nomor pelanggan" htmlFor="manual-add-nomor">
                <Input
                  id="manual-add-nomor"
                  value={nomor}
                  onChange={(event) => {
                    pencarianId.current += 1
                    setNomor(event.target.value)
                    setMencari(false)
                    setError(null)
                    setPelanggan([])
                    setPilihan(null)
                    setPesan(null)
                  }}
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Tanggal pencatatan" htmlFor="manual-add-tanggal">
                <PilihTanggalCatat
                  id="manual-add-tanggal"
                  value={tanggalCatat}
                  onChange={(value) => {
                    pencarianId.current += 1
                    setTanggalCatat(value)
                    setMencari(false)
                    setError(null)
                    setPilihan(null)
                    setPelanggan([])
                    setPesan(null)
                  }}
                />
              </Field>
              <Button
                type="submit"
                disabled={
                  mencari ||
                  !tanggalCatat ||
                  nomorPeriode === null ||
                  !/^\d{10,11}$/.test(nomor.trim())
                }
              >
                {mencari ? "Mencari..." : "Cari pelanggan"}
              </Button>
            </form>

            {pelanggan.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table className="min-w-2xl text-left">
                  <TableHeader className="bg-muted/50 text-xs text-muted-foreground">
                    <TableRow>
                      <TableHead>No. Pel</TableHead>
                      <TableHead>Nama / Alamat</TableHead>
                      <TableHead>Meter aktif</TableHead>
                      <TableHead>ST resmi terakhir</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pelanggan.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">
                          {item.nomorLangganan}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.nama}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.alamat}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.meterAmbigu
                            ? "Data meter ambigu"
                            : (item.nomorMeter ?? "Tidak ada")}
                        </TableCell>
                        <TableCell>
                          {item.standTerakhir ?? "Belum tersedia"}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              !item.meterAktif ||
                              (item.sudahAdaLaporan && !item.bolehTimpaLaporan)
                            }
                            onClick={() => pilihPelanggan(item)}
                          >
                            {item.bolehTimpaLaporan
                              ? "Pilih untuk timpa"
                              : item.sudahAdaLaporan
                                ? "Sudah ada"
                                : "Pilih"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pilihan && (
              <form
                onSubmit={simpanSatuan}
                className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-3">
                  <dl className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      No. pelanggan
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-medium break-words tabular-nums">
                      {pilihan.nomorLangganan}
                    </dd>
                  </dl>
                  <dl className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Nama</dt>
                    <dd className="mt-1 text-sm font-medium break-words">
                      {pilihan.nama}
                    </dd>
                  </dl>
                  <dl className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Alamat</dt>
                    <dd className="mt-1 text-sm break-words">
                      {pilihan.alamat}
                    </dd>
                  </dl>
                </div>
                {pilihan.sudahAdaLaporan && pilihan.bolehTimpaLaporan && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    Hasil lama akan diganti dan laporan kembali ke antrean
                    verifikasi.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ST Awal" htmlFor="manual-add-stand-awal">
                    <Input
                      id="manual-add-stand-awal"
                      type="number"
                      min="0"
                      step="1"
                      value={standAwal}
                      onChange={(event) => {
                        setStandAwal(event.target.value)
                        setPemakaianInput(null)
                      }}
                      required
                    />
                  </Field>
                  <Field label="ST Akhir" htmlFor="manual-add-stand-akhir">
                    <Input
                      id="manual-add-stand-akhir"
                      type="number"
                      min="0"
                      step="1"
                      value={standAkhir}
                      onChange={(event) => {
                        setStandAkhir(event.target.value)
                        setPemakaianInput(null)
                      }}
                      required
                    />
                  </Field>
                </div>
                <Field label="Pemakaian (m³)" htmlFor="manual-add-pemakaian">
                  <Input
                    id="manual-add-pemakaian"
                    type="number"
                    min="-2147483648"
                    max="2147483647"
                    step="1"
                    value={pemakaianSatuan}
                    onChange={(event) => setPemakaianInput(event.target.value)}
                    required
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={
                      menyimpanSatuan ||
                      !tanggalCatat ||
                      !pilihan.meterAktif ||
                      (pilihan.sudahAdaLaporan && !pilihan.bolehTimpaLaporan)
                    }
                  >
                    {menyimpanSatuan
                      ? "Menyimpan..."
                      : pilihan.sudahAdaLaporan && !pilihan.bolehTimpaLaporan
                        ? "Sudah tersimpan"
                        : pilihan.bolehTimpaLaporan
                          ? "Ganti hasil & ulangi verifikasi"
                          : "Simpan untuk verifikasi"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="flex h-full min-h-0 w-full flex-col gap-3">
            <header className="shrink-0">
              <h2 className="text-lg font-semibold">
                Tambah laporan massal berdasarkan rute dan petugas
              </h2>
            </header>
            <Notifikasi error={error} pesan={pesan} />
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(17rem,0.3fr)_minmax(0,1fr)]">
              <aside className="grid content-start gap-4 rounded-lg border border-border bg-muted/20 p-4">
                <Field
                  label="Tanggal pencatatan"
                  htmlFor="manual-add-massal-tanggal"
                >
                  <PilihTanggalCatat
                    id="manual-add-massal-tanggal"
                    value={tanggalCatat}
                    onChange={(value) => {
                      setTanggalCatat(value)
                      setDaftarManualAdd(null)
                      setProgresMassal(null)
                      setRuteId("")
                      setPencatatId("")
                    }}
                  />
                </Field>
                <Field label="Petugas" htmlFor="manual-add-pencatat">
                  <Select
                    value={pencatatId}
                    onValueChange={(value) => {
                      setPencatatId(value)
                      setRuteId("")
                      setDaftarManualAdd(null)
                      setPilihanIds(new Set())
                      setProgresMassal(null)
                    }}
                    disabled={opsiLoading}
                  >
                    <SelectTrigger id="manual-add-pencatat" className="w-full">
                      <SelectValue placeholder="Pilih petugas" />
                    </SelectTrigger>
                    <SelectContent>
                      {opsi.pencatat.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rute" htmlFor="manual-add-rute">
                  <Select
                    value={ruteId}
                    onValueChange={(value) => {
                      setRuteId(value)
                      setDaftarManualAdd(null)
                      setPilihanIds(new Set())
                      setProgresMassal(null)
                    }}
                    disabled={!pencatatId || opsiLoading}
                  >
                    <SelectTrigger id="manual-add-rute" className="w-full">
                      <SelectValue placeholder="Pilih rute" />
                    </SelectTrigger>
                    <SelectContent>
                      {opsi.rute.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.kode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Alasan Manual Add All"
                  htmlFor="manual-add-massal-alasan"
                >
                  <Textarea
                    id="manual-add-massal-alasan"
                    value={alasanMassal}
                    onChange={(event) => setAlasanMassal(event.target.value)}
                    maxLength={500}
                  />
                </Field>
              </aside>

              <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
                {progresMassal && (
                  <div className="grid shrink-0 gap-1 border-b border-border p-3">
                    <Progress
                      className="h-2"
                      value={Math.round(
                        (progresMassal.selesai / progresMassal.total) * 100
                      )}
                      aria-label="Progres Manual Add All"
                    />
                    <p className="text-xs text-muted-foreground" role="status">
                      {progresMassal.selesai} dari {progresMassal.total} alamat
                    </p>
                  </div>
                )}
                {memuatDaftar && (
                  <p
                    className="shrink-0 border-b border-border p-3 text-sm text-muted-foreground"
                    role="status"
                  >
                    Memuat daftar alamat...
                  </p>
                )}
                {daftarManualAdd && (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border p-3">
                      <span className="text-sm text-muted-foreground">
                        {daftarManualAdd.length} alamat · {pilihanIds.size}{" "}
                        dipilih
                      </span>
                      <Button
                        type="button"
                        disabled={
                          menyimpanMassal ||
                          !tanggalCatat ||
                          pilihanIds.size === 0
                        }
                        onClick={simpanMassal}
                      >
                        {menyimpanMassal
                          ? "Menyimpan..."
                          : `Tambah yang dipilih (${pilihanIds.size})`}
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
                      <Table className="min-w-[72rem] table-fixed text-left">
                        <TableHeader className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                          <TableRow>
                            <TableHead className="w-12 text-center">
                              <Checkbox
                                aria-label="Pilih semua alamat"
                                className="mx-auto"
                                checked={
                                  daftarYangBisaDipilih.length > 0 &&
                                  daftarYangBisaDipilih.every((item) =>
                                    pilihanIds.has(item.daftarCatatId)
                                  )
                                }
                                disabled={
                                  menyimpanMassal ||
                                  daftarYangBisaDipilih.length === 0
                                }
                                onCheckedChange={(checked) => {
                                  setPilihanIds(
                                    checked === true
                                      ? new Set(
                                          daftarYangBisaDipilih.map(
                                            (item) => item.daftarCatatId
                                          )
                                        )
                                      : new Set()
                                  )
                                }}
                              />
                            </TableHead>
                            <TableHead className="w-32">No. Pel</TableHead>
                            <TableHead className="w-48">Nama</TableHead>
                            <TableHead className="w-64">Alamat</TableHead>
                            <TableHead className="w-24 text-right">
                              ST Awal
                            </TableHead>
                            <TableHead className="w-24 text-right">
                              ST Akhir
                            </TableHead>
                            <TableHead className="w-24 text-right">
                              Pakai
                            </TableHead>
                            <TableHead className="w-56">Keterangan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {daftarManualAdd.length === 0 ? (
                            <TableRow>
                              <TableCell
                                className="py-6 text-center text-muted-foreground"
                                colSpan={8}
                              >
                                Tidak ada alamat untuk filter ini.
                              </TableCell>
                            </TableRow>
                          ) : (
                            daftarManualAdd.map((item) => {
                              const keterangan =
                                item.alasanPeninjauan ??
                                (item.metode === "RATA_RATA_12_BULAN"
                                  ? "Rata-rata 12 bulan"
                                  : item.metode === "TIGA_TERTINGGI"
                                    ? "Rata-rata 3 tertinggi"
                                    : item.metode === "RIWAYAT_TERSEDIA"
                                      ? "Rata-rata histori tersedia"
                                      : item.metode === "TANPA_HISTORI"
                                        ? "Minimum Perdir"
                                        : "—")
                              return (
                                <TableRow key={item.daftarCatatId}>
                                  <TableCell className="text-center">
                                    <Checkbox
                                      aria-label={`Pilih ${item.nomorLangganan}`}
                                      className="mx-auto"
                                      checked={pilihanIds.has(
                                        item.daftarCatatId
                                      )}
                                      disabled={
                                        menyimpanMassal ||
                                        !item.bolehDitambahkan
                                      }
                                      onCheckedChange={(checked) => {
                                        setPilihanIds((sebelumnya) => {
                                          const berikutnya = new Set(sebelumnya)
                                          if (checked === true) {
                                            berikutnya.add(item.daftarCatatId)
                                          } else {
                                            berikutnya.delete(
                                              item.daftarCatatId
                                            )
                                          }
                                          return berikutnya
                                        })
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {item.nomorLangganan}
                                  </TableCell>
                                  <TableCell className="font-medium whitespace-normal">
                                    {item.nama}
                                  </TableCell>
                                  <TableCell className="whitespace-normal text-muted-foreground">
                                    {item.alamat}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {item.standTerakhir ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {item.standTerakhir ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {item.taksasi === null
                                      ? "—"
                                      : `${item.taksasi} m³`}
                                  </TableCell>
                                  <TableCell className="whitespace-normal text-muted-foreground">
                                    {keterangan}
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
        )}
      </TabLembaran>
    </AreaTinggiLayar>
  )
}
