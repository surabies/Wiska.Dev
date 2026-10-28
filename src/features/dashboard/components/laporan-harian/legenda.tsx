import { cn } from "@/lib/utils"
import { GAYA_HARI, URUTAN_JENIS } from "./konstanta"

export function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      {URUTAN_JENIS.map((j) => (
        <span key={j} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", GAYA_HARI[j].titik)} />
          {GAYA_HARI[j].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-red-500/30" />
        Tidak menyetor di hari kerja
      </span>
    </div>
  )
}
