"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon } from "@hugeicons/core-free-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPeriode } from "@/features/public/lib/Format"
import type { RingkasanDrd } from "../types/TipeDrd"

export function BilahDrd({
  periodes,
  periode,
  ringkasan,
  memuat,
  onGanti,
}: {
  periodes: number[]
  periode: number | null
  ringkasan: RingkasanDrd | null
  memuat: boolean
  onGanti: (periode: number) => void
}) {
  return (
    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">
      <Select
        value={periode === null ? "" : String(periode)}
        onValueChange={(nilai) => onGanti(Number(nilai))}
        disabled={periodes.length === 0}
      >
        <SelectTrigger
          size="lg"
          aria-label="Periode tagihan"
          className="min-w-48 gap-2"
        >
          <HugeiconsIcon
            icon={Calendar03Icon}
            strokeWidth={2}
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
          <SelectValue placeholder="Pilih periode" />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {periodes.map((item) => (
            <SelectItem key={item} value={String(item)}>
              {formatPeriode(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {ringkasan && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {memuat ? "Memuat data periode" : "Data tagihan tersimpan"}
        </span>
      )}
    </div>
  )
}
