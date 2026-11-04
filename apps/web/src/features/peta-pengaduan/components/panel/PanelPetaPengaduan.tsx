"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ExternalLink,
  FileText,
  Inbox,
  Plus,
} from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { STATUS_META, labelKategori } from "../../lib/KonstantaPengaduan"
import type { Pengaduan, StatusPengaduan } from "../../types/TipePengaduan"
import {
  aksiTambahCatatan,
  aksiTugaskan,
  aksiUbahStatus,
  ambilDaftarPetugas,
  type PetugasOption,
} from "../../lib/ApiPengaduan"
import { KepalaPanel } from "./KepalaPanel"
import { TabAduan } from "./TabAduan"
import { TabKegiatan, type ItemKegiatan } from "./TabKegiatan"
import { TabDetail } from "./TabDetail"

interface Props {
  data: Pengaduan[]
  terpilihId: string | null
  onPilih: (id: string) => void
  onBuat: () => void
  onUpdatePengaduan?: (updated: Pengaduan) => void
  onBukaModalDetail?: () => void
}

const formatWaktuIndo = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function PanelPetaPengaduan({
  data,
  terpilihId,
  onPilih,
  onBuat,
  onUpdatePengaduan,
  onBukaModalDetail,
}: Props) {
  const [tabAktif, setTabAktif] = useState<string>("antrean")
  const [prevTerpilihId, setPrevTerpilihId] = useState<string | null>(terpilihId)
  const [filterStatus, setFilterStatus] = useState<StatusPengaduan | "semua">("semua")
  const [cariTeks, setCariTeks] = useState("")

  // State interaksi operator
  const [daftarPetugas, setDaftarPetugas] = useState<PetugasOption[]>([])
  const [petugasTugaskan, setPetugasTugaskan] = useState("")
  const [catatanOperator, setCatatanOperator] = useState("")
  const [prosesAksi, setProsesAksi] = useState(false)

  // Otomatis aktifkan tab Detail saat ada titik pengaduan yang dipilih/diklik
  if (terpilihId !== prevTerpilihId) {
    setPrevTerpilihId(terpilihId)
    if (terpilihId) {
      setTabAktif("detail")
    }
  }

  useEffect(() => {
    ambilDaftarPetugas().then(setDaftarPetugas)
  }, [])

  const tiketTerpilih = useMemo(
    () => data.find((p) => p.id === terpilihId) ?? null,
    [data, terpilihId],
  )

  // Filter daftar pengaduan
  const daftarTersaring = useMemo(() => {
    return data.filter((p) => {
      const cocokStatus = filterStatus === "semua" || p.status === filterStatus
      const q = cariTeks.toLowerCase().trim()
      const cocokCari =
        !q ||
        p.nomor.toLowerCase().includes(q) ||
        p.alamat.toLowerCase().includes(q) ||
        (p.pelapor && p.pelapor.toLowerCase().includes(q)) ||
        (p.judul && p.judul.toLowerCase().includes(q)) ||
        labelKategori(p.kategori).toLowerCase().includes(q)
      return cocokStatus && cocokCari
    })
  }, [data, filterStatus, cariTeks])

  // Kumpulan seluruh aktivitas log operator dari semua tiket
  const kegiatanOperator = useMemo<ItemKegiatan[]>(() => {
    const list: ItemKegiatan[] = []

    for (const p of data) {
      for (const r of p.riwayat) {
        list.push({
          id: r.id ? `${r.id}-${list.length}` : `${p.id}-${r.waktu}-${list.length}`,
          tiketId: p.id,
          nomorTiket: p.nomor,
          kategori: labelKategori(p.kategori),
          alamat: p.alamat,
          aksi: r.aksi || "STATUS_DIUBAH",
          status: r.status,
          catatan: r.catatan,
          olehNama: r.olehNama || "Petugas Lapangan",
          waktu: r.waktu,
          lat: p.lat,
          lng: p.lng,
        })
      }
    }

    return list.sort((a, b) => b.waktu.localeCompare(a.waktu))
  }, [data])

  // Hitung ringkasan status
  const hitungan = useMemo(() => {
    let baru = 0
    let diproses = 0
    let selesai = 0
    for (const p of data) {
      if (p.status === "baru") baru++
      else if (p.status === "diproses" || p.status === "terverifikasi") diproses++
      else if (p.status === "selesai") selesai++
    }
    return { total: data.length, baru, diproses, selesai }
  }, [data])

  // Hitung jumlah tiket yang cocok dengan filter aktif untuk label header
  const jumlahFilter = useMemo(() => {
    if (filterStatus === "baru") return hitungan.baru
    if (filterStatus === "diproses") return hitungan.diproses
    if (filterStatus === "selesai") return hitungan.selesai
    return hitungan.total
  }, [filterStatus, hitungan])

  function pilihDanBukaDetail(id: string) {
    onPilih(id)
    setTabAktif("detail")
  }

  async function handleAksiStatus(statusBaru: StatusPengaduan) {
    if (!tiketTerpilih) return
    setProsesAksi(true)
    const res = await aksiUbahStatus(tiketTerpilih.id, statusBaru)
    setProsesAksi(false)
    if (res.sukses) {
      toast.success(res.pesan || `Status tiket berhasil diubah menjadi ${STATUS_META[statusBaru].label}`)
      const tiketUpdate: Pengaduan = {
        ...tiketTerpilih,
        status: statusBaru,
        riwayat: [
          {
            id: `log-${Date.now()}`,
            status: statusBaru,
            aksi: `STATUS_${statusBaru.toUpperCase()}`,
            waktu: new Date().toISOString(),
            catatan: `Status diperbarui menjadi ${STATUS_META[statusBaru].label} melalui Peta Kendali.`,
            olehNama: "Operator Dispatcher",
          },
          ...tiketTerpilih.riwayat,
        ],
      }
      onUpdatePengaduan?.(tiketUpdate)
    } else {
      toast.error(res.pesan || "Gagal mengubah status tiket")
    }
  }

  async function handleAksiTugaskan() {
    if (!tiketTerpilih || !petugasTugaskan) return
    setProsesAksi(true)
    const res = await aksiTugaskan(tiketTerpilih.id, petugasTugaskan)
    setProsesAksi(false)
    if (res.sukses) {
      toast.success(res.pesan || `Petugas ${petugasTugaskan} berhasil ditugaskan`)
      const tiketUpdate: Pengaduan = {
        ...tiketTerpilih,
        status: tiketTerpilih.status === "baru" ? "diproses" : tiketTerpilih.status,
        petugasNama: petugasTugaskan,
        riwayat: [
          {
            id: `log-${Date.now()}`,
            status: tiketTerpilih.status === "baru" ? "diproses" : tiketTerpilih.status,
            aksi: "PENUGASAN_TEKNISI",
            waktu: new Date().toISOString(),
            catatan: `Ditugaskan ke: ${petugasTugaskan}.`,
            olehNama: "Operator Dispatcher",
          },
          ...tiketTerpilih.riwayat,
        ],
      }
      onUpdatePengaduan?.(tiketUpdate)
      setPetugasTugaskan("")
    } else {
      toast.error(res.pesan || "Gagal menugaskan petugas")
    }
  }

  async function handleAksiCatatan() {
    const teks = catatanOperator.trim()
    if (!tiketTerpilih || !teks) return
    setProsesAksi(true)
    const res = await aksiTambahCatatan(tiketTerpilih.id, teks)
    setProsesAksi(false)
    if (res.sukses) {
      toast.success(res.pesan || "Catatan tindak lanjut berhasil direkam")
      const tiketUpdate: Pengaduan = {
        ...tiketTerpilih,
        riwayat: [
          {
            id: `log-${Date.now()}`,
            status: tiketTerpilih.status,
            aksi: "CATATAN_TINDAK_LANJUT",
            waktu: new Date().toISOString(),
            catatan: teks,
            olehNama: "Operator Dispatcher",
          },
          ...tiketTerpilih.riwayat,
        ],
      }
      onUpdatePengaduan?.(tiketUpdate)
      setCatatanOperator("")
    } else {
      toast.error(res.pesan || "Gagal menyimpan catatan")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background overflow-hidden">
      {/* 1. Header Panel (Bersih, Rapi, Tanpa Tombol Kembali Dasbor) */}
      <KepalaPanel
        totalAduan={hitungan.total}
        totalKegiatan={kegiatanOperator.length}
        filterStatus={filterStatus}
        jumlahFilter={jumlahFilter}
      />

      {/* 2. Menu Navigasi Tab (Aduan, Kegiatan, Detail) */}
      <Tabs value={tabAktif} onValueChange={setTabAktif} className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        <div className="px-4 pt-3 pb-2 shrink-0">
          <TabsList className="grid w-full grid-cols-3 h-9 bg-muted/70 p-0.5">
            {/* Tab 1: Aduan */}
            <TabsTrigger value="antrean" className="text-xs gap-1.5 font-medium min-w-0">
              <Inbox className="size-3.5 shrink-0" />
              <span className="truncate">Aduan ({hitungan.total})</span>
            </TabsTrigger>

            {/* Tab 2: Kegiatan (Tanpa Count sesuai arahan pengguna) */}
            <TabsTrigger value="operator" className="text-xs gap-1.5 font-medium min-w-0">
              <Activity className="size-3.5 shrink-0" />
              <span className="truncate">Kegiatan</span>
            </TabsTrigger>

            {/* Tab 3: Detail (Tahan Overflow saat tiket dipilih) */}
            <TabsTrigger value="detail" className="text-xs gap-1.5 font-medium min-w-0">
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate min-w-0">
                {tiketTerpilih ? tiketTerpilih.nomor : "Detail"}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Konten Scrollable Tiap Tab dengan scrollbar tipis simetris yang sejajar dengan TabsList */}
        <div className="min-h-0 flex-1 overflow-y-auto pl-4 pr-2.5 py-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* TAB 1: ADUAN */}
          <TabsContent value="antrean" className="m-0 focus-visible:outline-none w-full min-w-0">
            <TabAduan
              daftar={daftarTersaring}
              terpilihId={terpilihId}
              cariTeks={cariTeks}
              onCariTeksChange={setCariTeks}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              hitungan={hitungan}
              onPilihTiket={pilihDanBukaDetail}
              formatWaktu={formatWaktuIndo}
            />
          </TabsContent>

          {/* TAB 2: KEGIATAN */}
          <TabsContent value="operator" className="m-0 focus-visible:outline-none w-full min-w-0">
            <TabKegiatan
              kegiatan={kegiatanOperator}
              onPilihTiket={pilihDanBukaDetail}
              formatWaktu={formatWaktuIndo}
            />
          </TabsContent>

          {/* TAB 3: DETAIL TIKET LENGKAP */}
          <TabsContent value="detail" className="m-0 focus-visible:outline-none w-full min-w-0">
            <TabDetail
              tiket={tiketTerpilih}
              onBukaDaftar={() => setTabAktif("antrean")}
              onFokusPeta={onPilih}
              onBukaModalDetail={onBukaModalDetail}
              prosesAksi={prosesAksi}
              onAksiStatus={handleAksiStatus}
              daftarPetugas={daftarPetugas}
              petugasTugaskan={petugasTugaskan}
              onPetugasTugaskanChange={setPetugasTugaskan}
              onAksiTugaskan={handleAksiTugaskan}
              catatanOperator={catatanOperator}
              onCatatanOperatorChange={setCatatanOperator}
              onAksiCatatan={handleAksiCatatan}
              formatWaktu={formatWaktuIndo}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* 3. Footer Panel */}
      <footer className="flex items-center justify-between border-t bg-card/60 px-4 py-2.5 text-xs text-muted-foreground shrink-0">
        <Link
          href="/pengaduan"
          className="hover:underline flex items-center gap-1 font-medium text-foreground truncate min-w-0"
          title="Buka Tabel Pengaduan Dashboard"
        >
          <ExternalLink className="size-3 text-primary shrink-0" />
          <span className="truncate">Kelola Semua Tiket</span>
        </Link>
        <Button
          size="sm"
          className="h-7 text-xs gap-1 shrink-0 font-medium"
          onClick={onBuat}
        >
          <Plus className="size-3.5" /> Buat Aduan
        </Button>
      </footer>
    </div>
  )
}
