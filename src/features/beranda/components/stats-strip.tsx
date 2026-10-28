// features/beranda/components/stats-strip.tsx — baris angka nyata dari
// database (features/beranda/lib/stats.ts). Async server component; dirender
// di dalam <Suspense> dari app/page.tsx supaya hero tidak menunggu query.
// Angka dianimasikan lewat <AnimatedNumber> (client leaf) — komponen ini
// sendiri TETAP server component, cuma mengoper angka mentah.
//
// Kalau database kosong (deploy baru), seluruh strip disembunyikan — angka
// nol besar-besar lebih merusak kepercayaan daripada tidak ada angka.
import { getStatsBeranda } from "../lib/stats";
import { formatPeriode } from "@/features/public/lib/format";
import { AnimatedNumber } from "./motion/animated-number";
import { Reveal } from "./motion/reveal";

export async function StatsStrip() {
  const stats = await getStatsBeranda();
  if (stats.pelangganAktif === 0) return null;

  const items = [
    { nilai: stats.pelangganAktif, label: "Pelanggan aktif terlayani" },
    { nilai: stats.kelurahanTerlayani, label: "Kelurahan dalam cakupan" },
    { nilai: stats.kecamatanTerlayani, label: "Kecamatan di Kota Bandung" },
    ...(stats.periodeTerakhir
      ? [
          {
            nilai: stats.tagihanPeriodeTerakhir,
            label: `Rekening diterbitkan · ${formatPeriode(stats.periodeTerakhir)}`,
          },
        ]
      : []),
  ];

  return (
    <section aria-label="Statistik pelayanan" className="border-b border-border bg-background">
      <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {items.map((item, i) => (
          <Reveal key={item.label} delay={i * 0.06} className="bg-background px-5 py-7 md:px-8">
            <dd className="order-1 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
              <AnimatedNumber value={item.nilai} />
            </dd>
            <dt className="order-2 mt-1 text-xs font-medium tracking-wide text-muted-foreground">{item.label}</dt>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

export function StatsStripSkeleton() {
  return (
    <section aria-hidden="true" className="border-b border-border bg-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-background px-5 py-7 md:px-8">
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
          </div>
        ))}
      </div>
    </section>
  );
}
