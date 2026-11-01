import {
  DropletsIcon,
  GaugeIcon,
  ReceiptIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import {
  ambilTren,
  ambilPerluTindakan,
  periodeTersedia,
} from "@/features/dashboard/ringkasan/server/KueriRingkasan"
import {
  ambilCapaian,
  ambilProgresPetugas,
  ambilStatPeriode,
  ambilTrenAnomali,
  geserPeriode,
  periodeKerja,
} from "@/features/dashboard/ringkasan/server/KueriMeter"
import type { StatPeriode } from "@/features/dashboard/ringkasan/types/TipeRingkasan"
import { PageContainer } from "@/components/layout/index"
import {
  StatPanel,
  StatPanelGrid,
} from "@/features/dashboard/ringkasan/components/StatPanel"
import {
  FilterPeriode,
  type OpsiPeriode,
} from "@/features/dashboard/ringkasan/components/PenyaringPeriode"
import { PerluTindakan } from "@/features/dashboard/ringkasan/components/PerluTindakan"
import { TrenPenjualan } from "@/features/dashboard/ringkasan/components/TrenPenjualan"
import { TrenAnomali } from "@/features/dashboard/ringkasan/components/TrenAnomali"
import { ProgresPetugas } from "@/features/dashboard/ringkasan/components/ProgresPetugas"
import {
  formatPeriode,
  formatRupiah,
  formatRupiahRingkas,
} from "@/features/public/lib/Format"

const angka = (n: number, digit = 0) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: digit })

function selisih(
  sekarang: number,
  lalu: number | undefined | null
): string | undefined {
  if (!lalu) return undefined
  const p = ((sekarang - lalu) / lalu) * 100
  const tanda = p >= 0 ? "▲" : "▼"
  return `${tanda} ${Math.abs(p).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% vs periode lalu`
}

/** Rata-rata pemakaian per SL — pembanding yang adil antara periode berjalan (sebagian) dan periode lalu (penuh). */
const rataPerSL = (s: StatPeriode) => (s.sl > 0 ? s.kubikasi / s.sl : 0)

export async function RingkasanView({
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

  // 2. Data spesifik periode terpilih (`kerja`) dan periode sebelumnya.
  //    `tren` (grafik 6 bulan tagihan) tetap berbasis periode yang sudah terbit.
  const [capaian, trenAnomali, petugas, tren, statIni, statLalu] = kerja
    ? await Promise.all([
        ambilCapaian(kerja),
        ambilTrenAnomali(kerja),
        ambilProgresPetugas(kerja),
        ambilTren(),
        ambilStatPeriode(kerja),
        ambilStatPeriode(geserPeriode(kerja, -1)),
      ])
    : [null, [], [], [], null, null]

  const opsiPeriode: OpsiPeriode[] = daftarPeriode.map((p: number) => ({
    value: String(p),
    label: formatPeriode(p),
  }))

  const berjalan = statIni?.status === "berjalan"
  const adaLalu = !!statLalu && statLalu.sl > 0

  // --- Keterangan tiap kartu -------------------------------------------------
  // SL tercatat: selalu tampilkan angka periode lalu sebagai pembanding.
  const ketSL = statIni
    ? adaLalu
      ? `${formatPeriode(statLalu!.periode)}: ${angka(statLalu!.sl)} SL`
      : "Belum ada pembanding periode lalu"
    : undefined

  // Kubikasi: periode berjalan hanya sebagian SL, jadi dibandingkan per SL;
  // periode terbit dibandingkan total.
  const ketKubikasi = statIni
    ? berjalan
      ? adaLalu
        ? `${angka(rataPerSL(statIni), 1)} m³/SL · ${formatPeriode(statLalu!.periode)}: ${angka(rataPerSL(statLalu!), 1)}`
        : `${angka(rataPerSL(statIni), 1)} m³ per SL`
      : selisih(statIni.kubikasi, statLalu?.kubikasi)
    : undefined

  // Tagihan: periode berjalan belum punya tagihan → tampilkan periode lalu sebagai acuan.
  const tagihanTampil = statIni
    ? statIni.nilai !== null
      ? {
          nilai: formatRupiahRingkas(statIni.nilai),
          penuh: formatRupiah(statIni.nilai),
        }
      : { nilai: "Belum terbit", penuh: undefined }
    : { nilai: "–", penuh: undefined }
  const ketTagihan = statIni
    ? statIni.nilai !== null
      ? selisih(statIni.nilai, statLalu?.nilai)
      : statLalu?.nilai != null
        ? `${formatPeriode(statLalu.periode)}: ${formatRupiahRingkas(statLalu.nilai)}`
        : undefined
    : undefined

  return (
    <PageContainer tanpaHeader className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 sm:gap-4">
        <header className="sticky top-0 z-30 -mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border/70 bg-background pt-3 pb-3">
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Capaian baca meter, tagihan, dan anomali pelanggan dalam satu
              tampilan.
            </p>
          </div>
          {kerja && <FilterPeriode opsi={opsiPeriode} nilai={String(kerja)} />}
        </header>

        <StatPanelGrid>
          <StatPanel
            label="Capaian baca meter"
            nilai={capaian ? `${angka(capaian.persen, 1)}%` : "–"}
            keterangan={
              capaian
                ? `${angka(capaian.dicatat)} dari ${angka(capaian.total)} sambungan`
                : undefined
            }
            icon={GaugeIcon}
            progres={capaian?.persen}
            nada="info"
          />
          <StatPanel
            label={
              kerja ? `SL tercatat ${formatPeriode(kerja)}` : "SL tercatat"
            }
            nilai={statIni ? angka(statIni.sl) : "–"}
            keterangan={ketSL}
            icon={UserGroupIcon}
          />
          <StatPanel
            label={
              kerja
                ? `Kubikasi ${formatPeriode(kerja)}${berjalan ? " (berjalan)" : ""}`
                : "Kubikasi"
            }
            nilai={statIni ? `${angka(statIni.kubikasi)} m³` : "–"}
            keterangan={ketKubikasi}
            icon={DropletsIcon}
          />
          <StatPanel
            label={kerja ? `Tagihan ${formatPeriode(kerja)}` : "Tagihan"}
            nilai={tagihanTampil.nilai}
            judulLengkap={tagihanTampil.penuh}
            keterangan={ketTagihan}
            icon={ReceiptIcon}
          />
        </StatPanelGrid>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <TrenPenjualan data={tren} />
          <TrenAnomali data={trenAnomali} />
        </div>

        <ProgresPetugas data={petugas} />

        <PerluTindakan
          pengaduan={tindakan.pengaduan}
          laporanMandiri={tindakan.laporanMandiri}
        />
      </div>
    </PageContainer>
  )
}
