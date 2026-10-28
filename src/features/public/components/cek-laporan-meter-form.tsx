"use client"

// features/public/components/cek-laporan-meter-form.tsx — pantau status
// laporan meter mandiri PERIODE BERJALAN lewat nomor langganan.
//
// Sengaja lewat GET /api/public/pelanggan/:nomorLangganan — endpoint yang
// SAMA PERSIS dengan yang menggerbangi tab "Lapor meter" (cariPelanggan di
// lapor-meter-form.tsx) — bukan endpoint kedua. Itu jugalah kenapa kotak
// nomor langganannya memakai <InputNomorLangganan> yang sama: satu sumber
// kebenaran untuk "cari pelanggan lewat nomor langganan", dipakai kedua tab.
//
// Begitu pelanggan ketemu, kotak cari otomatis disembunyikan dan HANYA
// laporan periode berjalan yang tampil (bukan daftar riwayat) — permintaan
// produk, lihat riwayat percakapan.
import * as React from "react"
import { AlertCircle } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cariPelanggan, ApiError, type PelangganPratinjau } from "../lib/api"
import { formatPeriode } from "../lib/format"
import { InputNomorLangganan } from "./input-nomor-langganan"
import { KartuLaporanMeter } from "./kartu-laporan-meter"

export function CekLaporanMeterForm({ nomorAwal }: { nomorAwal?: string } = {}) {
  const [nomor, setNomor] = React.useState(nomorAwal ?? "")
  const [pratinjau, setPratinjau] = React.useState<PelangganPratinjau | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const pencarianTerbaru = React.useRef(0)

  async function cari(nomorLangganan: string) {
    const id = ++pencarianTerbaru.current
    setError(null)
    setPratinjau(null)
    setPending(true)
    try {
      const hasil = await cariPelanggan(nomorLangganan)
      if (id === pencarianTerbaru.current) setPratinjau(hasil)
    } catch (err) {
      if (id === pencarianTerbaru.current)
        setError(err instanceof ApiError ? err.message : "Gagal mencari nomor pelanggan.")
    } finally {
      if (id === pencarianTerbaru.current) setPending(false)
    }
  }

  // Taut-langsung dari layar sukses lapor-meter (?tab=cek&nomor=...): isi
  // otomatis lalu langsung cari — pola sama dengan onNomorChange di bawah.
  // Sengaja hanya sekali (dependency kosong).
  React.useEffect(() => {
    // Sengaja: mengisi HASIL pencarian dari ?nomor= URL SEKALI saat
    // taut-langsung dibuka, pola sama dengan lacak-tiket-form.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nomorAwal?.trim()) void cari(nomorAwal.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sama seperti lapor-meter-form.tsx: auto-cari begitu nomor genap 11
  // digit, dipicu dari event handler (bukan efek yang memantau state).
  function onNomorChange(digitBaru: string) {
    setNomor(digitBaru)
    if (digitBaru.length === 11) {
      cari(digitBaru)
    } else {
      pencarianTerbaru.current++ // batalkan pencarian yang sedang berjalan
      setPratinjau(null)
      setError(null)
      setPending(false)
    }
  }

  function cekNomorLain() {
    setNomor("")
    setPratinjau(null)
    setError(null)
  }

  // Ketemu -> kotak nomor & tombol cari disembunyikan otomatis, HANYA foto +
  // detail periode berjalan yang tampil (permintaan produk: riwayat
  // periode-periode lampau tidak perlu ditunjukkan).
  if (pratinjau) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            {pratinjau.nama} · {pratinjau.nomorLangganan}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={cekNomorLain}>
            Cek nomor lain
          </Button>
        </div>

        {pratinjau.laporanBulanIni ? (
          <KartuLaporanMeter laporan={pratinjau.laporanBulanIni} />
        ) : (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            Belum ada laporan periode {formatPeriode(pratinjau.periodeBerjalan)} atas nama {pratinjau.nama}. Kirim
            lewat tab <strong>Lapor meter</strong> di sebelah.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <InputNomorLangganan id="nomorLanggananCek" nomor={nomor} onNomorChange={onNomorChange} onCari={cari} pending={pending} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
