"use client";

// features/dashboard/components/peta-wilayah.tsx — peta operasional MapLibre:
// batas kecamatan/kelurahan, pelanggan, potensi pelanggan, rute, dan laporan.
//
// Basemap: raster OpenStreetMap langsung (tanpa API key). Untuk produksi
// ber-traffic tinggi sebaiknya diganti penyedia tile sendiri/berbayar —
// kebijakan tile.openstreetmap.org melarang beban berat.
//
// Data datang via PROP dari server component (GeoJSON FeatureCollection) —
// komponen ini tidak fetch sendiri.
//
// Warna WebGL ditetapkan oleh peta-layer, sedangkan popup DOM memakai token
// tema CSS; pergantian tema tidak membangun ulang peta atau mengubah posisinya.
import * as React from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import type { Geometry, Point } from "geojson";
import type { FC } from "../../lib/geo-queries";
import type {
  RingkasanAsetPeta,
  RingkasanLaporanPeta,
} from "../../lib/peta-queries";
import { PanelPeta, type FokusPeta } from "./panel-peta";
import {
  ekspresiWarnaPelanggan,
  ekspresiWarnaWilayah,
  tambahLayerPeta,
  temaLayerPeta,
  type VisibilitasLayer,
} from "./peta-layers";
import { pasangPopupFiturPeta } from "./peta-popup";

const PUSAT_BANDUNG: [number, number] = [107.6098, -6.9147];

/// Sumber glyph — WAJIB ADA, dan ketiadaannya yang membuat peta membanjiri
/// konsol dengan galat setiap kali diperbesar. Lapisan `symbol` (angka pada
/// gugus titik, nama kelurahan) menggambar teks dari font vektor, dan gaya
/// peta ini sebelumnya tidak menyebutkan satu pun sumber font. Setiap ubin
/// baru yang masuk saat zoom mencoba memuat glyph, gagal, lalu melapor —
/// jadi makin diperbesar makin banyak galatnya.
const SUMBER_GLYPH =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

function pasangZoomCluster(
  map: maplibregl.Map,
  sourceId: string,
  layerId: string,
) {
  map.on("click", layerId, async (event) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    if (
      typeof clusterId !== "number" ||
      !feature ||
      feature.geometry.type !== "Point"
    )
      return;

    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
    try {
      const zoom = await source.getClusterExpansionZoom(clusterId);
      if (!map.getLayer(layerId)) return;
      map.easeTo({
        center: (feature.geometry as Point).coordinates as [number, number],
        zoom,
      });
    } catch (error) {
      console.error(`Gagal memperbesar cluster ${sourceId}:`, error);
    }
  });
}

