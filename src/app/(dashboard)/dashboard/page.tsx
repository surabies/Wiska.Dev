import type { Metadata } from "next"
import {
  DropletsIcon,
  GaugeIcon,
  ReceiptIcon,
  TriangleAlertIcon,
} from "@hugeicons/core-free-icons"
import { ambilTren, ambilPerluTindakan, periodeTersedia } from "@/features/dashboard/lib/queries"
import {
  ambilCapaian,
  ambilProgresPetugas,
  ambilTrenAnomali,
  periodeKerja,
} from "@/features/dashboard/lib/queries-meter"
import { PageContainer } from "@/components/layout"
import { StatPanel, StatPanelGrid } from "@/features/dashboard/components/stat-panel"
import { FilterPeriode, type OpsiPeriode } from "@/features/dashboard/components/filter-periode"
import { PerluTindakan } from "@/features/dashboard/components/dashboard/perlu-tindakan"
import { TrenPenjualan } from "@/features/dashboard/components/dashboard/tren-penjualan"
import { TrenAnomali } from "@/features/dashboard/components/dashboard/tren-anomali"
import { ProgresPetugas } from "@/features/dashboard/components/dashboard/progres-petugas"
import { formatPeriode, formatRupiah, formatRupiahRingkas } from "@/features/public/lib/format"

export const metadata: Metadata = { title: "Ringkasan" }

const AMBANG_ANOMALI_PERSEN = 5

function selisih(sekarang: number, lalu: number | undefined): string | undefined {
  if (!lalu) return undefined
  const p = ((sekarang - lalu) / lalu) * 100
  const tanda = p >= 0 ? "▲" : "▼"
  return `${tanda} ${Math.abs(p).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% vs periode lalu`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const { periode: periodeParam } = await searchParams

  // 1. Ambil data dasar yang ringan terlebih dahulu secara paralel
  const [kerjaTerbaru, daftarPeriode, tindakan] = await Promise.all([
    periodeKerja(),
    periodeTersedia(),
    ambilPerluTindakan(),
  ])

  const diminta = Number(periodeParam)
  const kerja = daftarPeriode.includes(diminta) ? diminta : kerjaTerbaru

  // 2. Ambil data spesifik berdasarkan periode `kerja` dan `tren` secara efisien
  const [capaian, trenAnomali, petugas, tren] = kerja
    ? await Promise.all([
        ambilCapaian(kerja),
        ambilTrenAnomali(kerja),
        ambilProgresPetugas(kerja),
        ambilTren(), // Dipindah ke sini agar tidak membebani jika tidak diperlukan
      ])
    : [null, [], [], []]

  // Sinkronkan indeks berdasarkan periode aktif (`kerja`) agar StatPanel dan Tren sejalan
  const idx = tren.findIndex((t: { periode: number; pemakaianM3: number; nilai: number }) => t.periode === kerja)
  const terakhir = idx >= 0 ? tren[idx] : tren.at(-1)
  const sebelumnya = idx >= 0 ? tren[idx - 1] : tren.at(-2)

  const opsiPeriode: OpsiPeriode[] = daftarPeriode.map((p: number) => ({
    value: String(p),
    label: formatPeriode(p),
  }))

  return (
    <PageContainer tanpaHeader className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 sm:gap-4">
        <header className="border-border/70 bg-background sticky top-0 z-30 -mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b pt-3 pb-3">
          <div className="min-w-0">
            <h1 className="text-foreground text-2xl leading-tight font-semibold tracking-tight">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-[13px]">
              Capaian baca meter, tagihan, dan anomali pelanggan dalam satu tampilan.
            </p>
          </div>
          {kerja && <FilterPeriode opsi={opsiPeriode} nilai={String(kerja)} />}
        </header>

        <StatPanelGrid>
          <StatPanel
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
          <StatPanel
            label={terakhir ? `Kubikasi ${formatPeriode(terakhir.periode)}` : "Kubikasi"}
            nilai={terakhir ? `${terakhir.pemakaianM3.toLocaleString("id-ID")} m³` : "–"}
            keterangan={terakhir ? selisih(terakhir.pemakaianM3, sebelumnya?.pemakaianM3) : undefined}
            icon={DropletsIcon}
          />
          <StatPanel
            label={terakhir ? `Tagihan ${formatPeriode(terakhir.periode)}` : "Tagihan"}
            nilai={terakhir ? formatRupiahRingkas(terakhir.nilai) : "–"}
            judulLengkap={terakhir ? formatRupiah(terakhir.nilai) : undefined}
            keterangan={terakhir ? selisih(terakhir.nilai, sebelumnya?.nilai) : undefined}
            icon={ReceiptIcon}
          />
          <StatPanel
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
        </StatPanelGrid>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <TrenPenjualan data={tren} />
          <TrenAnomali data={trenAnomali} />
        </div>

        <ProgresPetugas data={petugas} />

        <PerluTindakan pengaduan={tindakan.pengaduan} laporanMandiri={tindakan.laporanMandiri} />
      </div>
    </PageContainer>
  )
}