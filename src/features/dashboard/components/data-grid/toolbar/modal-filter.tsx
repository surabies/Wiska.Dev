"use client"

// features/dashboard/components/data-grid/toolbar/modal-filter.tsx — semua
// penyaring DataGrid (dropdown + rentang tanggal) dalam satu modal.
import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FilterSelect } from "../tipe"

export interface FilterTanggalModal {
  paramDari: string
  paramSampai: string
  label: string
}

const SEMUA = "__semua__"

export function hitungFilterAktif(
  filters: FilterSelect[],
  filterTanggal: FilterTanggalModal | undefined,
  nilai: Record<string, string>
) {
  const dropdown = filters.filter((f) => nilai[f.param]).length
  const tanggal =
    filterTanggal && (nilai[filterTanggal.paramDari] || nilai[filterTanggal.paramSampai])
      ? 1
      : 0
  return dropdown + tanggal
}

export function ModalFilter({
  onBuka,
  filters,
  filterTanggal,
  nilai,
  onTerapkan,
}: {
  onBuka: (v: boolean) => void
  filters: FilterSelect[]
  filterTanggal?: FilterTanggalModal
  nilai: Record<string, string>
  /** Menerima seluruh nilai draft; param kosong = tanpa filter. */
  onTerapkan: (patch: Record<string, string>) => void
}) {
  const [draft, setDraft] = React.useState<Record<string, string>>(() => ({ ...nilai }))

  const ubah = (param: string, v: string) => setDraft((d) => ({ ...d, [param]: v }))
  const jumlah = hitungFilterAktif(filters, filterTanggal, draft)

  function terapkan() {
    const patch: Record<string, string> = {}
    for (const f of filters) patch[f.param] = draft[f.param] ?? ""
    if (filterTanggal) {
      patch[filterTanggal.paramDari] = draft[filterTanggal.paramDari] ?? ""
      patch[filterTanggal.paramSampai] = draft[filterTanggal.paramSampai] ?? ""
    }
    onTerapkan(patch)
    onBuka(false)
  }

  function aturUlang() {
    const kosong: Record<string, string> = {}
    for (const f of filters) kosong[f.param] = ""
    if (filterTanggal) {
      kosong[filterTanggal.paramDari] = ""
      kosong[filterTanggal.paramSampai] = ""
    }
    setDraft(kosong)
  }

  return (
    <Dialog open onOpenChange={onBuka}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">Filter Data</DialogTitle>
          <DialogDescription className="sr-only">Pilih kriteria untuk menyaring tabel.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-10 gap-y-4 py-2 md:grid-cols-2">
          {filters.map((f) => (
            <div key={f.param} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-3">
              <Label htmlFor={`filter-${f.param}`} className="text-sm font-normal">
                {f.label}
              </Label>
              <Select
                value={draft[f.param] || SEMUA}
                onValueChange={(v) => ubah(f.param, v === SEMUA ? "" : v)}
              >
                <SelectTrigger id={`filter-${f.param}`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA}>Semua</SelectItem>
                  {f.opsi.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {filterTanggal && (
            <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-3 border-t border-border/70 pt-4 md:col-span-2">
              <Label className="text-sm font-normal">{filterTanggal.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="h-9"
                  value={draft[filterTanggal.paramDari] ?? ""}
                  onChange={(e) => ubah(filterTanggal.paramDari, e.target.value)}
                  aria-label={`${filterTanggal.label} dari`}
                />
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">
                  s/d
                </span>
                <Input
                  type="date"
                  className="h-9"
                  value={draft[filterTanggal.paramSampai] ?? ""}
                  onChange={(e) => ubah(filterTanggal.paramSampai, e.target.value)}
                  aria-label={`${filterTanggal.label} sampai`}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={aturUlang}>
            Atur ulang
          </Button>
          <Button className="h-9 min-w-36" onClick={terapkan}>
            Terapkan{jumlah > 0 ? ` (${jumlah})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}