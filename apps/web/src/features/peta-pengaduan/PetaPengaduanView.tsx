"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import type { FC } from "@/features/dashboard/peta-wilayah/types/TipePetaWilayah"
import { X } from "@/components/ui/hugeicons-compat"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  ambilDaftarPengaduan,
  buatPengaduan,
  cariAlamat,
  cariLokasi,
  ikutiPengaduan,
} from "./lib/ApiPengaduan"
import type { KategoriPengaduan, Pengaduan, TitikDraft } from "./types/TipePengaduan"
import { DialogBuatPengaduan } from "./components/DialogBuatPengaduan"
import { DialogDetailPengaduan } from "./components/DialogDetailPengaduan"
import { KontrolCari, KontrolVertikalPeta } from "./components/KontrolPetaPengaduan"
import type { PetaHandle, VisibilitasPeta } from "./components/PetaPengaduanCanvas"
import { DrawerBawahMobile, type PosisiDrawer } from "./components/DrawerBawahMobile"
import { PanelPetaPengaduan } from "./components/PanelPetaPengaduan"
import { PopupKoordinatPengaduan } from "./components/PopupKoordinatPengaduan"
import { useFormulirPengaduan } from "./hooks/UseFormulirPengaduan"

// MapLibre hanya berjalan di browser client, dimuat dengan ssr: false
const PetaCanvas = dynamic(
  () => import("./components/PetaPengaduanCanvas").then((m) => m.PetaPengaduanCanvas),
  {
    ssr: false,
    loading: () => <div className="size-full animate-pulse bg-muted" />,
  },
)

interface Props {
  kelurahan?: FC | null
  kecamatan?: FC | null
  pelanggan?: FC | null
  dataAwal?: Pengaduan[]
}

