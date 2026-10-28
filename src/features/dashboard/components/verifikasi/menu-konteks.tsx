"use client"

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface AksiKonteks {
  label: string
  icon?: IconSvgElement
  onPilih: () => void
  disabled?: boolean
  /** Dipakai sebagai tooltip native, tidak lagi baris kedua. */
  keterangan?: string
  destruktif?: boolean
  /** Garis pemisah sebelum item ini. */
  pemisah?: boolean
}

export function MenuKonteks({
  posisi,
  judul,
  aksi,
  onTutup,
}: {
  posisi: { x: number; y: number } | null
  judul?: string
  aksi: AksiKonteks[]
  onTutup: () => void
}) {
  if (!posisi) return null

  return (
    <DropdownMenu open onOpenChange={(buka) => !buka && onTutup()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="block size-0"
          style={{ position: "fixed", left: posisi.x, top: posisi.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" sideOffset={2} className="w-56">
        {judul && (
          <>
            <DropdownMenuLabel className="font-mono text-[11px] text-muted-foreground">
              {judul}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {aksi.map((a, index) => (
          <div key={a.label}>
            {a.pemisah && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={a.disabled}
              variant={a.destruktif ? "destructive" : "default"}
              onSelect={a.onPilih}
              title={a.keterangan}
              className="justify-between gap-3 py-1.5 text-[13px]"
            >
              <span className="truncate">{a.label}</span>
              {a.icon && (
                <HugeiconsIcon icon={a.icon} strokeWidth={2} className="size-4 shrink-0" aria-hidden />
              )}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}