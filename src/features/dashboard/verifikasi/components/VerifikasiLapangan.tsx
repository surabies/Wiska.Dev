"use client"

// features/dashboard/verifikasi/components/VerifikasiLapangan.tsx —
// halaman verifikasi laporan petugas lapangan (master-detail): panel detail
// murni penampil (kiri) + kartu ringkasan dan tabel laporan (kanan).
//
// SELURUH AKSI lewat MENU KLIK KANAN (disusun lib/MenuAksi.ts):
//   Verifikasi    → langsung menandai ring berikutnya; tidak membuka modal
//   Unverifikasi  → batalkan SATU tahap terakhir (dialog konfirmasi)
//   Edit / CHN    → modal Koreksi Data Pembacaan
//   ADD           → Manual ADD satuan, menunggu verifikasi ulang
//   Kondisi Foto  → penilaian tersimpan di AuditLog
//   BacaUlang     → modal cek ulang (tolak)
//   Batal Baca Ulang → kembalikan baris DITOLAK ke antrean
// Pembacaan resmi baru dibuat saat V3 — lihat laporan-harian.router.ts.
import * as React from "react"
import { ViewOffIcon } from "@hugeicons/core-free-icons"
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
import { toast } from "sonner"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  ambilSatu,
  ambilList,
  kirimJson,
  ApiError,
} from "@/features/dashboard/api/ApiDashboard"
import type {
  StatsVerifikasi,
  RingLaporanHarian,
} from "../types/TipeVerifikasi"
import { tahapLaporanHarian } from "../types/TipeVerifikasi"
import { RingkasanVerifikasi } from "./RingkasanVerifikasi"
import { PanelTabel } from "./panel/PanelTabel"
import { PanelKosong } from "./panel/KomponenPanel"
import { PanelLapangan } from "./panel/PanelLapangan"
import { MenuKonteks, type AksiKonteks } from "./MenuKonteks"
import {
  bangunMenuAksi,
  type KeadaanMenu,
  type KunciMenu,
  type ProfilMenu,
} from "../lib/MenuAksi"
import type { PenugasanFilter } from "../lib/PenyaringanRelasi"
import { sertakanPenugasanPadaOpsiRute } from "../lib/PenyaringanRelasi"
import {
  ModalKoreksi,
  dataKoreksiDariBaris,
  type HasilKoreksi,
} from "./modal/ModalKoreksi"
import {
  ModalKondisiFoto,
  type HasilKondisiFoto,
} from "./modal/ModalKondisiFoto"
import { ModalBacaManual, type HasilBacaManual } from "./modal/ModalBacaManual"
import { ModalCekUlang } from "./modal/ModalCekUlang"
import type { OpsiPencarian } from "./modal/ModalPencarian"

// Cermin ROLE_GROUPS (server/middleware/rbac.ts). Server tetap penjaga aslinya;
// ini hanya menentukan item menu mana yang aktif.
const SUPERVISOR_UP = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
])
const MANAGEMENT_UP = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
])
const SENIOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"])
const BISA_EDIT = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "STAFF",
])

// ISI role mana saja yang memakai menu profil "chn" (CHN, Batal Baca Ulang,
// Unverifikasi mati). Dikosongkan sampai peran itu dipastikan — semua role
// sementara memakai profil "penilai".
const ROLE_CHN = new Set<string>([])

/** Bentuk baris grid /laporan-harian yang dibaca kolom & menu konteks. */
type BarisLaporan = RingLaporanHarian & {
  id: string
  pelangganId?: string | null
  nomorLangganan?: string
  namaPelanggan?: string | null
  alamatPelanggan?: string | null
  periode?: number
  kondisi?: string | null
  standAwal?: number
  standAkhir?: number
  standAkhirRevisi?: number | null
  standAwalRevisi?: number | null
  kondisiRevisi?: string | null
  standAngkatLama?: number | null
  standMeterBaru?: number | null
  pemakaian?: number
  pemakaianTagihVerif?: number | null
  meterVerifId?: string | null
  blokTarifVerif?: number | null
  pemakaianLalu?: number | null
  persentase?: number | null
  nomorMeter?: string | null
  tanggalCatat?: string | null
  pelanggan?: {
    id: string
    nomorLangganan?: string
    nama: string
    alamat?: string | null
    tarifGolongan?: { kodeAsli: string } | null
    rute?: { kode: string } | null
    zona?: { kode: string; wilayahSeksi?: { kode: string } | null } | null
  } | null
  pencatat?: { id: string; namaLapangan: string } | null
  pembacaan?: { id: string; standAkhir: number } | null
  verif1By?: { name: string | null } | null
  verif2By?: { name: string | null } | null
  verif3By?: { name: string | null } | null
  verifiedBy?: { name: string | null } | null
}

