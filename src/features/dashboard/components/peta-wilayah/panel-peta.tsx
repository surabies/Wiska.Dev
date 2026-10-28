"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import type {
  RingkasanAsetPeta,
  RingkasanLaporanPeta,
} from "../../lib/peta-queries";
import styles from "./peta-panel.module.css";
import type { VisibilitasLayer } from "./peta-layers";

export interface FokusPeta {
  longitude: number;
  latitude: number;
  zoom?: number;
}

interface BarisKebocoran {
  id: string;
  tiket: string;
  judul: string;
  status: string;
  prioritas: string;
  alamat: string | null;
  kelurahan: string | null;
  dibuat: Date;
  longitude: number;
  latitude: number;
}

interface PanelPetaProps {
  visibilitas: VisibilitasLayer;
  onVisibilitasChange: (
    layer: keyof VisibilitasLayer,
    visible: boolean,
  ) => void;
  onFokus: (fokus: FokusPeta) => void;
  kebocoranAktif: BarisKebocoran[];
  ringkasan: RingkasanLaporanPeta;
  aset: RingkasanAsetPeta;
  pelangganTanpaKoordinat: number;
  jumlahKelurahan: number;
  jumlahKecamatan: number;
  jumlahPelanggan: number;
  jumlahPotensi: number;
  jumlahEksPelanggan: number;
  jumlahPengaduan: number;
  jumlahRute: number;
}

