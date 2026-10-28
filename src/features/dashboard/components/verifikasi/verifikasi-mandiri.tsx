"use client";

// features/dashboard/components/verifikasi/verifikasi-mandiri.tsx —
// halaman verifikasi laporan meter mandiri pelanggan (master-detail),
// kembaran verifikasi-lapangan untuk sumber data /laporan-mandiri.
// Laporan mandiri tetap satu ring: verify langsung membuat pembacaan resmi.
//
// MENU KLIK KANAN memakai susunan yang sama dengan Petugas (menu-aksi.ts):
//   Verifikasi    → modal verifikasi/koreksi stand (hanya status MENUNGGU)
//   Unverifikasi  → batalkan verifikasi (status DIVERIFIKASI/DIGUNAKAN)
//   Edit / CHN    → modal Koreksi Data Pembacaan   (BARU, tampilan saja)
//   ADD           → modal Baca Manual              (BARU, tampilan saja)
//   Kondisi Foto  → modal Kondisi Foto & Lapangan  (BARU, tampilan saja)
//   BacaUlang     → modal tolak / minta foto ulang (status MENUNGGU)
//   Batal Baca Ulang → kembalikan baris DITOLAK ke antrean
//
// BARIS YANG SUDAH DIVERIFIKASI TIDAK DIHAPUS dari tabel: ia berpindah status
// ke DIGUNAKAN. Yang membuatnya tampak "hilang" hanyalah penyaring status yang
// masih menempel — pilih "Sudah diverifikasi" (atau bersihkan saringan).
import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client";
import type { StatsVerifikasi } from "./types/tipe";
import { RingkasanVerifikasi } from "./ringkasan-verifikasi";
import { PanelTabelMandiri, type BarisMandiriTabel } from "./panel/panel-tabel-mandiri";
import { PanelMandiri, type AksiMandiri } from "./panel/panel-mandiri";
import { MenuKonteks, type AksiKonteks } from "./menu-konteks";
import {
  bangunMenuAksi,
  type KeadaanMenu,
  type KunciMenu,
  type ProfilMenu,
} from "./types/menu-aksi";
import { ModalKoreksi, dataKoreksiDariBaris } from "./modal/modal-koreksi";
import { ModalKondisiFoto } from "./modal/modal-kondisi-foto";
import { ModalBacaManual } from "./modal/modal-baca-manual";

/** Modal formulir baru (tampilan saja) yang sedang terbuka. */
type ModalLain = { jenis: "edit" | "chn" | "add" | "foto"; baris: BarisMandiriTabel };

