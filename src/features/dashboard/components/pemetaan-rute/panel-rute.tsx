"use client"

// features/dashboard/components/pemetaan-rute/panel-rute.tsx — panel kanan:
// rute milik petugas terpilih. Murni tampilan: data dan aksinya datang dari
// use-penugasan-rute.ts lewat props.
import type { ReactNode } from "react"
import { ListOrdered, Loader2, MapPin, PlusIcon, Trash2Icon } from "@/components/ui/hugeicons-compat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DaftarSeret } from "./daftar-seret"
import { namaTampil, type BarisRuteSeret, type PencatatBaris } from "./model"

interface PanelRuteProps {
  petugas: PencatatBaris | null
  /** false = hanya melihat: tombol tambah/lepas/urutan disembunyikan. */
  bolehUbah: boolean
  memuat: boolean
  galat: string | null
  rute: BarisRuteSeret[]
  perubahanUrutan: ReadonlyMap<string, number>
  berubah: boolean
  totalTarget: number
  /** true = urutan sedang disimpan; seretan dikunci. */
  menyusun: boolean
  onUrut: (ruteIds: string[]) => void
  onAturPosisi: (ruteId: string, posisiSaatIni: number) => void
  onBatalkanUrutan: () => void
  onSimpanUrutan: () => void
  onTambah: () => void
  onLepas: (rute: BarisRuteSeret) => void
  onUrutPelanggan: (rute: BarisRuteSeret) => void
  className?: string
}

function Tengah({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      {children}
    </div>
  )
}

export function PanelRute({
  petugas,
  bolehUbah,
  memuat,
  galat,
  rute,
  perubahanUrutan,
  berubah,
  totalTarget,
  menyusun,
  onUrut,
  onAturPosisi,
  onBatalkanUrutan,
  onSimpanUrutan,
  onTambah,
  onLepas,
  onUrutPelanggan,
  className,
}: PanelRuteProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col rounded-lg border bg-card shadow-panel", className)}>
      {!petugas ? (
        <Tengah>
          <MapPin className="size-8" />
          <p className="text-sm">Pilih petugas di kiri untuk mengatur rutenya.</p>
        </Tengah>
      ) : (
        <>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{namaTampil(petugas)}</h3>
              <p className="num text-sm text-muted-foreground">
                {rute.length} rute · {totalTarget.toLocaleString("id-ID")} sambungan langganan
              </p>
            </div>
            {bolehUbah && (
              <Button size="sm" onClick={onTambah} disabled={memuat || berubah || menyusun}>
                <PlusIcon className="size-4" /> Tambah rute
              </Button>
            )}
          </div>

          {galat && <p className="shrink-0 px-4 pt-3 text-sm text-destructive">{galat}</p>}
          {berubah && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-primary/5 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Urutan rute masih berupa draf. Nomor <span className="font-medium text-primary">lama → baru</span> ditandai.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBatalkanUrutan} disabled={menyusun}>
                  Batalkan
                </Button>
                <Button size="sm" onClick={onSimpanUrutan} disabled={menyusun}>
                  {menyusun && <Loader2 className="size-4 animate-spin" />}
                  Simpan urutan
                </Button>
              </div>
            </div>
          )}

          {/* Area gulir mengisi sisa tinggi panel (flex-1 min-h-0) — tidak ada
              tinggi yang dipatok, jadi mengikuti layout dashboard. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {memuat ? (
              <Tengah>
                <Loader2 className="size-5 animate-spin" />
              </Tengah>
            ) : rute.length === 0 ? (
              <Tengah>
                <p className="text-sm">
                  Petugas ini belum memegang rute.{bolehUbah && " Klik “Tambah rute”."}
                </p>
              </Tengah>
            ) : (
              <DaftarSeret
                label={`Rute ${namaTampil(petugas)}`}
                items={rute}
                onUrut={onUrut}
                posisiAsal={(r) => perubahanUrutan.get(r.id)}
                nonaktif={!bolehUbah || menyusun}
                tampil={(r) => (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-sm font-medium">{r.kode}</span>
                    {r.namaSeksi && <span className="truncate text-xs text-muted-foreground">{r.namaSeksi}</span>}
                    <Badge variant="outline" className="num ml-1 shrink-0">
                      {r.target} SL
                    </Badge>
                  </div>
                )}
                aksi={
                  bolehUbah
                    ? (r, indeks) => (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            title={`Atur posisi rute ${r.kode}`}
                            aria-label={`Atur posisi rute ${r.kode}`}
                            disabled={menyusun}
                            onClick={() => onAturPosisi(r.id, indeks + 1)}
                          >
                            Posisi
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Atur urutan pelanggan"
                            aria-label={`Atur urutan pelanggan rute ${r.kode}`}
                            onClick={() => onUrutPelanggan(r)}
                          >
                            <ListOrdered className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            title="Lepas rute"
                            aria-label={`Lepas rute ${r.kode}`}
                            disabled={menyusun || berubah}
                            onClick={() => onLepas(r)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      )
                    : undefined
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
