"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Invoice01Icon,
  Search01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Edit02Icon,
  Coins01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ambilDaftarTarif } from "../api/ApiTarif"
import type { TarifGolonganItem } from "../types/TipeTarif"
import { DialogTetapkanBlok } from "./dialogs/DialogTetapkanBlok"
import { DialogTarifGolongan } from "./dialogs/DialogTarifGolongan"

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatTanggal(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export function KelolaTarifView() {
  const [daftarTarif, setDaftarTarif] = useState<TarifGolonganItem[]>([])
  const [cari, setCari] = useState("")
  const [kategoriPilihan, setKategoriPilihan] = useState<string>("SEMUA")
  const [memuat, setMemuat] = useState(true)

  // Dialog State
  const [dialogBlokBuka, setDialogBlokBuka] = useState(false)
  const [tarifPilihan, setTarifPilihan] = useState<TarifGolonganItem | null>(null)

  const [dialogGolonganBuka, setDialogGolonganBuka] = useState(false)
  const [golonganEdit, setGolonganEdit] = useState<TarifGolonganItem | null>(null)

  const muatData = useCallback(async () => {
    setMemuat(true)
    try {
      const data = await ambilDaftarTarif().catch(() => [])
      setDaftarTarif(data)
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muatData()
  }, [muatData])

  // Hitung metrik ringkasan
  const totalGolongan = daftarTarif.length
  const totalBlok = daftarTarif.reduce(
    (acc, t) => acc + (t.blokTarif?.length ?? 0),
    0
  )
  const daftarKategoriUnik = Array.from(
    new Set(daftarTarif.map((t) => t.kategori))
  ).filter(Boolean)

  // Filter
  const q = cari.toLowerCase().trim()
  const tarifTersaring = daftarTarif.filter((t) => {
    const cocokTeks =
      t.kode.toLowerCase().includes(q) ||
      t.nama.toLowerCase().includes(q) ||
      t.kategori.toLowerCase().includes(q) ||
      t.kodeAsli.toLowerCase().includes(q)
    const cocokKategori =
      kategoriPilihan === "SEMUA" || t.kategori === kategoriPilihan
    return cocokTeks && cocokKategori
  })

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. KARTU RINGKASAN METRIK HARGA AIR ────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Golongan Pelanggan
            </CardTitle>
            <HugeiconsIcon icon={Invoice01Icon} className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGolongan}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {daftarKategoriUnik.length} klasifikasi kategori tarif air
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blok Progresif Terdaftar
            </CardTitle>
            <HugeiconsIcon icon={Layers01Icon} className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBlok} Blok</div>
            <p className="text-xs text-muted-foreground mt-1">
              Struktur harga berjenjang pemakaian kubikasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sistem Penagihan Air
            </CardTitle>
            <HugeiconsIcon icon={Coins01Icon} className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Progresif SK</div>
            <p className="text-xs text-muted-foreground mt-1">
              Histori masa berlaku tarif terkunci per tanggal SK
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. TABEL STRUKTUR TARIF & HARGA AIR PROGRESIF ──────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Daftar Golongan & Harga Air per Kubik (m³)</CardTitle>
              <CardDescription>
                Kelola klasifikasi golongan pelanggan dan tetapkan nominal harga air progresif per meter kubik (m³).
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setGolonganEdit(null)
                setDialogGolonganBuka(true)
              }}
            >
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 h-4 w-4" />
              Tambah Golongan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Baris Filter & Kategori */}
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={kategoriPilihan === "SEMUA" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setKategoriPilihan("SEMUA")}
              >
                Semua Kategori
              </Button>
              {daftarKategoriUnik.map((kat) => (
                <Button
                  key={kat}
                  variant={kategoriPilihan === kat ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setKategoriPilihan(kat)}
                >
                  {kat}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              />
              <Input
                placeholder="Cari kode atau nama tarif…"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </div>

          {/* Tabel Tarif */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Kode</TableHead>
                  <TableHead className="w-56">Nama Golongan Pelanggan</TableHead>
                  <TableHead className="w-32">Kategori</TableHead>
                  <TableHead>Harga Air per Blok Progresif (m³ & Rp)</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-44 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memuat ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Memuat struktur harga tarif air…
                    </TableCell>
                  </TableRow>
                ) : tarifTersaring.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Tidak ada golongan tarif yang sesuai dengan pencarian.
                    </TableCell>
                  </TableRow>
                ) : (
                  tarifTersaring.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="font-mono font-bold text-primary">
                        {item.kodeAsli}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground">{item.nama}</span>
                          <span className="text-[10px] text-muted-foreground">
                            Sistem: {item.kode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {item.kategori}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.blokTarif && item.blokTarif.length > 0 ? (
                          <div className="flex flex-col gap-1.5 py-0.5">
                            {item.blokTarif
                              .sort((a, b) => a.blok - b.blok)
                              .map((b) => (
                                <div
                                  key={b.id}
                                  className="flex flex-wrap items-center gap-2 rounded border bg-muted/40 px-2.5 py-1 text-xs"
                                >
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                                    Blok {b.blok}
                                  </Badge>
                                  <span className="font-mono font-medium">
                                    {b.batasAwalM3} – {b.batasAkhirM3 != null ? `${b.batasAkhirM3} m³` : "dst"}
                                  </span>
                                  <span className="font-mono font-bold text-primary">
                                    {formatRupiah(b.hargaPerM3)} / m³
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    (Berlaku {formatTanggal(b.berlakuMulai)})
                                  </span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="rounded border border-dashed border-muted-foreground/30 p-2 text-xs text-muted-foreground italic">
                            Belum ada konfigurasi blok tarif air untuk golongan ini.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.isActive ? (
                          <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-3 w-3" />
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <HugeiconsIcon icon={CancelCircleIcon} className="h-3 w-3" />
                            Non-aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1"
                            onClick={() => {
                              setTarifPilihan(item)
                              setDialogBlokBuka(true)
                            }}
                          >
                            <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
                            Tetapkan Blok
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setGolonganEdit(item)
                              setDialogGolonganBuka(true)
                            }}
                          >
                            <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Tetapkan Blok Progresif Baru */}
      <DialogTetapkanBlok
        buka={dialogBlokBuka}
        onBukaChange={setDialogBlokBuka}
        tarifGolongan={tarifPilihan}
        onSukses={() => void muatData()}
      />

      {/* Dialog Tambah/Ubah Golongan */}
      <DialogTarifGolongan
        buka={dialogGolonganBuka}
        onBukaChange={setDialogGolonganBuka}
        tarifEdit={golonganEdit}
        onSukses={() => void muatData()}
      />
    </div>
  )
}
