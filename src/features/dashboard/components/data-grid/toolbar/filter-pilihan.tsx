import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NILAI_KOSONG } from "../konstanta"
import { KELAS_KONTROL, KELAS_KONTROL_AKTIF } from "../tema"
import type { FilterSelect } from "../tipe"

/** Select satu penyaring. Labelnya jadi awalan di dalam tombol ("Status Semua")
 *  sehingga tidak perlu item "Status: semua" dan baris tetap ringkas. */
export function FilterPilihan({
  filter,
  nilai,
  onUbah,
}: {
  filter: FilterSelect
  nilai: string
  onUbah: (nilai: string) => void
}) {
  return (
    <Select
      value={nilai || NILAI_KOSONG}
      onValueChange={(value) => onUbah(value === NILAI_KOSONG ? "" : value)}
    >
      <SelectTrigger
        aria-label={filter.label}
        size="sm"
        className={cn(
          KELAS_KONTROL,
          "max-w-48 data-[state=open]:border-ring/60",
          nilai && KELAS_KONTROL_AKTIF
        )}
      >
        <span className="shrink-0 text-muted-foreground">{filter.label}</span>
        <SelectValue className="font-medium" />
      </SelectTrigger>
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
