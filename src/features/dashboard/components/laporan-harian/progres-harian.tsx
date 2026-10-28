"use client"

// Perakit layar Progres Harian. Logika data ada di use-progres.ts, tipe di
// tipe.ts, konstanta warna di konstanta.ts; tiap bagian layar punya file sendiri.
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPeriode } from "@/features/public/lib/format"
import { BilahPeriode } from "./bilah-periode"
import { GrafikSetoran } from "./grafik-setoran"
import { KartuRingkasan } from "./kartu-ringkasan"
import { TabelRincian } from "./tabel-rincian"
import { useProgres } from "./use-progres"

export function ProgresHarian({ periodes }: { periodes: number[] }) {
  const { periode, setPeriode, data, galat, jenisPer, ringkas, grafik, rataKerja } =
    useProgres(periodes)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BilahPeriode periodes={periodes} periode={periode} onGanti={setPeriode} data={data} />

      <div className="scrollbar-tipis min-h-0 flex-1 overflow-y-auto pt-4">
        <div className="flex flex-col gap-4 pb-2">
          {galat && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{galat}</AlertDescription>
            </Alert>
          )}

          {!data && !galat && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
              </div>
              <Skeleton className="h-72 w-full rounded-lg" />
            </>
          )}

          {data && ringkas && (
            data.tanggal.length === 0 ? (
              <Alert>
                <AlertDescription className="text-xs">
                  Periode {formatPeriode(data.periode)} belum punya satu pun tanggal untuk ditampilkan.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <KartuRingkasan data={data} ringkas={ringkas} />
                <GrafikSetoran grafik={grafik} jenisPer={jenisPer} rataKerja={rataKerja} />
                <TabelRincian data={data} ringkas={ringkas} />
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}
