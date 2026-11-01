"use client"

// GaleriFoto menampilkan foto lapangan dalam tiga kotak persegi (stand meter, segel, rumah),
// sama dengan PDF. Klik membuka lightbox dengan navigasi antar foto (juga
// tombol panah keyboard).
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PanelDasbor } from "../../shared/PanelDasbor"

type ItemFoto = { label: string; src: string; contoh: boolean }

const FOTO_UJI_TAMPILAN = "/images/meter/mock.png"

function Gambar({ item, onBuka }: { item: ItemFoto; onBuka: () => void }) {
  const [gagal, setGagal] = React.useState(false)
  const ada = item.src && !gagal

  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
      {ada ? (
        <button
          type="button"
          onClick={onBuka}
          aria-label={`Perbesar ${item.contoh ? "contoh tampilan foto" : "foto"} ${item.label}`}
          className="group relative block aspect-3/4 w-full overflow-hidden bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={`${item.contoh ? "Contoh tampilan" : "Foto"} ${item.label}`}
            loading="lazy"
            onError={() => setGagal(true)}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <div className="flex aspect-3/4 w-full items-center justify-center bg-muted/20 text-sm text-muted-foreground">
          {gagal ? "Foto gagal dimuat" : "Foto tidak dikirim"}
        </div>
      )}
      <figcaption className="border-t border-border px-3 py-2.5 text-center text-sm font-medium text-foreground">
        {item.label}
      </figcaption>
    </figure>
  )
}

export function GaleriFoto({
  foto,
}: {
  foto: { stand: string | null; segel: string | null; rumah: string | null }
}) {
  const semua: ItemFoto[] = [
    {
      label: "Stand meter",
      src: foto.stand || FOTO_UJI_TAMPILAN,
      contoh: !foto.stand,
    },
    {
      label: "Segel",
      src: foto.segel || FOTO_UJI_TAMPILAN,
      contoh: !foto.segel,
    },
    {
      label: "Rumah",
      src: foto.rumah || FOTO_UJI_TAMPILAN,
      contoh: !foto.rumah,
    },
  ]
  const tersedia = semua
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
    <>
      <PanelDasbor label="Foto lapangan" className="min-w-0">
        <div className="grid gap-4 sm:grid-cols-3">
          {semua.map((item, index) => (
            <Gambar
              key={item.label}
              item={item}
              onBuka={() => setIndeks(index)}
            />
          ))}
        </div>
      </PanelDasbor>

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
              alt={`${aktif.contoh ? "Contoh tampilan" : "Foto"} ${aktif.label}`}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
          {tersedia.length > 1 && (
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => geser(-1)}
              >
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => geser(1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
