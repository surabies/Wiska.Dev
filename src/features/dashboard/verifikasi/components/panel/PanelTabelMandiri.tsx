"use client"

// features/dashboard/verifikasi/components/panelTabelMandiri.tsx — tabel
// laporan mandiri dengan kemampuan yang sama seperti halaman Petugas:
// kotak centang (Shift+klik rentang, Ctrl+A), pilihan jumlah baris, saringan,
// dan ekspor CSV untuk baris terpilih.
//
// Memakai TabelVerifikasi yang sama dengan Petugas (modeRing="tunggal").
// Baris API dipetakan ke BarisVerifikasi agar laporan terverifikasi tampil
// berbeda dari V3 resmi pada tabel bersama.
// Tombol tampilan ada di toolbar, sebaris dengan pilihan jumlah baris.
import * as React from "react"
import {
  CalendarDaysIcon,
  Cancel01Icon,
  Download01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPeriode } from "@/features/public/lib/Format"
import { ambilList, ApiError } from "@/features/dashboard/api/ApiDashboard"
import { OPSI_STATUS_LAPORAN_MANDIRI } from "../../../lib/LabelLaporanMandiri"
import { KELAS_KONTROL } from "../../../shared/data-grid/KelasKontrol"
import { KotakCari } from "../../../shared/data-grid/toolbar/KotakCari"
import { FilterPilihan } from "../../../shared/data-grid/toolbar/PenyaringPilihan"
import { PILIHAN_UKURAN, TombolIkonVerifikasi } from "../BilahVerifikasi"
import { KontrolKolomVerifikasi, TabelVerifikasi } from "../TabelVerifikasi"
import type { BarisVerifikasi, Kerapatan } from "../../types/TipeVerifikasi"
import { usePreferensiKolom } from "../../hooks/GunakanPreferensiKolom"
import { KontrolTampilan } from "../KontrolTampilan"
import { RingkasanSebaris } from "../RingkasanVerifikasi"
import type { StatsVerifikasi } from "../../types/TipeVerifikasi"

export type StatusMandiri =
  "MENUNGGU" | "DIVERIFIKASI" | "DITOLAK" | "DIGUNAKAN"

export type BarisMandiriTabel = BarisVerifikasi & {
  status: StatusMandiri
  namaPelapor?: string | null
  nomorPelapor?: string | null
  verifiedByRole?: string | null
  sudahTahapPetugas?: boolean
  sudahDitagih?: boolean
}

/// Bentuk baris mentah /laporan-mandiri yang dibaca tabel.
interface BarisApi {
  id: string
  nomorLangganan?: string
  standAwal?: number | null
  standDilaporkan?: number
  pemakaianLalu?: number | null
  kondisi?: string | null
  createdAt?: string
  verifiedAt?: string | null
  pembacaanId?: string | null
  namaPelapor?: string | null
  nomorPelapor?: string | null
  verifiedByRole?: string | null
  sudahTahapPetugas?: boolean
  sudahDitagih?: boolean
  status: StatusMandiri
  pelanggan?: BarisVerifikasi["pelanggan"]
  pembacaan?: {
    standLalu?: number
    standAkhir: number
    pemakaianRiil?: number | null
    pemakaianM3: number
    pemakaianLalu?: number | null
    kondisi?: string
  } | null
}

function petaBaris(r: BarisApi): BarisMandiriTabel {
  const terverifikasi = r.status === "DIVERIFIKASI" || r.status === "DIGUNAKAN"
  const resmi =
    terverifikasi &&
    (r.status === "DIGUNAKAN" || r.pembacaanId != null || r.pembacaan != null)
  const standAwal = r.standAwal ?? r.pembacaan?.standLalu ?? null
  const pemakaian =
    standAwal != null && r.standDilaporkan != null
      ? r.standDilaporkan - standAwal
      : (r.pembacaan?.pemakaianRiil ?? null)
  return {
    id: r.id,
    status: r.status,
    nomorLangganan: r.nomorLangganan,
    standAwal,
    standAkhir: r.standDilaporkan ?? null,
    pemakaian,
    pembacaan:
      resmi && r.pembacaan
        ? {
            standLalu: r.pembacaan.standLalu,
            standAkhir: r.pembacaan.standAkhir,
            pemakaianRiil: r.pembacaan.pemakaianRiil,
            pemakaianM3: r.pembacaan.pemakaianM3,
            pemakaianLalu: r.pembacaan.pemakaianLalu,
          }
        : null,
    pemakaianLalu: r.pemakaianLalu ?? r.pembacaan?.pemakaianLalu ?? null,
    persentase: null,
    kondisi: r.kondisi ?? r.pembacaan?.kondisi ?? "STAND_KONSUMEN",
    tanggalCatat: r.createdAt ?? null,
    verif3At: resmi ? (r.verifiedAt ?? r.createdAt ?? "ok") : null,
    laporanMandiriTerverifikasi: terverifikasi && !resmi,
    verifiedAt:
      r.status === "DITOLAK" ? (r.verifiedAt ?? r.createdAt ?? "ok") : null,
    isVerified: terverifikasi,
    pencatat: { id: "konsumen", namaLapangan: "Konsumen" },
    pelanggan: r.pelanggan,
    namaPelapor: r.namaPelapor,
    nomorPelapor: r.nomorPelapor,
    verifiedByRole: r.verifiedByRole ?? null,
    sudahTahapPetugas: r.sudahTahapPetugas ?? false,
    sudahDitagih: r.sudahDitagih ?? false,
  }
}

