"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import "./peta.css"

import type { FC } from "@/features/dashboard/peta-wilayah/types/TipePetaWilayah"
import * as maplibregl from "maplibre-gl"
import type {
  ExpressionSpecification,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map as MapLibreMap,
} from "maplibre-gl"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useTheme } from "next-themes"
import { FONT_KLASTER, PETA, STATUS_META, buatGayaPeta } from "../lib/KonstantaPengaduan"
import type { Pengaduan, TitikDraft } from "../types/TipePengaduan"

// Atur worker URL jika di browser
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/api/maplibre-worker")
}

/** Perintah yang bisa dipanggil container terhadap peta. */
export interface PetaHandle {
  terbangKe: (lng: number, lat: number, zoom?: number) => void
  zoomMasuk: () => void
  zoomKeluar: () => void
}

export interface VisibilitasPeta {
  wilayah: boolean
  pelanggan: boolean
  aduan: boolean
}

interface Props {
  data: Pengaduan[]
  kelurahan?: FC | null
  kecamatan?: FC | null
  pelanggan?: FC | null
  visibilitas?: VisibilitasPeta
  terpilihId: string | null
  draft: TitikDraft | null
  popupDraft: ReactNode // isi popup koordinat (dirender lewat portal)
  modePilih: boolean // true saat pengguna diminta memilih lokasi
  onSiap: (handle: PetaHandle) => void
  onKlikPeta: (lng: number, lat: number) => void
  onPilihPengaduan: (id: string) => void
}

const SUMBER = "pengaduan"
type DataGeo = Exclude<GeoJSONSourceSpecification["data"], string>

// Pengaduan -> GeoJSON. Jika terdapat koordinat yang sama (seperti data uji pada titik pusat yang sama),
// lakukan sebaran melingkar mikro (~25m) agar semua titik terlihat dan bisa diklik secara individual.
function keGeoJSON(data: Pengaduan[]): DataGeo {
  const koordinatCount = new Map<string, number>()

  return {
    type: "FeatureCollection",
    features: data.map((p) => {
      const key = `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`
      const count = koordinatCount.get(key) ?? 0
      koordinatCount.set(key, count + 1)

      let lng = p.lng
      let lat = p.lat
      if (count > 0) {
        const sudut = (count * 2 * Math.PI) / 6
        const radius = 0.00035 * Math.ceil(count / 6) // ~30-40 meter
        lng += radius * Math.cos(sudut)
        lat += radius * Math.sin(sudut)
      }

      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [lng, lat] },
        properties: {
          id: p.id,
          nomor: p.nomor,
          judul: p.judul || p.nomor,
          status: p.status,
          kategori: p.kategori,
          prioritas: p.prioritas || "NORMAL",
        },
      }
    }),
  }
}

const WARNA_STATUS: ExpressionSpecification = [
  "match",
  ["get", "status"],
  ...Object.entries(STATUS_META).flatMap(([k, v]) => [k, v.warna]),
  "#64748b",
] as unknown as ExpressionSpecification

