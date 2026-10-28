"use client"

// features/publik/components/cek-tagihan-form.tsx
//
// Client component + fetch langsung ke /api/public (bukan server action):
// rate limit di backend berbasis IP PEMAKAI. Kalau lewat server action,
// seluruh permintaan datang dari IP server dan satu orang bisa menghabiskan
// kuota semua orang — sekaligus membuat pembatasnya tak berguna.
//
// Hanya nomor langganan — TIDAK ada field nama. Lihat catatan keputusan
// produk di server/modules/publik/verifikasi.ts soal trade-off keamanan
// yang itu berarti (siapa pun yang tahu/menebak nomornya bisa melihat data
// ini, bukan cuma pemiliknya).
import * as React from "react"
import { Search, TriangleAlert } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cekTagihan, ApiError, type HasilCekTagihan } from "../lib/api"
import { HasilTagihan } from "./hasil-tagihan"
import { KartuBerbingkai } from "./halaman-publik"
import { TombolUtama } from "./tombol-utama"

export function CekTagihanForm({ nomorAwal }: { nomorAwal?: string }) {
  // nomorAwal datang dari ?nomor= (form cek cepat di landing) — hanya
  // mengisi input, tidak auto-submit; lihat catatan di page.tsx-nya.
  const [nomorLangganan, setNomorLangganan] = React.useState(nomorAwal ?? "")
  const [pending, setPending] = React.useState(false)
  const [pesanError, setPesanError] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<HasilCekTagihan | null>(null)

  async function cari() {
    const nomor = nomorLangganan.trim()
    if (nomor.length !== 11) {
      setPesanError("Nomor langganan harus 11 digit.")
      return
    }

    setPesanError(null)
    setHasil(null)
    setPending(true)
    try {
      setHasil(await cekTagihan({ nomorLangganan: nomor }))
    } catch (err) {
      setPesanError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <KartuBerbingkai label="Formulir · Cek Tagihan" chip="Tanpa Akun">
        <label htmlFor="nomorLangganan" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Nomor langganan
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="nomorLangganan"
            value={nomorLangganan}
            onChange={(e) => setNomorLangganan(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => e.key === "Enter" && cari()}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00401700010"
            maxLength={11}
            disabled={pending}
            className="h-11 flex-1 font-mono"
          />
          <TombolUtama onClick={cari} disabled={pending || nomorLangganan.length !== 11} className="h-11 px-5">
            {pending ? <Spinner className="size-4" /> : <Search />}
            {pending ? "Mencari…" : "Cek tagihan"}
          </TombolUtama>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">11 digit, tertera di rekening Anda. Gratis dan langsung.</p>

        {pesanError && (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert />
            <AlertDescription>{pesanError}</AlertDescription>
          </Alert>
        )}
      </KartuBerbingkai>

      {hasil && (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-panel">
          <HasilTagihan hasil={hasil} />
        </div>
      )}
    </div>
  )
}