const LABEL_STATUS: Record<StatusMandiri, string> = {
  MENUNGGU: "MENUNGGU",
  DIVERIFIKASI: "TERVERIFIKASI",
  DIGUNAKAN: "PEMBACAAN RESMI",
  DITOLAK: "DITOLAK",
}

interface FilterMandiri {
  q: string
  status: string
  pageSize: number
}

export function PanelTabelMandiri({
  periodes,
  periode,
  onPeriode,
  refreshKey,
  idTerpilih,
  onKlikBaris,
  onKlikKanan,
  ringkasanTerbuka,
  onRingkasan,
  stats,
}: {
  periodes: number[]
  /** undefined = periode awal belum ditentukan; tabel menunggu. */
  periode: number | null | undefined
  onPeriode: (p: number | null) => void
  refreshKey: number
  idTerpilih: string | null
  onKlikBaris: (row: BarisMandiriTabel) => void
  onKlikKanan: (
    row: BarisMandiriTabel,
    posisi: { x: number; y: number }
  ) => void
  ringkasanTerbuka: boolean
  onRingkasan: (buka: boolean) => void
  stats: StatsVerifikasi | null
}) {
  const [filter, setFilter] = React.useState<FilterMandiri>({
    q: "",
    status: "",
    pageSize: 100,
  })
  const [cari, setCari] = React.useState("")
  const [kerapatan, setKerapatan] = React.useState<Kerapatan>("normal")
  const preferensiKolom = usePreferensiKolom()
  const [rows, setRows] = React.useState<BarisMandiriTabel[]>([])
  const [total, setTotal] = React.useState(0)
  const [memuat, setMemuat] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [terpilih, setTerpilih] = React.useState<Set<string>>(new Set())
  const jangkarRef = React.useRef<number | null>(null)

  // Pencarian ditunda 350 ms — mengetik nomor tidak boleh = satu permintaan per digit.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilter((f) => (f.q === cari ? f : { ...f, q: cari }))
    }, 350)
    return () => clearTimeout(t)
  }, [cari])

  React.useEffect(() => {
    if (periode === undefined) return
    let batal = false
    // Penanda "memuat" harus dinyalakan tepat sebelum permintaan berangkat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemuat(true)
    setGalat(null)
    ambilList<BarisApi>("/laporan-mandiri", {
      pageSize: filter.pageSize,
      periode: periode ?? undefined,
      status: filter.status || undefined,
      q: filter.q || undefined,
    })
      .then(({ rows: r, total: t }) => {
        if (batal) return
        setRows(r.map(petaBaris))
        setTotal(t)
        setTerpilih(new Set())
      })
      .catch((e) => {
        if (!batal)
          setGalat(e instanceof ApiError ? e.message : "Gagal memuat data.")
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [periode, filter, refreshKey])

  // Papan ketik: Ctrl+A pilih semua, Esc batal pilih.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault()
        setTerpilih(new Set(rows.map((r) => r.id)))
      } else if (e.key === "Escape") {
        setTerpilih((s) => (s.size > 0 ? new Set() : s))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [rows])

  function toggle(id: string, rentang: boolean, indeks: number) {
    setTerpilih((lama) => {
      const baru = new Set(lama)
      if (rentang && jangkarRef.current !== null) {
        const [a, b] = [jangkarRef.current, indeks].sort((x, y) => x - y) as [
          number,
          number,
        ]
        for (let i = a; i <= b; i++) {
          const r = rows[i]
          if (r) baru.add(r.id)
        }
        return baru
      }
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      jangkarRef.current = indeks
      return baru
    })
  }

  /// Ekspor baris terpilih ke CSV. Urutan kolom mengikuti urutan kolom tabel.
  function ekspor() {
    const pilih = rows.filter((r) => terpilih.has(r.id))
    const kolom = [
      "No. Pel",
      "Nama",
      "ST Awal",
      "ST Akhir",
      "Pakai (m3)",
      "Lalu (m3)",
      "ST Resmi",
      "Tagihan (m3)",
      "Rute",
      "Pelapor",
      "No. pelapor",
      "Tgl Lapor",
      "Alamat",
      "Status",
    ]
    const isi = pilih.map((r) => [
      r.nomorLangganan ?? "",
      r.pelanggan?.nama ?? "",
      r.standAwal ?? "",
      r.standAkhir ?? "",
      r.pemakaian ?? "",
      r.pemakaianLalu ?? "",
      r.pembacaan?.standAkhir ?? "",
      r.pembacaan?.pemakaianM3 ?? "",
      r.pelanggan?.rute?.kode ?? "",
      r.namaPelapor ?? "",
      r.nomorPelapor ?? "",
      r.tanggalCatat ? r.tanggalCatat.slice(0, 10) : "",
      r.pelanggan?.alamat ?? "",
      LABEL_STATUS[r.status],
    ])
    const csv = [kolom, ...isi]
      .map((baris) =>
        baris.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(";")
      )
      .join("\n")
    // BOM: tanpa ini Excel Indonesia membaca UTF-8 sebagai ANSI.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `verifikasi-mandiri-${periode ?? "semua"}-${pilih.length}baris.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const adaFilter = filter.q !== "" || filter.status !== ""

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-1">
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
          nilai={periode == null ? "" : String(periode)}
          onUbah={(v) => onPeriode(v === "" ? null : Number(v))}
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
        <FilterPilihan
          filter={{
            param: "status",
            label: "Status",
            opsi: OPSI_STATUS_LAPORAN_MANDIRI,
          }}
          nilai={filter.status}
          onUbah={(v) => setFilter((f) => ({ ...f, status: v }))}
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
        {adaFilter && (
          <TombolIkonVerifikasi
            label="Bersihkan filter"
            onClick={() => {
              setCari("")
              setFilter((f) => ({ ...f, q: "", status: "" }))
            }}
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

        <div className="ml-auto flex items-center gap-2">
          {/* Terlipat = angka ringkasan pindah ke sini, tidak hilang. */}
          {!ringkasanTerbuka && <RingkasanSebaris stats={stats} />}
          <span className="text-xs text-muted-foreground tabular-nums">
            {memuat
              ? "Memuat…"
              : `${rows.length.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")}`}
          </span>
          <Select
            value={String(filter.pageSize)}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, pageSize: Number(v) }))
            }
          >
            <SelectTrigger
              size="default"
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
          <KontrolTampilan
            ringkasanTerbuka={ringkasanTerbuka}
            onRingkasan={onRingkasan}
            padat={kerapatan === "padat"}
            onPadat={(p) => setKerapatan(p ? "padat" : "normal")}
            aksiTambahan={
              <KontrolKolomVerifikasi
                preferensi={preferensiKolom.preferensiKolom}
                onVisibilitas={preferensiKolom.ubahVisibilitasKolom}
                onPindah={preferensiKolom.pindahKolom}
                onReset={preferensiKolom.resetKolom}
              />
            }
          />
        </div>
      </div>

      {galat && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1">
        <TabelVerifikasi
          rows={rows}
          terpilih={terpilih}
          onToggle={toggle}
          onToggleSemua={(pilih) =>
            setTerpilih(pilih ? new Set(rows.map((r) => r.id)) : new Set())
          }
          idTerpilih={idTerpilih}
          onKlikBaris={(r) => onKlikBaris(r as BarisMandiriTabel)}
          onKlikKanan={(r, pos) => onKlikKanan(r as BarisMandiriTabel, pos)}
          ambangAnomali={50}
          modeRing="tunggal"
          memuat={memuat}
          kerapatan={kerapatan}
          preferensiKolom={preferensiKolom.preferensiKolom}
          onLebarKolom={preferensiKolom.ubahLebarKolom}
          onPindahKolom={preferensiKolom.pindahKolom}
        />
      </div>

      {terpilih.size > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card p-2">
          <Badge className="tabular-nums">
            {terpilih.size.toLocaleString("id-ID")} baris dipilih
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={ekspor}
          >
            <HugeiconsIcon
              icon={Download01Icon}
              strokeWidth={2}
              className="size-3.5"
              aria-hidden
            />
            Ekspor terpilih
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setTerpilih(new Set())}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              className="size-3.5"
              aria-hidden
            />
            Batal pilih
            <kbd className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
              Esc
            </kbd>
          </Button>
          <span className="ml-auto hidden text-[11px] text-muted-foreground lg:inline">
            Ctrl+A pilih semua · Shift+klik pilih rentang
          </span>
        </div>
      )}
    </div>
  )
}
