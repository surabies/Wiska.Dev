// features/dashboard/components/petugas/kartu-jenis.tsx — kartu ringkasan
// satu jenis tugas: nama, jumlah petugas, penjelasan.
import type { InfoJenis } from "./konstanta"

export function KartuJenis({ info, jumlah }: { info: InfoJenis; jumlah: number | null }) {
  const Ikon = info.ikon
  return (
    <div className="rounded-lg border bg-card p-4 shadow-panel">
      <div className="flex items-center gap-2">
        <Ikon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{info.label}</span>
        <span className="num ml-auto text-lg font-semibold">{jumlah ?? "—"}</span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{info.jelas}</p>
    </div>
  )
}
