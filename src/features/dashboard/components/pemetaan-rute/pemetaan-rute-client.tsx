"use client"

// features/dashboard/components/pemetaan-rute/pemetaan-rute-client.tsx —
// PERAKIT halaman Pemetaan Rute: mengatur rute mana dikerjakan petugas mana,
// dan urutannya. PERMANEN: berlaku otomatis tiap periode (dibaca mobile lewat
// GET /laporan-harian/rute-saya) tanpa admin mengatur ulang tiap bulan.
// Satu rute boleh dibagi ke beberapa petugas.
//
// Tata letak: pilih petugas (kiri, DataGrid) → atur rutenya (kanan, seret
// untuk urutkan). Dua tab memakai TabLembaran (gaya map/buku catatan) supaya
// seragam dengan halaman Laporan Harian. Pembagian berkas:
//   panel-petugas.tsx · kolom-petugas-rute.ts   panel kiri
//   panel-rute.tsx · daftar-seret.tsx            panel kanan
//   use-penugasan-rute.ts                        data & aksi panel kanan
//   tambah-rute-dialog.tsx · halaman-urutan-pelanggan.tsx · use-urutan-pelanggan.ts
//   model.ts                                     tipe & pemetaan murni
import * as React from "react"
import { useRouter } from "next/navigation"
import { Route01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { useKonfirmasi } from "../konfirmasi/use-konfirmasi"
import { namaTampil, type BarisRuteSeret, type PencatatBaris } from "./model"
import { PanelPetugas } from "./panel-petugas"
import { PanelRute } from "./panel-rute"
import { RuteTanpaPetugas } from "./rute-tanpa-petugas"
import { DialogAturPosisi } from "./dialog-atur-posisi"
import { TambahRuteDialog } from "./tambah-rute-dialog"
import { usePenugasanRute } from "./use-penugasan-rute"

type KunciTab = "pemetaan" | "tanpa-petugas"

const TAB: ItemTab<KunciTab>[] = [
  { kunci: "pemetaan", label: "Pemetaan petugas", icon: UserGroupIcon },
  { kunci: "tanpa-petugas", label: "Rute belum ditugaskan", icon: Route01Icon },
]

export function PemetaanRuteClient({ bolehUbah }: { bolehUbah: boolean }) {
  const router = useRouter()
  // Tab dikendalikan dari sini (TabLembaran tidak menyimpan state sendiri).
  const [tab, setTab] = React.useState<KunciTab>("pemetaan")
  const [terpilih, setTerpilih] = React.useState<PencatatBaris | null>(null)
  const [segarGrid, setSegarGrid] = React.useState(0)
  const [tambahBuka, setTambahBuka] = React.useState(false)
  const [posisiRute, setPosisiRute] = React.useState<{
    id: string
    kode: string
    posisi: number
  } | null>(null)

  const { minta, dialog } = useKonfirmasi()
  const penugasan = usePenugasanRute(terpilih?.id ?? null, () => setSegarGrid((v) => v + 1))

  React.useEffect(() => {
    if (!penugasan.berubah) return
    const cegahTutup = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", cegahTutup)
    return () => window.removeEventListener("beforeunload", cegahTutup)
  }, [penugasan.berubah])

  function pilihPetugas(petugas: PencatatBaris) {
    if (petugas.id === terpilih?.id) return
    if (
      penugasan.berubah &&
      !window.confirm("Buang draf urutan rute yang belum disimpan?")
    ) {
      return
    }
    penugasan.batalkanUrutan()
    setTerpilih(petugas)
  }

  // Penjaga: melepas rute harus dikonfirmasi, dan kegagalannya tampil di dialog.
  function mintaLepas(rute: BarisRuteSeret) {
    if (!terpilih) return
    const nama = namaTampil(terpilih)
    minta({
      judul: `Lepas rute ${rute.kode}?`,
      deskripsi: (
        <>
          Rute <strong>{rute.kode}</strong> tidak lagi ditugaskan ke <strong>{nama}</strong> dan akan hilang dari
          daftar kerjanya di aplikasi mobile. Rute dan pelanggannya tidak dihapus, dan petugas lain yang
          memegang rute ini tidak terpengaruh.
        </>
      ),
      labelYa: "Lepas rute",
      nada: "bahaya",
      aksi: () => penugasan.lepas(rute.penugasanId),
    })
  }

  return (
    <>
      <TabLembaran
        label="Bagian pemetaan rute"
        tab={TAB}
        aktif={tab}
        onGanti={setTab}
        // Menempati slot yang sama dengan <Tabs> sebelumnya.
        className="min-h-0 flex-1"
        panelClassName={cn(
          tab === "pemetaan"
            ? // Layar sempit: dua panel menumpuk, jadi lembaran boleh menggulir.
              // Desktop: keduanya berbagi tinggi, isi panel yang menggulir.
              "overflow-y-auto p-4 lg:overflow-hidden"
            : // Tabel penuh di dalam lembaran: border & bayangannya dilepas
              // (sama seperti tab "Daftar setoran" di Laporan Harian).
              "[&>section]:rounded-none [&>section]:border-0 [&>section]:shadow-none",
        )}
      >
        {tab === "pemetaan" ? (
          <div className="grid flex-none gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
            {/* Di layar sempit panel menumpuk; di desktop keduanya berbagi tinggi viewport. */}
            <div className="h-112 min-h-0 lg:h-auto">
              <PanelPetugas terpilihId={terpilih?.id ?? null} refreshKey={segarGrid} onPilih={pilihPetugas} />
            </div>

            <PanelRute
              className="min-h-96 lg:min-h-0"
              petugas={terpilih}
              bolehUbah={bolehUbah}
              memuat={penugasan.memuat}
              galat={penugasan.galat}
              rute={penugasan.rute}
              perubahanUrutan={penugasan.perubahanUrutan}
              berubah={penugasan.berubah}
              totalTarget={penugasan.totalTarget}
              menyusun={penugasan.menyusun}
              onUrut={(ids) => penugasan.urutkan(ids)}
              onAturPosisi={(id, posisi) => {
                const rute = penugasan.rute.find((item) => item.id === id)
                if (rute) setPosisiRute({ id, kode: rute.kode, posisi })
              }}
              onBatalkanUrutan={penugasan.batalkanUrutan}
              onSimpanUrutan={() => void penugasan.simpanUrutan()}
              onTambah={() => setTambahBuka(true)}
              onLepas={mintaLepas}
              onUrutPelanggan={(r) =>
                router.push(
                  `/master/urut/urutan/${encodeURIComponent(r.id)}?kode=${encodeURIComponent(r.kode)}`,
                )
              }
            />
          </div>
        ) : (
          <RuteTanpaPetugas
            bolehUbah={bolehUbah}
            refreshKey={segarGrid}
            onBerubah={() => setSegarGrid((v) => v + 1)}
          />
        )}
      </TabLembaran>

      {/* Dialog sengaja di LUAR TabLembaran: lembaran memakai overflow-hidden dan
          animasi geser, yang bisa memotong atau menggeser dialog di dalamnya. */}
      {tambahBuka && terpilih && (
        <TambahRuteDialog
          namaPencatat={namaTampil(terpilih)}
          ruteTerpakai={penugasan.ruteTerpakai}
          onPilih={penugasan.tugaskan}
          onTutup={() => setTambahBuka(false)}
        />
      )}
      {posisiRute && (
        <DialogAturPosisi
          jenis="rute"
          namaItem={posisiRute.kode}
          posisiSaatIni={posisiRute.posisi}
          jumlah={penugasan.rute.length}
          onTutup={() => setPosisiRute(null)}
          onTerapkan={(posisi) => {
            penugasan.aturPosisi(posisiRute.id, posisi)
            setPosisiRute(null)
          }}
        />
      )}
      {dialog}
    </>
  )
}