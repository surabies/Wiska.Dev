"use client"

// features/publik/components/hasil-tagihan/tab-riwayat.tsx — grafik pemakaian
// & daftar tagihan beberapa periode terakhir.
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Rectangle } from "recharts"
import { SectionLabel } from "./atoms"
import { formatBulanSingkat, formatPeriode, formatRupiah } from "../../lib/format"
import type { HasilCekTagihan, TagihanPublik } from "../../lib/api"

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        Pemakaian: <span className="font-mono font-semibold text-foreground">{payload[0]!.value} m³</span>
      </p>
    </div>
  )
}

function KonsumsiCard({ terbaru, riwayat }: { terbaru: TagihanPublik; riwayat: TagihanPublik[] }) {
  const BAR_SIZE = 20
  const chartData = [...riwayat]
    .reverse()
    .map((t) => ({ periode: t.periode, bulan: formatBulanSingkat(t.periode), pemakaian: t.pemakaianM3, isTerbaru: t.periode === terbaru.periode }))

  return (
    <div>
      <SectionLabel>Konsumsi bulan ini</SectionLabel>
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <p className="text-sm text-muted-foreground">{formatPeriode(terbaru.periode)}</p>
          <p className="font-mono text-2xl font-bold text-foreground">
            {terbaru.pemakaianM3} <span className="text-sm font-normal text-muted-foreground">m³</span>
          </p>
        </div>

        {/* Recharts merender kotak kosong untuk 1 titik data — pelanggan
            baru dengan satu periode tagihan hanya melihat angka di atas. */}
        {chartData.length >= 2 && (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} barSize={BAR_SIZE} margin={{ top: 4, right: 0, left: -5, bottom: 0 }}>
              <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
              <Bar
                dataKey="pemakaian"
                radius={[4, 4, 0, 0]}
                shape={(props: React.ComponentProps<typeof Rectangle> & { payload?: { isTerbaru?: boolean } }) => {
                  const { payload, ...rect } = props
                  return <Rectangle {...rect} fill={payload?.isTerbaru ? "var(--foreground)" : "color-mix(in srgb, var(--muted-foreground) 25%, transparent)"} />
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/// Riwayat TAGIHAN, bukan riwayat pembayaran — judul lama menjanjikan hal
/// yang tidak pernah ada isinya. Tiap baris hanya menyatakan apa yang memang
/// kita ketahui: periode, pemakaian, dan jumlah yang ditagihkan. Tidak ada
/// titik warna, label lunas, maupun angka merah, karena ketiganya adalah
/// pernyataan tentang pembayaran (lihat catatan di header.tsx).
function RiwayatList({ riwayat }: { riwayat: TagihanPublik[] }) {
  return (
    <div>
      <SectionLabel>Riwayat tagihan</SectionLabel>
      <div>
        {riwayat.map((t, i) => (
          <div
            key={t.periode}
            className={`flex items-center justify-between py-3 ${i < riwayat.length - 1 ? "border-b border-dashed border-border/50" : ""}`}
          >
            <div>
              <p className="text-sm font-medium text-foreground">{formatPeriode(t.periode)}</p>
              <p className="text-[11px] text-muted-foreground">Pemakaian {t.pemakaianM3} m³</p>
            </div>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatRupiah(t.totalTagihan)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Daftar ini menampilkan tagihan yang diterbitkan beserta pemakaiannya. Status pembayaran
        tidak ditampilkan di sini — untuk memastikannya, hubungi loket atau kantor pelayanan.
      </p>
    </div>
  )
}

export function TabRiwayat({ hasil }: { hasil: HasilCekTagihan }) {
  const riwayat = hasil.tagihan.slice(0, 6)
  const terbaru = riwayat[0]

  if (!terbaru) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Tidak ada data riwayat tagihan.</div>
  }

  return (
    <div className="space-y-6">
      <KonsumsiCard terbaru={terbaru} riwayat={riwayat} />
      <RiwayatList riwayat={riwayat} />
    </div>
  )
}
