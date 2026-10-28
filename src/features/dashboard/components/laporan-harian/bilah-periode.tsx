import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon } from "@hugeicons/core-free-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPeriode } from "@/features/public/lib/format"
import { tanggalPendek } from "./format"
import type { Progres } from "./tipe"

export function BilahPeriode({
  periodes,
  periode,
  onGanti,
  data,
}: {
  periodes: number[]
  periode: number | null
  onGanti: (p: number) => void
  data: Progres | null
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border pb-3">
      <Select value={periode === null ? "" : String(periode)} onValueChange={(v) => onGanti(Number(v))}>
        <SelectTrigger size="sm" aria-label="Periode" className="h-8 min-w-44 gap-2">
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" aria-hidden />
          <SelectValue placeholder="Pilih periode" />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {periodes.map((p) => (
            <SelectItem key={p} value={String(p)}>{formatPeriode(p)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {data?.tanggalAcuan && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Setoran terakhir masuk
          <span className="font-medium text-foreground">{tanggalPendek(data.tanggalAcuan)}</span>
        </span>
      )}

      {data && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {data.pencatat.length} petugas · {data.tanggal.length} hari
        </span>
      )}
    </div>
  )
}
