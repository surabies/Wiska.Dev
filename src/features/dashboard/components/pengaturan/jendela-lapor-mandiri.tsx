"use client"

import * as React from "react"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
} from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  ambilJendelaLaporMandiri,
  ApiError,
  simpanJendelaLaporMandiri,
  type JendelaLaporMandiri as NilaiJendela,
} from "../../lib/api-client"

function pesanKesalahan(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Terjadi kesalahan. Silakan coba lagi."
}

export function JendelaLaporMandiri() {
  const [nilaiTersimpan, setNilaiTersimpan] =
    React.useState<NilaiJendela | null>(null)
  const [tanggalBuka, setTanggalBuka] = React.useState("")
  const [tanggalTutup, setTanggalTutup] = React.useState("")
  const [memuat, setMemuat] = React.useState(true)
  const [menyimpan, setMenyimpan] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pesanSukses, setPesanSukses] = React.useState<string | null>(null)

  const muatPengaturan = React.useCallback(async () => {
    setMemuat(true)
    setError(null)
    try {
      const nilai = await ambilJendelaLaporMandiri()
      setNilaiTersimpan(nilai)
      setTanggalBuka(String(nilai.tanggalBuka))
      setTanggalTutup(String(nilai.tanggalTutup))
    } catch (err) {
      setError(pesanKesalahan(err))
    } finally {
      setMemuat(false)
    }
  }, [])

  React.useEffect(() => {
    void muatPengaturan()
  }, [muatPengaturan])

  const buka = Number(tanggalBuka)
  const tutup = Number(tanggalTutup)
  const inputValid =
    Number.isInteger(buka) &&
    Number.isInteger(tutup) &&
    buka >= 1 &&
    buka <= 28 &&
    tutup >= 1 &&
    tutup <= 28 &&
    buka <= tutup
  const berubah =
    nilaiTersimpan !== null &&
    (buka !== nilaiTersimpan.tanggalBuka ||
      tutup !== nilaiTersimpan.tanggalTutup)

  async function simpan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inputValid || !berubah || menyimpan) return

    setMenyimpan(true)
    setError(null)
    setPesanSukses(null)
    try {
      const hasil = await simpanJendelaLaporMandiri({
        tanggalBuka: buka,
        tanggalTutup: tutup,
      })
      setNilaiTersimpan(hasil)
      setTanggalBuka(String(hasil.tanggalBuka))
      setTanggalTutup(String(hasil.tanggalTutup))
      setPesanSukses("Jadwal laporan meter mandiri berhasil disimpan.")
    } catch (err) {
      setError(pesanKesalahan(err))
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Jendela laporan mandiri</CardTitle>
          <CardDescription>
            Atur tanggal warga dapat mengirim laporan stand meter setiap bulan.
            Perubahan berlaku untuk semua jalur laporan mandiri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {memuat ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Memuat pengaturan…
            </div>
          ) : (
            <form className="space-y-5" onSubmit={simpan}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tanggalBuka">Tanggal mulai</Label>
                  <Input
                    id="tanggalBuka"
                    type="number"
                    min={1}
                    max={28}
                    step={1}
                    inputMode="numeric"
                    value={tanggalBuka}
                    onChange={(event) => {
                      setTanggalBuka(event.target.value)
                      setPesanSukses(null)
                    }}
                    disabled={menyimpan}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalTutup">Tanggal terakhir</Label>
                  <Input
                    id="tanggalTutup"
                    type="number"
                    min={1}
                    max={28}
                    step={1}
                    inputMode="numeric"
                    value={tanggalTutup}
                    onChange={(event) => {
                      setTanggalTutup(event.target.value)
                      setPesanSukses(null)
                    }}
                    disabled={menyimpan}
                    required
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Tanggal harus berada pada rentang 1–28. Hari mulai tidak boleh
                melewati hari terakhir. Jadwal dan periode dihitung server
                berdasarkan WIB.
              </p>

              {!inputValid && (tanggalBuka !== "" || tanggalTutup !== "") && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>
                    Masukkan rentang tanggal yang valid, dengan tanggal mulai
                    tidak lebih besar dari tanggal terakhir.
                  </AlertDescription>
                </Alert>
              )}

              {pesanSukses && (
                <Alert>
                  <CheckCircle2 />
                  <AlertDescription>{pesanSukses}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" />
                  {inputValid
                    ? `Dibuka setiap tanggal ${buka}–${tutup}.`
                    : "Jadwal belum valid."}
                </p>
                <Button
                  type="submit"
                  disabled={!inputValid || !berubah || menyimpan}
                >
                  {menyimpan && <Spinner className="size-4" />}
                  {menyimpan ? "Menyimpan…" : "Simpan jadwal"}
                </Button>
              </div>
            </form>
          )}

          {!memuat && error && nilaiTersimpan === null && (
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void muatPengaturan()}
              >
                Coba muat ulang
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
