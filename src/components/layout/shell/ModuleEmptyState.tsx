// components/layout/shell/ModuleEmptyState.tsx
// Pengganti banner "dalam pengembangan" + kotak abu kosong.
// Satu ikon, satu judul, satu kalimat arahan, aksi opsional. Tanpa border putus-putus.
import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

type ModuleEmptyStateProps = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function ModuleEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: ModuleEmptyStateProps) {
  return (
    <section
      aria-labelledby="empty-state-title"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border bg-card px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-prose space-y-1">
        <h2 id="empty-state-title" className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </section>
  )
}

/* Contoh pemakaian pada halaman "Grafik Pelanggan":

<ModuleEmptyState
  icon={ChartNoAxesColumn}
  title="Grafik pelanggan belum tersedia"
  description="Data akan muncul di sini setelah integrasi pencatatan meter selesai."
/>

Contoh pemakaian shell pada layout:

<DashboardShell
  footer={{
    status: health.status,
    syncedAt: health.lastSyncAt,
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
    organization: "Perumda Air Minum",
    aboutTrigger: <AboutDialogTrigger>v1.0.0</AboutDialogTrigger>,
  }}
>
  {children}
</DashboardShell>
*/