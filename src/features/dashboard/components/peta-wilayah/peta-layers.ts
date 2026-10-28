import * as maplibregl from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { FC } from "../../lib/geo-queries";

export interface VisibilitasLayer {
  kecamatan: boolean;
  kelurahan: boolean;
  rute: boolean;
  pelanggan: boolean;
  potensi: boolean;
  eksPelanggan: boolean;
  pengaduan: boolean;
}

export interface TemaLayerPeta {
  aksen: string;
  aduan: string;
  aduanSelesai: string;
  potensi: string;
  eksPelanggan: string;
  tepiTitik: string;
  teksCluster: string;
  teksLabel: string;
  tepiLabel: string;
  wilayah: readonly [string, string, string, string];
  isiWilayah: number;
  raster: {
    "raster-brightness-max": number;
    "raster-saturation": number;
    "raster-contrast": number;
  };
}

const WARNA_WILAYAH = {
  terang: ["#2a78d6", "#eb6834", "#1baf7a", "#8a8a86"],
  gelap: ["#3987e5", "#d95926", "#199e70", "#9a9a95"],
} as const;

const TEMA_PETA: Record<"terang" | "gelap", TemaLayerPeta> = {
  terang: {
    aksen: "#0d9488",
    aduan: "#dc2626",
    aduanSelesai: "#7c3aed",
    potensi: "#2563eb",
    eksPelanggan: "#64748b",
    tepiTitik: "#ffffff",
    teksCluster: "#ffffff",
    teksLabel: "#111827",
    tepiLabel: "#ffffff",
    wilayah: WARNA_WILAYAH.terang,
    isiWilayah: 0.22,
    raster: {
      "raster-brightness-max": 1,
      "raster-saturation": 0,
      "raster-contrast": 0,
    },
  },
  gelap: {
    aksen: "#2dd4bf",
    aduan: "#f87171",
    aduanSelesai: "#c084fc",
    potensi: "#60a5fa",
    eksPelanggan: "#94a3b8",
    tepiTitik: "#1c2427",
    teksCluster: "#062023",
    teksLabel: "#f9fbfb",
    tepiLabel: "#090b0c",
    wilayah: WARNA_WILAYAH.gelap,
    isiWilayah: 0.3,
    raster: {
      "raster-brightness-max": 0.45,
      "raster-saturation": -0.65,
      "raster-contrast": -0.15,
    },
  },
};

export function temaLayerPeta(gelap: boolean): TemaLayerPeta {
  return gelap ? TEMA_PETA.gelap : TEMA_PETA.terang;
}

export function ekspresiWarnaWilayah(tema: TemaLayerPeta) {
  return [
    "match",
    ["get", "warna"],
    0,
    tema.wilayah[0],
    1,
    tema.wilayah[1],
    2,
    tema.wilayah[2],
    tema.wilayah[3],
  ] as unknown as maplibregl.ExpressionSpecification;
}

export function ekspresiWarnaPelanggan(tema: TemaLayerPeta) {
  return [
    "case",
    ["==", ["get", "dihapus"], true],
    "#64748b",
    [
      "match",
      ["get", "status"],
      "AKTIF",
      tema.aksen,
      "TUTUP_SEMENTARA",
      "#eab308",
      "DISEGEL",
      "#f97316",
      "TUTUP_SPT",
      tema.aduan,
      "#8b5cf6",
    ],
  ] as maplibregl.ExpressionSpecification;
}

function tambahLayerKelurahan(
  map: maplibregl.Map,
  data: FC,
  visible: boolean,
  tema: TemaLayerPeta,
) {
  map.addSource("kelurahan", {
    type: "geojson",
    data: data as FeatureCollection,
  });
  map.addLayer({
    id: "kelurahan-isi",
    type: "fill",
    source: "kelurahan",
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "fill-color": ekspresiWarnaWilayah(tema),
      "fill-opacity": tema.isiWilayah,
    },
  });
  map.addLayer({
    id: "kelurahan-garis",
    type: "line",
    source: "kelurahan",
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "line-color": ekspresiWarnaWilayah(tema),
      "line-width": 1.6,
      "line-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "kelurahan-nama",
    type: "symbol",
    source: "kelurahan",
    layout: {
      "text-field": ["get", "nama"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-transform": "uppercase",
      "text-letter-spacing": 0.05,
      "text-padding": 6,
      visibility: visible ? "visible" : "none",
    },
    minzoom: 11,
    paint: {
      "text-color": tema.teksLabel,
      "text-halo-color": tema.tepiLabel,
      "text-halo-width": 1.4,
    },
  });
}

function tambahLayerKecamatan(
  map: maplibregl.Map,
  data: FC,
  visible: boolean,
  tema: TemaLayerPeta,
) {
  map.addSource("kecamatan", {
    type: "geojson",
    data: data as FeatureCollection,
  });
  map.addLayer({
    id: "kecamatan-isi",
    type: "fill",
    source: "kecamatan",
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "fill-color": tema.aksen,
      "fill-opacity": 0.035,
    },
  });
  map.addLayer({
    id: "kecamatan-garis",
    type: "line",
    source: "kecamatan",
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "line-color": tema.aksen,
      "line-width": 2,
      "line-opacity": 0.8,
      "line-dasharray": [2, 1],
    },
  });
  map.addLayer({
    id: "kecamatan-nama",
    type: "symbol",
    source: "kecamatan",
    layout: {
      "text-field": ["get", "nama"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 13,
      "text-transform": "uppercase",
      "text-letter-spacing": 0.06,
      "text-padding": 8,
      visibility: visible ? "visible" : "none",
    },
    minzoom: 9,
    maxzoom: 12,
    paint: {
      "text-color": tema.teksLabel,
      "text-halo-color": tema.tepiLabel,
      "text-halo-width": 1.8,
    },
  });
}

