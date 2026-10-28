"use client"

// features/dashboard/components/verifikasi/panel-tabel.tsx — perekat layar
// verifikasi: saringan, dua tab sumber (laporan / belum dibaca), tabel
// berwarna, pemilihan, dan aksi massal.
//
// PEMILIHAN DIPEGANG DI SINI, bukan di tabel: aksi massal, ekspor, dan
// pintasan papan ketik semuanya membicarakan himpunan yang sama.
//
// Tombol tampilan (lipat ringkasan, kerapatan) kini di toolbar, sebaris dengan
// pilihan jumlah baris. Baris tab hanya memuat tab, ringkasan sebaris, dan sisa kerja.

import * as React from "react"
import { Task01Icon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ambilList, kirimJson, ApiError } from "../../../lib/api-client"
import { ToolbarVerifikasi, FILTER_AWAL, type FilterVerifikasi } from "../toolbar-verifikasi"
import { TabelVerifikasi, type BarisVerifikasi, type Kerapatan } from "../tabel-verifikasi"
import { AksiMassal, type Ring } from "../aksi-massal"
import { usePeriodeKerja } from "../../../lib/periode-kerja"
import { formatPeriode } from "@/features/public/lib/format"
import { KontrolTampilan } from "../kontrol-tampilan"
import { RingkasanSebaris } from "../ringkasan-verifikasi"
import type { StatsVerifikasi } from "../types/tipe"

/// Batas per permintaan verifikasi massal — sama dengan yang diterima server.
const BATCH_VERIF = 500

interface HasilMassal {
  diproses: number
  berhasil: number
  dilewati: number
  gagal: number
  masalah: { nomorLangganan: string; pesan?: string }[]
}

