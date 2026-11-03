"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { BilahDrd } from "./components/BilahDrd"
import { GrafikDrd } from "./components/GrafikDrd"
import { KartuRingkasanDrd } from "./components/KartuRingkasanDrd"
import { TabelDrd } from "./components/TabelDrd"
import { useDrd } from "./hooks/UseDrd"
import type { TabDrd } from "./types/TipeDrd"

const TAB: ItemTab<TabDrd>[] = [
  { kunci: "ringkasan", label: "Ringkasan" },
  { kunci: "kelurahan", label: "Kelurahan" },
  { kunci: "domestik", label: "Domestik" },
  { kunci: "tarif", label: "Tarif" },
  { kunci: "taa-kelurahan", label: "TAA per kelurahan" },
  { kunci: "cakupan", label: "Cakupan layanan" },
  { kunci: "taa", label: "TAA" },
  { kunci: "tagihan", label: "Tagihan" },
  { kunci: "pelanggan", label: "Pelanggan" },
]

export function DrdView() {
  const {
    periodes,
    periode,
    tab,
    ringkasan,
    memuatPeriode,
    memuatRingkasan,
    galat,
    gantiPeriode,
    gantiTab,
  } = useDrd()

  return (
    <TabLembaran
      label="Rekapitulasi DRD"
      tab={periodes.length > 0 ? TAB : []}
      aktif={tab}
      onGanti={gantiTab}
      transisi={false}
      kerangkaHalaman
      warnaTab="muted"
      warnaTabAktif="background"
      warnaTabTidakAktif="lebihGelap"
      className="h-full min-h-0 min-w-0 overflow-hidden bg-background"
      panelClassName="min-h-0 min-w-0 overflow-hidden p-5 sm:p-6"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {galat && (
          <Alert variant="destructive" className="shrink-0 mb-3">
            <AlertDescription className="text-xs">{galat}</AlertDescription>
          </Alert>
        )}

        {memuatPeriode ? (
          <div className="grid flex-1 grid-cols-2 gap-3 py-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : galat && periodes.length === 0 ? null : periodes.length === 0 ? (
          <Alert className="mt-1">
            <AlertDescription className="text-xs">
              Belum ada histori tagihan yang tersimpan di database.
            </AlertDescription>
          </Alert>
        ) : tab === "ringkasan" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
            <BilahDrd
              periodes={periodes}
              periode={periode}
              ringkasan={ringkasan}
              memuat={memuatPeriode || memuatRingkasan}
              onGanti={gantiPeriode}
            />
            {memuatRingkasan ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-28 w-full rounded-lg" />
                  ))}
                </div>
                <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-72 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ) : ringkasan ? (
              <>
                <KartuRingkasanDrd ringkasan={ringkasan} />
                <GrafikDrd ringkasan={ringkasan} />
              </>
            ) : null}
          </div>
        ) : periode === null ? null : (
          <TabelDrd
            tab={tab}
            periode={periode}
            periodes={periodes}
            ringkasan={ringkasan}
            memuatPeriode={memuatPeriode || memuatRingkasan}
            onGantiPeriode={gantiPeriode}
          />
        )}
      </div>
    </TabLembaran>
  )
}
