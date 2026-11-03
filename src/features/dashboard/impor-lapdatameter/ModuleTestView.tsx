"use client"

// features/dashboard/impor-lapdatameter/ModuleTestView.tsx —
// Halaman terpadu Module Test untuk simulasi dan pengujian alur impor data
// (Lapdatameter, PBPK, R-Nomor Pemutusan, dan Cadangan Lapangan).
// Mengikuti pola arsitektur TabLembaran yang ringkas, modern, dan sejajar kontainer.
import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  FileSpreadsheetIcon,
  UserAdd01Icon,
  Cancel01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { ImporDataClient } from "./components/KlienImporData"
import { PbpkView } from "@/features/dashboard/pbpk/PbpkView"
import { PemutusanView } from "@/features/dashboard/pemutusan/PemutusanView"
import { ImporCadanganClient } from "@/features/dashboard/impor/components/KlienImporCadangan"

export type TabModuleTest = "lapdatameter" | "pbpk" | "r-nomor" | "cadangan"

const TAB_MODULE_TEST: ItemTab<TabModuleTest>[] = [
  {
    kunci: "lapdatameter",
    label: "Import Lapdatameter",
    icon: FileSpreadsheetIcon,
  },
  {
    kunci: "pbpk",
    label: "Import PBPK",
    icon: UserAdd01Icon,
  },
  {
    kunci: "r-nomor",
    label: "Import R-Nomor",
    icon: Cancel01Icon,
  },
  {
    kunci: "cadangan",
    label: "Import Cadangan & Bukti",
    icon: Folder01Icon,
  },
]

export function ModuleTestView({
  tabAwal = "lapdatameter",
  role = "STAFF",
}: {
  tabAwal?: TabModuleTest
  role?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as TabModuleTest | null
  const [tab, setTab] = React.useState<TabModuleTest>(
    tabParam && TAB_MODULE_TEST.some((t) => t.kunci === tabParam)
      ? tabParam
      : tabAwal
  )

  function gantiTab(kunci: TabModuleTest) {
    setTab(kunci)
    // Sinkronkan tab ke URL query tanpa full refresh
    const url = new URL(window.location.href)
    url.searchParams.set("tab", kunci)
    router.replace(url.pathname + url.search)
  }

  return (
    <TabLembaran
      label="Module Test Aplikasi"
      tab={TAB_MODULE_TEST}
      aktif={tab}
      onGanti={gantiTab}
      transisi={false}
      kerangkaHalaman
      warnaTab="muted"
      warnaTabAktif="background"
      warnaTabTidakAktif="lebihGelap"
      className="h-full min-h-0 min-w-0 overflow-hidden bg-background"
      panelClassName="min-h-0 min-w-0 overflow-y-auto p-5 sm:p-6"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tab === "lapdatameter" && <ImporDataClient />}
        {tab === "pbpk" && <PbpkView role={role} />}
        {tab === "r-nomor" && <PemutusanView />}
        {tab === "cadangan" && <ImporCadanganClient />}
      </div>
    </TabLembaran>
  )
}