export function PanelTabel({
  periodes,
  pencatats,
  rutes,
  ambangAnomali,
  bolehRing,
  idTerpilih,
  onKlikBaris,
  onKlikKanan,
  refreshKey,
  onBerubah,
  onPeriodeBerubah,
  sisaKerja,
  onTabBerubah,
  anomali,
  ringkasanTerbuka,
  onRingkasan,
  stats,
}: {
  periodes: number[]
  pencatats: { id: string; namaLapangan: string }[]
  rutes: { id: string; kode: string }[]
  ambangAnomali: number
  bolehRing: (r: Ring) => boolean
  idTerpilih: string | null
  onKlikBaris: (row: BarisVerifikasi) => void
  onKlikKanan: (row: BarisVerifikasi, posisi: { x: number; y: number }) => void
  refreshKey: number
  onBerubah: () => void
  /// Diberi tahu setiap kali periode yang dipilih berubah, supaya kartu
  /// ringkasan di induk memakai periode yang SAMA dengan tabel.
  onPeriodeBerubah: (periode: number | null) => void
  /// Jumlah laporan periode ini yang belum lolos V3.
  sisaKerja: number | null
  /// Tab aktif diteruskan ke induk supaya panel detail tahu baris apa yang dipilih.
  onTabBerubah?: (tab: "laporan" | "belum") => void
  anomali?: number
  /// Kartu ringkasan dilipat/dibuka dari kelompok tombol di toolbar.
  ringkasanTerbuka: boolean
  onRingkasan: (buka: boolean) => void
  stats: StatsVerifikasi | null
}) {
  const [tab, setTab] = React.useState<"laporan" | "belum">("laporan")
  const [kerapatan, setKerapatan] = React.useState<Kerapatan>("normal")
  const [filter, setFilter] = React.useState<FilterVerifikasi>(FILTER_AWAL)
  const [rows, setRows] = React.useState<BarisVerifikasi[]>([])
  const [total, setTotal] = React.useState(0)
  const [memuat, setMemuat] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  const [terpilih, setTerpilih] = React.useState<Set<string>>(new Set())
  const [sedangJalan, setSedangJalan] = React.useState(false)
  const [kemajuan, setKemajuan] = React.useState<{ selesai: number; total: number } | null>(null)
  const [hasil, setHasil] = React.useState<HasilMassal | null>(null)
  const jangkarRef = React.useRef<number | null>(null)

  /// Daftar periode untuk dropdown diambil dari PERIODE KERJA, bukan dari
  /// "periode yang punya laporan": tepat setelah buka bulan baru, daftar kerja
  /// sudah terbit tapi belum ada satu pun laporan, dan bulan itu tidak akan
  /// muncul di dropdown kalau sumbernya laporan.
  const { periodeKerja, daftar: daftarPeriode } = usePeriodeKerja()
  const periodePilihan = daftarPeriode.length > 0 ? daftarPeriode.map((d) => d.periode) : periodes
  /// Penyesuaian saat render, BUKAN useEffect — pola resmi React untuk
  /// "menyetel state ketika nilai dari luar berubah". Dengan useEffect, render
  /// pertama sempat mengambil data untuk SELURUH periode.
  const [periodeKerjaTerpakai, setPeriodeKerjaTerpakai] = React.useState<number | null>(null)
  if (periodeKerja !== null && periodeKerja !== periodeKerjaTerpakai) {
    setPeriodeKerjaTerpakai(periodeKerja)
    // `=== null` dipertahankan: periode pilihan operator tidak boleh direbut.
    if (filter.periode === null) setFilter((f) => ({ ...f, periode: periodeKerja }))
  }

  React.useEffect(() => {
    onPeriodeBerubah(filter.periode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.periode])

  React.useEffect(() => {
    let batal = false
    // Penanda "memuat" harus dinyalakan tepat sebelum permintaan berangkat.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemuat(true)
    setGalat(null)
    const params: Record<string, string | number | undefined> = {
      pageSize: filter.pageSize,
      periode: filter.periode ?? undefined,
      pencatatId: filter.pencatatId || undefined,
      // Berlaku di KEDUA tab: /laporan-harian lewat relasi pelanggan,
      // /belum-dibaca lewat kolom ruteId DaftarCatat.
      ruteId: filter.ruteId || undefined,
      q: filter.q || undefined,
    }
    if (tab === "laporan") {
      // Muatan ringkas: tabel cuma butuh kolom tampil, bukan 50 field + 7 relasi.
      params.ringkas = "true"
      params.statusVerif = filter.statusVerif || undefined
      params.tanggalDari = filter.tanggalDari || undefined
      params.tanggalSampai = filter.tanggalSampai || undefined
      params.hanyaAnomali = filter.hanyaAnomali ? "true" : undefined
    }
    const jalur = tab === "laporan" ? "/laporan-harian" : "/laporan-harian/belum-dibaca"

    ambilList<BarisVerifikasi>(jalur, params)
      .then(({ rows: r, total: t }) => {
        if (batal) return
        setRows(r)
        setTotal(t)
        setTerpilih(new Set())
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof ApiError ? e.message : "Gagal memuat data.")
      })
      .finally(() => { if (!batal) setMemuat(false) })
    return () => { batal = true }
  }, [tab, filter, refreshKey])

  // Papan ketik: Ctrl+A pilih semua, panah pindah baris aktif, Space menandai.
  // Navigasi panah inilah yang membuat 22 ribu baris bisa dikerjakan tanpa
  // menyentuh tetikus; panel detail mengikuti baris aktif.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault()
        setTerpilih(new Set(rows.map((r) => r.id)))
        return
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== " ") return
      if (rows.length === 0) return
      e.preventDefault()

      const kini = rows.findIndex((r) => r.id === idTerpilih)
      if (e.key === " ") {
        const baris = rows[kini < 0 ? 0 : kini]
        if (baris) toggle(baris.id, false, kini < 0 ? 0 : kini)
        return
      }
      const arah = e.key === "ArrowDown" ? 1 : -1
      const berikut = kini < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, kini + arah))
      const baris = rows[berikut]
      if (baris) onKlikBaris(baris)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, idTerpilih])

  function toggle(id: string, rentang: boolean, indeks: number) {
    setTerpilih((lama) => {
      const baru = new Set(lama)
      if (rentang && jangkarRef.current !== null) {
        const [a, b] = [jangkarRef.current, indeks].sort((x, y) => x - y) as [number, number]
        for (let i = a; i <= b; i++) { const r = rows[i]; if (r) baru.add(r.id) }
        return baru
      }
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      jangkarRef.current = indeks
      return baru
    })
  }

  async function jalankanMassal(ring: Ring, sertakanAnomali: boolean) {
    const ids = [...terpilih]
    setSedangJalan(true)
    setHasil(null)
    setKemajuan({ selesai: 0, total: ids.length })
    const gabung: HasilMassal = { diproses: 0, berhasil: 0, dilewati: 0, gagal: 0, masalah: [] }
    try {
      for (let i = 0; i < ids.length; i += BATCH_VERIF) {
        const potong = ids.slice(i, i + BATCH_VERIF)
        const h = await kirimJson<HasilMassal>("/laporan-harian/verif-massal", "POST", {
          ring, ids: potong, sertakanAnomali,
        })
        gabung.diproses += h.diproses; gabung.berhasil += h.berhasil
        gabung.dilewati += h.dilewati; gabung.gagal += h.gagal
        gabung.masalah.push(...h.masalah.slice(0, 20))
        setKemajuan({ selesai: Math.min(i + BATCH_VERIF, ids.length), total: ids.length })
      }
      setHasil(gabung)
      setTerpilih(new Set())
      onBerubah()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Verifikasi massal gagal.")
    } finally {
      setSedangJalan(false)
      setKemajuan(null)
    }
  }

  /// Ekspor baris terpilih ke CSV — dibuat di peramban, datanya sudah ada di layar.
  /// Urutan kolom CSV mengikuti urutan kolom tabel.
  function ekspor() {
    const pilih = rows.filter((r) => terpilih.has(r.id))
    const kolom = [
      "No. Pel", "Nama", "ST Awal", "ST Akhir", "Pakai (m3)", "Lalu (m3)", "Dev %",
      "Kondisi", "ST Resmi", "Tagihan (m3)", "Rute", "Petugas", "Tgl Catat", "Alamat", "Status",
    ]
    const isi = pilih.map((r) => [
      r.nomorLangganan ?? r.pelanggan?.nomorLangganan ?? "",
      r.pelanggan?.nama ?? r.namaPelanggan ?? "",
      r.standAwal ?? "", r.standAkhir ?? "",
      r.pemakaian ?? "", r.pemakaianLalu ?? "", r.persentase ?? "",
      r.kondisi ?? "",
      r.verif1At ? r.standAkhirRevisi ?? r.standAkhir ?? "" : "",
      r.verif1At ? r.pemakaianTagihVerif ?? r.pemakaian ?? "" : "",
      r.pelanggan?.rute?.kode ?? "",
      r.pencatat?.namaLapangan ?? "",
      r.tanggalCatat ? r.tanggalCatat.slice(0, 10) : "",
      r.pelanggan?.alamat ?? r.alamatPelanggan ?? "",
      r.verif3At ? "V3" : r.verif2At ? "V2" : r.verif1At ? "V1" : "MENUNGGU",
    ])
    const csv = [kolom, ...isi]
      .map((baris) => baris.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(";"))
      .join("\n")
    // BOM: tanpa ini Excel Indonesia membaca UTF-8 sebagai ANSI.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `verifikasi-${filter.periode ?? "semua"}-${pilih.length}baris.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Periode yang daftar kerjanya sudah terbit tapi belum ada setoran: tanpa
  // pesan ini tabel kosong terbaca seperti aplikasi berhenti.
  const tanpaSaringan =
    filter.q === "" && filter.statusVerif === "" && filter.pencatatId === "" && filter.ruteId === "" &&
    filter.tanggalDari === "" && filter.tanggalSampai === "" && !filter.hanyaAnomali
  const pesanKosong =
    tab === "laporan" && filter.periode !== null && tanpaSaringan ? (
      <>
        Belum ada setoran pencatatan untuk {formatPeriode(filter.periode)}. Daftar kerjanya sudah terbit —
        lihat tab <strong>Belum dibaca</strong>, atau unggah setoran petugas lewat{" "}
        <strong>Impor Data → Berkas sumber</strong>.
      </>
    ) : undefined

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1">
        {([
          ["laporan", "Laporan masuk", Task01Icon],
          ["belum", "Belum dibaca", ViewOffIcon],
        ] as const).map(([id, label, Ikon]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "secondary" : "ghost"}
            className="h-8 text-xs"
            onClick={() => { setTab(id); setTerpilih(new Set()); onTabBerubah?.(id) }}
          >
            <HugeiconsIcon icon={Ikon} strokeWidth={2} className="size-3.5" aria-hidden /> {label}
          </Button>
        ))}
        {tab === "belum" && (
          <span className="text-muted-foreground ml-2 text-[11px]">
            Sambungan di daftar catat yang belum ada setorannya — bahan menagih pekerjaan ke petugas.
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Terlipat = angka ringkasan pindah ke sini, tidak hilang. */}
          {!ringkasanTerbuka && <RingkasanSebaris stats={stats} />}
          {/* Sisa pekerjaan selalu terlihat. */}
          {tab === "laporan" && sisaKerja !== null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              sisa <strong className="text-foreground">{sisaKerja.toLocaleString("id-ID")}</strong> belum V3
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <ToolbarVerifikasi
          filter={filter}
          onGanti={setFilter}
          periodes={periodePilihan}
          pencatats={pencatats}
          rutes={rutes}
          jumlahTampil={rows.length}
          jumlahTotal={total}
          memuat={memuat}
          modeBelumDibaca={tab === "belum"}
          anomali={anomali ?? 0}
          ambang={ambangAnomali}
          aksiKanan={
            <KontrolTampilan
              ringkasanTerbuka={ringkasanTerbuka}
              onRingkasan={onRingkasan}
              padat={kerapatan === "padat"}
              onPadat={(p) => setKerapatan(p ? "padat" : "normal")}
            />
          }
        />
      </div>

      {galat && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}

      {hasil && (
        <Alert className="shrink-0">
          <AlertDescription className="text-xs">
            Selesai: <strong>{hasil.berhasil.toLocaleString("id-ID")} berhasil</strong>
            {hasil.dilewati > 0 && ` · ${hasil.dilewati.toLocaleString("id-ID")} dilewati`}
            {hasil.gagal > 0 && ` · ${hasil.gagal.toLocaleString("id-ID")} gagal`}
            {hasil.masalah.length > 0 && (
              <span className="text-muted-foreground block">
                Contoh: {hasil.masalah.slice(0, 3).map((m) => `${m.nomorLangganan} — ${m.pesan}`).join(" · ")}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1">
        <TabelVerifikasi
          rows={rows}
          terpilih={terpilih}
          onToggle={toggle}
          onToggleSemua={(pilih) => setTerpilih(pilih ? new Set(rows.map((r) => r.id)) : new Set())}
          idTerpilih={idTerpilih}
          onKlikBaris={onKlikBaris}
          onKlikKanan={onKlikKanan}
          ambangAnomali={ambangAnomali}
          modeBelumDibaca={tab === "belum"}
          memuat={memuat}
          kerapatan={kerapatan}
          pesanKosong={pesanKosong}
        />
      </div>

      {tab === "laporan" && (
        <div className="shrink-0">
          <AksiMassal
            jumlah={terpilih.size}
            bolehRing={bolehRing}
            onJalankan={(r, a) => void jalankanMassal(r, a)}
            onBersihkan={() => setTerpilih(new Set())}
            onEkspor={ekspor}
            sedangJalan={sedangJalan}
            kemajuan={kemajuan}
          />
        </div>
      )}
    </div>
  )
}