export function PetaWilayah({
  kecamatan,
  kelurahan,
  rute,
  pelanggan,
  statistikPelanggan,
  potensi,
  eksPelanggan,
  pengaduan,
  daftarKebocoran,
  ringkasan,
  aset,
}: {
  kecamatan: FC;
  kelurahan: FC;
  rute: FC;
  pelanggan: FC;
  statistikPelanggan: {
    total: number;
    berkoordinat: number;
    tanpaKoordinat: number;
  };
  potensi: FC;
  eksPelanggan: FC;
  pengaduan: FC;
  daftarKebocoran: Awaited<
    ReturnType<typeof import("../../lib/peta-queries").daftarKebocoranAktifPeta>
  >;
  ringkasan: RingkasanLaporanPeta;
  aset: RingkasanAsetPeta;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const [mapStatus, setMapStatus] = React.useState<
    "loading" | "ready" | "error"
  >("loading");
  const [fokus, setFokus] = React.useState<FokusPeta | null>(null);
  const [visibilitas, setVisibilitas] = React.useState<VisibilitasLayer>({
    kecamatan: true,
    kelurahan: true,
    rute: rute.features.length > 0,
    pelanggan: true,
    potensi: true,
    eksPelanggan: true,
    pengaduan: true,
  });
  const { resolvedTheme } = useTheme();
  const gelap = resolvedTheme === "dark";

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Nilai saat peta DIBANGUN saja (efek ini sengaja tanpa dependensi —
    // peta tidak boleh dibangun ulang tiap ganti tema). Pada render pertama
    // next-themes belum tahu tema tersimpannya, jadi nilai ini bisa saja
    // "terang" sesaat; effect kedua di bawah yang membetulkannya begitu
    // temanya diketahui.
    const w = temaLayerPeta(gelap);

    maplibregl.setWorkerUrl("/api/maplibre-worker");

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: PUSAT_BANDUNG,
      zoom: 11.5,
      maxZoom: 19,
      style: {
        version: 8,
        // Tanpa `glyphs`, tiap lapisan symbol (angka gugus, nama kelurahan)
        // gagal memuat font dan melapor per ubin — lihat SUMBER_GLYPH.
        glyphs: SUMBER_GLYPH,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            // Server tile OSM mentok di zoom 19; jangan minta tile zoom 20
            // yang berakhir sebagai AJAX/CORS errors.
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm", paint: { ...w.raster } },
        ],
      },
    });
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    const styleLoadTimeout = window.setTimeout(() => {
      setMapStatus((status) => (status === "loading" ? "error" : status));
    }, 20000);
    map.on("error", (event) => {
      console.error("MapLibre map error:", event.error);
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    let layerSudahDitambahkan = false;
    const saatStyleSiap = () => {
      if (layerSudahDitambahkan || !map.isStyleLoaded()) return;
      layerSudahDitambahkan = true;
      window.clearTimeout(styleLoadTimeout);
      setMapStatus("ready");
      // ---- Layer wilayah dan aset ----
      tambahLayerPeta({
        map,
        kecamatan,
        kelurahan,
        rute,
        pelanggan,
        potensi,
        eksPelanggan,
        pengaduan,
        visibilitas,
        tema: w,
      });
      pasangPopupFiturPeta(map);

      pasangZoomCluster(map, "pelanggan", "pelanggan-cluster");
      pasangZoomCluster(map, "potensi", "potensi-cluster");
      pasangZoomCluster(map, "eks-pelanggan", "eks-pelanggan-cluster");
      pasangZoomCluster(map, "pengaduan", "pengaduan-cluster");

      // Pas-kan tampilan ke data yang ada.
      const semua: number[][] = [];
      for (const fc of [
        kelurahan,
        pelanggan,
        potensi,
        eksPelanggan,
        pengaduan,
      ]) {
        for (const feat of fc.features) {
          const g = feat.geometry as Geometry;
          if (g.type === "Point") semua.push(g.coordinates as number[]);
        }
      }
      if (semua.length > 0) {
        const lngs = semua.map((c) => c[0]!);
        const lats = semua.map((c) => c[1]!);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 48, maxZoom: 14, duration: 0 },
        );
      }
    };
    // Inline style kadang sudah siap sebelum listener dipasang. Periksa juga
    // status langsung dan gunakan load sebagai fallback untuk event lifecycle.
    map.on("style.load", saatStyleSiap);
    map.on("load", saatStyleSiap);
    saatStyleSiap();

    return () => {
      window.clearTimeout(styleLoadTimeout);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Data datang dari server render sekali — peta tidak perlu di-rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready") return;
    const layerGroups: Record<keyof VisibilitasLayer, string[]> = {
      kecamatan: ["kecamatan-isi", "kecamatan-garis", "kecamatan-nama"],
      kelurahan: ["kelurahan-isi", "kelurahan-garis", "kelurahan-nama"],
      rute: ["rute-garis"],
      pelanggan: [
        "pelanggan-cluster",
        "pelanggan-cluster-angka",
        "pelanggan-titik",
      ],
      potensi: ["potensi-cluster", "potensi-cluster-angka", "potensi-titik"],
      eksPelanggan: [
        "eks-pelanggan-cluster",
        "eks-pelanggan-cluster-angka",
        "eks-pelanggan-titik",
      ],
      pengaduan: [
        "pengaduan-cluster",
        "pengaduan-cluster-angka",
        "pengaduan-titik",
      ],
    };
    for (const [key, visible] of Object.entries(visibilitas) as Array<
      [keyof VisibilitasLayer, boolean]
    >) {
      for (const layer of layerGroups[key]) {
        if (map.getLayer(layer))
          map.setLayoutProperty(
            layer,
            "visibility",
            visible ? "visible" : "none",
          );
      }
    }
  }, [mapStatus, visibilitas]);

  React.useEffect(() => {
    if (!fokus || !mapRef.current || mapStatus !== "ready") return;
    mapRef.current.flyTo({
      center: [fokus.longitude, fokus.latitude],
      zoom: fokus.zoom ?? 15,
      duration: 700,
    });
  }, [fokus, mapStatus]);

  const ubahVisibilitas = React.useCallback(
    (layer: keyof VisibilitasLayer, visible: boolean) => {
      setVisibilitas((sebelumnya) => ({ ...sebelumnya, [layer]: visible }));
    },
    [],
  );

  // Pergantian tema: warna lapisan diperbarui DI TEMPAT. Membangun ulang
  // peta akan melempar pengguna kembali ke tampilan awal — posisi dan zoom
  // yang sudah dicari hilang hanya karena menekan tombol tema.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const w = temaLayerPeta(gelap);

    function terapkan() {
      if (!map || !map.isStyleLoaded()) return;
      for (const [prop, nilai] of Object.entries(w.raster)) {
        map.setPaintProperty("osm", prop as "raster-brightness-max", nilai);
      }
      map.setPaintProperty("kecamatan-isi", "fill-color", w.aksen);
      map.setPaintProperty("kecamatan-garis", "line-color", w.aksen);
      map.setPaintProperty("kecamatan-nama", "text-color", w.teksLabel);
      map.setPaintProperty("kecamatan-nama", "text-halo-color", w.tepiLabel);
      map.setPaintProperty(
        "kelurahan-isi",
        "fill-color",
        ekspresiWarnaWilayah(w),
      );
      map.setPaintProperty("kelurahan-isi", "fill-opacity", w.isiWilayah);
      map.setPaintProperty(
        "kelurahan-garis",
        "line-color",
        ekspresiWarnaWilayah(w),
      );
      map.setPaintProperty("kelurahan-nama", "text-color", w.teksLabel);
      map.setPaintProperty("kelurahan-nama", "text-halo-color", w.tepiLabel);
      map.setPaintProperty("pelanggan-cluster", "circle-color", w.aksen);
      map.setPaintProperty(
        "pelanggan-cluster-angka",
        "text-color",
        w.teksCluster,
      );
      map.setPaintProperty("potensi-cluster", "circle-color", w.potensi);
      map.setPaintProperty(
        "potensi-cluster-angka",
        "text-color",
        w.teksCluster,
      );
      map.setPaintProperty(
        "eks-pelanggan-cluster",
        "circle-color",
        w.eksPelanggan,
      );
      map.setPaintProperty(
        "eks-pelanggan-cluster-angka",
        "text-color",
        w.teksCluster,
      );
      map.setPaintProperty("pengaduan-cluster", "circle-color", w.aduan);
      map.setPaintProperty(
        "pengaduan-cluster-angka",
        "text-color",
        w.teksCluster,
      );
      map.setPaintProperty(
        "pelanggan-titik",
        "circle-color",
        ekspresiWarnaPelanggan(w),
      );
      map.setPaintProperty(
        "pelanggan-titik",
        "circle-stroke-color",
        w.tepiTitik,
      );
      map.setPaintProperty("pengaduan-titik", "circle-color", [
        "case",
        ["in", ["get", "status"], ["literal", ["SELESAI", "DITOLAK", "DITUTUP"]]],
        w.aduanSelesai,
        w.aduan,
      ]);
      map.setPaintProperty(
        "pengaduan-titik",
        "circle-stroke-color",
        w.tepiTitik,
      );
      map.setPaintProperty(
        "eks-pelanggan-titik",
        "circle-color",
        w.eksPelanggan,
      );
      map.setPaintProperty(
        "eks-pelanggan-titik",
        "circle-stroke-color",
        w.tepiTitik,
      );
      map.setPaintProperty("potensi-titik", "circle-color", w.potensi);
      map.setPaintProperty(
        "potensi-titik",
        "circle-stroke-color",
        w.tepiTitik,
      );
    }

    // Tema bisa berganti sebelum gaya peta selesai dimuat (mis. tema
    // tersimpan diterapkan tepat saat halaman dibuka) — `load` menyusul.
    if (map.isStyleLoaded()) terapkan();
    else map.once("load", terapkan);
  }, [gelap]);

  return (
    <section
      aria-label="Peta jaringan dan panel operasional"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      data-map-status={mapStatus}
    >
      <h2 className="sr-only">Peta Operasional</h2>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
        <div className="relative h-[42dvh] min-h-72 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm md:h-auto md:min-h-0 md:flex-1">
          <div ref={containerRef} className="h-full w-full" />
          {mapStatus === "loading" && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <p
                role="status"
                className="bg-background/95 px-4 py-2 text-sm text-muted-foreground shadow-sm"
              >
                Memuat peta…
              </p>
            </div>
          )}
          {mapStatus === "error" && (
            <div
              role="alert"
              className="absolute inset-x-4 top-4 flex justify-center"
            >
              <p className="border border-destructive/40 bg-background/95 px-4 py-2 text-sm text-destructive shadow-sm">
                Peta gagal memuat sebagian data. Muat ulang halaman atau periksa
                koneksi.
              </p>
            </div>
          )}
          {kelurahan.features.length === 0 &&
            kecamatan.features.length === 0 &&
            rute.features.length === 0 &&
            pelanggan.features.length === 0 &&
            potensi.features.length === 0 &&
            eksPelanggan.features.length === 0 &&
            pengaduan.features.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <p className="pointer-events-auto max-w-md border border-border bg-background/95 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground shadow-sm">
                  Belum ada data spasial yang tersedia. Peta akan menampilkan
                  layer setelah geometri wilayah atau koordinat aset diimpor.
                </p>
              </div>
            )}
        </div>
        <PanelPeta
          visibilitas={visibilitas}
          onVisibilitasChange={ubahVisibilitas}
          onFokus={setFokus}
          kebocoranAktif={daftarKebocoran}
          ringkasan={ringkasan}
          aset={aset}
          pelangganTanpaKoordinat={statistikPelanggan.tanpaKoordinat}
          jumlahKelurahan={kelurahan.features.length}
          jumlahKecamatan={kecamatan.features.length}
          jumlahPelanggan={pelanggan.features.length}
          jumlahPotensi={potensi.features.length}
          jumlahEksPelanggan={eksPelanggan.features.length}
          jumlahPengaduan={pengaduan.features.length}
          jumlahRute={rute.features.length}
        />
      </div>
    </section>
  );
}
