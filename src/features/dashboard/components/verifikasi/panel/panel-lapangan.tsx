"use client";

// features/dashboard/components/verifikasi/panel-lapangan.tsx — panel detail
// halaman verifikasi laporan petugas lapangan.
//
// MURNI PENAMPIL DETAIL. Seluruh aksi (V1/V2/V3, cek ulang, unverify) dipicu
// dari MENU KLIK KANAN pada baris tabel; halaman meneruskannya lewat prop
// `aksi`, dan panel merender ModalLapangan begitu detailnya siap.
//
// Isi panel berupa tumpukan SEKSI LIPAT (kartu). Informasi dan Stand terbuka
// bawaan; histori, foto, ring, dan lokasi tertutup — dan baru mengambil data
// saat dibuka.
import * as React from "react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  CursorPointer01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriode, formatTanggal } from "@/features/public/lib/format";
import { ambilSatu, ambilList, ApiError } from "../../../lib/api-client";
import { LABEL_KONDISI_CATAT, label } from "../../../lib/label";
import type { LaporanHarianDetail, MeterRingkas } from "../types/tipe";
import { tahapLaporanHarian, ringVerif } from "../types/tipe";
import { GridStand, InfoPelanggan, PanelKosong, Seksi } from "./panel-bagian";
import { FotoSebelumnya } from "../foto/foto-sebelumnya";
import { TabFoto } from "../foto/tab-foto";
import { HistoriPemakaian } from "../histori-pemakaian";
import { PetaLokasi } from "../peta-lokasi";
import { ModalLapangan } from "../modal/modal-lapangan";
import { TEKS_RING } from "../types/warna-ring";

/// v2/v3 memakai modal yang SAMA dengan v1: koreksi yang boleh dilakukan
/// ketiganya identik, dan dua formulir untuk satu pekerjaan selalu berujung
/// pada salah satunya ketinggalan diperbarui.
export type AksiLapangan = "v1" | "v2" | "v3" | "cekulang";

