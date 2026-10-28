import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, CloudUploadIcon, File01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { ukuranBerkas } from "./format"

const MAKS_TAMPIL = 5

export function ZonaBerkas({
  id,
  accept,
  format,
  files,
  onUbah,
  disabled,
}: {
  id: string
  accept: string
  format: string
  files: File[]
  onUbah: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [seret, setSeret] = React.useState(false)

  React.useEffect(() => {
    if (files.length === 0 && inputRef.current) inputRef.current.value = ""
  }, [files])

  function hapus(i: number) {
    onUbah(files.filter((_, n) => n !== i))
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setSeret(true) }}
        onDragLeave={() => setSeret(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSeret(false)
          if (!disabled) onUbah(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors",
          "hover:bg-muted/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
          seret && "border-foreground/40 bg-muted",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span className="mb-1 grid size-10 place-items-center rounded-full border border-border bg-background">
          <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <span className="text-sm font-medium">
          {disabled ? "Pilih periode lebih dulu" : "Pilih berkas atau seret ke sini"}
        </span>
        <span className="text-xs text-muted-foreground">{format}</span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={accept}
          disabled={disabled}
          onChange={(e) => onUbah(Array.from(e.target.files ?? []))}
          className="sr-only"
        />
      </label>

      {files.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {files.slice(0, MAKS_TAMPIL).map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{ukuranBerkas(f.size)}</span>
              <button
                type="button"
                onClick={() => hapus(i)}
                aria-label={`Hapus ${f.name}`}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {files.length > MAKS_TAMPIL && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              +{files.length - MAKS_TAMPIL} berkas lainnya
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
