"use client"

import type { ColDef } from "ag-grid-community"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { DataGrid } from "@/features/dashboard/shared/data-grid"
import {
  fmtAngka,
  fmtRupiah,
  KELAS_ANGKA,
  KELAS_MONO,
} from "@/features/dashboard/shared/data-grid/components/Sel"
import { LABEL_KONDISI_CATAT } from "@/features/dashboard/lib/LabelPencatatan"
import { formatPeriode, formatRupiah } from "@/features/public/lib/Format"
import { BilahDrd } from "./components/BilahDrd"
import { GrafikDrd } from "./components/GrafikDrd"
import { useDrd } from "./hooks/UseDrd"
import { DAFTAR_TARIF_DRD, type TabDrd } from "./types/TipeDrd"

const TAB: ItemTab<TabDrd>[] = [
  { kunci: "ringkasan", label: "Ringkasan" },
  { kunci: "kelurahan", label: "Kelurahan" },
  { kunci: "domestik", label: "Domestik" },
  { kunci: "tarif", label: "Tarif" },
  { kunci: "taa-kelurahan", label: "TAA per kelurahan" },
  { kunci: "cakupan", label: "Cakupan layanan" },
  { kunci: "taa", label: "TAA" },
  { kunci: "tagihan", label: "Tagihan" },
  { kunci: "pelanggan", label: "Pelanggan" },
]

