import type { ColDef } from "ag-grid-community"
import { HugeiconsIcon } from "@hugeicons/react"
import { Columns3CogIcon } from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroupItem } from "@/components/ui/toggle-group"
import { kunciKolom } from "../nilai-sel"

/** Picker kolom tampil. Harus dirender di dalam <ToggleGroup> toolbar. */
export function PemilihKolom({
  kolom,
  sembunyi,
  onUbah,
}: {
  kolom: ColDef[]
  sembunyi: Set<string>
  onUbah: (kunci: string, tampil: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToggleGroupItem
          value="columns"
          aria-label={
            sembunyi.size > 0
              ? `Pilih kolom; ${sembunyi.size} kolom disembunyikan`
              : "Pilih kolom yang ditampilkan"
          }
          title="Pilih kolom yang ditampilkan"
        >
          <HugeiconsIcon
            icon={Columns3CogIcon}
            strokeWidth={2}
            className="size-4"
            aria-hidden
          />
        </ToggleGroupItem>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-56 overflow-y-auto shadow-overlay"
      >
        <DropdownMenuLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Kolom tampil
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {kolom
          .filter((c) => c.headerName)
          .map((c) => {
            const kunci = kunciKolom(c)
            return (
              <DropdownMenuCheckboxItem
                key={kunci}
                checked={!sembunyi.has(kunci)}
                // preventDefault: menu tetap terbuka agar bisa
                // mencentang beberapa kolom sekaligus.
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(tampil) => onUbah(kunci, tampil)}
              >
                {c.headerName}
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
