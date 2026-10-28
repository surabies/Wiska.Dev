"use client";

// features/dashboard/components/verifikasi/panel-mandiri.tsx — panel detail
// halaman verifikasi laporan mandiri pelanggan. Bentuk, urutan seksi, dan
// ingatan buka/tutup seksinya SAMA dengan panel-lapangan.
//
// MURNI PENAMPIL DETAIL. Aksi (verifikasi/koreksi, tolak, batalkan) dipicu
// dari MENU KLIK KANAN; halaman meneruskan pilihan lewat prop `aksi`.
//
// Meter tujuan, stand lalu, dan blok tarif tidak pernah ditampilkan: ketiganya
// turunan mekanis, dihitung diam-diam dan dikirim saat verify.
import * as React from "react";
import { CursorPointer01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriode, formatTanggal } from "@/features/public/lib/format";
import { ambilSatu, ambilList, ApiError } from "../../../lib/api-client";
import type { LaporanMandiriDetail, MeterRingkas, PembacaanRingkas } from "../types/tipe";
import { GridStand, InfoPelanggan, PanelKosong, Seksi } from "./panel-bagian";
import { FotoBukti } from "../foto/foto-bukti";
import { FotoSebelumnya } from "../foto/foto-sebelumnya";
import { HistoriPemakaian } from "../histori-pemakaian";
import { PetaLokasi } from "../peta-lokasi";
import { ModalMandiri } from "../modal/modal-mandiri";

export type AksiMandiri = "verify" | "tolak";

