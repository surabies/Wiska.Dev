import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NILAI_KOSONG, OPERATOR_TEKS } from "./konstanta"
import { KELAS_KONTROL, KELAS_KONTROL_PANEL } from "./tema"
import type {
  BarisFilterLanjutan,
  FilterLanjutanField,
  OperatorFilterLanjutan,
} from "./tipe"

/** Panel filter lanjutan: tiap baris = "where/and  <kolom> <operator> <nilai>".
 *  Di layar lega barisnya memakai subgrid agar kolom-kolomnya lurus. */
export function PanelFilterLanjutan({
  id,
  fields,
  baris,
  penuh,
  onTambah,
  onUbah,
  onHapus,
  onBersihkan,
}: {
  id: string
  fields: FilterLanjutanField[]
  baris: BarisFilterLanjutan[]
  penuh: boolean
  onTambah: () => void
  onUbah: (
    id: number,
    perubahan: Partial<Omit<BarisFilterLanjutan, "id">>
  ) => void
  onHapus: (id: number) => void
  onBersihkan: () => void
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label="Filter lanjutan"
      className="flex shrink-0 flex-col gap-3 border-b border-border-subtle bg-background px-3 py-3 sm:flex-row sm:items-start sm:gap-0 sm:px-4"
    >
      <ul className="min-w-0 space-y-2 sm:grid sm:w-fit sm:flex-none sm:grid-cols-[3.5rem_auto_auto_minmax(8rem,auto)_1.75rem] sm:gap-x-2 sm:gap-y-2 sm:space-y-0">
        {baris.map((row, index) => {
          const field = fields.find((item) => item.id === row.fieldId)
          if (!field) return null
          const fieldsTersedia = fields.filter(
            (item) =>
              item.id === row.fieldId ||
              !baris.some((lain) => lain.fieldId === item.id)
          )
          const operators =
            field.operator ??
            (field.type === "select"
              ? [{ value: "equals" as const, label: "sama dengan" }]
              : OPERATOR_TEKS)

          return (
            <li
              key={row.id}
              className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_1.75rem] items-center gap-2 sm:col-span-5 sm:grid-cols-subgrid"
            >
              <span className="inline-flex h-7 w-full items-center justify-center rounded-md bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
                {index === 0 ? "where" : "and"}
              </span>

              <Select
                value={row.fieldId}
                onValueChange={(fieldId) => {
                  if (!fields.some((item) => item.id === fieldId)) return
                  onUbah(row.id, { fieldId, operator: "equals", value: "" })
                }}
              >
                <SelectTrigger
                  aria-label="Kolom filter"
                  size="sm"
                  className={cn(
                    "col-start-2 w-full sm:col-auto",
                    KELAS_KONTROL_PANEL
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  {fieldsTersedia.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={row.operator}
                onValueChange={(operator) =>
                  onUbah(row.id, {
                    operator: operator as OperatorFilterLanjutan,
                  })
                }
              >
                <SelectTrigger
                  aria-label="Operator filter"
                  size="sm"
                  className={cn(
                    "col-span-2 col-start-2 w-full sm:col-span-1",
                    KELAS_KONTROL_PANEL
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  {operators.map((operator) => (
                    <SelectItem key={operator.value} value={operator.value}>
                      {operator.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {field.type === "select" ? (
                <Select
                  value={row.value || NILAI_KOSONG}
                  onValueChange={(value) =>
                    onUbah(row.id, {
                      value: value === NILAI_KOSONG ? "" : value,
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={`Nilai ${field.label}`}
                    size="sm"
                    className={cn(
                      "col-span-2 col-start-2 w-full sm:col-span-1",
                      KELAS_KONTROL_PANEL
                    )}
                  >
                    <SelectValue placeholder="Pilih nilai" />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start">
                    <SelectItem value={NILAI_KOSONG}>Pilih nilai</SelectItem>
                    {field.opsi?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={row.value}
                  onChange={(event) =>
                    onUbah(row.id, { value: event.currentTarget.value })
                  }
                  placeholder={
                    field.placeholder ?? `Masukkan ${field.label.toLowerCase()}`
                  }
                  aria-label={`Nilai ${field.label}`}
                  className={cn(
                    "col-span-2 col-start-2 h-7 min-w-0 sm:col-span-1",
                    KELAS_KONTROL_PANEL
                  )}
                />
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="col-start-3 row-start-1 size-8 justify-self-center sm:col-auto sm:row-auto sm:size-7"
                aria-label={`Hapus filter ${field.label}`}
                onClick={() => onHapus(row.id)}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  strokeWidth={2}
                  className="size-3.5"
                  aria-hidden
                />
              </Button>
            </li>
          )
        })}
      </ul>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:items-start sm:self-stretch sm:border-l sm:border-border-subtle sm:pl-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={penuh}
          onClick={onTambah}
          className={cn(KELAS_KONTROL, "bg-card")}
        >
          <HugeiconsIcon
            icon={Add01Icon}
            strokeWidth={2}
            className="size-3.5"
            aria-hidden
          />
          Add filter
        </Button>
        {baris.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onBersihkan}>
            Bersihkan filter
          </Button>
        )}
      </div>
    </div>
  )
}
