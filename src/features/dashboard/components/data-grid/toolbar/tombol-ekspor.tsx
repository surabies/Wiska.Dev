import { HugeiconsIcon } from "@hugeicons/react"
import { FileSpreadsheetIcon } from "@hugeicons/core-free-icons"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroupItem } from "@/components/ui/toggle-group"

/** Tombol ekspor Excel. Harus dirender di dalam <ToggleGroup> toolbar. */
export function TombolEkspor({
  mengekspor,
  nonaktif,
  onKlik,
}: {
  mengekspor: boolean
  nonaktif: boolean
  onKlik: () => void
}) {
  return (
    <ToggleGroupItem
      value="export"
      onClick={onKlik}
      disabled={mengekspor || nonaktif}
      aria-label={mengekspor ? "Menyiapkan ekspor" : "Ekspor ke Excel"}
      title="Unduh seluruh baris (sesuai filter & kolom aktif) sebagai file Excel"
    >
      {mengekspor ? (
        <Spinner className="size-4" />
      ) : (
        <HugeiconsIcon
          icon={FileSpreadsheetIcon}
          strokeWidth={2}
          className="size-4"
          aria-hidden
        />
      )}
    </ToggleGroupItem>
  )
}