export function PanelMandiri({
  id,
  aksi,
  onTutupAksi,
  onSelesai,
}: {
  id: string | null;
  /** Aksi dari menu klik kanan yang butuh modal; null = tidak ada modal. */
  aksi: AksiMandiri | null;
  onTutupAksi: () => void;
  onSelesai: () => void;
}) {
  const [detail, setDetail] = React.useState<LaporanMandiriDetail | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [muatKe, setMuatKe] = React.useState(0);

  const [dataMeter, setDataMeter] = React.useState<{
    laporanId: string;
    meterId: string;
    galat?: string;
  } | null>(null);
  const [riwayatMeter, setRiwayatMeter] = React.useState<{
    meterId: string;
    standLalu: number;
    blokTarif: number;
  } | null>(null);
  const [galatRiwayat, setGalatRiwayat] = React.useState<{
    meterId: string;
    pesan: string;
  } | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let batal = false;
    (async () => {
      let detailDimuat = false;
      try {
        const row = await ambilSatu<LaporanMandiriDetail>(`/laporan-mandiri/${id}`);
        if (batal) return;
        setDetail(row);
        setGalat(null);
        detailDimuat = true;
        const { rows } = await ambilList<MeterRingkas>("/meter", {
          pelangganId: row.pelangganId,
          pageSize: 100,
        });
        if (batal) return;
        setDataMeter({
          laporanId: id,
          meterId: (rows.find((m) => m.isAktif) ?? rows[0])?.id ?? "",
        });
      } catch (err) {
        if (batal) return;
        const pesan =
          err instanceof ApiError
            ? err.message
            : detailDimuat
              ? "Gagal memuat meter pelanggan."
              : "Gagal memuat detail laporan.";
        if (detailDimuat) setDataMeter({ laporanId: id, meterId: "", galat: pesan });
        else setGalat(pesan);
      }
    })();
    return () => {
      batal = true;
    };
  }, [id, muatKe]);

  const dataMeterAktif = id && dataMeter?.laporanId === id ? dataMeter : null;
  const meterId = dataMeterAktif?.meterId ?? "";
  const galatMeter = dataMeterAktif?.galat ?? null;

  // Prefill stand lalu & blok tarif dari pembacaan resmi terakhir meter terpilih.
  React.useEffect(() => {
    if (!meterId) return;
    let batal = false;
    ambilList<PembacaanRingkas>("/pembacaan", {
      meterId,
      periodeSebelum: detail?.periode,
      pageSize: 1,
    })
      .then(({ rows }) => {
        if (batal) return;
        setRiwayatMeter({
          meterId,
          standLalu: rows[0]?.standAkhir ?? 0,
          blokTarif: rows[0]?.blokTarif ?? 1,
        });
        setGalatRiwayat(null);
      })
      .catch((err) => {
        if (batal) return;
        setGalatRiwayat({
          meterId,
          pesan: err instanceof ApiError ? err.message : "Gagal memuat riwayat pembacaan meter.",
        });
      });
    return () => {
      batal = true;
    };
  }, [meterId, detail?.periode]);

  if (!id) {
    return (
      <PanelKosong
        icon={CursorPointer01Icon}
        pesan="Klik baris untuk melihat detail; klik kanan baris untuk aksi verifikasi, tolak, atau batalkan."
      />
    );
  }
  if (!detail && !galat) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (!detail) {
    return <p className="p-4 text-center text-xs text-destructive">{galat ?? "Detail tidak ditemukan."}</p>;
  }

  const riwayatAktif = meterId && riwayatMeter?.meterId === meterId ? riwayatMeter : null;
  const galatRiwayatAktif = meterId && galatRiwayat?.meterId === meterId ? galatRiwayat.pesan : null;
  const standAwal = detail.pembacaan?.standLalu ?? riwayatAktif?.standLalu ?? null;
  const pemakaianCatat = standAwal === null ? null : Math.max(0, detail.standDilaporkan - standAwal);
  // Pagar kedua — menu klik kanan sudah menyaring status MENUNGGU.
  const bisaModal = detail.status === "MENUNGGU";

  // Tiga angka yang sama persis dengan panel Petugas.
  const stAkhir = detail.pembacaan?.standAkhir ?? detail.standDilaporkan;
  const pakai = detail.pembacaan?.pemakaianM3 ?? pemakaianCatat;

  return (
    <div className="flex min-w-0 flex-col gap-2 p-3">
      <Seksi id="info" judul="Informasi pelanggan" awalBuka>
        <InfoPelanggan
          nama={detail.pelanggan?.nama ?? "—"}
          status={detail.status}
          nomor={detail.nomorLangganan}
          alamat={detail.pelanggan?.alamat}
        />
      </Seksi>

      <Seksi id="stand" judul="Stand meter" awalBuka>
        <GridStand
          sel={[
            { label: "ST awal", nilai: standAwal },
            { label: "ST akhir", nilai: stAkhir, nada: "info" },
            { label: "Pakai", nilai: pakai, nada: "sukses" },
          ]}
        />
        <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          <span>
            {formatPeriode(detail.periode)} · dilaporkan {formatTanggal(detail.createdAt)}
          </span>
          <span>
            Pelapor: {detail.namaPelapor} · {detail.nomorPelapor}
          </span>
          {detail.pembacaan?.sumberLaporan && (
            <span>
              Sumber hasil resmi: {detail.pembacaan.sumberLaporan === "PETUGAS" ? "Petugas" : "Konsumen"}
            </span>
          )}
        </div>
      </Seksi>

      <Seksi id="histori" judul="Histori pemakaian (3 bulan)">
        <HistoriPemakaian pelangganId={detail.pelangganId} />
      </Seksi>

      <Seksi id="foto-lalu" judul="Foto periode sebelumnya">
        <FotoSebelumnya pelangganId={detail.pelangganId} periode={detail.periode} />
      </Seksi>

      <Seksi id="foto" judul="Foto periode berjalan">
        <FotoBukti url={detail.fotoUrl} label={`Foto meter — ${formatPeriode(detail.periode)}`} />
      </Seksi>

      <Seksi id="lokasi" judul="Lokasi">
        <PetaLokasi langsung lat={detail.pelanggan?.geoLat} lng={detail.pelanggan?.geoLong} />
      </Seksi>

      {(detail.status === "DIVERIFIKASI" || detail.status === "DIGUNAKAN") && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Sudah menjadi pembacaan resmi
          {detail.verifiedBy?.name ? ` — diverifikasi ${detail.verifiedBy.name}` : ""}
          {detail.verifiedAt ? ` (${formatTanggal(detail.verifiedAt)})` : ""}.
        </p>
      )}
      {detail.status === "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Ditolak
          {detail.verifiedBy?.name ? ` oleh ${detail.verifiedBy.name}` : ""}
          {detail.alasanDitolak ? ` — “${detail.alasanDitolak}”` : ""}.
        </p>
      )}

      {aksi && bisaModal && (
        <ModalMandiri
          detail={detail}
          meterId={meterId}
          memuatMeter={!dataMeterAktif}
          galatMeter={galatMeter}
          standLalu={riwayatAktif?.standLalu ?? null}
          blokTarif={riwayatAktif?.blokTarif ?? null}
          galatRiwayat={galatRiwayatAktif}
          tolakAwal={aksi === "tolak"}
          onTutup={onTutupAksi}
          onSelesai={() => {
            onTutupAksi();
            onSelesai();
            setMuatKe((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}