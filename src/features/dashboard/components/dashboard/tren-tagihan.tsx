"use client";

// features/dashboard/components/tren-tagihan.tsx — grafik nilai tagihan 6
// periode terakhir.
//
// Client component: Recharts mengukur elemen DOM, jadi tidak bisa dirender
// di server. Datanya sudah diagregasi di server (features/dashboard/lib/
// queries.ts) dan dioper sebagai prop — komponen ini tidak mengambil data
// sendiri.
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPeriode } from "@/features/public/lib/format";
import { Panel } from "../panel";

interface Titik {
  periode: number;
  nilai: number;
  jumlahTagihan: number;
  pemakaianM3: number;
}

/// Warna diambil dari token tema (--chart-1), BUKAN hex — supaya grafik ikut
/// berubah benar saat tema gelap. Lihat aturan warna di FRONTEND.md.
const config = {
  nilai: { label: "Nilai tagihan", color: "var(--chart-1)" },
} satisfies ChartConfig;

/// "Rp 1,2 jt" — sumbu Y tidak muat menampung angka penuh (ratusan juta),
/// dan angka bulat yang panjang justru lebih sulit dibandingkan sekilas.
function ringkas(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)} jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return `Rp ${n}`;
}

export function TrenTagihan({ data }: { data: Titik[] }) {
  // Grafik garis/area BUTUH minimal 2 titik — dengan 1 titik, Recharts
  // merender kotak kosong yang terlihat seperti komponen rusak (dan memang
  // sempat begitu: data hasil impor CSV baru berisi satu periode).
  // Tampilkan angkanya langsung + jelaskan kenapa grafiknya belum ada.
  if (data.length < 2) {
    const satu = data[0];
    return (
      <Panel
        label="Tren Nilai Tagihan"
        chip={satu ? "1 Periode" : undefined}
        deskripsi={
          satu
            ? `Baru ada data satu periode (${formatPeriode(satu.periode)}). Grafik tren muncul setelah minimal dua periode tercatat.`
            : "Belum ada data tagihan."
        }
      >
        {satu && (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="label-micro text-muted-foreground">
                Nilai tagihan
              </p>
              <p className="num-display mt-1 text-lg">
                Rp {satu.nilai.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="label-micro text-muted-foreground">
                Jumlah rekening
              </p>
              <p className="num-display mt-1 text-lg">
                {satu.jumlahTagihan.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <p className="label-micro text-muted-foreground">
                Total pemakaian
              </p>
              <p className="num-display mt-1 text-lg">
                {satu.pemakaianM3.toLocaleString("id-ID")}{" "}
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  m³
                </span>
              </p>
            </div>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel
      label="Tren Nilai Tagihan"
      chip={`${data.length} Periode`}
      deskripsi="Nilai tagihan diterbitkan per periode yang tercatat."
    >
      {/* Tinggi ikut layar: 220px di ponsel (grafik setinggi 320px membuat
          daftar "Perlu Tindakan" di bawahnya tidak terlihat sama sekali tanpa
          menggulir), 320px begitu ada ruang. */}
      <ChartContainer config={config} className="h-55 max-sm:h-44 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="periode"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            // "Mei 2026" -> "Mei": label penuh menumpuk di layar sempit.
            tickFormatter={(v: number) => formatPeriode(v).split(" ")[0] ?? ""}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            // 64px sumbu Y = seperlima lebar layar ponsel dipakai label
            // "Rp 12 jt". Cukup 52px karena angkanya sudah diringkas.
            width={52}
            tickFormatter={ringkas}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) =>
                  formatPeriode(Number(p?.[0]?.payload?.periode))
                }
                formatter={(v) => ` Rp ${Number(v).toLocaleString("id-ID")}`}
              />
            }
          />
          <Area
            dataKey="nilai"
            type="monotone"
            fill="var(--color-nilai)"
            fillOpacity={0.15}
            stroke="var(--color-nilai)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </Panel>
  );
}