export function PetaPengaduanCanvas({
  data,
  kelurahan,
  kecamatan,
  pelanggan,
  visibilitas = { wilayah: true, pelanggan: false, aduan: true },
  terpilihId,
  draft,
  popupDraft,
  modePilih,
  onSiap,
  onKlikPeta,
  onPilihPengaduan,
}: Props) {
  const { resolvedTheme } = useTheme()
  const gelap = resolvedTheme === "dark"

  const wadahRef = useRef<HTMLDivElement>(null)
  const petaRef = useRef<MapLibreMap | null>(null)
  const penandaRef = useRef<maplibregl.Marker | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [siap, setSiap] = useState(false)

  // Elemen DOM tempat popup MapLibre berisi komponen React (lewat portal)
  const [popupEl] = useState(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  )

  // Callback & data terbaru disimpan di ref supaya handler peta tidak basi
  const cb = useRef({ onSiap, onKlikPeta, onPilihPengaduan })
  const dataRef = useRef(data)
  const kelurahanRef = useRef(kelurahan)
  const kecamatanRef = useRef(kecamatan)
  const pelangganRef = useRef(pelanggan)
  const visibilitasRef = useRef(visibilitas)

  useEffect(() => {
    cb.current = { onSiap, onKlikPeta, onPilihPengaduan }
    dataRef.current = data
    kelurahanRef.current = kelurahan
    kecamatanRef.current = kecamatan
    pelangganRef.current = pelanggan
    visibilitasRef.current = visibilitas
  })

  // 1) Buat peta sekali
  useEffect(() => {
    if (!wadahRef.current || petaRef.current) return

    maplibregl.setWorkerUrl("/api/maplibre-worker")

    // Deteksi sinkron apakah browser saat ini dalam tema gelap (dari class HTML langsung)
    const isGelapAwal =
      typeof document !== "undefined"
        ? document.documentElement.classList.contains("dark")
        : false

    const peta = new maplibregl.Map({
      container: wadahRef.current,
      style: buatGayaPeta(isGelapAwal),
      center: PETA.pusat,
      zoom: PETA.zoom,
      minZoom: PETA.zoomMin,
      attributionControl: { compact: true },
    })
    petaRef.current = peta

    const ro = new ResizeObserver(() => {
      peta.resize()
    })
    ro.observe(wadahRef.current)

    requestAnimationFrame(() => peta.resize())
    const tResize = setTimeout(() => peta.resize(), 300)

    peta.on("error", (e) => {
      console.error("MapLibre runtime error:", e.error)
    })

    let layerSudahDitambahkan = false
    const inisialisasiLayer = () => {
      if (layerSudahDitambahkan || !peta.isStyleLoaded()) return
      layerSudahDitambahkan = true
      peta.resize()

      const curVis = visibilitasRef.current

      // A) Layer Batas Wilayah: Kelurahan
      if (kelurahanRef.current && kelurahanRef.current.features?.length > 0) {
        peta.addSource("kelurahan", {
          type: "geojson",
          data: kelurahanRef.current as unknown as GeoJSON.FeatureCollection,
        })
        peta.addLayer({
          id: "kelurahan-isi",
          type: "fill",
          source: "kelurahan",
          layout: { visibility: curVis.wilayah ? "visible" : "none" },
          paint: {
            "fill-color": [
              "match",
              ["get", "warna"],
              0, "#2a78d6",
              1, "#eb6834",
              2, "#1baf7a",
              "#8a8a86",
            ],
            "fill-opacity": 0.12,
          },
        })
        peta.addLayer({
          id: "kelurahan-garis",
          type: "line",
          source: "kelurahan",
          layout: { visibility: curVis.wilayah ? "visible" : "none" },
          paint: {
            "line-color": [
              "match",
              ["get", "warna"],
              0, "#2a78d6",
              1, "#eb6834",
              2, "#1baf7a",
              "#8a8a86",
            ],
            "line-width": 1.5,
            "line-opacity": 0.7,
          },
        })
        peta.addLayer({
          id: "kelurahan-nama",
          type: "symbol",
          source: "kelurahan",
          minzoom: 12,
          layout: {
            "text-field": ["get", "nama"],
            "text-font": FONT_KLASTER,
            "text-size": 11,
            "text-transform": "uppercase",
            "text-letter-spacing": 0.05,
            visibility: curVis.wilayah ? "visible" : "none",
          },
          paint: {
            "text-color": isGelapAwal ? "#f8fafc" : "#334155",
            "text-halo-color": isGelapAwal ? "#0f172a" : "#ffffff",
            "text-halo-width": 1.5,
          },
        })
      }

      // B) Layer Batas Wilayah: Kecamatan
      if (kecamatanRef.current && kecamatanRef.current.features?.length > 0) {
        peta.addSource("kecamatan", {
          type: "geojson",
          data: kecamatanRef.current as unknown as GeoJSON.FeatureCollection,
        })
        peta.addLayer({
          id: "kecamatan-garis",
          type: "line",
          source: "kecamatan",
          layout: { visibility: curVis.wilayah ? "visible" : "none" },
          paint: {
            "line-color": isGelapAwal ? "#2dd4bf" : "#0d9488",
            "line-width": 2,
            "line-dasharray": [2, 1],
            "line-opacity": 0.85,
          },
        })
        peta.addLayer({
          id: "kecamatan-nama",
          type: "symbol",
          source: "kecamatan",
          minzoom: 9.5,
          maxzoom: 12.5,
          layout: {
            "text-field": ["get", "nama"],
            "text-font": FONT_KLASTER,
            "text-size": 13,
            "text-transform": "uppercase",
            visibility: curVis.wilayah ? "visible" : "none",
          },
          paint: {
            "text-color": isGelapAwal ? "#2dd4bf" : "#0f766e",
            "text-halo-color": isGelapAwal ? "#090d16" : "#ffffff",
            "text-halo-width": 2,
          },
        })
      }

      // C) Layer Titik Sambungan Pelanggan
      if (pelangganRef.current && pelangganRef.current.features?.length > 0) {
        peta.addSource("pelanggan", {
          type: "geojson",
          data: pelangganRef.current as unknown as GeoJSON.FeatureCollection,
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        })
        peta.addLayer({
          id: "pelanggan-cluster",
          type: "circle",
          source: "pelanggan",
          layout: { visibility: curVis.pelanggan ? "visible" : "none" },
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0d9488",
            "circle-opacity": 0.8,
            "circle-radius": ["step", ["get", "point_count"], 12, 50, 16, 200, 22],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        })
        peta.addLayer({
          id: "pelanggan-cluster-angka",
          type: "symbol",
          source: "pelanggan",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": FONT_KLASTER,
            "text-size": 10,
            visibility: curVis.pelanggan ? "visible" : "none",
          },
          paint: { "text-color": "#ffffff" },
        })
        peta.addLayer({
          id: "pelanggan-titik",
          type: "circle",
          source: "pelanggan",
          filter: ["!", ["has", "point_count"]],
          layout: { visibility: curVis.pelanggan ? "visible" : "none" },
          paint: {
            "circle-color": "#10b981",
            "circle-radius": 3.5,
            "circle-opacity": 0.75,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        })
      }

      // D) Layer Utama: Titik Pengaduan (Tanpa klaster hitam; semua titik tampil individual dengan warna status resmi)
      peta.addSource(SUMBER, {
        type: "geojson",
        data: keGeoJSON(dataRef.current),
        cluster: false,
      })

      // Halo berpendar lembut di sekeliling titik
      peta.addLayer({
        id: "titik-halo",
        type: "circle",
        source: SUMBER,
        layout: { visibility: curVis.aduan ? "visible" : "none" },
        paint: {
          "circle-color": WARNA_STATUS,
          "circle-radius": 16,
          "circle-opacity": 0.22,
          "circle-stroke-width": 1,
          "circle-stroke-color": WARNA_STATUS,
          "circle-stroke-opacity": 0.4,
        },
      })

      // Titik utama aduan dengan warna status dan garis tepi putih kontras
      peta.addLayer({
        id: "titik",
        type: "circle",
        source: SUMBER,
        layout: { visibility: curVis.aduan ? "visible" : "none" },
        paint: {
          "circle-color": WARNA_STATUS,
          "circle-radius": 8.5,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      })

      // Label nomor tiket saat diperbesar (zoom >= 13)
      peta.addLayer({
        id: "titik-label",
        type: "symbol",
        source: SUMBER,
        minzoom: 13,
        layout: {
          "text-field": ["get", "nomor"],
          "text-font": FONT_KLASTER,
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          visibility: curVis.aduan ? "visible" : "none",
        },
        paint: {
          "text-color": isGelapAwal ? "#f8fafc" : "#0f172a",
          "text-halo-color": isGelapAwal ? "#0f172a" : "#ffffff",
          "text-halo-width": 2,
        },
      })

      // Lingkaran penanda untuk titik yang sedang aktif/terpilih
      peta.addLayer({
        id: "titik-terpilih",
        type: "circle",
        source: SUMBER,
        filter: ["==", ["get", "id"], ""],
        layout: { visibility: curVis.aduan ? "visible" : "none" },
        paint: {
          "circle-radius": 15,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 3.5,
          "circle-stroke-color": isGelapAwal ? "#38bdf8" : "#0f172a",
        },
      })

      setSiap(true)
    }

    peta.on("load", inisialisasiLayer)
    peta.on("styledata", inisialisasiLayer)

    // 5) Handler klik interaktif
    peta.on("click", (e) => {
      const f = peta.queryRenderedFeatures(e.point, {
        layers: ["titik", "pelanggan-cluster"].filter((id) => peta.getLayer(id)),
      })[0]

      if (!f) {
        cb.current.onKlikPeta(e.lngLat.lng, e.lngLat.lat)
        return
      }
      if (f.geometry.type !== "Point") return
      const coordinates = f.geometry.coordinates as [number, number]
      const [lng, lat] = coordinates

      if (f.layer.id === "pelanggan-cluster") {
        const clusterId = Number(f.properties?.cluster_id)
        if (!Number.isNaN(clusterId)) {
          const sumber = peta.getSource("pelanggan") as GeoJSONSource | undefined
          sumber
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => peta.easeTo({ center: [lng, lat], zoom }))
        }
        return
      }

      if (f.layer.id === "titik") {
        cb.current.onPilihPengaduan(String(f.properties?.id ?? ""))
      }
    })

    for (const id of ["titik", "pelanggan-cluster"]) {
      peta.on("mouseenter", id, () => {
        peta.getCanvas().style.cursor = "pointer"
      })
      peta.on("mouseleave", id, () => {
        peta.getCanvas().style.cursor = ""
      })
    }

    // 6) Serahkan perintah peta ke container
    cb.current.onSiap({
      terbangKe: (lng, lat, zoom = PETA.zoomTitik) => peta.flyTo({ center: [lng, lat], zoom }),
      zoomMasuk: () => peta.zoomIn(),
      zoomKeluar: () => peta.zoomOut(),
    })

    return () => {
      clearTimeout(tResize)
      ro.disconnect()
      peta.remove()
      petaRef.current = null
      penandaRef.current = null
      popupRef.current = null
      setSiap(false)
    }
  }, [])

  // Sinkronkan data
  useEffect(() => {
    if (!siap) return
    ;(petaRef.current?.getSource(SUMBER) as GeoJSONSource | undefined)?.setData(keGeoJSON(data))
  }, [data, siap])

  // Sorot titik terpilih
  useEffect(() => {
    if (!siap) return
    petaRef.current?.setFilter("titik-terpilih", ["==", ["get", "id"], terpilihId ?? ""])
  }, [terpilihId, siap])

  // Kursor crosshair saat memilih lokasi
  useEffect(() => {
    if (!siap || !petaRef.current) return
    petaRef.current.getCanvas().style.cursor = modePilih ? "crosshair" : ""
  }, [modePilih, siap])

  // Sinkronkan visibilitas layer peta secara dinamis
  useEffect(() => {
    const peta = petaRef.current
    if (!siap || !peta) return

    const visWilayah = visibilitas.wilayah ? "visible" : "none"
    for (const id of [
      "kelurahan-isi",
      "kelurahan-garis",
      "kelurahan-nama",
      "kecamatan-garis",
      "kecamatan-nama",
    ]) {
      if (peta.getLayer(id)) peta.setLayoutProperty(id, "visibility", visWilayah)
    }

    const visPelanggan = visibilitas.pelanggan ? "visible" : "none"
    for (const id of [
      "pelanggan-cluster",
      "pelanggan-cluster-angka",
      "pelanggan-titik",
    ]) {
      if (peta.getLayer(id)) peta.setLayoutProperty(id, "visibility", visPelanggan)
    }

    const visAduan = visibilitas.aduan ? "visible" : "none"
    for (const id of ["titik-halo", "titik", "titik-label", "titik-terpilih"]) {
      if (peta.getLayer(id)) peta.setLayoutProperty(id, "visibility", visAduan)
    }
  }, [visibilitas, siap])

  // Sinkronkan tema gelap / terang ke layer raster MapLibre & label spasial
  useEffect(() => {
    const peta = petaRef.current
    if (!peta) return

    function terapkanTema() {
      if (!peta || !peta.isStyleLoaded()) return

      if (peta.getLayer("osm")) {
        peta.setPaintProperty(
          "osm",
          "raster-brightness-max",
          gelap ? 0.45 : 1,
        )
        peta.setPaintProperty(
          "osm",
          "raster-saturation",
          gelap ? -0.7 : 0,
        )
        peta.setPaintProperty(
          "osm",
          "raster-contrast",
          gelap ? -0.15 : 0,
        )
      }

      if (peta.getLayer("kelurahan-nama")) {
        peta.setPaintProperty("kelurahan-nama", "text-color", gelap ? "#f8fafc" : "#334155")
        peta.setPaintProperty("kelurahan-nama", "text-halo-color", gelap ? "#0f172a" : "#ffffff")
      }

      if (peta.getLayer("kecamatan-nama")) {
        peta.setPaintProperty("kecamatan-nama", "text-color", gelap ? "#2dd4bf" : "#0f766e")
        peta.setPaintProperty("kecamatan-nama", "text-halo-color", gelap ? "#090d16" : "#ffffff")
      }

      if (peta.getLayer("kecamatan-garis")) {
        peta.setPaintProperty("kecamatan-garis", "line-color", gelap ? "#2dd4bf" : "#0d9488")
      }

      if (peta.getLayer("titik-label")) {
        peta.setPaintProperty("titik-label", "text-color", gelap ? "#f8fafc" : "#0f172a")
        peta.setPaintProperty("titik-label", "text-halo-color", gelap ? "#0f172a" : "#ffffff")
      }

      if (peta.getLayer("titik-terpilih")) {
        peta.setPaintProperty("titik-terpilih", "circle-stroke-color", gelap ? "#38bdf8" : "#0f172a")
      }
    }

    if (peta.isStyleLoaded()) {
      terapkanTema()
    } else {
      peta.on("styledata", terapkanTema)
      return () => {
        peta.off("styledata", terapkanTema)
      }
    }
  }, [gelap, siap])

  // Penanda + popup di titik yang diklik
  useEffect(() => {
    const peta = petaRef.current
    if (!peta || !siap || !popupEl) return

    if (!draft) {
      penandaRef.current?.remove()
      popupRef.current?.remove()
      penandaRef.current = null
      popupRef.current = null
      return
    }

    const posisi: [number, number] = [draft.lng, draft.lat]

    if (!penandaRef.current) {
      penandaRef.current = new maplibregl.Marker({ color: "#ef4444" })
        .setLngLat(posisi)
        .addTo(peta)
    } else {
      penandaRef.current.setLngLat(posisi)
    }

    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({
        offset: 40, // di atas pin
        closeButton: false, // tombol tutup ada di isi popup
        closeOnClick: false,
        maxWidth: "320px",
      }).setDOMContent(popupEl)
    }
    popupRef.current.setLngLat(posisi).addTo(peta)
  }, [draft, siap, popupEl])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={wadahRef}
        className="h-full w-full"
        style={{ width: "100%", height: "100%", minHeight: "100%" }}
      />
      {popupEl && draft && createPortal(popupDraft, popupEl)}
    </div>
  )
}
