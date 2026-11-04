"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  Building03Icon,
  Layers01Icon,
  Share01Icon,
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
  ambilDaftarDivisi,
  ambilDaftarBagian,
  ambilDaftarSubBagian,
  hapusDivisi,
  hapusBagian,
  hapusSubBagian,
} from "../api/ApiOrganisasi"
import type {
  DivisiItem,
  BagianItem,
  SubBagianItem,
} from "../types/TipeOrganisasi"
import { DialogDivisi } from "./dialogs/DialogDivisi"
import { DialogBagian } from "./dialogs/DialogBagian"
import { DialogSubBagian } from "./dialogs/DialogSubBagian"

export function KelolaOrganisasi() {
  const [subTab, setSubTab] = useState<"divisi" | "bagian" | "sub-bagian">("divisi")
  const [cari, setCari] = useState("")

  const [daftarDivisi, setDaftarDivisi] = useState<DivisiItem[]>([])
  const [daftarBagian, setDaftarBagian] = useState<BagianItem[]>([])
  const [daftarSubBagian, setDaftarSubBagian] = useState<SubBagianItem[]>([])
  const [memuat, setMemuat] = useState(true)

  // State Dialog
  const [dialogDivisiBuka, setDialogDivisiBuka] = useState(false)
  const [divisiEdit, setDivisiEdit] = useState<DivisiItem | null>(null)

  const [dialogBagianBuka, setDialogBagianBuka] = useState(false)
  const [bagianEdit, setBagianEdit] = useState<BagianItem | null>(null)

  const [dialogSubBagianBuka, setDialogSubBagianBuka] = useState(false)
  const [subBagianEdit, setSubBagianEdit] = useState<SubBagianItem | null>(null)

  const muatData = useCallback(async () => {
    setMemuat(true)
    try {
      const [div, bag, sub] = await Promise.all([
        ambilDaftarDivisi().catch(() => []),
        ambilDaftarBagian().catch(() => []),
        ambilDaftarSubBagian().catch(() => []),
      ])
      setDaftarDivisi(div)
      setDaftarBagian(bag)
      setDaftarSubBagian(sub)
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muatData()
  }, [muatData])

  async function onHapusDivisi(item: DivisiItem) {
    if (!confirm(`Hapus divisi ${item.nama}? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await hapusDivisi(item.id)
      void muatData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus divisi")
    }
  }

  async function onHapusBagian(item: BagianItem) {
    if (!confirm(`Hapus bagian ${item.nama}? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await hapusBagian(item.id)
      void muatData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus bagian")
    }
  }

  async function onHapusSubBagian(item: SubBagianItem) {
    if (!confirm(`Hapus subbagian ${item.nama}? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await hapusSubBagian(item.id)
      void muatData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus subbagian")
    }
  }

  // Filter teks
  const q = cari.toLowerCase().trim()
  const divisiTersaring = daftarDivisi.filter(
    (d) => d.kode.toLowerCase().includes(q) || d.nama.toLowerCase().includes(q)
  )
  const bagianTersaring = daftarBagian.filter(
    (b) =>
      b.kode.toLowerCase().includes(q) ||
      b.nama.toLowerCase().includes(q) ||
      (b.divisi?.nama ?? "").toLowerCase().includes(q)
  )
  const subBagianTersaring = daftarSubBagian.filter(
    (s) =>
      s.kode.toLowerCase().includes(q) ||
      s.nama.toLowerCase().includes(q) ||
      (s.bagian?.nama ?? "").toLowerCase().includes(q) ||
      (s.bagian?.divisi?.nama ?? "").toLowerCase().includes(q)
  )

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Struktur Organisasi & Tata Kerja (SOTK)</CardTitle>
              <CardDescription>
                Kelola data Divisi, Bagian / Wilayah Kerja, dan Subbagian Perumda Tirtawening.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {subTab === "divisi" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDivisiEdit(null)
                    setDialogDivisiBuka(true)
                  }}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-1.5 h-4 w-4" />
                  Tambah Divisi
                </Button>
              )}
              {subTab === "bagian" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setBagianEdit(null)
                    setDialogBagianBuka(true)
                  }}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-1.5 h-4 w-4" />
                  Tambah Bagian
                </Button>
              )}
              {subTab === "sub-bagian" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSubBagianEdit(null)
                    setDialogSubBagianBuka(true)
                  }}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-1.5 h-4 w-4" />
                  Tambah Subbagian
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)}>
            <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="divisi" className="gap-1.5">
                  <HugeiconsIcon icon={Building03Icon} className="h-4 w-4" />
                  Divisi ({daftarDivisi.length})
                </TabsTrigger>
                <TabsTrigger value="bagian" className="gap-1.5">
                  <HugeiconsIcon icon={Layers01Icon} className="h-4 w-4" />
                  Bagian / Wilayah ({daftarBagian.length})
                </TabsTrigger>
                <TabsTrigger value="sub-bagian" className="gap-1.5">
                  <HugeiconsIcon icon={Share01Icon} className="h-4 w-4" />
                  Subbagian ({daftarSubBagian.length})
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

            {/* TAB DIVISI */}
            <TabsContent value="divisi" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Kode Divisi</TableHead>
                      <TableHead>Nama Divisi</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memuat ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Memuat data divisi…
                        </TableCell>
                      </TableRow>
                    ) : divisiTersaring.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Tidak ada divisi yang sesuai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      divisiTersaring.map((item) => (
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
                                  setDivisiEdit(item)
                                  setDialogDivisiBuka(true)
                                }}
                              >
                                <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => void onHapusDivisi(item)}
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

            {/* TAB BAGIAN */}
            <TabsContent value="bagian" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Kode Bagian</TableHead>
                      <TableHead>Nama Bagian</TableHead>
                      <TableHead className="w-48">Divisi Induk</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memuat ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Memuat data bagian…
                        </TableCell>
                      </TableRow>
                    ) : bagianTersaring.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Tidak ada bagian yang sesuai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bagianTersaring.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-semibold text-primary">
                            {item.kode}
                          </TableCell>
                          <TableCell className="font-medium">{item.nama}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.divisi?.nama ?? item.divisi?.kode ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setBagianEdit(item)
                                  setDialogBagianBuka(true)
                                }}
                              >
                                <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => void onHapusBagian(item)}
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

            {/* TAB SUBBAGIAN */}
            <TabsContent value="sub-bagian" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Kode Subbagian</TableHead>
                      <TableHead>Nama Subbagian</TableHead>
                      <TableHead className="w-52">Bagian Induk</TableHead>
                      <TableHead className="w-28 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memuat ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Memuat data subbagian…
                        </TableCell>
                      </TableRow>
                    ) : subBagianTersaring.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Tidak ada subbagian yang sesuai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      subBagianTersaring.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-semibold text-primary">
                            {item.kode}
                          </TableCell>
                          <TableCell className="font-medium">{item.nama}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold">
                                {item.bagian?.nama ?? item.bagian?.kode ?? "-"}
                              </span>
                              {item.bagian?.divisi?.nama && (
                                <span className="text-[10px] text-muted-foreground">
                                  {item.bagian.divisi.nama}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSubBagianEdit(item)
                                  setDialogSubBagianBuka(true)
                                }}
                              >
                                <HugeiconsIcon icon={Edit02Icon} className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => void onHapusSubBagian(item)}
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
      <DialogDivisi
        buka={dialogDivisiBuka}
        onBukaChange={setDialogDivisiBuka}
        divisiEdit={divisiEdit}
        onSukses={() => void muatData()}
      />

      <DialogBagian
        buka={dialogBagianBuka}
        onBukaChange={setDialogBagianBuka}
        bagianEdit={bagianEdit}
        daftarDivisi={daftarDivisi}
        onSukses={() => void muatData()}
      />

      <DialogSubBagian
        buka={dialogSubBagianBuka}
        onBukaChange={setDialogSubBagianBuka}
        subBagianEdit={subBagianEdit}
        daftarBagian={daftarBagian}
        onSukses={() => void muatData()}
      />
    </div>
  )
}