const KOLOM_KELURAHAN: ColDef[] = [
  { field: "kelurahan", headerName: "Kelurahan", minWidth: 180, flex: 2 },
  {
    field: "jumlahPelanggan",
    headerName: "Pelanggan",
    minWidth: 120,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "pemakaianM3",
    headerName: "Pemakaian (m³)",
    minWidth: 145,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "totalTagihan",
    headerName: "Total tagihan",
    minWidth: 150,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
]

const KOLOM_DOMESTIK: ColDef[] = [
  {
    field: "tarif",
    headerName: "Tarif",
    minWidth: 95,
    maxWidth: 115,
    cellClass: KELAS_MONO,
  },
  { field: "namaTarif", headerName: "Nama tarif", minWidth: 200, flex: 2 },
  {
    field: "jumlahPelanggan",
    headerName: "Pelanggan",
    minWidth: 120,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "pemakaianM3",
    headerName: "Pemakaian (m³)",
    minWidth: 145,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "totalTagihan",
    headerName: "Total tagihan",
    minWidth: 150,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
]

const KOLOM_TARIF = KOLOM_DOMESTIK

const KOLOM_TAA_KELURAHAN: ColDef[] = [
  { field: "kelurahan", headerName: "Kelurahan", minWidth: 180, flex: 2 },
  {
    field: "jumlahPelanggan",
    headerName: "Pelanggan TAA",
    minWidth: 140,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "pemakaianM3",
    headerName: "Pemakaian (m³)",
    minWidth: 145,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "totalTagihan",
    headerName: "Total tagihan",
    minWidth: 150,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
]

const METRIK_CAKUPAN = [
  { field: "sl", label: "SL", formatter: fmtAngka },
  {
    field: "pemakaianM3",
    label: "m³",
    formatter: fmtAngka,
  },
  {
    field: "totalTagihan",
    label: "DRD",
    formatter: fmtRupiah,
  },
] as const

const KOLOM_CAKUPAN: ColDef[] = [
  {
    field: "kelurahan",
    headerName: "Kelurahan",
    minWidth: 180,
    pinned: "left",
  },
  ...DAFTAR_TARIF_DRD.flatMap(({ kode, label }) =>
    METRIK_CAKUPAN.map(({ field, label: labelMetrik, formatter }) => ({
      field: `${field}_${kode}`,
      headerName: `${label} · ${labelMetrik}`,
      minWidth: 115,
      cellClass: KELAS_ANGKA,
      valueFormatter: formatter,
    }))
  ),
  ...METRIK_CAKUPAN.map(({ field, label: labelMetrik, formatter }) => ({
    field: `${field}_TANPA_TARIF`,
    headerName: `Tanpa tarif · ${labelMetrik}`,
    minWidth: 140,
    cellClass: KELAS_ANGKA,
    valueFormatter: formatter,
  })),
]

const KOLOM_PELANGGAN: ColDef[] = [
  {
    field: "nomorLangganan",
    headerName: "No. langganan",
    minWidth: 135,
    cellClass: KELAS_MONO,
  },
  { field: "nama", headerName: "Nama", minWidth: 170, flex: 1.5 },
  { field: "alamat", headerName: "Alamat", minWidth: 220, flex: 2 },
  {
    field: "tarif",
    headerName: "Tarif",
    minWidth: 90,
    cellClass: KELAS_MONO,
  },
  { field: "kelurahan", headerName: "Kelurahan", minWidth: 140 },
  {
    field: "pemakaianM3",
    headerName: "Pemakaian (m³)",
    minWidth: 145,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "totalTagihan",
    headerName: "Total tagihan",
    minWidth: 150,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
]

const KOLOM_TAA: ColDef[] = [
  ...KOLOM_PELANGGAN.slice(0, 5),
  {
    field: "kondisi",
    headerName: "Keterangan",
    minWidth: 155,
    valueFormatter: (params) =>
      LABEL_KONDISI_CATAT[String(params.value)] ?? String(params.value ?? "—"),
  },
  KOLOM_PELANGGAN[5]!,
]

const KOLOM_TAGIHAN: ColDef[] = [
  ...KOLOM_PELANGGAN.slice(0, 5),
  ...(
    [
      ["hargaAir", "Harga air"],
      ["beaBeban", "Bea beban"],
      ["beaAdmin", "Bea admin"],
      ["airKotor", "Air kotor"],
      ["lainLain", "Lain-lain"],
      ["totalTagihan", "Total tagihan"],
    ] as const
  ).map(([field, headerName]) => ({
    field,
    headerName,
    minWidth: 135,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  })),
]

const KOLOM_TAB: Partial<Record<TabDrd, ColDef[]>> = {
  kelurahan: KOLOM_KELURAHAN,
  domestik: KOLOM_DOMESTIK,
  tarif: KOLOM_TARIF,
  "taa-kelurahan": KOLOM_TAA_KELURAHAN,
  cakupan: KOLOM_CAKUPAN,
  taa: KOLOM_TAA,
  tagihan: KOLOM_TAGIHAN,
  pelanggan: KOLOM_PELANGGAN,
}

const ANGKA = (nilai: number) => nilai.toLocaleString("id-ID")

export function DrdView() {
  const {
    periodes,
    periode,
    tab,
    ringkasan,
    memuatPeriode,
    memuatRingkasan,
    galat,
    gantiPeriode,
    gantiTab,
  } = useDrd()

  const judulTab = TAB.find((item) => item.kunci === tab)?.label ?? "DRD"

  return (
    <TabLembaran
      label="Rekapitulasi DRD"
      tab={periodes.length > 0 ? TAB : []}
      aktif={tab}
      onGanti={gantiTab}
      transisi={false}
      kerangkaHalaman
      warnaTab="muted"
      warnaTabAktif="background"
      warnaTabTidakAktif="lebihGelap"
      className="h-full min-h-0 min-w-0 overflow-hidden bg-background"
      panelClassName="min-h-0 min-w-0 overflow-hidden p-5 sm:p-6"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {galat && (
          <Alert variant="destructive" className="shrink-0">
            <AlertDescription className="text-xs">{galat}</AlertDescription>
          </Alert>
        )}

        {memuatPeriode ? (
          <div className="grid flex-1 grid-cols-2 gap-3 py-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : galat && periodes.length === 0 ? null : periodes.length === 0 ? (
          <Alert className="mt-1">
            <AlertDescription className="text-xs">
              Belum ada histori tagihan yang tersimpan di database.
            </AlertDescription>
          </Alert>
        ) : tab === "ringkasan" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
            <BilahDrd
              periodes={periodes}
              periode={periode}
              ringkasan={ringkasan}
              memuat={memuatPeriode || memuatRingkasan}
              onGanti={gantiPeriode}
            />
            <GrafikDrd periode={periode} />
            <RingkasanPanel
              periode={periode}
              ringkasan={ringkasan}
              memuat={memuatRingkasan}
            />
          </div>
        ) : periode === null ? null : (
          <section className="flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col">
            <DataGrid
              judul={`DRD ${judulTab}`}
              endpoint="/drd/data"
              columnDefs={KOLOM_TAB[tab] ?? KOLOM_PELANGGAN}
              searchParam="q"
              searchPlaceholder="Cari data DRD…"
              toolbarStart={
                <BilahDrd
                  periodes={periodes}
                  periode={periode}
                  ringkasan={ringkasan}
                  memuat={memuatPeriode || memuatRingkasan}
                  onGanti={gantiPeriode}
                />
              }
              extraParams={{ periode: String(periode), tab }}
              sesuaikanTinggiDenganBaris
              tinggiClassName="min-h-0 flex-1"
            />
          </section>
        )}
      </div>
    </TabLembaran>
  )
}

function RingkasanPanel({
  periode,
  ringkasan,
  memuat,
}: {
  periode: number | null
  ringkasan: ReturnType<typeof useDrd>["ringkasan"]
  memuat: boolean
}) {
  if (memuat) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!ringkasan) return null

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <h2 className="text-base font-semibold tracking-tight">
        Data {periode === null ? "" : formatPeriode(periode)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ringkasan dihitung di server dari tagihan dan pembacaan resmi periode
        terpilih.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuRingkasan
          label="Pelanggan ditagih"
          nilai={ANGKA(ringkasan.jumlahPelanggan)}
        />
        <KartuRingkasan
          label="Pemakaian DRD"
          nilai={`${ANGKA(ringkasan.pemakaianM3)} m³`}
        />
        <KartuRingkasan
          label="Total tagihan"
          nilai={formatRupiah(ringkasan.totalTagihan)}
        />
        <KartuRingkasan
          label="Tidak ada air (TAA)"
          nilai={ANGKA(ringkasan.jumlahTaa)}
        />
      </div>

      <Card size="sm" className="mt-5 gap-2">
        <CardHeader>
          <CardTitle className="text-sm">Cakupan periode</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {ANGKA(ringkasan.jumlahDomestik)} pelanggan dengan tarif domestik ·{" "}
            {ANGKA(ringkasan.jumlahKelurahan)} kelurahan
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function KartuRingkasan({ label, nilai }: { label: string; nilai: string }) {
  return (
    <Card size="sm" className="min-w-0 gap-2">
      <CardHeader>
        <CardTitle className="text-xs font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold wrap-break-word tabular-nums">
          {nilai}
        </p>
      </CardContent>
    </Card>
  )
}
