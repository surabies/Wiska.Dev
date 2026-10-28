import { HugeiconsIcon } from "@hugeicons/react"
import { FilterIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { KELAS_KONTROL, KELAS_KONTROL_AKTIF } from "../tema"

export function TombolFilterLanjutan({
  idPanel,
  terbuka,
  jumlah,
  onKlik,
}: {
  idPanel: string
  terbuka: boolean
  jumlah: number
  onKlik: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-expanded={terbuka}
      aria-controls={idPanel}
      onClick={onKlik}
      className={cn(
        KELAS_KONTROL,
        (terbuka || jumlah > 0) && KELAS_KONTROL_AKTIF
      )}
    >
      <HugeiconsIcon
        icon={FilterIcon}
        strokeWidth={2}
        className="size-3.5 text-muted-foreground"
        aria-hidden
      />
      <span>Filters</span>
      {jumlah > 0 && (
        <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background">
          {jumlah}
        </span>
      )}
    </Button>
  )
}
