"use client"

// features/dashboard/verifikasi/components/BilahVerifikasi.tsx — bilah
// saringan layar verifikasi, versi COMPACT.
//
// BARIS UTAMA hanya memuat yang dipakai tiap hari: cari, periode, tanggal.
// Sisanya (status, petugas, rute, anomali) dilipat ke panel "Filters".
// BARU: tombol "Cari lanjutan" membuka modal Pencarian Data (filter custom
// dengan kriteria bercentang) — angka di tombolnya = jumlah kriteria yang
// terakhir diterapkan.
//
// Di ujung kanan: jumlah tampil, pilihan jumlah baris, lalu `aksiKanan`
// (tombol tampilan) — satu kelompok, satu baris.
import * as React from "react"
import {
  Alert02Icon,
  Cancel01Icon,
  CalendarDaysIcon,
  Database01Icon,
  Route01Icon,
  Search01Icon,
  Task01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/Utilitas"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatPeriode } from "@/features/public/lib/Format"
import {
  KELAS_KONTROL,
  KELAS_KONTROL_AKTIF,
} from "../../shared/data-grid/KelasKontrol"
import { KotakCari } from "../../shared/data-grid/toolbar/KotakCari"
import { FilterPilihan } from "../../shared/data-grid/toolbar/PenyaringPilihan"
import { PenyaringTanggal } from "../../shared/data-grid/toolbar/PenyaringTanggal"
import { TombolFilterLanjutan } from "../../shared/data-grid/toolbar/TombolPenyaringLanjutan"
import {
  hitungKriteriaPencarian,
  ModalPencarian,
  type KriteriaPencarian,
  type OpsiPencarian,
} from "./modal/ModalPencarian"
import {
  saringOpsiPetugasRute,
  type PenugasanFilter,
} from "../lib/PenyaringanRelasi"
import { LABEL_KONDISI_CATAT } from "../../lib/LabelPencatatan"

export interface FilterVerifikasi {
  q: string
  periode: number | null
  statusVerif: string
  pencatatId: string
  /// Rute ≠ pencatat: pencatat = "siapa yang menyetor", rute = "wilayah mana".
  ruteId: string
  tanggalDari: string
  tanggalSampai: string
  hanyaAnomali: boolean
  kondisi: string
  jenisInput: string
  kriteriaLanjutan: KriteriaPencarian
  pageSize: number
}

export const FILTER_AWAL: FilterVerifikasi = {
  q: "",
  periode: null,
  statusVerif: "",
  pencatatId: "",
  ruteId: "",
  tanggalDari: "",
  tanggalSampai: "",
  hanyaAnomali: false,
  kondisi: "",
  jenisInput: "",
  kriteriaLanjutan: {},
  pageSize: 100,
}

export const PILIHAN_UKURAN = [50, 100, 200, 500, 1000, 2000, 5000] as const

const ID_PANEL = "panel-filter-verifikasi"

export function TombolIkonVerifikasi({
  label,
  ikon,
  onClick,
  aktif = false,
  jumlah,
  ditekan,
  diperluas,
  hasPopup,
  controls,
}: {
  label: string
  ikon: React.ReactNode
  onClick: () => void
  aktif?: boolean
  jumlah?: number
  ditekan?: boolean
  diperluas?: boolean
  hasPopup?: "dialog"
  controls?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          aria-pressed={ditekan}
          aria-expanded={diperluas}
          aria-haspopup={hasPopup}
          aria-controls={controls}
          onClick={onClick}
          className={cn(
            KELAS_KONTROL,
            "relative size-8 justify-center p-0",
            aktif && KELAS_KONTROL_AKTIF
          )}
        >
          {ikon}
          {jumlah !== undefined && jumlah > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
              {jumlah}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ToolbarVerifikasi({
  filter,
  onGanti,
  periodes,
  pencatats,
  rutes,
  penugasanRute,
  jumlahTampil,
  jumlahTotal,
  memuat,
  modeBelumDibaca = false,
  anomali = 0,
  ambang = 50,
  aksiKanan,
  opsiPencarian,
  onPencarianLanjutan,
  galatOpsiPencarian,
}: {
  filter: FilterVerifikasi
  onGanti: (f: FilterVerifikasi) => void
  periodes: number[]
  pencatats: { id: string; namaLapangan: string }[]
  rutes: { id: string; kode: string }[]
  penugasanRute: PenugasanFilter[]
  jumlahTampil: number
  jumlahTotal: number
  memuat: boolean
  /** Tab "belum dibaca": sembunyikan saringan yang tidak berlaku. */
  modeBelumDibaca?: boolean
  anomali?: number
  ambang?: number
  /** Dirender tepat di sebelah kanan pilihan jumlah baris. */
  aksiKanan?: React.ReactNode
  /** Pilihan dropdown modal Pencarian Data (wilayah, zonasi, …) dari server. */
  opsiPencarian?: OpsiPencarian
  /** Dipanggil saat kriteria Cari Lanjutan diterapkan. */
  onPencarianLanjutan: (kriteria: KriteriaPencarian) => void
  galatOpsiPencarian?: string | null
}) {
  const [cari, setCari] = React.useState(filter.q)
  const [panelBuka, setPanelBuka] = React.useState(false)
  const [pencarianBuka, setPencarianBuka] = React.useState(false)
  const kriteriaTerapan = hitungKriteriaPencarian(filter.kriteriaLanjutan)

  // Pencarian ditunda 350 ms — mengetik 11 digit nomor tidak boleh = 11 permintaan.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (cari !== filter.q) onGanti({ ...filter, q: cari })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari])

  React.useEffect(() => {
    setCari(filter.q)
  }, [filter.q])

  const set = <K extends keyof FilterVerifikasi>(
    k: K,
    v: FilterVerifikasi[K]
  ) => {
    const berikutnya = { ...filter, [k]: v }
    if (k === "pencatatId" && typeof v === "string" && v && filter.ruteId) {
      if (
        !penugasanRute.some(
          (item) => item.pencatatId === v && item.ruteId === filter.ruteId
        )
      ) {
        berikutnya.ruteId = ""
      }
    }
    if (k === "ruteId" && typeof v === "string" && v && filter.pencatatId) {
      if (
        !penugasanRute.some(
          (item) => item.pencatatId === filter.pencatatId && item.ruteId === v
        )
      ) {
        berikutnya.pencatatId = ""
      }
    }
    onGanti(berikutnya)
  }

  const opsiFilterUtama = saringOpsiPetugasRute(
    pencatats,
    rutes,
    penugasanRute,
    filter.pencatatId,
    filter.ruteId
  )

  // Hanya saringan yang ADA di panel yang dihitung di tombol "Filters".
  const jumlahLanjutan =
    (filter.pencatatId ? 1 : 0) +
    (filter.ruteId ? 1 : 0) +
    (!modeBelumDibaca && filter.statusVerif ? 1 : 0) +
    (!modeBelumDibaca && filter.hanyaAnomali ? 1 : 0) +
    (!modeBelumDibaca && filter.kondisi ? 1 : 0) +
    (!modeBelumDibaca && filter.jenisInput ? 1 : 0)
  const adaFilter =
    jumlahLanjutan > 0 ||
    kriteriaTerapan > 0 ||
    filter.q !== "" ||
    filter.tanggalDari !== "" ||
    filter.tanggalSampai !== ""

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <KotakCari
            nilai={cari}
            onUbah={setCari}
            placeholder="Cari no. langganan atau nama"
          />

          <FilterPilihan
            filter={{
              param: "periode",
              label: "Periode",
              opsi: periodes.map((p) => ({
                value: String(p),
                label: formatPeriode(p),
              })),
            }}
            nilai={filter.periode === null ? "" : String(filter.periode)}
            onUbah={(v) => set("periode", v === "" ? null : Number(v))}
            ikon={
              <HugeiconsIcon
                icon={CalendarDaysIcon}
                strokeWidth={2}
                className="size-3.5"
                aria-hidden
              />
            }
            labelIkonSaja
          />

          {!modeBelumDibaca && (
            <PenyaringTanggal
              label="Tanggal"
              dari={filter.tanggalDari}
              sampai={filter.tanggalSampai}
              onTerapkan={(dari, sampai) =>
                onGanti({
                  ...filter,
                  tanggalDari: dari,
                  tanggalSampai: sampai,
                })
              }
              ringkas
            />
          )}

          {!modeBelumDibaca && (
            <>
              <TombolIkonVerifikasi
                label={`Cari lanjutan${kriteriaTerapan > 0 ? ` (${kriteriaTerapan} kriteria aktif)` : ""}`}
                onClick={() => setPencarianBuka(true)}
                hasPopup="dialog"
                aktif={kriteriaTerapan > 0}
                jumlah={kriteriaTerapan}
                ikon={
                  <HugeiconsIcon
                    icon={Search01Icon}
                    strokeWidth={2}
                    className="size-3.5"
                    aria-hidden
                  />
                }
              />
              {kriteriaTerapan > 0 && (
                <TombolIkonVerifikasi
                  label="Hapus kriteria pencarian lanjutan"
                  onClick={() => onPencarianLanjutan({})}
                  ikon={
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                  }
                />
              )}
            </>
          )}

          <div className="relative flex items-center">
            <TombolFilterLanjutan
              idPanel={ID_PANEL}
              terbuka={panelBuka}
              jumlah={jumlahLanjutan}
              onKlik={() => setPanelBuka((b) => !b)}
              ringkas
            />

            <div
              id={ID_PANEL}
              aria-hidden={!panelBuka}
              inert={!panelBuka}
              className={cn(
                "absolute top-0 left-full z-30 ml-1 flex w-max flex-nowrap items-center gap-1 whitespace-nowrap transition-[opacity,transform,visibility] duration-200 ease-out",
                panelBuka
                  ? "visible translate-x-0 opacity-100"
                  : "invisible -translate-x-2 opacity-0"
              )}
            >
              {!modeBelumDibaca && (
                <FilterPilihan
                  filter={{
                    param: "jenisInput",
                    label: "Asal laporan",
                    opsi: [
                      { value: "PETUGAS", label: "Petugas" },
                      { value: "KONSUMEN", label: "Mandiri" },
                      { value: "MANUAL_SATUAN", label: "Manual Add satuan" },
                      { value: "MANUAL_MASSAL", label: "Manual Add All" },
                    ],
                  }}
                  nilai={filter.jenisInput}
                  onUbah={(v) => set("jenisInput", v)}
                  ikon={
                    <HugeiconsIcon
                      icon={Database01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                  }
                  ringkas
                />
              )}
              {!modeBelumDibaca && (
                <FilterPilihan
                  filter={{
                    param: "statusVerif",
                    label: "Status",
                    opsi: [
                      { value: "MENUNGGU", label: "Menunggu" },
                      { value: "DIVERIFIKASI", label: "Resmi (V3)" },
                      { value: "DITOLAK", label: "Cek ulang" },
                    ],
                  }}
                  nilai={filter.statusVerif}
                  onUbah={(v) => set("statusVerif", v)}
                  ikon={
                    <HugeiconsIcon
                      icon={Task01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                  }
                  ringkas
                />
              )}
              {!modeBelumDibaca && (
                <FilterPilihan
                  filter={{
                    param: "kondisi",
                    label: "Kondisi Catat",
                    opsi: Object.entries(LABEL_KONDISI_CATAT).map(
                      ([value, label]) => ({ value, label })
                    ),
                  }}
                  nilai={filter.kondisi}
                  onUbah={(v) => set("kondisi", v)}
                  ikon={
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                  }
                  ringkas
                />
              )}
              <FilterPilihan
                filter={{
                  param: "pencatatId",
                  label: "Petugas",
                  opsi: opsiFilterUtama.pencatats.map((p) => ({
                    value: p.id,
                    label: p.namaLapangan,
                  })),
                }}
                nilai={filter.pencatatId}
                onUbah={(v) => set("pencatatId", v)}
                ikon={
                  <HugeiconsIcon
                    icon={UserGroupIcon}
                    strokeWidth={2}
                    className="size-3.5"
                    aria-hidden
                  />
                }
                ringkas
              />
              <FilterPilihan
                filter={{
                  param: "ruteId",
                  label: "Rute",
                  opsi: opsiFilterUtama.rutes.map((r) => ({
                    value: r.id,
                    label: r.kode,
                  })),
                }}
                nilai={filter.ruteId}
                onUbah={(v) => set("ruteId", v)}
                ikon={
                  <HugeiconsIcon
                    icon={Route01Icon}
                    strokeWidth={2}
                    className="size-3.5"
                    aria-hidden
                  />
                }
                ringkas
              />
              {!modeBelumDibaca && (
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  spacing={1}
                  value={filter.hanyaAnomali ? ["anomali"] : []}
                  onValueChange={(v) =>
                    set("hanyaAnomali", v.includes("anomali"))
                  }
                  aria-label="Filter anomali"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem
                        value="anomali"
                        aria-label="Hanya anomali"
                        className={cn(
                          "relative size-8 min-w-8 p-0",
                          filter.hanyaAnomali && KELAS_KONTROL_AKTIF
                        )}
                      >
                        <HugeiconsIcon
                          icon={Alert02Icon}
                          strokeWidth={2}
                          className="size-3.5"
                          aria-hidden
                        />
                        {anomali > 0 && (
                          <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white tabular-nums">
                            {anomali}
                          </span>
                        )}
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>
                      Hanya anomali: deviasi lebih dari ±{ambang}% dari bulan
                      lalu
                    </TooltipContent>
                  </Tooltip>
                </ToggleGroup>
              )}
              {adaFilter && (
                <TombolIkonVerifikasi
                  label="Bersihkan filter"
                  onClick={() =>
                    onGanti({
                      ...FILTER_AWAL,
                      periode: filter.periode,
                      pageSize: filter.pageSize,
                    })
                  }
                  ikon={
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                      aria-hidden
                    />
                  }
                />
              )}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {memuat
              ? "Memuat…"
              : `${jumlahTampil.toLocaleString("id-ID")} dari ${jumlahTotal.toLocaleString("id-ID")}`}
          </span>
          {/* Bukan FilterPilihan: ia selalu menyisipkan item "Semua" yang untuk
              ukuran halaman tidak bermakna. */}
          <Select
            value={String(filter.pageSize)}
            onValueChange={(v) => set("pageSize", Number(v))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Baris per halaman"
              className={KELAS_KONTROL}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PILIHAN_UKURAN.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n.toLocaleString("id-ID")} baris
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {aksiKanan}
        </div>
      </div>

      {/* Dirender hanya saat dibuka — state isian selalu mulai bersih. */}
      {pencarianBuka && (
        <ModalPencarian
          buka
          onBuka={(b) => !b && setPencarianBuka(false)}
          opsi={opsiPencarian}
          nilaiAwal={filter.kriteriaLanjutan}
          onCari={(kriteria) => onPencarianLanjutan(kriteria)}
        />
      )}
      {galatOpsiPencarian && (
        <p role="status" className="text-xs text-muted-foreground">
          Beberapa pilihan Cari Lanjutan gagal dimuat: {galatOpsiPencarian}
        </p>
      )}
    </div>
  )
}