const formatAngka = new Intl.NumberFormat("id-ID");

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {detail && (
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

function labelBulan(bulan: string) {
  const [tahun, nomorBulan] = bulan.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
    new Date(tahun!, nomorBulan! - 1, 1),
  );
}

async function eksporLaporan(ringkasan: RingkasanLaporanPeta) {
  const XLSX = await import("xlsx");
  const buku = XLSX.utils.book_new();
  const ringkas = [
    { metrik: "Aduan kebocoran aktif", nilai: ringkasan.aktif },
    { metrik: "Aduan kebocoran 30 hari", nilai: ringkasan.laporan30Hari },
    {
      metrik: "Rata-rata respons (jam)",
      nilai: ringkasan.rataRataResponsJam ?? "Belum tersedia",
    },
    {
      metrik: "Rata-rata penyelesaian (jam)",
      nilai: ringkasan.rataRataPenyelesaianJam ?? "Belum tersedia",
    },
  ];
  XLSX.utils.book_append_sheet(
    buku,
    XLSX.utils.json_to_sheet(ringkas),
    "Ringkasan",
  );
  XLSX.utils.book_append_sheet(
    buku,
    XLSX.utils.json_to_sheet(
      ringkasan.trenBulanan.map((row) => ({
        bulan: labelBulan(row.bulan),
        laporan: row.jumlah,
      })),
    ),
    "Tren Bulanan",
  );
  XLSX.utils.book_append_sheet(
    buku,
    XLSX.utils.json_to_sheet(ringkasan.hotspot),
    "Hotspot Kelurahan",
  );
  XLSX.writeFile(
    buku,
    `laporan-peta-kebocoran-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function PanelPeta({
  visibilitas,
  onVisibilitasChange,
  onFokus,
  kebocoranAktif,
  ringkasan,
  aset,
  pelangganTanpaKoordinat,
  jumlahKelurahan,
  jumlahKecamatan,
  jumlahPelanggan,
  jumlahPotensi,
  jumlahEksPelanggan,
  jumlahPengaduan,
  jumlahRute,
}: PanelPetaProps) {
  const [cari, setCari] = React.useState("");
  const [sedangEkspor, setSedangEkspor] = React.useState(false);
  const hasilKebocoran = React.useMemo(() => {
    const kata = cari.trim().toLocaleLowerCase("id-ID");
    if (!kata) return kebocoranAktif;
    return kebocoranAktif.filter((row) =>
      [row.tiket, row.judul, row.alamat, row.kelurahan].some((nilai) =>
        nilai?.toLocaleLowerCase("id-ID").includes(kata),
      ),
    );
  }, [cari, kebocoranAktif]);
  const puncakTren = Math.max(
    1,
    ...ringkasan.trenBulanan.map((row) => row.jumlah),
  );
  const puncakHotspot = Math.max(
    1,
    ...ringkasan.hotspot.map((row) => row.jumlah),
  );
  const kelompokLayer = [
    {
      value: "wilayah",
      label: "Wilayah & rute",
      total: jumlahKecamatan + jumlahKelurahan + jumlahRute,
      rows: [
        ["kecamatan", "Batas kecamatan", jumlahKecamatan],
        ["kelurahan", "Batas kelurahan", jumlahKelurahan],
        ["rute", "Geometri rute", jumlahRute],
      ] as const,
    },
    {
      value: "titik",
      label: "Titik pelanggan & laporan",
      total:
        jumlahPelanggan + jumlahPotensi + jumlahEksPelanggan + jumlahPengaduan,
      rows: [
        ["pelanggan", "Pelanggan berkoordinat", jumlahPelanggan],
        ["potensi", "Pelanggan potensial", jumlahPotensi],
        [
          "eksPelanggan",
          "Titik pencabutan / eks pelanggan",
          jumlahEksPelanggan,
        ],
        ["pengaduan", "Pengaduan berkoordinat", jumlahPengaduan],
      ] as const,
    },
  ] as const;

  async function unduhLaporan() {
    setSedangEkspor(true);
    try {
      await eksporLaporan(ringkasan);
    } catch (error) {
      console.error("Gagal mengekspor laporan peta:", error);
      toast.error("Laporan gagal diekspor. Silakan coba lagi.");
    } finally {
      setSedangEkspor(false);
    }
  }

  return (
    <aside
      aria-label="Panel informasi peta"
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm ${styles.panel}`}
    >
      <Tabs
        defaultValue="operasi"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b border-border/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Pusat peta</h2>
              <p className="text-xs text-muted-foreground">
                Data operasional dan wilayah
              </p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
              DATA PETA
            </span>
          </div>
          <TabsList aria-label="Bagian panel peta" className="flex h-8 w-full">
            <TabsTrigger value="operasi" className="text-xs">
              Operasi
            </TabsTrigger>
            <TabsTrigger value="laporan" className="text-xs">
              Laporan
            </TabsTrigger>
            <TabsTrigger value="aset" className="text-xs">
              Aset
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="operasi"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
        >
          <section aria-labelledby="layer-heading">
            <h3
              id="layer-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Legenda &amp; layer
            </h3>
            <Accordion
              type="multiple"
              defaultValue={["titik"]}
              className="mt-2 divide-y divide-border/60 rounded-lg border border-border/70 px-3"
            >
              {kelompokLayer.map((kelompok) => (
                <AccordionItem key={kelompok.value} value={kelompok.value}>
                  <AccordionTrigger className="py-2.5 text-xs hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
                      <span className="truncate">{kelompok.label}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatAngka.format(kelompok.total)}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="divide-y divide-border/50">
                      {kelompok.rows.map(([key, label, count]) => (
                        <label
                          key={key}
                          className="flex min-h-9 cursor-pointer items-center gap-2.5 py-1.5 text-xs"
                        >
                          <Checkbox
                            checked={visibilitas[key]}
                            onCheckedChange={(checked) =>
                              onVisibilitasChange(key, checked === true)
                            }
                            aria-label={`Tampilkan ${label.toLocaleLowerCase("id-ID")}`}
                          />
                          <span
                            aria-hidden="true"
                            className={`${key === "kelurahan" || key === "kecamatan" ? "size-2.5 rounded-sm" : key === "rute" ? "h-0.5 w-3 rounded-full" : "size-2 rounded-full"} ${styles[key]}`}
                          />
                          <span className="min-w-0 flex-1">{label}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {formatAngka.format(count)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
              <AccordionItem value="legenda">
                <AccordionTrigger className="py-2.5 text-xs hover:no-underline">
                  Legenda warna titik
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
                    {(
                      [
                        ["pelanggan", "Pelanggan aktif"],
                        ["tutupSementara", "Tutup sementara"],
                        ["disegel", "Disegel"],
                        ["tutupSpt", "Tutup SPT"],
                        ["pelangganDihapus", "Dihapus dari daftar"],
                        ["eksPelanggan", "Riwayat pencabutan"],
                        ["potensi", "Potensial"],
                        ["pengaduan", "Pengaduan aktif"],
                        ["pengaduanSelesai", "Selesai/ditutup"],
                      ] as const
                    ).map(([warna, label]) => (
                      <span key={warna} className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ${styles[warna]}`}
                        />
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Riwayat pencabutan menampilkan pemutusan dengan koordinat
                    verifikasi.
                    {pelangganTanpaKoordinat > 0 &&
                      ` ${formatAngka.format(pelangganTanpaKoordinat)} pelanggan belum memiliki koordinat.`}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          <section aria-labelledby="aduan-heading" className="mt-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3
                id="aduan-heading"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Antrean kebocoran
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatAngka.format(ringkasan.aktif)} aktif
              </span>
            </div>
            <Input
              value={cari}
              onChange={(event) => setCari(event.target.value)}
              placeholder="Cari tiket, alamat, kelurahan…"
              aria-label="Cari aduan kebocoran"
              className="mt-2"
            />
            <ul className="mt-2 space-y-1.5">
              {hasilKebocoran.slice(0, 30).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onFokus({
                        longitude: row.longitude,
                        latitude: row.latitude,
                        zoom: 16,
                      })
                    }
                    className="w-full rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">
                        {row.tiket}
                      </span>
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                        {row.status.replaceAll("_", " ")}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {row.alamat || row.kelurahan || row.judul}
                    </span>
                  </button>
                </li>
              ))}
              {hasilKebocoran.length === 0 && (
                <li className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                  {cari
                    ? "Tidak ada aduan yang cocok."
                    : "Tidak ada aduan kebocoran berkoordinat yang aktif."}
                </li>
              )}
              {hasilKebocoran.length > 30 && (
                <li className="px-2 py-1 text-center text-xs text-muted-foreground">
                  Menampilkan 30 dari{" "}
                  {formatAngka.format(hasilKebocoran.length)} lokasi. Gunakan
                  pencarian untuk mempersempit.
                </li>
              )}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="laporan" className="min-h-0 overflow-y-auto p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Kinerja kebocoran</h3>
              <p className="text-xs text-muted-foreground">
                Ringkasan seluruh laporan kebocoran pipa dinas
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sedangEkspor}
              onClick={unduhLaporan}
            >
              {sedangEkspor ? "Menyiapkan…" : "Ekspor"}
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric
              label="Sedang aktif"
              value={formatAngka.format(ringkasan.aktif)}
            />
            <Metric
              label="30 hari terakhir"
              value={formatAngka.format(ringkasan.laporan30Hari)}
            />
            <Metric
              label="Rata-rata respons"
              value={
                ringkasan.rataRataResponsJam === null
                  ? "—"
                  : `${ringkasan.rataRataResponsJam.toFixed(1)} jam`
              }
              detail="Dari laporan ke respons pertama"
            />
            <Metric
              label="Rata-rata selesai"
              value={
                ringkasan.rataRataPenyelesaianJam === null
                  ? "—"
                  : `${ringkasan.rataRataPenyelesaianJam.toFixed(1)} jam`
              }
              detail="Dari laporan sampai selesai"
            />
          </div>

          <section aria-labelledby="trend-heading" className="mt-5">
            <h4
              id="trend-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Tren 6 bulan
            </h4>
            <div className="mt-3 space-y-2">
              {ringkasan.trenBulanan.map((row) => (
                <div
                  key={row.bulan}
                  className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-xs"
                >
                  <span className="text-muted-foreground">
                    {labelBulan(row.bulan)}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(row.jumlah / puncakTren) * 100}%` }}
                    />
                  </div>
                  <span className="text-right tabular-nums">{row.jumlah}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="hotspot-heading" className="mt-5">
            <h4
              id="hotspot-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Hotspot kelurahan · 12 bulan
            </h4>
            {ringkasan.hotspot.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {ringkasan.hotspot.map((row, index) => (
                  <li
                    key={row.kelurahan}
                    className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-2 text-xs"
                  >
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span className="min-w-0">
                      <span className="block truncate">{row.kelurahan}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-destructive/70"
                          style={{
                            width: `${(row.jumlah / puncakHotspot) * 100}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {row.jumlah}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Belum ada data laporan untuk periode ini.
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="aset" className="min-h-0 overflow-y-auto p-3">
          <h3 className="text-sm font-semibold">Kesiapan data aset</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Ringkasan berikut menunjukkan data yang saat ini sudah memiliki
            lokasi dan dapat ditampilkan di peta.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric
              label="Batas kelurahan"
              value={formatAngka.format(aset.kelurahanDenganGeometri)}
              detail="Area tersedia"
            />
            <Metric
              label="Pelanggan di peta"
              value={formatAngka.format(aset.pelangganBerkoordinat)}
              detail="Titik berkoordinat"
            />
            <Metric
              label="Rute terdata"
              value={formatAngka.format(aset.totalRute)}
            />
            <Metric
              label="Rute di peta"
              value={formatAngka.format(aset.ruteDenganGeometri)}
              detail="Geometri tersedia"
            />
          </div>
          <section
            aria-labelledby="rencana-aset-heading"
            className="mt-5 rounded-lg border border-border/70 p-3"
          >
            <h4 id="rencana-aset-heading" className="text-xs font-semibold">
              Layer aset jaringan berikutnya
            </h4>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  Pipa, valve, meter induk, dan DMA:
                </strong>{" "}
                belum memiliki model aset spasial tersendiri.
              </li>
              <li>
                <strong className="text-foreground">
                  Perawatan dan inspeksi:
                </strong>{" "}
                perlu relasi ke aset, jadwal, penanggung jawab, dan riwayat
                pekerjaan.
              </li>
            </ul>
          </section>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Pengeditan geometri dinonaktifkan sampai sumber data, alur
            persetujuan, dan kewenangan edit aset ditetapkan. Untuk saat ini,
            panel hanya menampilkan dan mengatur layer.
          </p>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
