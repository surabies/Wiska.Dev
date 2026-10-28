// features/dashboard/components/pengaduan/detail-tiket/kepala-tiket.tsx —
// kepala halaman yang menetap di atas (konten di bawahnya yang menggulir).
//
//  KIRI   identitas: judul / jenis · waktu masuk
//         (tombol kembali = breadcrumb, nomor tiket = judul & lembar cetak)
//  KANAN  keadaan & aksi: status · prioritas · (dibuka kembali) · Cetak PDF
//         dan, di bawahnya, SLA (terlambat / dijeda / sisa waktu)
//
// Tiap informasi tampil SEKALI di sini. SLA tidak diulang di kartu "Duduk
// perkara" (di sana hanya tanggal target). Angka SLA dari server (`sla`).
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";
import { Clock } from "@/components/ui/hugeicons-compat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LABEL_JENIS_PENGADUAN, formatSisaWaktu, formatWaktu } from "@/features/public/lib/format";
import { LABEL_PRIORITAS_PENGADUAN, statusPengaduanStaf } from "@/features/dashboard/lib/label";
import { cn } from "@/lib/utils";
import type { PengaduanDetail, PrioritasPengaduan } from "@/features/dashboard/components/pengaduan/tipe";

const TITIK_PRIORITAS: Record<PrioritasPengaduan, string> = {
  DARURAT: "bg-destructive",
  TINGGI: "bg-warning",
  NORMAL: "bg-muted-foreground/60",
  RENDAH: "bg-muted-foreground/30",
};

const STATUS_AKHIR = ["SELESAI", "DITUTUP", "DITOLAK"];

/// Satu chip SLA — null bila tidak ada yang perlu ditampilkan.
function ChipSla({ detail }: { detail: PengaduanDetail }) {
  const { sla } = detail;
  if (STATUS_AKHIR.includes(detail.status) && !sla.melanggar) return null;
  if (!sla.targetSelesaiAt) return null;

  const teks = sla.terjeda ? "SLA dijeda" : formatSisaWaktu(sla.sisaMenit);
  return (
    <span
      title={sla.melanggar ? "Tiket melewati target penyelesaian" : "Sisa waktu penyelesaian (SLA)"}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        sla.melanggar ? "font-medium text-destructive" : "text-muted-foreground",
      )}
    >
      <Clock className="size-3.5" />
      <span className="inline-block first-letter:uppercase">{teks}</span>
    </span>
  );
}

export function KepalaTiket({
  detail,
  onCetak,
  mencetak,
}: {
  detail: PengaduanDetail;
  onCetak: () => void;
  mencetak: boolean;
}) {
  const status = statusPengaduanStaf(detail.status);

  return (
    <header className="shrink-0 border-b border-border pb-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {/* Kiri: identitas */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">{detail.judul}</h2>
          <p className="text-sm text-muted-foreground">
            {LABEL_JENIS_PENGADUAN[detail.jenis] ?? detail.jenis} · masuk {formatWaktu(detail.createdAt)} WIB
          </p>
        </div>

        {/* Kanan: keadaan & aksi */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className={status.badgeClass}>
              {status.label}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <span aria-hidden className={cn("size-1.5 rounded-full", TITIK_PRIORITAS[detail.prioritas])} />
              {LABEL_PRIORITAS_PENGADUAN[detail.prioritas]}
            </Badge>
            {detail.jumlahDibukaKembali > 0 && (
              <Badge variant="outline" className="border-warning/40 bg-warning-muted text-foreground">
                Dibuka kembali {detail.jumlahDibukaKembali}×
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onCetak} disabled={mencetak}>
              <HugeiconsIcon icon={PrinterIcon} />
              Cetak PDF
            </Button>
          </div>
          <ChipSla detail={detail} />
        </div>
      </div>
    </header>
  );
}