export function PetaPengaduanView({
  kelurahan,
  kecamatan,
  pelanggan,
  dataAwal,
}: Props) {
  /* ---------- State ---------- */
  const [data, setData] = useState<Pengaduan[]>(() => dataAwal || [])
  const [terpilihId, setTerpilihId] = useState<string | null>(null)
  const [detailBuka, setDetailBuka] = useState(false)

  const [draft, setDraft] = useState<TitikDraft | null>(null)
  const [buatBuka, setBuatBuka] = useState(false)
  const [modePilih, setModePilih] = useState(false)
  const [mengirim, setMengirim] = useState(false)

  // Drawer mobile bergaya bottom sheet: 'sembunyi' | 'separuh' | 'penuh'
  const [posisiDrawer, setPosisiDrawer] = useState<PosisiDrawer>("sembunyi")

  // Visibilitas layer spasial
  const [visibilitas, setVisibilitas] = useState<VisibilitasPeta>({
    wilayah: true,
    pelanggan: false,
    aduan: true,
  })

  const formulir = useFormulirPengaduan()
  const petaRef = useRef<PetaHandle | null>(null)
  const permintaanAlamat = useRef(0)

  const pengaduanTerpilih = data.find((p) => p.id === terpilihId) ?? null

  /* ---------- Sinkronisasi Data Cadangan jika dataAwal kosong ---------- */
  useEffect(() => {
    if (!dataAwal || dataAwal.length === 0) {
      ambilDaftarPengaduan().then(setData)
    }
  }, [dataAwal])

  /* ---------- Interaksi peta ---------- */

  // Klik area kosong: taruh titik + popup koordinat. Saat mode pilih, kembali ke dialog.
  const handleKlikPeta = useCallback(
    async (lng: number, lat: number) => {
      setDetailBuka(false)
      setDraft({ lng, lat, memuat: true })
      if (modePilih) {
        setModePilih(false)
        setBuatBuka(true)
      }
      const id = ++permintaanAlamat.current
      const alamat = await cariAlamat(lng, lat)
      if (id === permintaanAlamat.current) {
        setDraft({ lng, lat, alamat, memuat: false })
      }
    },
    [modePilih],
  )

  // Klik titik pengaduan: terbang ke titik dan sorot di panel / buka drawer mobile
  const handlePilih = useCallback(
    (id: string) => {
      setDraft(null)
      setTerpilihId(id)
      const p = data.find((x) => x.id === id)
      if (p) petaRef.current?.terbangKe(p.lng, p.lat, 16)
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setPosisiDrawer("separuh")
      }
    },
    [data],
  )

  // Pilih dari panel: terbang ke lokasi dan set aktif
  function handlePilihDariDaftar(id: string) {
    const p = data.find((x) => x.id === id)
    if (p) petaRef.current?.terbangKe(p.lng, p.lat, 16)
    setDraft(null)
    setTerpilihId(id)
  }

  /* ---------- Buat pengaduan ---------- */

  const bukaBuat = () => {
    setPosisiDrawer("sembunyi")
    setDetailBuka(false)
    setBuatBuka(true)
  }

  const mulaiPilihDiPeta = () => {
    setBuatBuka(false)
    setModePilih(true)
  }

  const batalPilih = () => {
    setModePilih(false)
    setBuatBuka(true)
  }

  async function handleKirim() {
    if (!draft) return
    setMengirim(true)
    try {
      const baru = await buatPengaduan({
        pelapor: formulir.nilai.pelapor.trim(),
        kategori: formulir.nilai.kategori as KategoriPengaduan,
        deskripsi: formulir.nilai.deskripsi.trim(),
        alamat: draft.alamat ?? "",
        lng: draft.lng,
        lat: draft.lat,
        foto: formulir.nilai.foto.map((f) => f.file),
        kontak: formulir.nilai.kontak.trim() || undefined,
      })
      setData((d) => [baru, ...d])
      formulir.reset()
      setDraft(null)
      setBuatBuka(false)
      setTerpilihId(baru.id)
      toast.success(`Pengaduan berhasil tercatat dengan nomor tiket: ${baru.nomor}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pengaduan ke server")
    } finally {
      setMengirim(false)
    }
  }

  async function handleIkuti(id: string, ikuti: boolean) {
    setData((d) => d.map((x) => (x.id === id ? { ...x, diikuti: ikuti } : x)))
    await ikutiPengaduan(id, ikuti)
    toast.info(ikuti ? "Laporan kini dipantau di tab Diikuti" : "Batal mengikuti laporan")
  }

  async function handleCari(teks: string) {
    const hasil = await cariLokasi(teks)
    if (hasil) petaRef.current?.terbangKe(hasil.lng, hasil.lat, 15)
  }

  function handleLokasiSaya() {
    navigator.geolocation?.getCurrentPosition((pos) =>
      petaRef.current?.terbangKe(pos.coords.longitude, pos.coords.latitude, 16),
    )
  }

  const handleUpdatePengaduan = useCallback((updated: Pengaduan) => {
    setData((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }, [])

  const panel = (
    <PanelPetaPengaduan
      data={data}
      terpilihId={terpilihId}
      onPilih={handlePilihDariDaftar}
      onBuat={bukaBuat}
      onUpdatePengaduan={handleUpdatePengaduan}
      onBukaModalDetail={() => setDetailBuka(true)}
    />
  )

  /* ---------- Tampilan Layar Penuh ---------- */
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Desktop: panel tetap di kiri */}
      <aside className="hidden w-104 shrink-0 h-full border-r bg-background md:flex md:flex-col overflow-hidden">
        {panel}
      </aside>

      <main className="relative min-w-0 flex-1 h-full w-full overflow-hidden">
        <PetaCanvas
          data={data}
          kelurahan={kelurahan}
          kecamatan={kecamatan}
          pelanggan={pelanggan}
          visibilitas={visibilitas}
          terpilihId={terpilihId}
          draft={draft}
          modePilih={modePilih}
          onSiap={(h) => {
            petaRef.current = h
          }}
          onKlikPeta={handleKlikPeta}
          onPilihPengaduan={handlePilih}
          popupDraft={
            draft ? (
              <PopupKoordinatPengaduan
                draft={draft}
                onBuat={bukaBuat}
                onTutup={() => setDraft(null)}
              />
            ) : null
          }
        />

        {/* Pencarian Lokasi di Kanan Atas */}
        <div className="pointer-events-none absolute right-3 top-3 z-10 w-full max-w-sm px-3 md:px-0">
          <div className="pointer-events-auto">
            <KontrolCari onCari={handleCari} onLokasiSaya={handleLokasiSaya} />
          </div>
        </div>

        {/* Dok Kontrol Vertikal: Filter Layer, Zoom In/Out, Toggle Tema (Sejajar Vertikal & Seimbang) */}
        <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
          <KontrolVertikalPeta
            visibilitas={visibilitas}
            onUbahVisibilitas={setVisibilitas}
            onMasuk={() => petaRef.current?.zoomMasuk()}
            onKeluar={() => petaRef.current?.zoomKeluar()}
          />
        </div>

        {/* Banner saat memilih lokasi dari dialog */}
        {modePilih && (
          <div
            role="status"
            className="absolute left-1/2 top-16 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background py-1.5 pl-4 pr-1.5 text-sm shadow-lg md:top-3"
          >
            Klik peta untuk memilih lokasi gangguan
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-full"
              onClick={batalPilih}
              aria-label="Batal memilih lokasi"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Mobile: Drawer di posisi bottom yang bisa discroll up & disembunyikan */}
      <DrawerBawahMobile
        data={data}
        terpilihId={terpilihId}
        posisi={posisiDrawer}
        onUbahPosisi={setPosisiDrawer}
        onBuat={bukaBuat}
      >
        {panel}
      </DrawerBawahMobile>

      {/* Dialog Detail & Form Pengaduan */}
      <DialogDetailPengaduan
        pengaduan={pengaduanTerpilih}
        buka={detailBuka}
        onBukaChange={setDetailBuka}
        onIkuti={handleIkuti}
      />
      <DialogBuatPengaduan
        buka={buatBuka}
        onBukaChange={setBuatBuka}
        draft={draft}
        nilai={formulir.nilai}
        ubah={formulir.ubah}
        mengirim={mengirim}
        onPilihDiPeta={mulaiPilihDiPeta}
        onKirim={handleKirim}
      />
    </div>
  )
}
