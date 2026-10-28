// features/dashboard/components/pengaduan/detail-tiket/info-perkara.tsx —
// duduk perkara: deskripsi + fakta tiket (pelapor, target, petugas, lokasi,
// eskalasi, batas konfirmasi, penilaian).
import {
  ArrowUpCircle,
  CircleUser,
  Clock,
  MapPin,
  Star,
  UserCheck,
} from "@/components/ui/hugeicons-compat";
import { formatWaktu } from "@/features/public/lib/format";
import { BarisInfo } from "@/features/dashboard/components/pengaduan/bersama/baris-info";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import type { PengaduanDetail } from "@/features/dashboard/components/pengaduan/tipe";

export function InfoPerkara({ detail }: { detail: PengaduanDetail }) {
  const wilayah = [detail.kelurahan?.nama, detail.kecamatan?.nama].filter(Boolean).join(", ");

  return (
    <PanelKartu judul="Duduk perkara">
      <p className="text-sm whitespace-pre-wrap">{detail.deskripsi}</p>

      <div className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
        <BarisInfo ikon={CircleUser} label="Pelapor">
          <p>{detail.pelapor}</p>
          {/* Kontak pelapor tampil di sini (sisi petugas), TIDAK pernah di
              halaman publik. */}
          {detail.kontakPelapor && <p className="text-muted-foreground">{detail.kontakPelapor}</p>}
          {detail.pelanggan && (
            <p className="font-mono text-xs text-muted-foreground">
              {detail.pelanggan.nomorLangganan} · {detail.pelanggan.nama}
            </p>
          )}
          {!detail.pelanggan && detail.nomorLangganan && (
            <p className="font-mono text-xs text-muted-foreground">
              {detail.nomorLangganan} (belum dicocokkan)
            </p>
          )}
        </BarisInfo>

        <BarisInfo ikon={Clock} label="Target penyelesaian">
          <p>{formatWaktu(detail.sla.targetSelesaiAt)} WIB</p>
        </BarisInfo>

        <BarisInfo ikon={UserCheck} label="Ditugaskan ke">
          <p>{detail.ditugaskanKe?.name ?? "— belum ditugaskan"}</p>
        </BarisInfo>

        <BarisInfo ikon={MapPin} label="Lokasi kejadian">
          <p>{detail.alamatKejadian ?? "—"}</p>
          {/* Wilayah hasil auto-tag ST_Contains — bantu operator memilah
              antrean per wilayah kerja tanpa menebak dari alamat teks. */}
          {wilayah && <p className="text-muted-foreground">{wilayah}</p>}
        </BarisInfo>

        {detail.eskalasiKe && (
          <BarisInfo ikon={ArrowUpCircle} label="Dieskalasi ke">
            <p>
              {detail.eskalasiKe.name ?? "—"}
              <span className="text-muted-foreground"> · {detail.eskalasiKe.role}</span>
            </p>
            {detail.alasanEskalasi && <p className="text-muted-foreground">{detail.alasanEskalasi}</p>}
          </BarisInfo>
        )}

        {detail.status === "SELESAI" && detail.konfirmasiBatasAt && (
          <BarisInfo ikon={Clock} label="Batas konfirmasi pelapor">
            <p>{formatWaktu(detail.konfirmasiBatasAt)} WIB</p>
            <p className="text-muted-foreground">Lewat batas ini tiket ditutup otomatis.</p>
          </BarisInfo>
        )}

        {detail.ratingKepuasan !== null && (
          <BarisInfo ikon={Star} label="Penilaian pelapor">
            <p className="flex items-center gap-1">
              {detail.ratingKepuasan}/5
              <Star className="size-3.5 fill-warning text-warning" />
            </p>
            {detail.komentarKepuasan && (
              <p className="text-muted-foreground">“{detail.komentarKepuasan}”</p>
            )}
          </BarisInfo>
        )}
      </div>
    </PanelKartu>
  );
}
