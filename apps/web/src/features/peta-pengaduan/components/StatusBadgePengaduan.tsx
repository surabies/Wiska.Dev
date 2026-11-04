import type * as React from "react"
import {
  BadgeCheck,
  Clock,
  ShieldCheck,
  Wrench,
} from "@/components/ui/hugeicons-compat"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/Utilitas"
import { STATUS_META } from "../lib/KonstantaPengaduan"
import type { StatusPengaduan } from "../types/TipePengaduan"

export const IKON_STATUS: Record<StatusPengaduan, React.ComponentType<{ className?: string }>> = {
  baru: Clock,
  terverifikasi: BadgeCheck,
  diproses: Wrench,
  selesai: ShieldCheck,
}

export function StatusBadge({ status }: { status: StatusPengaduan }) {
  const meta = STATUS_META[status]
  const Ikon = IKON_STATUS[status]
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent", meta.badge)}>
      {meta.label}
      <Ikon className="size-3" aria-hidden />
    </Badge>
  )
}
