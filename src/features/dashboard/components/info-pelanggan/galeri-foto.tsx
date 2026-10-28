"use client"

// Foto lapangan: tiga kotak persegi sama besar (stand meter, segel, rumah),
// sama dengan PDF. Klik membuka lightbox dengan navigasi antar foto (juga
// tombol panah keyboard).
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type ItemFoto = { label: string; src: string | null }

function Gambar({ item, onBuka }: { item: ItemFoto; onBuka: () => void }) {
  const [gagal, setGagal] = React.useState(false)
  const ada = item.src && !gagal

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      {ada ? (
        <button
          type="button"
          onClick={onBuka}
          aria-label={`Perbesar foto ${item.label}`}
          className="overflow-hidden rounded-lg border border-border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src!}
            alt={`Foto ${item.label}`}
            loading="lazy"
            onError={() => setGagal(true)}
            className="aspect-square w-full cursor-zoom-in object-cover"
          />
        </button>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          {gagal ? "Foto gagal dimuat" : "Foto tidak dikirim"}
        </div>
      )}
      <figcaption className="text-sm text-muted-foreground">{item.label}</figcaption>
    </figure>
  )
}

export function GaleriFoto({
  foto,
}: {
  foto: { stand: string | null; segel: string | null; rumah: string | null }
}) {
  const semua: ItemFoto[] = [
    { label: "Stand meter", src: foto.stand },
    { label: "Segel", src: foto.segel },
    { label: "Rumah", src: foto.rumah },
  ]
  const tersedia = semua.filter((f) => f.src)
  const [indeks, setIndeks] = React.useState<number | null>(null)

  const geser = React.useCallback(
    (arah: 1 | -1) =>
      setIndeks((i) =>
        i === null ? i : (i + arah + tersedia.length) % tersedia.length
      ),
    [tersedia.length]
  )

  React.useEffect(() => {
    if (indeks === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") geser(1)
      if (e.key === "ArrowLeft") geser(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [indeks, geser])

  const aktif = indeks === null ? null : tersedia[indeks]

  return (
    <section aria-label="Foto lapangan" className="flex min-w-0 flex-col gap-3">
      <h2 className="text-sm font-semibold">Foto lapangan</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {semua.map((item) => (
          <Gambar
            key={item.label}
            item={item}
            onBuka={() => setIndeks(tersedia.findIndex((f) => f.src === item.src))}
          />
        ))}
      </div>

      <Dialog open={aktif !== null} onOpenChange={(o) => !o && setIndeks(null)}>
        <DialogContent className="max-w-4xl gap-3">
          <DialogTitle className="text-sm font-medium">
            {aktif?.label}
            {tersedia.length > 1 && indeks !== null && (
              <span className="ml-2 font-normal text-muted-foreground">
                {indeks + 1} dari {tersedia.length}
              </span>
            )}
          </DialogTitle>
          {aktif?.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={aktif.src}
              alt={`Foto ${aktif.label}`}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
          {tersedia.length > 1 && (
            <div className="flex justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => geser(-1)}>
                Sebelumnya
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => geser(1)}>
                Berikutnya
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