/// Baris progres ring V1/V2/V3 — penampil murni. Warna per ring SAMA dengan
/// kolom Ring di tabel, dan ketiganya diperlakukan setara.
function ProgresRing({ detail }: { detail: LaporanHarianDetail }) {
  const ring = ringVerif(detail);
  const baris: { label: string; nama: string | null; tanggal?: string | null; warna: string }[] = [
    { label: "V1 · Supervisor", nama: ring.v1, tanggal: detail.verif1At, warna: TEKS_RING[1] },
    { label: "V2 · Manager", nama: ring.v2, tanggal: detail.verif2At, warna: TEKS_RING[2] },
    { label: "V3 · Senior Manager", nama: ring.v3, tanggal: detail.verif3At, warna: TEKS_RING[3] },
  ];
  return (
    <div className="flex flex-col divide-y divide-border/60">
      {baris.map((b) => (
        <div key={b.label} className="flex flex-col gap-0.5 py-1.5 first:pt-0 last:pb-0">
          <span className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
            {b.label}
          </span>
          {b.nama ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${b.warna}`}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3 shrink-0" aria-hidden />
              {b.nama}
              {b.tanggal ? ` · ${formatTanggal(b.tanggal)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function PanelLapangan({
  id,
  aksi,
  ambangAnomali,
  onTutupAksi,
  onSelesai,
}: {
  id: string | null;
  /** Aksi dari menu klik kanan yang butuh modal; null = tidak ada modal. */
  aksi: AksiLapangan | null;
  ambangAnomali: number;
  onTutupAksi: () => void;
  onSelesai: () => void;
}) {
  const [detail, setDetail] = React.useState<LaporanHarianDetail | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);
  // Pemicu muat ulang setelah aksi. State awal selalu bersih tiap ganti baris
  // karena parent me-remount panel lewat `key`.
  const [muatKe, setMuatKe] = React.useState(0);

  const [meters, setMeters] = React.useState<MeterRingkas[]>([]);
  const [meterAwal, setMeterAwal] = React.useState("");

  React.useEffect(() => {
    if (!id) return;
    let batal = false;
    (async () => {
      try {
        const row = await ambilSatu<LaporanHarianDetail>(`/laporan-harian/${id}`);
        if (batal) return;
        setDetail(row);
        setGalat(null);
        if (row.pelanggan?.id) {
          const { rows } = await ambilList<MeterRingkas>("/meter", {
            pelangganId: row.pelanggan.id,
            pageSize: 100,
          });
          if (batal) return;
          setMeters(rows);
          // Prapilih: meter pilihan V1 sebelumnya, lalu meter yang nomornya
          // cocok dengan laporan, lalu meter aktif.
          const pilihan = rows.find((m) => m.id === row.meterVerifId);
          const cocok = rows.find((m) => row.nomorMeter && m.nomorMeter === row.nomorMeter);
          setMeterAwal(
            (row.kondisi === "MB"
              ? rows.find((m) => m.isAktif)
              : pilihan ?? cocok ?? rows.find((m) => m.isAktif) ?? rows[0]
            )?.id ?? "",
          );
        } else {
          setMeters([]);
          setMeterAwal("");
        }
      } catch (err) {
        if (!batal)
          setGalat(err instanceof ApiError ? err.message : "Gagal memuat detail laporan.");
      }
    })();
    return () => {
      batal = true;
    };
  }, [id, muatKe]);

  if (!id) {
    return (
      <PanelKosong
        icon={CursorPointer01Icon}
        pesan="Klik baris untuk melihat detail; klik kanan baris untuk aksi verifikasi (V1/V2/V3, cek ulang, batalkan)."
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

  const tahap = tahapLaporanHarian(detail);
  const nama = detail.pelanggan?.nama ?? detail.namaPelanggan ?? "Tanpa nama";
  const alamat = detail.pelanggan?.alamat ?? detail.alamatPelanggan;
  const anomali = detail.persentase != null && Math.abs(detail.persentase) > ambangAnomali;

  // Syarat modal PER RING, persis seperti yang ditegakkan server.
  const bisaModal = (() => {
    if (detail.pembacaanId) return false;
    if (aksi === "cekulang") return true;
    if (!detail.pelanggan) return false;
    if (aksi === "v1") return !detail.verif1At;
    if (aksi === "v2") return !!detail.verif1At && !detail.verif2At;
    if (aksi === "v3") return !!detail.verif1At && !!detail.verif2At && !detail.verif3At;
    return false;
  })();

  // Tiga angka yang sama di panel Petugas dan Pelanggan.
  const stAkhir = detail.pembacaan?.standAkhir ?? detail.standAkhirRevisi ?? detail.standAkhir;
  const pakai = detail.pembacaan?.pemakaianM3 ?? detail.pemakaianTagihVerif ?? detail.pemakaian;

  return (
    <div className="flex min-w-0 flex-col gap-2 p-3">
      <Seksi id="info" judul="Informasi pelanggan" awalBuka>
        <InfoPelanggan
          nama={nama}
          status={tahap}
          nomor={detail.nomorLangganan}
          kondisi={label(LABEL_KONDISI_CATAT, detail.kondisi)}
          alamat={alamat}
        />
        {!detail.pelanggan && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Nomor langganan ini belum terhubung ke data pelanggan — verifikasi belum bisa dijalankan
            sebelum pelanggannya ter-import.
          </p>
        )}
      </Seksi>

      <Seksi id="stand" judul="Stand meter" awalBuka>
        <GridStand
          sel={[
            { label: "ST awal", nilai: detail.standAwal },
            { label: "ST akhir", nilai: stAkhir, nada: "info" },
            { label: "Pakai", nilai: pakai, nada: "sukses" },
          ]}
        />
        <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          <span
            className={
              anomali ? "inline-flex items-center gap-1 font-medium text-destructive" : undefined
            }
          >
            {anomali && <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3" aria-hidden />}
            Deviasi{" "}
            {detail.persentase != null
              ? `${detail.persentase > 0 ? "+" : ""}${detail.persentase}%`
              : "—"}
            {anomali ? ` (ambang ±${ambangAnomali}%)` : " dari bulan lalu"}
          </span>
          <span>
            {formatPeriode(detail.periode)} · {detail.pencatat?.namaLapangan ?? "Pencatat tidak diketahui"}
            {detail.tanggalCatat ? ` · ${formatTanggal(detail.tanggalCatat)}` : ""}
          </span>
          {detail.pembacaan?.sumberLaporan && (
            <span>
              Sumber hasil resmi: {detail.pembacaan.sumberLaporan === "PETUGAS" ? "Petugas" : "Konsumen"}
            </span>
          )}
        </div>
      </Seksi>

      <Seksi id="histori" judul="Histori pemakaian (3 bulan)">
        <HistoriPemakaian pelangganId={detail.pelanggan?.id} />
      </Seksi>

      <Seksi id="foto-lalu" judul="Foto periode sebelumnya">
        <FotoSebelumnya pelangganId={detail.pelanggan?.id} periode={detail.periode} />
      </Seksi>

      <Seksi id="foto" judul="Foto periode berjalan">
        <TabFoto
          varian="panel"
          item={[
            {
              kunci: "stand",
              label: "Stand meter",
              url: detail.fotoStandUrl ?? detail.pembacaan?.fotoBukti,
              keteranganKosong: "Laporan petugas dari sistem lama tidak menyertakan foto.",
            },
            {
              kunci: "segel",
              label: "Segel",
              url: detail.fotoSegelUrl,
              keteranganKosong: "Petugas tidak mengirim foto segel.",
            },
            {
              kunci: "rumah",
              label: "Rumah",
              url: detail.fotoRumahUrl,
              keteranganKosong: "Petugas tidak mengirim foto rumah/persil.",
            },
          ]}
        />
      </Seksi>

      <Seksi id="ring" judul="Verifikasi berjenjang">
        <ProgresRing detail={detail} />
      </Seksi>

      <Seksi id="lokasi" judul="Lokasi">
        <PetaLokasi langsung lat={detail.pelanggan?.geoLat} lng={detail.pelanggan?.geoLong} />
      </Seksi>

      {tahap === "RESMI" && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Sudah menjadi pembacaan resmi
          {detail.verifiedBy?.name ? ` — approve final ${detail.verifiedBy.name}` : ""}
          {detail.verifiedAt ? ` (${formatTanggal(detail.verifiedAt)})` : ""}.
        </p>
      )}
      {tahap === "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Dikembalikan untuk cek ulang
          {detail.verifiedBy?.name ? ` oleh ${detail.verifiedBy.name}` : ""}
          {detail.catatanVerif ? ` — “${detail.catatanVerif}”` : ""}. Klik kanan barisnya untuk
          memverifikasi ulang bila ternyata benar.
        </p>
      )}
      {detail.catatanVerif && tahap !== "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">Catatan verifikasi: “{detail.catatanVerif}”</p>
      )}

      {aksi && bisaModal && (
        <ModalLapangan
          detail={detail}
          meters={meters}
          meterAwal={meterAwal}
          ring={aksi === "v2" ? 2 : aksi === "v3" ? 3 : 1}
          tolakAwal={aksi === "cekulang"}
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