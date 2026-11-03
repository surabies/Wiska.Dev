import * as React from "react"
import type { ColDef } from "ag-grid-community"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpDownIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/Utilitas"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NILAI_KOSONG } from "../lib/KonstantaDataGrid"
import { KELAS_KONTROL } from "../Tema"

/** Urutan di mode kartu — menggantikan kepala kolom yang tidak ada di ponsel. */
export function PemilihUrut({
  kolom,
  nilai,
  onUbah,
}: {
  kolom: ColDef[]
  nilai: string
  onUbah: (nilai: string) => void
}) {
  return (
    <Select
      value={nilai || NILAI_KOSONG}
      onValueChange={(value) => onUbah(value === NILAI_KOSONG ? "" : value)}
    >
      <SelectTrigger
        aria-label="Urutkan"
        size="default"
        className={cn(KELAS_KONTROL, "max-w-48")}
      >
        <HugeiconsIcon
          icon={ArrowUpDownIcon}
          strokeWidth={2}
          className="size-3.5 text-muted-foreground"
          aria-hidden
        />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value={NILAI_KOSONG}>Urutan bawaan</SelectItem>
        {kolom.map((c) => {
          const kunci = c.colId ?? c.field ?? ""
          return (
            <React.Fragment key={kunci}>
              <SelectItem value={`${kunci}:asc`}>{c.headerName} ↑</SelectItem>
              <SelectItem value={`${kunci}:desc`}>{c.headerName} ↓</SelectItem>
            </React.Fragment>
          )
        })}
      </SelectContent>
    </Select>
  )
}
