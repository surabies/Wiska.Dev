import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Calendar03Icon,
  Task01Icon,
  UserCheck01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { angka, persenDari, tanggalPendek, warnaProgres } from "./format"
import type { Progres, Ringkasan } from "./tipe"

function Kartu({
  label,
  nilai,
  keterangan,
  icon,
  perhatian = false,
  progres,
}: {
  label: string
  nilai: string
  keterangan: string
  icon: IconSvgElement
  perhatian?: boolean
  progres?: number | null
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          perhatian && "text-red-600 dark:text-red-400"
        )}
      >
        {nilai}
      </div>
      {progres != null && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", warnaProgres(progres))}
            style={{ width: `${Math.min(100, progres)}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{keterangan}</p>
    </div>
  )
}

export function KartuRingkasan({ data, ringkas }: { data: Progres; ringkas: Ringkasan }) {
  const jumlahPetugas = data.pencatat.length
  const capaian = persenDari(ringkas.tersetor, ringkas.target)

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kartu
        label="Setoran hari terakhir"
        nilai={angka(ringkas.setorAcuan)}
        keterangan={data.tanggalAcuan ? tanggalPendek(data.tanggalAcuan) : "Belum ada setoran"}
        icon={Calendar03Icon}
      />
      <Kartu
        label="Petugas menyetor"
        nilai={`${ringkas.orangAcuan}/${jumlahPetugas}`}
        keterangan="Pada hari terakhir yang ada setorannya"
        icon={UserCheck01Icon}
        progres={persenDari(ringkas.orangAcuan, jumlahPetugas)}
      />
      <Kartu
        label="Belum menyetor"
        nilai={angka(ringkas.belumJalan)}
        keterangan={`Belum mulai, atau diam ≥ ${data.ambangDiamHari} hari`}
        icon={UserRemove01Icon}
        perhatian={ringkas.belumJalan > 0}
      />
      <Kartu
        label="Capaian periode"
        nilai={capaian === null ? "—" : `${capaian}%`}
        keterangan={`${angka(ringkas.tersetor)} dari ${angka(ringkas.target)} daftar kerja`}
        icon={Task01Icon}
        progres={capaian}
      />
    </div>
  )
}