function tambahLayerRute(map: maplibregl.Map, data: FC, visible: boolean) {
  map.addSource("rute", {
    type: "geojson",
    data: data as FeatureCollection,
  });
  map.addLayer({
    id: "rute-garis",
    type: "line",
    source: "rute",
    layout: { visibility: visible ? "visible" : "none" },
    paint: {
      "line-color": "#7c3aed",
      "line-width": 2.5,
      "line-opacity": 0.9,
    },
  });
}

function tambahLayerTitikTerkelompok({
  map,
  sourceId,
  data,
  visible,
  warnaCluster,
  warnaTitik,
  tema,
}: {
  map: maplibregl.Map;
  sourceId: string;
  data: FC;
  visible: boolean;
  warnaCluster: string;
  warnaTitik: string | maplibregl.ExpressionSpecification;
  tema: TemaLayerPeta;
}) {
  map.addSource(sourceId, {
    type: "geojson",
    data: data as FeatureCollection,
    cluster: true,
    clusterRadius: 45,
    clusterMaxZoom: 15,
  });
  map.addLayer({
    id: `${sourceId}-cluster`,
    type: "circle",
    source: sourceId,
    layout: { visibility: visible ? "visible" : "none" },
    filter: ["has", "point_count"],
    paint: {
      "circle-color": warnaCluster,
      "circle-opacity": 0.88,
      "circle-radius": ["step", ["get", "point_count"], 14, 100, 20, 1000, 28],
    },
  });
  map.addLayer({
    id: `${sourceId}-cluster-angka`,
    type: "symbol",
    source: sourceId,
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      visibility: visible ? "visible" : "none",
    },
    filter: ["has", "point_count"],
    paint: { "text-color": tema.teksCluster },
  });
  map.addLayer({
    id: `${sourceId}-titik`,
    type: "circle",
    source: sourceId,
    layout: { visibility: visible ? "visible" : "none" },
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": warnaTitik,
      "circle-radius": 5,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": tema.tepiTitik,
    },
  });
}

function tambahLayerPelanggan(
  map: maplibregl.Map,
  data: FC,
  visible: boolean,
  tema: TemaLayerPeta,
) {
  tambahLayerTitikTerkelompok({
    map,
    sourceId: "pelanggan",
    data,
    visible,
    warnaCluster: tema.aksen,
    warnaTitik: ekspresiWarnaPelanggan(tema),
    tema,
  });
}

function tambahLayerPotensi(
  map: maplibregl.Map,
  data: FC,
  visible: boolean,
  tema: TemaLayerPeta,
) {
  tambahLayerTitikTerkelompok({
    map,
    sourceId: "potensi",
    data,
    visible,
    warnaCluster: tema.potensi,
    warnaTitik: tema.potensi,
    tema,
  });
}

function tambahLayerPengaduan(
  map: maplibregl.Map,
  data: FC,
  visible: boolean,
  tema: TemaLayerPeta,
) {
  tambahLayerTitikTerkelompok({
    map,
    sourceId: "pengaduan",
    data,
    visible,
    warnaCluster: tema.aduan,
    warnaTitik: [
      "case",
      ["in", ["get", "status"], ["literal", ["SELESAI", "DITOLAK", "DITUTUP"]]],
      tema.aduanSelesai,
      tema.aduan,
    ] as maplibregl.ExpressionSpecification,
    tema,
  });
}

function tambahLayerEksPelanggan(
  map: maplibregl.Map,
  data: FC,
  visible: boolean,
  tema: TemaLayerPeta,
) {
  tambahLayerTitikTerkelompok({
    map,
    sourceId: "eks-pelanggan",
    data,
    visible,
    warnaCluster: tema.eksPelanggan,
    warnaTitik: tema.eksPelanggan,
    tema,
  });
}

export function tambahLayerPeta({
  map,
  kecamatan,
  kelurahan,
  rute,
  pelanggan,
  potensi,
  eksPelanggan,
  pengaduan,
  visibilitas,
  tema,
}: {
  map: maplibregl.Map;
  kecamatan: FC;
  kelurahan: FC;
  rute: FC;
  pelanggan: FC;
  potensi: FC;
  eksPelanggan: FC;
  pengaduan: FC;
  visibilitas: VisibilitasLayer;
  tema: TemaLayerPeta;
}) {
  tambahLayerKecamatan(map, kecamatan, visibilitas.kecamatan, tema);
  tambahLayerKelurahan(map, kelurahan, visibilitas.kelurahan, tema);
  tambahLayerRute(map, rute, visibilitas.rute);
  tambahLayerPelanggan(map, pelanggan, visibilitas.pelanggan, tema);
  tambahLayerPotensi(map, potensi, visibilitas.potensi, tema);
  tambahLayerEksPelanggan(
    map,
    eksPelanggan,
    visibilitas.eksPelanggan,
    tema,
  );
  tambahLayerPengaduan(map, pengaduan, visibilitas.pengaduan, tema);
}
