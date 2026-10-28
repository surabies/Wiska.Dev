"use client"

// features/public/components/lacak-tiket-form.tsx — pantau status pengaduan
// lewat nomor tiket.
//
// TANPA verifikasi identitas, dan itu aman KARENA `nomorTiket` berformat
// TW-YYMM-XXXXXX dengan 6 karakter ACAK (≈1,07 miliar kemungkinan per
// bulan) — bukan nomor urut. Nomor tiket berperan sebagai kunci pembawa:
// yang memegangnya berhak melihat, menutup, dan membuka kembali tiketnya.
//
// KALAU FORMAT NOMOR TIKET SUATU SAAT DIBUAT BERURUTAN, form ini WAJIB
// dikasih faktor kedua (mis. nomor HP pelapor) lebih dulu — kalau tidak,
// halaman ini berubah jadi alat memanen aduan seluruh warga. Lihat
// server/modules/pengaduan/tiket.ts.
import * as React from "react"
import { Search, TriangleAlert } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { lacakTiket, ApiError, type StatusTiket } from "../lib/api"
import { KartuTiket } from "./pelacakan/kartu-tiket"

export function LacakTiketForm({ nomorAwal }: { nomorAwal?: string } = {}) {
  const [pending, setPending] = React.useState(false)
  const [pesanError, setPesanError] = React.useState<string | null>(null)
  const [tiket, setTiket] = React.useState<StatusTiket | null>(null)
  const [nomor, setNomor] = React.useState(nomorAwal ?? "")

  // Taut-langsung dari /akun (?nomor=TW-...): isi otomatis lalu langsung
  // cari, supaya baris di "Laporan Saya" benar-benar sekali klik ke detail
  // tiketnya — bukan hanya mengisi kotak dan menunggu pengguna menekan
  // "Lacak" lagi. Sengaja hanya sekali (dependency kosong): kalau pengguna
  // mengetik nomor lain secara manual sesudahnya, itu tidak boleh memicu
  // pencarian otomatis kedua.
  React.useEffect(() => {
    if (nomorAwal?.trim()) void ambil(nomorAwal.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ambil(nomorTiket: string) {
    setPesanError(null)
    setPending(true)
    try {
      setTiket(await lacakTiket(nomorTiket))
    } catch (err) {
      setTiket(null)
      setPesanError(
        err instanceof ApiError && err.status === 404
          ? "Nomor tiket tidak ditemukan. Periksa kembali nomor yang Anda terima saat melapor."
          : err instanceof ApiError
            ? err.message
            : "Terjadi kesalahan. Coba lagi."
      )
    } finally {
      setPending(false)
    }
  }

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = nomor.trim()
    if (input) await ambil(input)
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="nomorTiket">Nomor tiket</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="nomorTiket"
                name="nomorTiket"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="TW-2607-4F2A9K"
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                disabled={pending}
                required
                className="font-mono tracking-wider uppercase"
              />
              <Button type="submit" variant="outline" className="h-9 shrink-0" disabled={pending}>
                {pending ? <Spinner className="size-4" /> : <Search />}
                Lacak
              </Button>
            </div>
            <FieldDescription>
              Nomor yang Anda terima saat melapor. Huruf besar/kecil tidak masalah.
            </FieldDescription>
          </Field>

          {pesanError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{pesanError}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </form>

      {/* Setelah pelapor menilai / membuka kembali, tiket diambil ULANG dari
          server alih-alih ditambal di client — status, linimasa, dan tenggat
          SLA barunya semua diputuskan server, dan menebaknya di sini hanya
          akan menampilkan keadaan yang tidak pernah ada. */}
      {tiket && <KartuTiket tiket={tiket} onPerbarui={() => ambil(tiket.nomorTiket)} />}
    </div>
  )
}
