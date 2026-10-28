"use client"

// features/dashboard/components/laporan-harian/laporan-harian-client.tsx —
// dua tab: daftar setoran (tabel) dan progres harian (pemantauan).
import * as React from "react"
import { ChartBarBigIcon, ListViewIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { AreaTinggiLayar } from "@/components/layout/page/AreaTinggiLayar"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { ambilSatu } from "../../lib/api-client"
import { LaporanHarianGrid } from "../grids/laporan-harian-grid"
import { ProgresHarian } from "./progres-harian"

type KunciTab = "daftar" | "progres"

const TAB: ItemTab<KunciTab>[] = [
  { kunci: "daftar", label: "Daftar setoran", icon: ListViewIcon },
  { kunci: "progres", label: "Progres harian", icon: ChartBarBigIcon },
]

export function LaporanHarianClient() {
  const [periodes, setPeriodes] = React.useState<number[]>([])
  const [aktif, setAktif] = React.useState<KunciTab>("daftar")

  React.useEffect(() => {
    let batal = false
    ambilSatu<{ periodes: number[] }>("/laporan-harian/stats", {})
      .then((s) => { if (!batal) setPeriodes(s.periodes) })
      .catch(() => {})
    return () => { batal = true }
  }, [])

  return (
    <AreaTinggiLayar className="flex min-h-0 flex-col">
      <TabLembaran
        label="Laporan harian"
        tab={TAB}
        aktif={aktif}
        onGanti={setAktif}
        className="min-h-0 flex-1"
        panelClassName={cn(
          "[&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none",
          aktif === "progres" && "p-4"
        )}
      >
        {aktif === "daftar" ? <LaporanHarianGrid /> : <ProgresHarian periodes={periodes} />}
      </TabLembaran>
    </AreaTinggiLayar>
  )
}