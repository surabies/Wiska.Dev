import { HugeiconsIcon } from "@hugeicons/react"
import { FilterIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/Utilitas"
import { Button } from "@/components/ui/button"
import { KELAS_KONTROL, KELAS_KONTROL_AKTIF } from "../Tema"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function TombolFilterLanjutan({
  idPanel,
  terbuka,
  jumlah,
  onKlik,
  ringkas = false,
}: {
  idPanel: string
  terbuka: boolean
  jumlah: number
  onKlik: () => void
  ringkas?: boolean
}) {
  const pemicu = (
    <Button
      type="button"
      variant="outline"
      size={ringkas ? "icon" : "default"}
      aria-label={ringkas ? "Filter lainnya" : undefined}
      aria-expanded={terbuka}
      aria-controls={idPanel}
      onClick={onKlik}
      className={cn(
        KELAS_KONTROL,
        ringkas && "relative size-8 justify-center p-0",
        (terbuka || jumlah > 0) && KELAS_KONTROL_AKTIF
      )}
    >
      <HugeiconsIcon
        icon={FilterIcon}
        strokeWidth={2}
        className="size-3.5 text-muted-foreground"
        aria-hidden
      />
      {ringkas ? (
        jumlah > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
            {jumlah}
          </span>
        )
      ) : (
        <>
          <span>Filters</span>
          {jumlah > 0 && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
              {jumlah}
            </span>
          )}
        </>
      )}
    </Button>
  )

  return ringkas ? (
    <Tooltip>
      <TooltipTrigger asChild>{pemicu}</TooltipTrigger>
      <TooltipContent>
        {terbuka ? "Sembunyikan filter lainnya" : "Tampilkan filter lainnya"}
        {jumlah > 0 && ` (${jumlah} aktif)`}
      </TooltipContent>
    </Tooltip>
  ) : (
    pemicu
  )
}
