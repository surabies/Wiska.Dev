import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { KELAS_INPUT_TOOLBAR } from "../kelas-kontrol"

export function KotakCari({
  nilai,
  onUbah,
  placeholder,
}: {
  nilai: string
  onUbah: (nilai: string) => void
  placeholder: string
}) {
  return (
    <div
      role="search"
      className="relative w-full min-w-0 sm:w-64 lg:w-auto lg:max-w-72 lg:min-w-44 lg:flex-1"
    >
      <HugeiconsIcon
        icon={Search01Icon}
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      {/* Tinggi, radius, bingkai, dan huruf datang dari KELAS_INPUT_TOOLBAR —
          dasar yang sama dengan select di sebelahnya (lihat kelas-kontrol.ts).
          KELAS_ISIAN dari kontrol.ts tidak dipakai lagi di sini. */}
      <Input
        type="search"
        name="cari-grid"
        autoComplete="off"
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder={placeholder}
        className={cn(KELAS_INPUT_TOOLBAR, "w-full pl-8")}
        aria-label="Cari"
      />
    </div>
  )
}