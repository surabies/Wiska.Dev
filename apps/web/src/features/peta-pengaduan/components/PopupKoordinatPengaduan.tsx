import { Globe, MapPin, X } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import type { TitikDraft } from "../types/TipePengaduan"

interface Props {
  draft: TitikDraft
  onBuat: () => void
  onTutup: () => void
}

export function PopupKoordinatPengaduan({ draft, onBuat, onTutup }: Props) {
  return (
    <div className="relative flex w-72 flex-col gap-2 p-3">
      <button
        type="button"
        onClick={onTutup}
        aria-label="Tutup"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-2 pr-6 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="font-medium">
          {draft.memuat ? "Mencari alamat…" : `Sekitar ${draft.alamat ?? "lokasi ini"}`}
        </p>
      </div>

      <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Globe className="size-3.5" aria-hidden />
        {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
      </p>

      <Button onClick={onBuat} disabled={draft.memuat} className="mt-1 w-full">
        Buat pengaduan
      </Button>
      <p className="text-center text-xs text-muted-foreground">Terbuka di formulir pengaduan</p>
    </div>
  )
}