type Konfirmasi = {
  endpoint: "verif2" | "verif3" | "unverify"
  id: string
  judul: string
  deskripsi: string
  destruktif?: boolean
}

/** Modal formulir baru (tampilan saja) yang sedang terbuka. */
type ModalLain = {
  jenis: "edit" | "chn" | "add" | "foto"
  baris: BarisLaporan
}

export function VerifikasiLapangan({ role }: { role: string }) {
  const bisaV1 = SUPERVISOR_UP.has(role)
  const bisaV2 = MANAGEMENT_UP.has(role)
  const bisaV3 = SENIOR_UP.has(role)
  const bisaEdit = BISA_EDIT.has(role)
  const ringAkun: 1 | 2 | 3 | null = bisaV3 ? 3 : bisaV2 ? 2 : bisaV1 ? 1 : null
  const profil: ProfilMenu = ROLE_CHN.has(role) ? "chn" : "penilai"

  // undefined = belum init (diisi periode terbaru yang punya data).
  // null = pengguna memilih "Semua periode".
  const [periode, setPeriode] = React.useState<number | null | undefined>(
    undefined
  )
  const [stats, setStats] = React.useState<StatsVerifikasi | null>(null)
  const [galatStats, setGalatStats] = React.useState<string | null>(null)
  const [idTerpilih, setIdTerpilih] = React.useState<string | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)
  // Tab aktif diangkat ke sini: baris "belum dibaca" adalah DaftarCatat, bukan
  // laporan, jadi id-nya TIDAK ADA di /laporan-harian/:id.
  const [tab, setTab] = React.useState<"laporan" | "belum">("laporan")
  const [ringkasanTerbuka, setRingkasanTerbuka] = React.useState(true)

  const [menu, setMenu] = React.useState<{
    posisi: { x: number; y: number }
    baris: BarisLaporan
  } | null>(null)
  const [cekUlangId, setCekUlangId] = React.useState<string | null>(null)
  const [modalLain, setModalLain] = React.useState<ModalLain | null>(null)
  const [konfirmasi, setKonfirmasi] = React.useState<Konfirmasi | null>(null)
  const [mengirim, setMengirim] = React.useState(false)
  const [galatAksi, setGalatAksi] = React.useState<string | null>(null)

  const [pencatats, setPencatats] = React.useState<
    { id: string; namaLapangan: string }[]
  >([])
  const [rutes, setRutes] = React.useState<{ id: string; kode: string }[]>([])
  const [penugasanRute, setPenugasanRute] = React.useState<PenugasanFilter[]>(
    []
  )
  const [penugasanRuteDimuat, setPenugasanRuteDimuat] = React.useState(false)
  const [opsiPencarian, setOpsiPencarian] = React.useState<OpsiPencarian>({})
  const opsiPencarianDenganPenugasan = React.useMemo(
    () =>
      sertakanPenugasanPadaOpsiRute(
        opsiPencarian,
        penugasanRute,
        penugasanRuteDimuat
      ),
    [opsiPencarian, penugasanRute, penugasanRuteDimuat]
  )
  const [galatOpsiPencarian, setGalatOpsiPencarian] = React.useState<
    string | null
  >(null)

  React.useEffect(() => {
    const muatUlang = () => setRefreshKey((k) => k + 1)
    window.addEventListener("focus", muatUlang)
    return () => window.removeEventListener("focus", muatUlang)
  }, [])

  React.useEffect(() => {
    let batal = false
    Promise.all([
      ambilList<{ id: string; namaLapangan: string }>("/pencatat", {
        pageSize: 500,
      }),
      ambilList<{
        id: string
        kode: string
        seksiCater: { wilayahDistId: string }
      }>("/rute", { pageSize: 500 }),
      ambilList<{ id: string; kode: string; nama: string }>("/wilayah-dist", {
        pageSize: 500,
      }),
      ambilList<{
        id: string
        kode: string
        nama: string
        wilayahSeksi: { wilayahDistId: string }
      }>("/zona", { pageSize: 500 }),
      ambilList<{ id: string; kodeAsli: string; nama: string }>("/tarif", {
        pageSize: 500,
      }),
      ambilList<{ id: string; kode: string; nama: string }>("/kecamatan", {
        pageSize: 500,
      }),
      ambilList<{
        id: string
        kode: string
        nama: string
        kecamatanId: string
      }>("/kelurahan", { pageSize: 500 }),
    ])
      .then(
        ([
          hasilPencatat,
          hasilRute,
          wilayah,
          zona,
          tarif,
          kecamatan,
          kelurahan,
        ]) => {
          if (batal) return
          setPencatats(hasilPencatat.rows)
          setRutes(hasilRute.rows.map(({ id, kode }) => ({ id, kode })))
          setOpsiPencarian({
            wilayahDistId: wilayah.rows.map(({ id, kode, nama }) => ({
              value: id,
              label: `${kode} · ${nama}`,
            })),
            zonaId: zona.rows.map(({ id, kode, nama, wilayahSeksi }) => ({
              value: id,
              label: `${kode} · ${nama}`,
              wilayahDistId: wilayahSeksi.wilayahDistId,
            })),
            ruteLanjutanId: hasilRute.rows.map(({ id, kode, seksiCater }) => ({
              value: id,
              label: kode,
              wilayahDistId: seksiCater.wilayahDistId,
            })),
            tarifGolonganId: tarif.rows.map(({ id, kodeAsli, nama }) => ({
              value: id,
              label: `${kodeAsli} · ${nama}`,
            })),
            pencatatLanjutanId: hasilPencatat.rows.map(
              ({ id, namaLapangan }) => ({
                value: id,
                label: namaLapangan,
              })
            ),
            kecamatanId: kecamatan.rows.map(({ id, kode, nama }) => ({
              value: id,
              label: `${kode} · ${nama}`,
            })),
            kelurahanId: kelurahan.rows.map(
              ({ id, kode, nama, kecamatanId }) => ({
                value: id,
                label: `${kode} · ${nama}`,
                kecamatanId,
              })
            ),
          })
          setGalatOpsiPencarian(null)
        }
      )
      .catch((err) => {
        if (!batal) {
          setGalatOpsiPencarian(
            err instanceof ApiError ? err.message : "Gagal memuat data pilihan."
          )
        }
      })
    return () => {
      batal = true
    }
  }, [])

  React.useEffect(() => {
    let batal = false
    setPenugasanRuteDimuat(false)
    setPenugasanRute([])
    ambilSatu<PenugasanFilter[]>("/penugasan-rute/opsi-filter", {
      periode: periode ?? undefined,
    })
      .then((pasangan) => {
        if (!batal) {
          setPenugasanRute(pasangan)
          setPenugasanRuteDimuat(true)
          setGalatOpsiPencarian(null)
        }
      })
      .catch((err) => {
        if (!batal) {
          setPenugasanRute([])
          setPenugasanRuteDimuat(true)
          setGalatOpsiPencarian(
            err instanceof ApiError
              ? err.message
              : "Gagal memuat relasi Petugas dan Rute."
          )
        }
      })
    return () => {
      batal = true
    }
  }, [periode])

  React.useEffect(() => {
    let batal = false
    ambilSatu<StatsVerifikasi>("/laporan-harian/stats", {
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

  const ambang = stats?.ambangAnomali ?? 50

  async function jalankanKonfirmasi() {
    if (!konfirmasi) return
    setMengirim(true)
    setGalatAksi(null)
    try {
      await kirimJson(
        `/laporan-harian/${konfirmasi.id}/${konfirmasi.endpoint}`,
        "PATCH",
        {}
      )
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

  async function verifikasiLangsung(id: string) {
    setMengirim(true)
    try {
      const hasil = await kirimJson<{ ring: 1 | 2 | 3; laporan: unknown }>(
        `/laporan-harian/${id}/verifikasi-langsung`,
        "PATCH",
        {}
      )
      toast.success(
        hasil.ring === 3
          ? "Hasil resmi berhasil diterbitkan atau diperbarui."
          : `Laporan ditandai diverifikasi pada ring V${hasil.ring}.`
      )
      setRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Verifikasi gagal dijalankan."
      )
    } finally {
      setMengirim(false)
    }
  }

  async function simpanKoreksi(id: string, hasil: HasilKoreksi) {
    await kirimJson(`/laporan-harian/${id}/koreksi`, "PATCH", hasil)
    setModalLain(null)
    setRefreshKey((k) => k + 1)
    toast.success("Koreksi laporan berhasil disimpan.")
  }

  async function simpanBacaManual(baris: BarisLaporan, hasil: HasilBacaManual) {
    const { pelangganId: pelangganIdHasil, ...dataHasil } = hasil
    const pelangganId =
      pelangganIdHasil ?? baris.pelangganId ?? baris.pelanggan?.id
    if (!pelangganId || !baris.periode) {
      throw new Error("Data pelanggan atau periode tidak lengkap.")
    }
    await kirimJson("/manual-add/satuan", "POST", {
      pelangganId,
      periode: baris.periode,
      ...dataHasil,
    })
    setModalLain(null)
    setRefreshKey((k) => k + 1)
    toast.success("Manual ADD tersimpan dan menunggu verifikasi ulang.")
  }

  async function simpanKondisiFoto(id: string, hasil: HasilKondisiFoto) {
    await kirimJson(`/laporan-harian/${id}/kondisi-foto`, "POST", hasil)
    setModalLain(null)
    toast.success("Penilaian kondisi foto tersimpan di riwayat audit.")
  }

  /// Keadaan tiap item menu menurut tahap baris + role. Susunan dan label
  /// diurus bangunMenuAksi; di sini hanya: boleh/tidak, dan apa yang terjadi.
  function aksiMenu(baris: BarisLaporan): AksiKonteks[] {
    const id = baris.id
    if (!id) return []
    const tahap = tahapLaporanHarian(baris)
    const nama =
      baris.pelanggan?.nama ?? baris.namaPelanggan ?? baris.nomorLangganan ?? ""

    const bukaKonfirmasi = (k: Omit<Konfirmasi, "id" | "endpoint">) => {
      setMenu(null)
      setGalatAksi(null)
      setKonfirmasi({ id, endpoint: "unverify", ...k })
    }
    const bukaModal = (jenis: ModalLain["jenis"]) => {
      setMenu(null)
      setModalLain({ jenis, baris })
    }

    // Verifikasi = ring BERIKUTNYA yang belum terisi.
    const bolehRing =
      (ringAkun === 1 && (tahap === "MENUNGGU_V1" || tahap === "DITOLAK")) ||
      (ringAkun === 2 &&
        (tahap === "MENUNGGU_V1" || tahap === "MENUNGGU_V2")) ||
      (ringAkun === 3 &&
        (tahap === "MENUNGGU_V1" ||
          tahap === "MENUNGGU_V2" ||
          tahap === "MENUNGGU_V3"))

    // Unverifikasi = batalkan SATU tahap terakhir.
    // Sesuai kebijakan VERIFIKASI.md: V1 hanya dapat dibatalkan oleh V2/V3
    // (bisaV2), V2 hanya dapat dibatalkan oleh V3 (bisaV3), dan V3 dapat
    // membuka kembali (reopen) hasil V3 sebelum Tagihan.
    const unverif =
      tahap === "RESMI"
        ? {
            nama: "Batalkan V3",
            boleh: bisaV3,
            judul: "Batalkan approve final?",
            deskripsi: baris.pembacaanId
              ? `PembacaanMeter resmi milik ${nama} dihapus dan laporan kembali ke tahap menunggu V3. Server menolak bila pembacaan sudah dipakai tagihan.`
              : `Persetujuan V3 untuk laporan ${nama} dibatalkan. Hasil resmi yang kini berasal dari jalur lain tetap dipertahankan.`,
          }
        : tahap === "MENUNGGU_V3"
          ? {
              nama: "Batalkan V2",
              boleh: bisaV3,
              judul: "Batalkan V2?",
              deskripsi: `Tanda validasi V2 pada laporan ${nama} dihapus; laporan kembali menunggu V2.`,
            }
          : tahap === "MENUNGGU_V2"
            ? {
                nama: "Batalkan V1",
                boleh: bisaV2,
                judul: "Batalkan V1?",
                deskripsi: `Hasil pemeriksaan V1 pada laporan ${nama} (termasuk revisi stand dan pilihan meter) dihapus; laporan kembali menunggu V1.`,
              }
            : null

    const k: Record<KunciMenu, KeadaanMenu> = {
      verifikasi: {
        aktif: bolehRing,
        keterangan: ringAkun
          ? `Tandai sebagai V${ringAkun}`
          : "Role tidak memiliki izin verifikasi",
        onPilih: () => {
          setMenu(null)
          void verifikasiLangsung(id)
        },
      },
      unverifikasi: {
        aktif: !!unverif && unverif.boleh,
        keterangan: unverif?.nama ?? "Belum ada tahap yang bisa dibatalkan",
        onPilih: () =>
          unverif &&
          bukaKonfirmasi({
            judul: unverif.judul,
            deskripsi: unverif.deskripsi,
            destruktif: true,
          }),
      },
      edit: {
        aktif:
          bisaEdit &&
          tahap !== "RESMI" &&
          (role === "STAFF" ||
            (tahap === "MENUNGGU_V3"
              ? bisaV3
              : tahap === "MENUNGGU_V2"
                ? bisaV2
                : bisaV1)),
        keterangan:
          tahap === "RESMI"
            ? "Buka kembali (Batalkan V3) terlebih dahulu sebelum mengoreksi hasil resmi"
            : tahap === "MENUNGGU_V3" && !bisaV3 && role !== "STAFF"
              ? "Koreksi setelah V2 memerlukan Senior Manager ke atas (V3)"
              : tahap === "MENUNGGU_V2" && !bisaV2 && role !== "STAFF"
                ? "Koreksi setelah V1 memerlukan Manager ke atas (V2/V3)"
                : undefined,
        onPilih: () => bukaModal(profil === "chn" ? "chn" : "edit"),
      },
      add: {
        aktif:
          bisaEdit &&
          (tahap === "MENUNGGU_V2" ||
            tahap === "MENUNGGU_V3" ||
            tahap === "RESMI"),
        keterangan:
          tahap === "MENUNGGU_V1" || tahap === "DITOLAK"
            ? "Laporan belum diverifikasi; gunakan menu Edit/Koreksi"
            : undefined,
        onPilih: () => bukaModal("add"),
      },
      kondisiFoto: { aktif: bisaV1, onPilih: () => bukaModal("foto") },
      bacaUlang: {
        aktif: bisaV1 && tahap !== "RESMI" && tahap !== "DITOLAK",
        keterangan:
          tahap === "DITOLAK"
            ? "Sudah dikembalikan untuk cek ulang"
            : undefined,
        onPilih: () => {
          setMenu(null)
          setGalatAksi(null)
          setCekUlangId(id)
        },
      },
      batalBacaUlang: {
        aktif: bisaV1 && tahap === "DITOLAK",
        keterangan:
          tahap === "DITOLAK" ? undefined : "Baris tidak sedang dibaca ulang",
        onPilih: () =>
          bukaKonfirmasi({
            judul: "Batalkan penolakan?",
            deskripsi: `Laporan ${nama} dikembalikan ke antrean MENUNGGU. Ring dan koreksi sebelumnya tetap tercatat dalam audit.`,
          }),
      },
    }

    return bangunMenuAksi(profil, k)
  }

  return (
    <>
      {/* TATA LETAK: panel detail KIRI (terbuka di ukuran paling kecil —
          defaultSize = minSize), tabel KANAN yang butuh lebar. Tanpa gap dan
          tanpa border luar; satu-satunya garis di antara keduanya adalah
          pemisah yang bisa ditarik. */}
      <div className="h-[calc(100dvh-var(--navbar-h,3.5rem)-6.5rem)] min-h-96">
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
                {tab === "belum" ? (
                  <PanelKosong
                    icon={ViewOffIcon}
                    pesan="Sambungan ini belum punya setoran, jadi belum ada detail laporan. Tagih pencatatannya ke petugas rute."
                  />
                ) : (
                  <PanelLapangan
                    key={`${idTerpilih ?? "kosong"}-${refreshKey}`}
                    id={idTerpilih}
                  />
                )}
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
              {galatStats && (
                <p className="shrink-0 text-xs text-destructive">
                  {galatStats}
                </p>
              )}

              <RingkasanVerifikasi
                stats={stats}
                periode={periode ?? null}
                terbuka={ringkasanTerbuka}
              />

              <div className="min-h-0 min-w-0 flex-1">
                <PanelTabel
                  periodes={stats?.periodes ?? []}
                  pencatats={pencatats}
                  rutes={rutes}
                  penugasanRute={penugasanRute}
                  opsiPencarian={opsiPencarianDenganPenugasan}
                  galatOpsiPencarian={galatOpsiPencarian}
                  ambangAnomali={ambang}
                  bolehRing={(r) =>
                    r === 1 ? bisaV1 : r === 2 ? bisaV2 : bisaV3
                  }
                  idTerpilih={idTerpilih}
                  onPeriodeBerubah={setPeriode}
                  onKlikBaris={(row) => setIdTerpilih(row.id)}
                  onKlikKanan={(row, posisi) => {
                    setIdTerpilih(row.id)
                    setCekUlangId(null)
                    setMenu({ posisi, baris: row as BarisLaporan })
                  }}
                  refreshKey={refreshKey}
                  onBerubah={() => setRefreshKey((k) => k + 1)}
                  sisaKerja={stats ? stats.total - stats.diverifikasi : null}
                  onTabBerubah={(t) => {
                    setTab(t)
                    setIdTerpilih(null)
                    setCekUlangId(null)
                  }}
                  anomali={stats?.anomali ?? 0}
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
          judul={`${menu.baris.nomorLangganan ?? ""} · ${menu.baris.pelanggan?.nama ?? menu.baris.namaPelanggan ?? ""}`}
          aksi={aksiMenu(menu.baris)}
          onTutup={() => setMenu(null)}
        />
      )}

      {/* Modal edit terhubung ke koreksi laporan petugas; jalur mandiri tetap baca-saja. */}
      {modalLain &&
        (modalLain.jenis === "edit" || modalLain.jenis === "chn") && (
          <ModalKoreksi
            key={modalLain.baris.id}
            id={modalLain.baris.id}
            data={dataKoreksiDariBaris(modalLain.baris)}
            onTutup={() => setModalLain(null)}
            onSimpan={(hasil) => simpanKoreksi(modalLain.baris.id, hasil)}
            bolehAturTagihan={bisaV3}
          />
        )}
      {modalLain?.jenis === "add" && (
        <ModalBacaManual
          data={{
            ...dataKoreksiDariBaris(modalLain.baris),
            pelangganId:
              modalLain.baris.pelangganId ??
              modalLain.baris.pelanggan?.id ??
              null,
            nomorLangganan: modalLain.baris.nomorLangganan ?? null,
            periodeId: modalLain.baris.periode ?? null,
          }}
          onTutup={() => setModalLain(null)}
          onSimpan={(hasil) => simpanBacaManual(modalLain.baris, hasil)}
        />
      )}
      {modalLain?.jenis === "foto" && (
        <ModalKondisiFoto
          data={dataKoreksiDariBaris(modalLain.baris)}
          id={modalLain.baris.id}
          onTutup={() => setModalLain(null)}
          onSimpan={(hasil) => simpanKondisiFoto(modalLain.baris.id, hasil)}
        />
      )}
      {cekUlangId && (
        <ModalCekUlang
          id={cekUlangId}
          onTutup={() => setCekUlangId(null)}
          onSelesai={() => {
            setCekUlangId(null)
            setRefreshKey((k) => k + 1)
          }}
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
                void jalankanKonfirmasi()
              }}
            >
              {mengirim && <Spinner className="size-3.5" />}
              {konfirmasi?.destruktif ? "Ya, batalkan" : "Ya, lanjutkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
