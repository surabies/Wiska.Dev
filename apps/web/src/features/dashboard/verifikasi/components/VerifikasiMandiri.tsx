"use client"

// features/dashboard/verifikasi/components/VerifikasiMandiri.tsx —
// halaman verifikasi laporan meter mandiri pelanggan (master-detail),
// kembaran verifikasi-lapangan untuk sumber data /laporan-mandiri.
// Verifikasi mandiri mengoreksi laporan; pembacaan resmi tetap diterbitkan
// terpisah melalui verifikasi petugas.
//
// MENU KLIK KANAN memakai susunan terarah dari lib/MenuAksi.ts:
//   Verifikasi    → modal verifikasi/koreksi stand (tanpa membuat bacaan resmi)
//   Unverifikasi  → batalkan verifikasi (laporan kembali MENUNGGU)
//   BacaUlang     → modal tolak / minta foto ulang (status MENUNGGU)
//   Batal Baca Ulang → kembalikan baris DITOLAK ke antrean
//
// BARIS YANG SUDAH DIVERIFIKASI TIDAK DIHAPUS dari tabel: statusnya berubah
// menjadi DIVERIFIKASI, tetapi stand resmi tetap dibuat lewat alur Petugas.
import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  ambilSatu,
  kirimJson,
  ApiError,
} from "@/features/dashboard/api/ApiDashboard"
import type { StatsVerifikasi } from "../types/TipeVerifikasi"
import { RingkasanVerifikasi } from "./RingkasanVerifikasi"
import {
  PanelTabelMandiri,
  type BarisMandiriTabel,
} from "./panel/PanelTabelMandiri"
import { PanelMandiri, type AksiMandiri } from "./panel/PanelMandiri"
import { MenuKonteks, type AksiKonteks } from "./MenuKonteks"
import {
  bangunMenuAksi,
  type KeadaanMenu,
  type KunciMenu,
  type ProfilMenu,
} from "../lib/MenuAksi"

function bobotRole(role: string | null | undefined): number {
  switch (role) {
    case "SUPER_ADMIN":
    case "DIREKSI":
    case "SENIOR_MANAGER":
      return 3
    case "MANAGER":
      return 2
    case "SUPERVISOR":
      return 1
    case "STAFF":
      return 0
    default:
      return -1
  }
}

