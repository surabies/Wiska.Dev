"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import {
  Layers,
  LocateFixed,
  Minus,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Kolom pencarian lokasi + tombol lokasi saya (posisi atas kanan peta). */
export function KontrolCari({
  onCari,
  onLokasiSaya,
}: {
  onCari: (teks: string) => void
  onLokasiSaya: () => void
}) {
  const [teks, setTeks] = useState("")

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (teks.trim()) onCari(teks.trim())
      }}
      className="flex items-center gap-1 rounded-xl border bg-background/95 backdrop-blur-md p-1 shadow-md"
    >
      <Search className="ml-2.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        placeholder="Cari lokasi gangguan air..."
        aria-label="Cari lokasi"
        className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 rounded-lg hover:bg-accent"
        onClick={onLokasiSaya}
        aria-label="Gunakan lokasi saya"
        title="Gunakan lokasi saya"
      >
        <LocateFixed className="size-4 text-primary" />
      </Button>
    </form>
  )
}

/** Saklar pemilihan lapisan spasial peta GIS. */
export function KontrolLayer({
  visibilitas,
  onUbahVisibilitas,
}: {
  visibilitas: { wilayah: boolean; pelanggan: boolean; aduan: boolean }
  onUbahVisibilitas: (v: { wilayah: boolean; pelanggan: boolean; aduan: boolean }) => void
}) {
  const [buka, setBuka] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="icon"
        className="size-9.5 rounded-xl border bg-background/95 backdrop-blur-xs shadow-md hover:bg-accent transition-colors"
        onClick={() => setBuka(!buka)}
        title="Pengaturan Lapisan Spasial Peta"
        aria-label="Pengaturan Lapisan Spasial Peta"
      >
        <Layers className="size-4.5 text-foreground" />
      </Button>

      {buka && (
        <div className="absolute right-full mr-2.5 top-0 z-30 w-64 rounded-xl border bg-background/95 backdrop-blur-md p-3.5 shadow-2xl flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex flex-col">
              <span className="font-bold text-foreground">Lapisan Peta GIS</span>
              <span className="text-[10px] text-muted-foreground">PERUMDA Tirtawening</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => setBuka(false)}
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 p-1.5 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={visibilitas.wilayah}
              onChange={(e) =>
                onUbahVisibilitas({ ...visibilitas, wilayah: e.target.checked })
              }
              className="rounded size-4 accent-primary"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-foreground">Batas Wilayah</span>
              <span className="text-[10px] text-muted-foreground">Kecamatan & Kelurahan</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 p-1.5 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={visibilitas.pelanggan}
              onChange={(e) =>
                onUbahVisibilitas({ ...visibilitas, pelanggan: e.target.checked })
              }
              className="rounded size-4 accent-emerald-600"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-foreground">Titik Pelanggan</span>
              <span className="text-[10px] text-muted-foreground">Koneksi meter air</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 p-1.5 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={visibilitas.aduan}
              onChange={(e) =>
                onUbahVisibilitas({ ...visibilitas, aduan: e.target.checked })
              }
              className="rounded size-4 accent-red-600"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-foreground">Aduan Gangguan</span>
              <span className="text-[10px] text-muted-foreground">Sebaran laporan warga</span>
            </div>
          </label>
        </div>
      )}
    </div>
  )
}

/** Tombol Pengalih Tema Terang / Gelap yang seimbang dengan kontrol GIS. */
export function PengalihTemaPeta() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="secondary"
      size="icon"
      type="button"
      className="size-9.5 rounded-xl border bg-background/95 backdrop-blur-xs shadow-md hover:bg-accent transition-colors"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Ganti Tema Terang/Gelap"
      title="Ganti Tema Terang/Gelap"
    >
      <Sun aria-hidden="true" className="hidden size-4 dark:block text-amber-400" />
      <Moon aria-hidden="true" className="size-4 dark:hidden text-slate-700" />
    </Button>
  )
}

/** Dok Kontrol Vertikal di sisi kanan peta: Filter Layer, Zoom In/Out, Toggle Tema (Semua Berukuran Seimbang). */
export function KontrolVertikalPeta({
  visibilitas,
  onUbahVisibilitas,
  onMasuk,
  onKeluar,
}: {
  visibilitas: { wilayah: boolean; pelanggan: boolean; aduan: boolean }
  onUbahVisibilitas: (v: { wilayah: boolean; pelanggan: boolean; aduan: boolean }) => void
  onMasuk: () => void
  onKeluar: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 pointer-events-auto">
      {/* 1. Filter Lapisan GIS */}
      <KontrolLayer
        visibilitas={visibilitas}
        onUbahVisibilitas={onUbahVisibilitas}
      />

      {/* 2. Zoom In & Zoom Out */}
      <div className="flex flex-col overflow-hidden rounded-xl border bg-background/95 backdrop-blur-xs shadow-md">
        <Button
          variant="ghost"
          size="icon"
          className="size-9.5 rounded-none hover:bg-accent"
          onClick={onMasuk}
          aria-label="Perbesar Peta"
          title="Perbesar Peta"
        >
          <Plus className="size-4 text-foreground" />
        </Button>
        <div className="h-px bg-border/60" />
        <Button
          variant="ghost"
          size="icon"
          className="size-9.5 rounded-none hover:bg-accent"
          onClick={onKeluar}
          aria-label="Perkecil Peta"
          title="Perkecil Peta"
        >
          <Minus className="size-4 text-foreground" />
        </Button>
      </div>

      {/* 3. Toggle Tema Terang / Gelap */}
      <PengalihTemaPeta />
    </div>
  )
}
