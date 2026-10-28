// features/dashboard/components/pengaduan/linimasa-staf.tsx — linimasa tiket
// versi PETUGAS.
//
// Bedanya dari features/public/components/pelacakan/linimasa.tsx: di sini
// SELURUH entri tampil, termasuk catatan internal — dan yang internal diberi
// penanda gembok yang jelas. Penandanya bukan hiasan: petugas harus bisa
// melihat sekilas mana yang sudah dibaca warga dan mana yang belum, sebelum
// ia menulis catatan berikutnya.
//
// Penanda ganda: titik di rel (terisi = publik, kosong = internal), kartu
// putus-putus untuk internal, dan lencana Publik/Internal di kanan atas.
import { Eye, Lock } from "@/components/ui/hugeicons-compat";
import { BingkaiFoto } from "@/components/bingkai-foto";
import { formatWaktu } from "@/features/public/lib/format";
import { statusPengaduanStaf } from "@/features/dashboard/lib/label";
import { cn } from "@/lib/utils";
import type { EntriRiwayat } from "./tipe";

export const LABEL_AKSI: Record<string, string> = {
  DIBUAT: "Tiket dibuat",
  DIVERIFIKASI: "Diverifikasi operator",
  DITUGASKAN: "Ditugaskan",
  STATUS_DIUBAH: "Status diubah",
  CATATAN: "Catatan",
  CHAT: "Chat",
  ESKALASI: "Eskalasi",
  DIKONFIRMASI: "Dikonfirmasi pelapor",
  DIBUKA_KEMBALI: "Dibuka kembali pelapor",
  DINILAI: "Dinilai pelapor",
  DITUTUP_OTOMATIS: "Ditutup otomatis (lewat batas konfirmasi)",
};

function EntriLinimasa({ e }: { e: EntriRiwayat }) {
  const nada = e.statusKe ? statusPengaduanStaf(e.statusKe) : null;

  return (
    <li
      className={cn(
        "relative pb-4 pl-6 last:pb-0",
        // Rel vertikal antar-titik; entri terakhir tidak punya rel.
        "before:absolute before:top-4 before:bottom-0 before:left-1.25 before:w-px before:bg-border last:before:hidden",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 left-0 size-2.75 rounded-full border-2",
          e.isPublik ? "border-info bg-info" : "border-border bg-background",
        )}
      />

      <div
        className={cn(
          "rounded-lg border px-3 py-2.5",
          e.isPublik ? "border-border bg-card" : "border-dashed border-border bg-muted/50",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{LABEL_AKSI[e.aksi] ?? e.aksi}</span>
          {nada && (
            <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", nada.badgeClass)}>
              {nada.label}
            </span>
          )}
          <span
            className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground"
            title={e.isPublik ? "Terlihat oleh pelapor di halaman pelacakan" : "Hanya terlihat petugas"}
          >
            {e.isPublik ? <Eye className="size-3" /> : <Lock className="size-3" />}
            {e.isPublik ? "Publik" : "Internal"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatWaktu(e.createdAt)} WIB · {e.olehNama}
          {e.oleh?.role ? ` (${e.oleh.role})` : ""}
        </p>

        {e.catatan && <p className="mt-1.5 text-sm whitespace-pre-wrap">{e.catatan}</p>}

        {e.fotoUrl && (
          // Frame rasio tetap (BingkaiFoto) — lebar dikunci 200px, tinggi ikut
          // rasio, bukan ikut file fotonya.
          <BingkaiFoto src={e.fotoUrl} alt="Foto tindak lanjut" className="mt-2 max-w-50" />
        )}
      </div>
    </li>
  );
}

export function LinimasaStaf({ riwayat }: { riwayat: EntriRiwayat[] }) {
  if (riwayat.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada tindak lanjut.</p>;
  }

  return (
    <ol className="flex flex-col">
      {riwayat.map((e) => (
        <EntriLinimasa key={e.id} e={e} />
      ))}
    </ol>
  );
}
