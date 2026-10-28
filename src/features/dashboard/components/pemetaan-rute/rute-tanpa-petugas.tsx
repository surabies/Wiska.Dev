"use client"

import * as React from "react"
import { Loader2, Search } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ambilList, ambilSatu, kirimJson, ApiError } from "../../lib/api-client"

interface RuteTanpaPetugas {
  id: string
  kode: string
  namaSeksi: string
  target: number
}

interface PetugasRingkas {
  id: string
  namaLapangan: string
  namaLengkap: string | null
  isAktif: boolean
}

export function RuteTanpaPetugas({
  bolehUbah,
  refreshKey,
  onBerubah,
}: {
  bolehUbah: boolean
  refreshKey: number
  onBerubah: () => void
}) {
  const [rute, setRute] = React.useState<RuteTanpaPetugas[]>([])
  const [petugas, setPetugas] = React.useState<PetugasRingkas[]>([])
  const [petugasId, setPetugasId] = React.useState("")
  const [cari, setCari] = React.useState("")
  const [memuat, setMemuat] = React.useState(true)
  const [mengirim, setMengirim] = React.useState<string | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [pesan, setPesan] = React.useState<string | null>(null)
  const [versi, setVersi] = React.useState(0)

  React.useEffect(() => {
    let batal = false
    Promise.all([
      ambilList<RuteTanpaPetugas>("/penugasan-rute/rute-tanpa-petugas", {
        pageSize: 5000,
      }),
      ambilSatu<PetugasRingkas[]>("/penugasan-rute/ringkasan"),
    ])
      .then(([hasilRute, daftarPetugas]) => {
        if (batal) return
        setRute(hasilRute.rows)
        setPetugas(daftarPetugas.filter((p) => p.isAktif))
        setGalat(null)
      })
      .catch((e) => {
        if (!batal)
          setGalat(
            e instanceof ApiError ? e.message : "Gagal memuat rute tanpa petugas."
          )
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [refreshKey, versi])

  const tampil = React.useMemo(() => {
    const q = cari.trim().toLocaleLowerCase("id-ID")
    return q ? rute.filter((r) => r.kode.toLocaleLowerCase("id-ID").includes(q)) : rute
  }, [cari, rute])

  async function tugaskan(ruteId: string) {
    if (!petugasId || mengirim) return
    setMengirim(ruteId)
    setGalat(null)
    setPesan(null)
    try {
      await kirimJson("/penugasan-rute", "POST", { pencatatId: petugasId, ruteId })
      setRute((lama) => lama.filter((r) => r.id !== ruteId))
      onBerubah()
      setPesan("Rute berhasil ditugaskan.")
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menugaskan rute.")
    } finally {
      setMengirim(null)
    }
  }

  return (
    <section
      aria-label="Rute belum ditugaskan"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-panel"
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Rute belum ditugaskan</h2>
          <p className="text-sm text-muted-foreground">
            Rute ini tidak muncul pada daftar kerja petugas mana pun.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{rute.length.toLocaleString("id-ID")}</span>
          <span>rute</span>
        </div>
      </header>

      <div className="flex shrink-0 flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative w-full max-w-full sm:w-[22.5rem] sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari kode rute…"
            aria-label="Cari rute tanpa petugas"
            className="pl-8"
          />
        </div>
        {bolehUbah && (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">Tugaskan ke</span>
            <Select value={petugasId || undefined} onValueChange={setPetugasId}>
              <SelectTrigger
                size="default"
                aria-label="Pilih petugas untuk rute"
                className="w-52"
              >
                <SelectValue placeholder="Pilih petugas…" />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {petugas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.namaLengkap ?? p.namaLapangan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {galat && (
        <Alert variant="destructive" className="m-4 mb-0 shrink-0">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{galat}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMemuat(true)
                setVersi((v) => v + 1)
              }}
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {pesan && <p role="status" className="shrink-0 px-4 pt-3 text-sm text-primary">{pesan}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {memuat ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : tampil.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {cari ? "Tidak ada rute yang cocok." : "Semua rute sudah ditugaskan."}
          </p>
        ) : (
          <ul className="divide-y">
            {tampil.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">{r.kode}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.namaSeksi} · {r.target.toLocaleString("id-ID")} sambungan
                  </p>
                </div>
                {bolehUbah && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!petugasId || mengirim !== null}
                    onClick={() => void tugaskan(r.id)}
                  >
                    {mengirim === r.id && <Loader2 className="size-4 animate-spin" />}
                    Tugaskan
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
