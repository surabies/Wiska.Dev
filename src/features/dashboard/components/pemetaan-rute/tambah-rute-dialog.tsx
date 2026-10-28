"use client"

// Dialog pemilih rute untuk ditugaskan ke seorang pencatat. Cari rute
// (GET /rute?q=), rute yang SUDAH ditugaskan ke pencatat ini disaring keluar
// (rute yang sama boleh dipegang pencatat LAIN — itu fitur berbagi). Klik =
// tugaskan (POST /penugasan-rute), lalu tutup.
import * as React from "react"
import { Loader2, Search } from "@/components/ui/hugeicons-compat"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ambilList, ApiError } from "../../lib/api-client"

interface RuteBaris {
  id: string
  kode: string
  seksiCater?: { nama: string | null } | null
}

export function TambahRuteDialog({
  namaPencatat,
  ruteTerpakai,
  onPilih,
  onTutup,
}: {
  namaPencatat: string
  /** ruteId yang sudah ditugaskan ke pencatat ini — disaring dari daftar. */
  ruteTerpakai: ReadonlySet<string>
  /** Melempar galat bila server menolak; pesannya tampil di dialog ini. */
  onPilih: (ruteId: string) => Promise<void>
  onTutup: () => void
}) {
  const [cari, setCari] = React.useState("")
  const [hasil, setHasil] = React.useState<RuteBaris[]>([])
  const [memuat, setMemuat] = React.useState(true)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [mengirim, setMengirim] = React.useState<string | null>(null)

  // Penyaringan `ruteTerpakai` dilakukan saat render, BUKAN di effect: dulu
  // Set itu ada di deps, dan induk membuat Set baru tiap render → daftar rute
  // diambil ulang setiap induk render ulang.
  const tampil = React.useMemo(() => hasil.filter((r) => !ruteTerpakai.has(r.id)), [hasil, ruteTerpakai])

  React.useEffect(() => {
    let batal = false
    // setState di dalam callback timer (bukan badan effect sinkron) — sesuai
    // aturan lint react-hooks/set-state-in-effect.
    const t = setTimeout(() => {
      if (batal) return
      setMemuat(true)
      ambilList<RuteBaris>("/rute", { q: cari || undefined, pageSize: 50 })
        .then(({ rows }) => {
          if (batal) return
          setHasil(rows)
          setGalat(null)
        })
        .catch((e) => {
          if (!batal) setGalat(e instanceof ApiError ? e.message : "Gagal memuat rute.")
        })
        .finally(() => {
          if (!batal) setMemuat(false)
        })
    }, 250)
    return () => {
      batal = true
      clearTimeout(t)
    }
  }, [cari])

  async function tugaskan(ruteId: string) {
    if (mengirim !== null) return
    setMengirim(ruteId)
    setGalat(null)
    try {
      await onPilih(ruteId)
      onTutup()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menugaskan rute.")
      setMengirim(null)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(buka) => {
        // Tidak bisa ditutup saat penugasan sedang dikirim.
        if (!buka && mengirim === null) onTutup()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah rute untuk {namaPencatat}</DialogTitle>
          <DialogDescription>Pilih rute yang akan ditugaskan. Rute boleh juga dipegang petugas lain.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoComplete="off"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari kode rute…"
            className="pl-8"
            autoFocus
          />
        </div>
        {galat && <p className="text-sm text-destructive">{galat}</p>}
        <ScrollArea className="h-72 rounded-lg border">
          {memuat ? (
            <div className="flex h-72 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : tampil.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Tidak ada rute yang cocok / semua sudah ditugaskan.</p>
          ) : (
            <ul className="divide-y">
              {tampil.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={mengirim !== null}
                    onClick={() => void tugaskan(r.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 disabled:opacity-50"
                  >
                    <span>
                      <span className="font-mono font-medium">{r.kode}</span>
                      {r.seksiCater?.nama && <span className="ml-2 text-muted-foreground">{r.seksiCater.nama}</span>}
                    </span>
                    {mengirim === r.id && <Loader2 className="size-4 animate-spin" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
