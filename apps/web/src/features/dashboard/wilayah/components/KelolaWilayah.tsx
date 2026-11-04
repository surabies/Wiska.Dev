"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  MapsLocation01Icon,
  Location01Icon,
  Search01Icon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ambilDaftarKecamatan,
  ambilDaftarKelurahan,
  hapusKecamatan,
  hapusKelurahan,
} from "../api/ApiWilayah"
import type { KecamatanItem, KelurahanItem } from "../types/TipeWilayah"
import { DialogKecamatan } from "./dialogs/DialogKecamatan"
import { DialogKelurahan } from "./dialogs/DialogKelurahan"

export function KelolaWilayah() {
  const [subTab, setSubTab] = useState<"kecamatan" | "kelurahan">("kecamatan")
  const [cari, setCari] = useState("")

  const [daftarKecamatan, setDaftarKecamatan] = useState<KecamatanItem[]>([])
  const [daftarKelurahan, setDaftarKelurahan] = useState<KelurahanItem[]>([])
  const [memuat, setMemuat] = useState(true)

  // Dialog State
  const [dialogKecamatanBuka, setDialogKecamatanBuka] = useState(false)
  const [kecamatanEdit, setKecamatanEdit] = useState<KecamatanItem | null>(null)

  const [dialogKelurahanBuka, setDialogKelurahanBuka] = useState(false)
  const [kelurahanEdit, setKelurahanEdit] = useState<KelurahanItem | null>(null)

  const muatData = useCallback(async () => {
    setMemuat(true)
    try {
      const [kec, kel] = await Promise.all([
        ambilDaftarKecamatan().catch(() => []),
        ambilDaftarKelurahan().catch(() => []),
      ])
      setDaftarKecamatan(kec)
      setDaftarKelurahan(kel)
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muatData()
  }, [muatData])

  async function onHapusKecamatan(item: KecamatanItem) {
    if (!confirm(`Hapus kecamatan ${item.nama}? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await hapusKecamatan(item.id)
      void muatData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus kecamatan")
    }
  }

  async function onHapusKelurahan(item: KelurahanItem) {
    if (!confirm(`Hapus kelurahan ${item.nama}? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await hapusKelurahan(item.id)
      void muatData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus kelurahan")
    }
  }

  const q = cari.toLowerCase().trim()
  const kecamatanTersaring = daftarKecamatan.filter(
    (k) => k.kode.toLowerCase().includes(q) || k.nama.toLowerCase().includes(q)
  )
  const kelurahanTersaring = daftarKelurahan.filter(
    (k) =>
      k.kode.toLowerCase().includes(q) ||
      k.nama.toLowerCase().includes(q) ||
      (k.kecamatan?.nama ?? "").toLowerCase().includes(q)
  )

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Wilayah Administratif</CardTitle>
              <CardDescription>
                Kelola data Kecamatan dan Kelurahan cakupan pelayanan Perumda Tirtawening Kota Bandung.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {subTab === "kecamatan" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setKecamatanEdit(null)
                    setDialogKecamatanBuka(true)
                  }}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-1.5 h-4 w-4" />
                  Tambah Kecamatan
                </Button>
              )}
              {subTab === "kelurahan" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setKelurahanEdit(null)
                    setDialogKelurahanBuka(true)
                  }}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-1.5 h-4 w-4" />
                  Tambah Kelurahan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)}>
            <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="kecamatan" className="gap-1.5">
                  <HugeiconsIcon icon={MapsLocation01Icon} className="h-4 w-4" />
                  Kecamatan ({daftarKecamatan.length})
                </TabsTrigger>
                <TabsTrigger value="kelurahan" className="gap-1.5">
                  <HugeiconsIcon icon={Location01Icon} className="h-4 w-4" />
                  Kelurahan ({daftarKelurahan.length})
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full sm:w-64">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                />
                <Input
                  placeholder="Cari kode atau nama…"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            {/* TAB KECAMATAN */}
            <TabsContent value="kecamatan" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Kode Kecamatan</TableHead>
                      <TableHead>Nama Kecamatan</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memuat ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Memuat data kecamatan…
                        </TableCell>
                      </TableRow>
                    ) : kecamatanTersaring.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Tidak ada kecamatan yang sesuai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      kecamatanTersaring.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-semibold text-primary">
                            {item.kode}
                          </TableCell>
                          <TableCell className="font-medium">{item.nama}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setKecamatanEdit(item)
                                  setDialogKecamatanBuka(true)
                                }}
                              >
                                <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => void onHapusKecamatan(item)}
                              >
                                <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB KELURAHAN */}
            <TabsContent value="kelurahan" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Kode Kelurahan</TableHead>
                      <TableHead>Nama Kelurahan</TableHead>
                      <TableHead className="w-52">Kecamatan Induk</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memuat ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Memuat data kelurahan…
                        </TableCell>
                      </TableRow>
                    ) : kelurahanTersaring.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Tidak ada kelurahan yang sesuai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      kelurahanTersaring.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-semibold text-primary">
                            {item.kode}
                          </TableCell>
                          <TableCell className="font-medium">{item.nama}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.kecamatan?.nama ?? item.kecamatan?.kode ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setKelurahanEdit(item)
                                  setDialogKelurahanBuka(true)
                                }}
                              >
                                <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => void onHapusKelurahan(item)}
                              >
                                <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      <DialogKecamatan
        buka={dialogKecamatanBuka}
        onBukaChange={setDialogKecamatanBuka}
        kecamatanEdit={kecamatanEdit}
        onSukses={() => void muatData()}
      />

      <DialogKelurahan
        buka={dialogKelurahanBuka}
        onBukaChange={setDialogKelurahanBuka}
        kelurahanEdit={kelurahanEdit}
        daftarKecamatan={daftarKecamatan}
        onSukses={() => void muatData()}
      />
    </div>
  )
}