export function VerifikasiMandiri({
  bisaAksi,
  role = "",
  profilMenu = "penilai",
}: {
  bisaAksi: boolean
  role?: string
  /** "chn" = menu CHN / Batal Baca Ulang / Unverifikasi mati. */
  profilMenu?: ProfilMenu
}) {
  // undefined = belum init; diisi periode terbaru yang punya data.
  const [periode, setPeriode] = React.useState<number | null | undefined>(
    undefined
  )
  const [stats, setStats] = React.useState<StatsVerifikasi | null>(null)
  const [galatStats, setGalatStats] = React.useState<string | null>(null)
  const [idTerpilih, setIdTerpilih] = React.useState<string | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [ringkasanTerbuka, setRingkasanTerbuka] = React.useState(true)

  const [menu, setMenu] = React.useState<{
    posisi: { x: number; y: number }
    baris: BarisMandiriTabel
  } | null>(null)
  const [aksi, setAksi] = React.useState<AksiMandiri | null>(null)
  const [konfirmasi, setKonfirmasi] = React.useState<{
    id: string
    judul: string
    deskripsi: string
  } | null>(null)
  const [mengirim, setMengirim] = React.useState(false)
  const [galatAksi, setGalatAksi] = React.useState<string | null>(null)

  React.useEffect(() => {
    const muatUlang = () => setRefreshKey((k) => k + 1)
    window.addEventListener("focus", muatUlang)
    return () => window.removeEventListener("focus", muatUlang)
  }, [])

  React.useEffect(() => {
    let batal = false
    ambilSatu<StatsVerifikasi>("/laporan-mandiri/stats", {
      periode: periode ?? undefined,
    })
      .then((s) => {
        if (batal) return
        setStats(s)
        setGalatStats(null)
        setPeriode((lama) =>
          lama === undefined ? (s.periodes[0] ?? null) : lama
        )
      })
      .catch((err) => {
        if (!batal)
          setGalatStats(
            err instanceof ApiError ? err.message : "Gagal memuat ringkasan."
          )
      })
    return () => {
      batal = true
    }
  }, [periode, refreshKey])

  async function jalankanUnverify() {
    if (!konfirmasi) return
    setMengirim(true)
    setGalatAksi(null)
    try {
      await kirimJson(`/laporan-mandiri/${konfirmasi.id}/unverify`, "PATCH", {})
      setKonfirmasi(null)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setGalatAksi(
        err instanceof ApiError ? err.message : "Aksi gagal dijalankan."
      )
    } finally {
      setMengirim(false)
    }
  }

  function aksiMenu(baris: BarisMandiriTabel): AksiKonteks[] {
    const id = baris.id
    if (!id) return []
    const nama = baris.pelanggan?.nama ?? baris.nomorLangganan ?? ""
    const tanpaAkses = "Akun Anda tidak punya akses verifikasi"
    const disetujui =
      baris.status === "DIVERIFIKASI" || baris.status === "DIGUNAKAN"
    const kalahJenjangVerifikator = Boolean(
      baris.verifiedByRole &&
      role &&
      bobotRole(role) < bobotRole(baris.verifiedByRole)
    )
    const tertahanTahapPetugas = Boolean(
      baris.sudahTahapPetugas ||
      baris.verif3At != null ||
      baris.pembacaan != null
    )
    const bolehUnverify =
      bisaAksi &&
      disetujui &&
      !baris.sudahDitagih &&
      !tertahanTahapPetugas &&
      !kalahJenjangVerifikator
    const bolehBatalBacaUlang =
      bisaAksi && baris.status === "DITOLAK" && !kalahJenjangVerifikator

    const bukaKonfirmasi = (judul: string, deskripsi: string) => {
      setMenu(null)
      setGalatAksi(null)
      setKonfirmasi({ id, judul, deskripsi })
    }
    const tidakBerlaku: KeadaanMenu = {
      aktif: false,
      keterangan: "Aksi ini hanya berlaku untuk laporan petugas lapangan",
      onPilih: () => undefined,
    }

    const k: Record<KunciMenu, KeadaanMenu> = {
      verifikasi: {
        aktif: bisaAksi && baris.status === "MENUNGGU",
        keterangan: !bisaAksi
          ? tanpaAkses
          : baris.status === "MENUNGGU"
            ? "Periksa foto dan koreksi stand bila angka laporan tidak sesuai"
            : disetujui
              ? "Laporan sudah diverifikasi"
              : "Perlu dikembalikan ke antrean dulu",
        onPilih: () => {
          setMenu(null)
          setAksi("verify")
        },
      },
      unverifikasi: {
        aktif: bolehUnverify,
        keterangan: !bisaAksi
          ? tanpaAkses
          : !disetujui
            ? "Belum ada verifikasi yang bisa dibatalkan"
            : baris.sudahDitagih
              ? "Pembacaan resmi sudah dipakai tagihan — tidak bisa dibatalkan"
              : tertahanTahapPetugas
                ? "Tidak dapat dibatalkan karena data telah diverifikasi di Verifikasi Petugas (V1/V2/V3). Batalkan verifikasi di halaman Petugas terlebih dahulu"
                : kalahJenjangVerifikator
                  ? "Pembatalan memerlukan kewenangan minimal setara dengan verifikator sebelumnya"
                  : "Kembalikan laporan terverifikasi ke antrean dan batalkan sinkronisasi Petugas",
        onPilih: () =>
          bukaKonfirmasi(
            "Batalkan verifikasi laporan mandiri?",
            `Laporan ${nama} dikembalikan ke status MENUNGGU, koreksi stand mandiri dibatalkan ke kiriman awal warga, dan data pada halaman Verifikasi Petugas dikembalikan ke kondisi semula.`
          ),
      },
      edit: tidakBerlaku,
      add: tidakBerlaku,
      kondisiFoto: tidakBerlaku,
      bacaUlang: {
        aktif: bisaAksi && baris.status === "MENUNGGU",
        keterangan: !bisaAksi
          ? tanpaAkses
          : baris.status === "MENUNGGU"
            ? "Minta pelapor mengirim foto ulang"
            : undefined,
        onPilih: () => {
          setMenu(null)
          setAksi("tolak")
        },
      },
      batalBacaUlang: {
        aktif: bolehBatalBacaUlang,
        keterangan: !bisaAksi
          ? tanpaAkses
          : baris.status !== "DITOLAK"
            ? "Laporan tidak sedang dibaca ulang"
            : kalahJenjangVerifikator
              ? "Pembatalan memerlukan kewenangan minimal setara dengan verifikator sebelumnya"
              : undefined,
        onPilih: () =>
          bukaKonfirmasi(
            "Batalkan penolakan?",
            `Laporan ${nama} dikembalikan ke antrean MENUNGGU agar dapat diverifikasi kembali.`
          ),
      },
    }

    return bangunMenuAksi(profilMenu, k, "mandiri")
  }

  return (
    // TATA LETAK KEMBAR verifikasi-lapangan: panel detail di kiri terbuka di
    // ukuran paling kecil (defaultSize = minSize) supaya tabel langsung mendapat
    // lebar maksimal. Mengisi ruang layar penuh secara fluid tanpa container/breadcrumb.
    <>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col p-3">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full min-h-0 items-stretch"
        >
          <ResizablePanel
            defaultSize="18"
            minSize="18"
            maxSize="45"
            collapsible
            className="flex min-w-0 flex-col"
          >
            {/* Judul DI LUAR wadah bergulir supaya garis atasnya tidak terpotong. */}
            <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card">
              <div className="shrink-0 border-b border-border/70 px-4 py-2.5">
                <h2 className="text-center text-sm font-medium">
                  Detail laporan
                </h2>
              </div>
              <div className="scrollbar-tipis min-h-0 flex-1 overflow-y-auto">
                {/* key: ganti baris = remount panel, state mulai bersih. */}
                <PanelMandiri
                  key={`${idTerpilih ?? "kosong"}-${refreshKey}`}
                  id={idTerpilih}
                  aksi={aksi}
                  onTutupAksi={() => setAksi(null)}
                  onSelesai={() => setRefreshKey((k) => k + 1)}
                />
              </div>
            </aside>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize="82"
            minSize="50"
            className="flex min-w-0 flex-col"
          >
            <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 pl-3">
              <RingkasanVerifikasi
                stats={stats}
                periode={periode ?? null}
                terbuka={ringkasanTerbuka}
              />

              {galatStats && (
                <p className="shrink-0 text-xs text-destructive">
                  {galatStats}
                </p>
              )}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <PanelTabelMandiri
                  periodes={stats?.periodes ?? []}
                  periode={periode}
                  onPeriode={setPeriode}
                  refreshKey={refreshKey}
                  idTerpilih={idTerpilih}
                  onKlikBaris={(row) => setIdTerpilih(row.id)}
                  onKlikKanan={(row, posisi) => {
                    setIdTerpilih(row.id)
                    setAksi(null)
                    setMenu({ posisi, baris: row })
                  }}
                  ringkasanTerbuka={ringkasanTerbuka}
                  onRingkasan={setRingkasanTerbuka}
                  stats={stats}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {menu && (
        <MenuKonteks
          posisi={menu.posisi}
          judul={`${menu.baris.nomorLangganan ?? ""} · ${menu.baris.pelanggan?.nama ?? ""}`}
          aksi={aksiMenu(menu.baris)}
          onTutup={() => setMenu(null)}
        />
      )}

      <AlertDialog
        open={konfirmasi !== null}
        onOpenChange={(buka) => {
          if (!buka && !mengirim) setKonfirmasi(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{konfirmasi?.judul}</AlertDialogTitle>
            <AlertDialogDescription>
              {konfirmasi?.deskripsi}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {galatAksi && <p className="text-xs text-destructive">{galatAksi}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mengirim}>Batal</AlertDialogCancel>
            {/* onClick tanpa auto-close: dialog baru ditutup setelah server
                menjawab sukses; galat tampil di dalam dialog. */}
            <AlertDialogAction
              disabled={mengirim}
              onClick={(e) => {
                e.preventDefault()
                void jalankanUnverify()
              }}
            >
              {mengirim && <Spinner className="size-3.5" />}
              Ya, lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
