import { cn } from "@/lib/Utilitas"
import { GAYA_STATUS } from "./Konstanta"
import type { Status } from "../types/TipeLaporanHarian"

export function LencanaStatus({ status }: { status: Status }) {
  const g = GAYA_STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      <span className={cn("size-1.5 rounded-full", g.titik)} />
      {g.label}
    </span>
  )
}
