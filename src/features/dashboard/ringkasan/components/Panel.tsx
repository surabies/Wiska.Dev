import type { ReactNode } from "react"
import { PanelDasbor } from "../../shared/PanelDasbor"

export function Panel({
  label,
  chip,
  deskripsi,
  icon,
  flush = false,
  className,
  children,
}: {
  label: string
  chip?: string
  deskripsi?: string
  icon?: ReactNode
  flush?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <PanelDasbor
      label={label}
      chip={chip}
      deskripsi={deskripsi}
      ikon={icon}
      tanpaPadding={flush}
      className={className}
    >
      {children}
    </PanelDasbor>
  )
}
