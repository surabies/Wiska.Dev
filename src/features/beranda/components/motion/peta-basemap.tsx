"use client";

import * as React from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PetaCakupan } from "../../lib/peta-tipe";

const SUMBER_GLYPH =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FONT = ["Noto Sans Regular"];

const WARNA_WILAYAH = ["#2a78d6", "#eb6834", "#1baf7a", "#8a8a86"] as const;

export function PetaBasemap({ data }: { data: PetaCakupan }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    maplibregl.setWorkerUrl("/api/maplibre-worker");

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [107.6098, -6.9147],
      zoom: 11.5,
      attributionControl: { compact: true },
      style: {
        version: 8,
        glyphs: SUMBER_GLYPH,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
          kelurahan: { type: "geojson", data: data.geoJson.kelurahan as never },
          kecamatan: { type: "geojson", data: data.geoJson.kecamatan as never },
          pelanggan: { type: "geojson", data: data.geoJson.pelanggan as never },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            paint: {
              "raster-brightness-max": 0.9,
              "raster-saturation": -0.2,
              "raster-contrast": 0,
            },
          },
        ],
      },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      map.addLayer({
        id: "kelurahan-isi",
        type: "fill",
        source: "kelurahan",
        paint: {
          "fill-color": [
            "match",
            ["get", "warna"],
            0,
            WARNA_WILAYAH[0],
            1,
            WARNA_WILAYAH[1],
            2,
            WARNA_WILAYAH[2],
            WARNA_WILAYAH[3],
          ],
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "kelurahan-garis",
        type: "line",
        source: "kelurahan",
        paint: {
          "line-color": "#2dd4bf",
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "kelurahan-nama",
        type: "symbol",
        source: "kelurahan",
        minzoom: 11,
        layout: {
          "text-field": ["get", "nama"],
          "text-font": FONT,
          "text-size": 10,
          "text-padding": 6,
        },
        paint: {
          "text-color": "#171717",
          "text-halo-color": "#fafafa",
          "text-halo-width": 1.2,
        },
      });
      map.addLayer({
        id: "kecamatan-garis",
        type: "line",
        source: "kecamatan",
        paint: {
          "line-color": "#f8fafc",
          "line-width": 2.4,
          "line-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "pelanggan-titik",
        type: "circle",
        source: "pelanggan",
        paint: {
          "circle-color": "#34d399",
          "circle-radius": 4,
          "circle-opacity": 0.8,
          "circle-stroke-color": "#071b16",
          "circle-stroke-width": 1,
        },
      });

      const { minLng, maxLat, skala, offsetX, offsetY } = data.proyeksi;
      const maxLng = minLng + (data.lebar - offsetX) / skala;
      const minLat = maxLat - (data.tinggi - offsetY) / skala;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 24, duration: 0 },
      );
    });

    return () => map.remove();
  }, [data]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      <div
        ref={containerRef}
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className="h-90 w-full overscroll-contain sm:h-120"
      />
      <div className="border-t border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
        Batas wilayah administratif dan titik sambungan pelanggan anonim.
      </div>
    </div>
  );
}
