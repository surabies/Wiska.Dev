import type { Metadata } from "next"
import {
  DropletsIcon,
  GaugeIcon,
  ReceiptIcon,
  TriangleAlertIcon,
} from "@hugeicons/core-free-icons"
import { ambilTren, ambilPerluTindakan } from "@/features/dashboard/lib/queries"
import {
  ambilCapaian,
  ambilProgresPetugas,
  ambilTrenAnomali,
  periodeKerja,
} from "@/features/dashboard/lib/queries-meter"
import { PageContainer } from "@/components/layout"
import { StatCard, StatGrid } from "@/features/dashboard/components/stat-card"
import { PerluTindakan } from "@/features/dashboard/components/dashboard/perlu-tindakan"
import { TrenPenjualan } from "@/features/dashboard/components/dashboard/tren-penjualan"
import { TrenAnomali } from "@/features/dashboard/components/dashboard/tren-anomali"
import { ProgresPetugas } from "@/features/dashboard/components/dashboard/progres-petugas"
import { formatPeriode, formatRupiah, formatRupiahRingkas } from "@/features/public/lib/format"

export const metadata: Metadata = { title: "Ringkasan" }

// Anomali di atas persen ini diberi tanda kuning. Sesuaikan dengan kebijakan.
const AMBANG_ANOMALI_PERSEN = 5

/** "▲ 2,3% vs periode lalu" — null bila tidak ada pembanding. */
function selisih(sekarang: number, lalu: number | undefined): string | undefined {
  if (!lalu) return undefined
  const p = ((sekarang - lalu) / lalu) * 100
  const tanda = p >= 0 ? "▲" : "▼"
  return `${tanda} ${Math.abs(p).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% vs periode lalu`
}

export default async function DashboardPage() {
  // Tahap 1: query yang tidak bergantung periode kerja berjalan paralel.
  const [kerja, tren, tindakan] = await Promise.all([
    periodeKerja(),
    ambilTren(),
    ambilPerluTindakan(),
  ])

  // Tahap 2: query yang butuh periode kerja, juga paralel.
  const [capaian, trenAnomali, petugas] = kerja
    ? await Promise.all([ambilCapaian(kerja), ambilTrenAnomali(kerja), ambilProgresPetugas(kerja)])
    : [null, [], []]

  // Kubikasi & tagihan memakai periode tagihan TERAKHIR, bisa berbeda dari
  // periode kerja (tagihan baru terbit setelah closing).
  const terakhir = tren.at(-1)
  const sebelumnya = tren.at(-2)

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col"
      breadcrumbs={[{ label: "Ringkasan" }]}
    >
      <div className="flex flex-col gap-4 sm:gap-6">
        {kerja && (
          <div className="flex sm:justify-end">
            <span className="label-micro w-fit rounded-md border border-border bg-card px-2.5 py-1 text-muted-foreground">
              Periode · {formatPeriode(kerja)}
            </span>
          </div>
        )}

        {/* Baris KPI */}
        <StatGrid>
          <StatCard
            label="Capaian baca meter"
            nilai={capaian ? `${capaian.persen.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "–"}
            keterangan={
              capaian
                ? `${capaian.dicatat.toLocaleString("id-ID")} dari ${capaian.total.toLocaleString("id-ID")} sambungan`
                : undefined
            }
            icon={GaugeIcon}
            progres={capaian?.persen}
            nada="info"
          />
          <StatCard
            label={terakhir ? `Kubikasi ${formatPeriode(terakhir.periode)}` : "Kubikasi"}
            nilai={terakhir ? `${terakhir.pemakaianM3.toLocaleString("id-ID")} m³` : "–"}
            keterangan={terakhir ? selisih(terakhir.pemakaianM3, sebelumnya?.pemakaianM3) : undefined}
            icon={DropletsIcon}
          />
          <StatCard
            label={terakhir ? `Tagihan ${formatPeriode(terakhir.periode)}` : "Tagihan"}
            nilai={terakhir ? formatRupiahRingkas(terakhir.nilai) : "–"}
            judulLengkap={terakhir ? formatRupiah(terakhir.nilai) : undefined}
            keterangan={terakhir ? selisih(terakhir.nilai, sebelumnya?.nilai) : undefined}
            icon={ReceiptIcon}
          />
          <StatCard
            label="Anomali periode ini"
            nilai={capaian ? capaian.anomali.toLocaleString("id-ID") : "–"}
            keterangan={
              capaian
                ? `${capaian.persenAnomali.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari yang dilaporkan`
                : undefined
            }
            icon={TriangleAlertIcon}
            nada={capaian && capaian.persenAnomali > AMBANG_ANOMALI_PERSEN ? "peringatan" : "netral"}
          />
        </StatGrid>

        {/* Grafik tren */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <TrenPenjualan data={tren} />
          <TrenAnomali data={trenAnomali} />
        </div>

        <ProgresPetugas data={petugas} />

        <PerluTindakan pengaduan={tindakan.pengaduan} laporanMandiri={tindakan.laporanMandiri} />
      </div>
    </PageContainer>
  )
}