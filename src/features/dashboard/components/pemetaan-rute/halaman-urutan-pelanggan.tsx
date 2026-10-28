"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  GripVerticalIcon,
  Loader2,
  ListOrdered,
  Search,
} from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DialogAturPosisi } from "./dialog-atur-posisi"
import { useUrutanPelanggan } from "./use-urutan-pelanggan"

const TINGGI_BARIS = 68
const BUFFER_BARIS = 5

export function HalamanUrutanPelanggan({
  ruteId,
  kodeRute,
  bolehUbah,
}: {
  ruteId: string
  kodeRute: string
  bolehUbah: boolean
}) {
  const u = useUrutanPelanggan(ruteId)
  const areaRef = React.useRef<HTMLDivElement>(null)
  const dragIdRef = React.useRef<string | null>(null)
  const [cari, setCari] = React.useState("")
  const [posisiGulir, setPosisiGulir] = React.useState(0)
  const [tinggiArea, setTinggiArea] = React.useState(480)
  const [posisiPelanggan, setPosisiPelanggan] = React.useState<{
    id: string
    nama: string
    posisi: number
  } | null>(null)

  React.useEffect(() => {
    if (!u.berubah) return
    const cegahTutup = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", cegahTutup)
    return () => window.removeEventListener("beforeunload", cegahTutup)
  }, [u.berubah])

  const tampil = React.useMemo(() => {
    const q = cari.trim().toLocaleLowerCase("id-ID")
    if (!q) return u.items.map((item, indeks) => ({ item, indeks }))
    return u.items.flatMap((item, indeks) =>
      `${item.nomorLangganan} ${item.nama}`.toLocaleLowerCase("id-ID").includes(q)
        ? [{ item, indeks }]
        : [],
    )
  }, [cari, u.items])

  React.useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const pengamat = new ResizeObserver(() => setTinggiArea(area.clientHeight))
    pengamat.observe(area)
    return () => pengamat.disconnect()
  }, [u.memuat, tampil.length])

  const awal = Math.max(0, Math.floor(posisiGulir / TINGGI_BARIS) - BUFFER_BARIS)
  const akhir = Math.min(
    tampil.length,
    Math.ceil((tinggiArea + posisiGulir) / TINGGI_BARIS) +
      BUFFER_BARIS,
  )

  function jatuhkan(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    const asalId = dragIdRef.current
    if (asalId) u.pindah(asalId, targetId)
    dragIdRef.current = null
  }

  return (
    <section
      aria-label={`Urutan pelanggan rute ${kodeRute}`}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-panel"
    >
      <header className="flex shrink-0 flex-col gap-5 border-b border-border-subtle p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Penataan rute
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Urutan kunjungan
              </h1>
              <span className="font-mono text-sm font-medium text-muted-foreground">
                {kodeRute}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Seret pelanggan atau gunakan tombol panah untuk mengubah urutannya.
            </p>
          </div>
          <Button
            className="shrink-0"
            onClick={() => void u.simpan()}
            disabled={!bolehUbah || !u.berubah || u.menyimpan || u.memuat || u.items.length === 0}
          >
            {u.menyimpan && <Loader2 className="size-4 animate-spin" />}
            Simpan urutan
          </Button>
        </div>

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative w-full max-w-full sm:w-[22.5rem] sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={cari}
              onChange={(e) => {
                setCari(e.target.value)
                setPosisiGulir(0)
                if (areaRef.current) areaRef.current.scrollTop = 0
              }}
              placeholder="Cari nomor sambungan atau nama…"
              aria-label="Cari pelanggan dalam rute"
              className="pl-8"
            />
          </div>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
            {cari ? `${tampil.length.toLocaleString("id-ID")} hasil dari ` : ""}
            <span className="font-medium text-foreground">
              {(u.total ?? 0).toLocaleString("id-ID")}
            </span>{" "}
            pelanggan dalam rute
          </p>
        </div>

        {u.berubah && (
          <Alert>
            <AlertDescription>
              Perubahan urutan belum disimpan. Baris yang berubah menampilkan posisi lama → baru.
              Urutan ini berlaku untuk semua petugas yang memegang rute.
            </AlertDescription>
          </Alert>
        )}
        {!bolehUbah && (
          <p className="text-sm text-muted-foreground">
            Anda hanya memiliki akses untuk melihat urutan pelanggan.
          </p>
        )}
        {u.galat && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{u.galat}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (
                    u.berubah &&
                    !window.confirm("Buang perubahan urutan yang belum disimpan?")
                  ) {
                    return
                  }
                  u.muatUlang()
                }}
                disabled={u.memuat}
              >
                Muat ulang
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </header>

      <div className="min-h-0 flex-1 p-3 sm:p-4">
        {u.memuat ? (
          <div className="flex h-full min-h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="ml-2 text-sm">Memuat daftar pelanggan…</span>
          </div>
        ) : u.items.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
            Rute ini belum memiliki pelanggan aktif.
          </div>
        ) : tampil.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
            Tidak ada pelanggan yang cocok dengan pencarian.
          </div>
        ) : (
          <div
            ref={areaRef}
            onScroll={(e) => setPosisiGulir(e.currentTarget.scrollTop)}
            className="h-full overflow-y-auto overscroll-contain rounded-md border"
            aria-label="Daftar pelanggan terurut"
          >
            <ol className="m-0 list-none p-2">
              <li aria-hidden style={{ height: awal * TINGGI_BARIS }} />
              {tampil.slice(awal, akhir).map(({ item, indeks }) => (
                <li
                  key={item.id}
                  draggable={bolehUbah && !u.menyimpan}
                  onDragStart={(e) => {
                    dragIdRef.current = item.id
                    e.dataTransfer.effectAllowed = "move"
                    e.dataTransfer.setData("text/plain", item.id)
                  }}
                  onDragOver={(e) => {
                    if (bolehUbah && !u.menyimpan) e.preventDefault()
                  }}
                  onDrop={(e) => jatuhkan(e, item.id)}
                  onDragEnd={() => {
                    dragIdRef.current = null
                  }}
                  className={`flex h-[68px] items-center gap-3 border-b px-3 last:border-b-0 ${
                    u.posisiAwal.get(item.id) !== indeks + 1 ? "bg-primary/[0.04]" : "bg-card"
                  }`}
                >
                  <span className="flex w-10 shrink-0 flex-col items-end text-right font-mono text-sm tabular-nums">
                    <span aria-label={`Urutan ${indeks + 1}`} className="text-foreground">
                      {indeks + 1}
                    </span>
                    {u.posisiAwal.get(item.id) !== indeks + 1 && (
                      <span className="whitespace-nowrap text-[9px] leading-3 text-primary">
                        {u.posisiAwal.get(item.id)} → {indeks + 1}
                      </span>
                    )}
                  </span>
                  <GripVerticalIcon
                    aria-hidden
                    className={`size-4 shrink-0 text-muted-foreground ${bolehUbah ? "cursor-grab" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.nama}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.nomorLangganan}</p>
                  </div>
                  {bolehUbah && (
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Atur posisi langsung"
                        aria-label={`Atur posisi ${item.nama}`}
                        disabled={u.menyimpan}
                        onClick={() =>
                          setPosisiPelanggan({
                            id: item.id,
                            nama: item.nama,
                            posisi: indeks + 1,
                          })
                        }
                      >
                        <ListOrdered className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Naikkan satu urutan"
                        aria-label={`Naikkan ${item.nama} satu urutan`}
                        disabled={indeks === 0 || u.menyimpan}
                        onClick={() => u.pindahSatu(indeks, -1)}
                      >
                        <ChevronDownIcon className="size-4 rotate-180" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Turunkan satu urutan"
                        aria-label={`Turunkan ${item.nama} satu urutan`}
                        disabled={indeks === u.items.length - 1 || u.menyimpan}
                        onClick={() => u.pindahSatu(indeks, 1)}
                      >
                        <ChevronDownIcon className="size-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
              <li aria-hidden style={{ height: Math.max(0, tampil.length - akhir) * TINGGI_BARIS }} />
            </ol>
          </div>
        )}
      </div>
      {posisiPelanggan && (
        <DialogAturPosisi
          jenis="pelanggan"
          namaItem={posisiPelanggan.nama}
          posisiSaatIni={posisiPelanggan.posisi}
          jumlah={u.items.length}
          onTutup={() => setPosisiPelanggan(null)}
          onTerapkan={(posisi) => {
            u.aturPosisi(posisiPelanggan.id, posisi)
            setPosisiPelanggan(null)
          }}
        />
      )}
    </section>
  )
}