export function VerifikasiMandiri({
  bisaAksi,
  profilMenu = "penilai",
}: {
  bisaAksi: boolean;
  /** "chn" = menu CHN / Batal Baca Ulang / Unverifikasi mati. */
  profilMenu?: ProfilMenu;
}) {
  // undefined = belum init; diisi periode terbaru yang punya data.
  const [periode, setPeriode] = React.useState<number | null | undefined>(undefined);
  const [stats, setStats] = React.useState<StatsVerifikasi | null>(null);
  const [galatStats, setGalatStats] = React.useState<string | null>(null);
  const [idTerpilih, setIdTerpilih] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [ringkasanTerbuka, setRingkasanTerbuka] = React.useState(true);

  const [menu, setMenu] = React.useState<{
    posisi: { x: number; y: number };
    baris: BarisMandiriTabel;
  } | null>(null);
  const [aksi, setAksi] = React.useState<AksiMandiri | null>(null);
  const [modalLain, setModalLain] = React.useState<ModalLain | null>(null);
  const [konfirmasi, setKonfirmasi] = React.useState<{
    id: string;
    judul: string;
    deskripsi: string;
  } | null>(null);
  const [mengirim, setMengirim] = React.useState(false);
  const [galatAksi, setGalatAksi] = React.useState<string | null>(null);

  React.useEffect(() => {
    let batal = false;
    ambilSatu<StatsVerifikasi>("/laporan-mandiri/stats", { periode: periode ?? undefined })
      .then((s) => {
        if (batal) return;
        setStats(s);
        setGalatStats(null);
        setPeriode((lama) => (lama === undefined ? (s.periodes[0] ?? null) : lama));
      })
      .catch((err) => {
        if (!batal)
          setGalatStats(err instanceof ApiError ? err.message : "Gagal memuat ringkasan.");
      });
    return () => {
      batal = true;
    };
  }, [periode, refreshKey]);

  async function jalankanUnverify() {
    if (!konfirmasi) return;
    setMengirim(true);
    setGalatAksi(null);
    try {
      await kirimJson(`/laporan-mandiri/${konfirmasi.id}/unverify`, "PATCH", {});
      setKonfirmasi(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setGalatAksi(err instanceof ApiError ? err.message : "Aksi gagal dijalankan.");
    } finally {
      setMengirim(false);
    }
  }

  function aksiMenu(baris: BarisMandiriTabel): AksiKonteks[] {
    const id = baris.id;
    if (!id) return [];
    const nama = baris.pelanggan?.nama ?? baris.nomorLangganan ?? "";
    const tanpaAkses = "Akun Anda tidak punya akses verifikasi";
    const resmi = baris.status === "DIVERIFIKASI" || baris.status === "DIGUNAKAN";

    const bukaKonfirmasi = (judul: string, deskripsi: string) => {
      setMenu(null);
      setGalatAksi(null);
      setKonfirmasi({ id, judul, deskripsi });
    };
    const bukaModal = (jenis: ModalLain["jenis"]) => {
      setMenu(null);
      setModalLain({ jenis, baris });
    };

    const k: Record<KunciMenu, KeadaanMenu> = {
      verifikasi: {
        aktif: bisaAksi && baris.status === "MENUNGGU",
        keterangan: !bisaAksi
          ? tanpaAkses
          : baris.status === "MENUNGGU"
            ? "Periksa foto, koreksi bila salah input, lalu jadikan resmi"
            : resmi
              ? "Sudah resmi"
              : "Perlu dikembalikan ke antrean dulu",
        onPilih: () => {
          setMenu(null);
          setAksi("verify");
        },
      },
      unverifikasi: {
        aktif: bisaAksi && resmi,
        keterangan: !bisaAksi
          ? tanpaAkses
          : resmi
            ? "Pembacaan resmi dihapus; ditolak bila sudah dipakai tagihan"
            : "Belum ada verifikasi yang bisa dibatalkan",
        onPilih: () =>
          bukaKonfirmasi(
            "Batalkan verifikasi?",
            `Laporan ${nama} kembali ke status menunggu; PembacaanMeter resmi yang terbentuk ikut dihapus. Server menolak bila pembacaan sudah dipakai tagihan.`,
          ),
      },
      edit: {
        aktif: bisaAksi,
        keterangan: bisaAksi ? undefined : tanpaAkses,
        onPilih: () => bukaModal(profilMenu === "chn" ? "chn" : "edit"),
      },
      add: {
        aktif: bisaAksi,
        keterangan: bisaAksi ? undefined : tanpaAkses,
        onPilih: () => bukaModal("add"),
      },
      kondisiFoto: {
        aktif: bisaAksi,
        keterangan: bisaAksi ? undefined : tanpaAkses,
        onPilih: () => bukaModal("foto"),
      },
      bacaUlang: {
        aktif: bisaAksi && baris.status === "MENUNGGU",
        keterangan: !bisaAksi
          ? tanpaAkses
          : baris.status === "MENUNGGU"
            ? "Minta pelapor mengirim foto ulang"
            : undefined,
        onPilih: () => {
          setMenu(null);
          setAksi("tolak");
        },
      },
      batalBacaUlang: {
        aktif: bisaAksi && baris.status === "DITOLAK",
        keterangan: !bisaAksi
          ? tanpaAkses
          : baris.status === "DITOLAK"
            ? undefined
            : "Laporan tidak sedang dibaca ulang",
        onPilih: () =>
          bukaKonfirmasi(
            "Batalkan penolakan?",
            `Alasan penolakan dihapus dan laporan ${nama} kembali ke antrean menunggu verifikasi.`,
          ),
      },
    };

    return bangunMenuAksi(profilMenu, k);
  }

  return (
    // TATA LETAK KEMBAR verifikasi-lapangan: panel detail di kiri terbuka di
    // ukuran paling kecil (defaultSize = minSize) supaya tabel langsung mendapat
    // lebar maksimal. Pemisah bisa ditarik untuk melebarkan.
    <>
      <div className="h-[calc(100dvh-var(--navbar-h,3.5rem)-6.5rem)] min-h-96">
        <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 items-stretch">
          <ResizablePanel
            defaultSize="18"
            minSize="18"
            maxSize="45"
            collapsible
            className="flex min-w-0 flex-col"
          >
            {/* Judul DI LUAR wadah bergulir supaya garis atasnya tidak terpotong. */}
            <aside className="bg-card border-border/70 flex h-full min-h-0 flex-col overflow-hidden rounded-lg border">
              <div className="border-border/70 shrink-0 border-b px-4 py-2.5">
                <h2 className="text-center text-sm font-medium">Detail laporan</h2>
              </div>
              <div className="scrollbar-tipis min-h-0 flex-1 overflow-y-auto">
                {/* key: ganti baris = remount panel, state mulai bersih. */}
                <PanelMandiri
                  key={idTerpilih ?? "kosong"}
                  id={idTerpilih}
                  aksi={aksi}
                  onTutupAksi={() => setAksi(null)}
                  onSelesai={() => setRefreshKey((k) => k + 1)}
                />
              </div>
            </aside>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="82" minSize="50" className="flex min-w-0 flex-col">
            <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 pl-3">
              <RingkasanVerifikasi stats={stats} periode={periode ?? null} terbuka={ringkasanTerbuka} />

              {galatStats && <p className="shrink-0 text-xs text-destructive">{galatStats}</p>}

              <div className="min-h-0 min-w-0 flex-1">
                <PanelTabelMandiri
                  periodes={stats?.periodes ?? []}
                  periode={periode}
                  onPeriode={setPeriode}
                  refreshKey={refreshKey}
                  idTerpilih={idTerpilih}
                  onKlikBaris={(row) => setIdTerpilih(row.id)}
                  onKlikKanan={(row, posisi) => {
                    setIdTerpilih(row.id);
                    setAksi(null);
                    setMenu({ posisi, baris: row });
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

      {/* Modal formulir baru — tampilan saja, dirender hanya saat diminta. */}
      {modalLain && (modalLain.jenis === "edit" || modalLain.jenis === "chn") && (
        <ModalKoreksi data={dataKoreksiDariBaris(modalLain.baris)} onTutup={() => setModalLain(null)} />
      )}
      {modalLain?.jenis === "add" && (
        <ModalBacaManual data={dataKoreksiDariBaris(modalLain.baris)} onTutup={() => setModalLain(null)} />
      )}
      {modalLain?.jenis === "foto" && (
        <ModalKondisiFoto data={dataKoreksiDariBaris(modalLain.baris)} onTutup={() => setModalLain(null)} />
      )}

      <AlertDialog
        open={konfirmasi !== null}
        onOpenChange={(buka) => {
          if (!buka && !mengirim) setKonfirmasi(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{konfirmasi?.judul}</AlertDialogTitle>
            <AlertDialogDescription>{konfirmasi?.deskripsi}</AlertDialogDescription>
          </AlertDialogHeader>
          {galatAksi && <p className="text-xs text-destructive">{galatAksi}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mengirim}>Batal</AlertDialogCancel>
            {/* onClick tanpa auto-close: dialog baru ditutup setelah server
                menjawab sukses; galat tampil di dalam dialog. */}
            <AlertDialogAction
              disabled={mengirim}
              onClick={(e) => {
                e.preventDefault();
                void jalankanUnverify();
              }}
            >
              {mengirim && <Spinner className="size-3.5" />}
              Ya, lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}