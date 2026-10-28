"use client"

// features/dashboard/components/verifikasi/toolbar-verifikasi.tsx — bilah
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
import { Alert02Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { formatPeriode } from "@/features/public/lib/format"
import { KELAS_KONTROL, KELAS_KONTROL_AKTIF } from "../data-grid/kelas-kontrol"
import { KotakCari } from "../data-grid/toolbar/kotak-cari"
import { FilterPilihan } from "../data-grid/toolbar/filter-pilihan"
import { PenyaringTanggal } from "../data-grid/toolbar/penyaring-tanggal"
import { TombolFilterLanjutan } from "../data-grid/toolbar/tombol-filter-lanjutan"
import { ModalPencarian, type KriteriaPencarian, type OpsiPencarian } from "./modal/modal-pencarian"

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
  pageSize: number
}

export const FILTER_AWAL: FilterVerifikasi = {
  q: "", periode: null, statusVerif: "", pencatatId: "", ruteId: "",
  tanggalDari: "", tanggalSampai: "", hanyaAnomali: false, pageSize: 100,
}

export const PILIHAN_UKURAN = [50, 100, 200, 500, 1000, 2000, 5000] as const

const ID_PANEL = "panel-filter-verifikasi"

export function ToolbarVerifikasi({
  filter, onGanti, periodes, pencatats, rutes,
  jumlahTampil, jumlahTotal, memuat,
  modeBelumDibaca = false, anomali = 0, ambang = 50,
  aksiKanan,
  opsiPencarian,
  onPencarianLanjutan,
}: {
  filter: FilterVerifikasi
  onGanti: (f: FilterVerifikasi) => void
  periodes: number[]
  pencatats: { id: string; namaLapangan: string }[]
  rutes: { id: string; kode: string }[]
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
  /** Dipanggil saat "Cari Data" ditekan. Belum diberikan = modal hanya tampilan. */
  onPencarianLanjutan?: (kriteria: KriteriaPencarian, jumlah: number) => void
}) {
  const [cari, setCari] = React.useState(filter.q)
  const [panelBuka, setPanelBuka] = React.useState(false)
  const [pencarianBuka, setPencarianBuka] = React.useState(false)
  const [kriteriaTerapan, setKriteriaTerapan] = React.useState(0)

  // Pencarian ditunda 350 ms — mengetik 11 digit nomor tidak boleh = 11 permintaan.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (cari !== filter.q) onGanti({ ...filter, q: cari })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari])

  const set = <K extends keyof FilterVerifikasi>(k: K, v: FilterVerifikasi[K]) =>
    onGanti({ ...filter, [k]: v })

  // Hanya saringan yang ADA di panel yang dihitung di tombol "Filters".
  const jumlahLanjutan =
    (filter.pencatatId ? 1 : 0) + (filter.ruteId ? 1 : 0) +
    (!modeBelumDibaca && filter.statusVerif ? 1 : 0) +
    (!modeBelumDibaca && filter.hanyaAnomali ? 1 : 0)
  const adaFilter =
    jumlahLanjutan > 0 || filter.q !== "" || filter.tanggalDari !== "" || filter.tanggalSampai !== ""

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <KotakCari nilai={cari} onUbah={setCari} placeholder="Cari no. langganan atau nama" />

        <FilterPilihan
          filter={{ param: "periode", label: "Periode", opsi: periodes.map((p) => ({ value: String(p), label: formatPeriode(p) })) }}
          nilai={filter.periode === null ? "" : String(filter.periode)}
          onUbah={(v) => set("periode", v === "" ? null : Number(v))}
        />

        {!modeBelumDibaca && (
          <PenyaringTanggal
            label="Tanggal"
            dari={filter.tanggalDari}
            sampai={filter.tanggalSampai}
            onTerapkan={(dari, sampai) => onGanti({ ...filter, tanggalDari: dari, tanggalSampai: sampai })}
          />
        )}

        <TombolFilterLanjutan
          idPanel={ID_PANEL}
          terbuka={panelBuka}
          jumlah={jumlahLanjutan}
          onKlik={() => setPanelBuka((b) => !b)}
        />

        {!modeBelumDibaca && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(KELAS_KONTROL, kriteriaTerapan > 0 && KELAS_KONTROL_AKTIF)}
            onClick={() => setPencarianBuka(true)}
            aria-haspopup="dialog"
            title="Pencarian dengan kriteria bercentang (wilayah, zonasi, rentang pemakaian, status verifikasi, …)"
          >
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" aria-hidden />
            Cari lanjutan
            {kriteriaTerapan > 0 && (
              <span className="rounded-full bg-blue-500/15 px-1.5 text-[10px] font-medium text-blue-700 tabular-nums dark:text-blue-400">
                {kriteriaTerapan}
              </span>
            )}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {memuat ? "Memuat…" : `${jumlahTampil.toLocaleString("id-ID")} dari ${jumlahTotal.toLocaleString("id-ID")}`}
          </span>
          {/* Bukan FilterPilihan: ia selalu menyisipkan item "Semua" yang untuk
              ukuran halaman tidak bermakna. */}
          <Select value={String(filter.pageSize)} onValueChange={(v) => set("pageSize", Number(v))}>
            <SelectTrigger size="sm" aria-label="Baris per halaman" className={KELAS_KONTROL}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PILIHAN_UKURAN.map((n) => (
                <SelectItem key={n} value={String(n)}>{n.toLocaleString("id-ID")} baris</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {aksiKanan}
        </div>
      </div>

      {panelBuka && (
        <div id={ID_PANEL} className="bg-background border-border-subtle flex flex-wrap items-center gap-2 rounded-lg border p-2">
          {!modeBelumDibaca && (
            <FilterPilihan
              filter={{
                param: "statusVerif", label: "Status",
                opsi: [
                  { value: "MENUNGGU", label: "Menunggu" },
                  { value: "DIVERIFIKASI", label: "Resmi (V3)" },
                  { value: "DITOLAK", label: "Cek ulang" },
                ],
              }}
              nilai={filter.statusVerif}
              onUbah={(v) => set("statusVerif", v)}
            />
          )}
          <FilterPilihan
            filter={{ param: "pencatatId", label: "Petugas", opsi: pencatats.map((p) => ({ value: p.id, label: p.namaLapangan })) }}
            nilai={filter.pencatatId}
            onUbah={(v) => set("pencatatId", v)}
          />
          <FilterPilihan
            filter={{ param: "ruteId", label: "Rute", opsi: rutes.map((r) => ({ value: r.id, label: r.kode })) }}
            nilai={filter.ruteId}
            onUbah={(v) => set("ruteId", v)}
          />
          {!modeBelumDibaca && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(KELAS_KONTROL, filter.hanyaAnomali && KELAS_KONTROL_AKTIF)}
              onClick={() => set("hanyaAnomali", !filter.hanyaAnomali)}
              aria-pressed={filter.hanyaAnomali}
              title={`Deviasi lebih dari ±${ambang}% dari bulan lalu`}
            >
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" aria-hidden />
              Hanya anomali
              {anomali > 0 && (
                <span className="rounded-full bg-red-500/15 px-1.5 text-[10px] font-medium text-red-700 tabular-nums dark:text-red-400">
                  {anomali.toLocaleString("id-ID")}
                </span>
              )}
            </Button>
          )}
          {adaFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-[13px] font-normal"
              onClick={() => onGanti({ ...FILTER_AWAL, periode: filter.periode, pageSize: filter.pageSize })}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" aria-hidden /> Bersihkan
            </Button>
          )}
        </div>
      )}

      {/* Dirender hanya saat dibuka — state isian selalu mulai bersih. */}
      {pencarianBuka && (
        <ModalPencarian
          buka
          onBuka={(b) => !b && setPencarianBuka(false)}
          opsi={opsiPencarian}
          onCari={(kriteria, jumlah) => {
            setKriteriaTerapan(jumlah)
            onPencarianLanjutan?.(kriteria, jumlah)
          }}
        />
      )}
    </div>
  )
}