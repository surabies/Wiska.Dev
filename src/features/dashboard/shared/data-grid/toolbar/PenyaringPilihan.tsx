import { useState, type ReactNode } from "react"
import { cn } from "@/lib/Utilitas"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NILAI_KOSONG } from "../lib/KonstantaDataGrid"
import { KELAS_KONTROL, KELAS_KONTROL_AKTIF } from "../Tema"
import type { FilterSelect } from "../types/TipeDataGrid"

/** Select satu penyaring. Labelnya jadi awalan di dalam tombol ("Status Semua")
 *  sehingga tidak perlu item "Status: semua" dan baris tetap ringkas. */
export function FilterPilihan({
  filter,
  nilai,
  onUbah,
  ikon,
  labelIkonSaja = false,
  ringkas = false,
}: {
  filter: FilterSelect
  nilai: string
  onUbah: (nilai: string) => void
  ikon?: ReactNode
  labelIkonSaja?: boolean
  ringkas?: boolean
}) {
  const pilihanAktif = filter.opsi.find((opsi) => opsi.value === nilai)?.label
  const [terbuka, setTerbuka] = useState(false)

  if (ringkas) {
    return (
      <Popover open={terbuka} onOpenChange={setTerbuka}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`${filter.label}: ${pilihanAktif ?? "Semua"}`}
                aria-expanded={terbuka}
                className={cn(
                  KELAS_KONTROL,
                  "relative size-8 justify-center p-0",
                  nilai && KELAS_KONTROL_AKTIF
                )}
              >
                {ikon}
                <span className="sr-only">{filter.label}</span>
                {nilai && (
                  <span
                    aria-hidden
                    className="absolute right-1 bottom-1 size-1 rounded-full bg-primary"
                  />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {filter.label}: {pilihanAktif ?? "Semua"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-56 p-1">
          <div className="flex flex-col gap-0.5">
            {[{ value: "", label: "Semua" }, ...filter.opsi].map((opsi) => (
              <Button
                key={opsi.value || "semua"}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={nilai === opsi.value}
                className={cn(
                  "justify-start font-normal",
                  nilai === opsi.value && "bg-accent"
                )}
                onClick={() => {
                  onUbah(opsi.value)
                  setTerbuka(false)
                }}
              >
                {opsi.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const pemicu = (
    <SelectTrigger
      aria-label={filter.label}
      size="sm"
      className={cn(
        KELAS_KONTROL,
        "max-w-48 data-[state=open]:border-ring/60",
        nilai && KELAS_KONTROL_AKTIF
      )}
    >
      {labelIkonSaja ? (
        <span className="shrink-0">{ikon}</span>
      ) : (
        <span className="shrink-0 text-muted-foreground">{filter.label}</span>
      )}
      <SelectValue className="font-medium" />
    </SelectTrigger>
  )

  return (
    <Select
      value={nilai || NILAI_KOSONG}
      onValueChange={(value) => onUbah(value === NILAI_KOSONG ? "" : value)}
    >
      {pemicu}
      <SelectContent position="popper" align="start">
        <SelectItem value={NILAI_KOSONG}>Semua</SelectItem>
        {filter.opsi.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
