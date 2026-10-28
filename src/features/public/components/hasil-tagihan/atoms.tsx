// features/publik/components/hasil-tagihan/atoms.tsx — primitif tampilan
// bersama antar tab hasil cek-tagihan. Murni presentasional: tanpa logika
// bisnis, tanpa pengambilan data.
import { cn } from "@/lib/utils"
import { formatRupiah } from "../../lib/format"

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{children}</p>
}

export function FieldValue({ children, mono = false, className }: { children: React.ReactNode; mono?: boolean; className?: string }) {
  return <p className={cn("text-sm font-medium text-foreground", mono && "font-mono", className)}>{children}</p>
}

export function StatusDot({ className }: { className: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", className)} />
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{children}</p>
}

export function BiayaRow({ label, value, accent = false, last = false }: { label: string; value: number; accent?: boolean; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2.5", !last && "border-b border-dashed border-border/60")}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-sm font-semibold tabular-nums", accent ? "text-destructive" : "text-foreground")}>
        {formatRupiah(value)}
      </span>
    </div>
  )
}
