"use client";

// features/dashboard/components/pengaduan/detail-tiket/detail-tiket.tsx —
// HALAMAN detail satu tiket (/dashboard/pengaduan/[id]). File ini cuma
// perakit tata letak; isi tiap blok ada di berkas masing-masing:
//
//   use-detail-tiket.ts  data + pembungkus aksi
//   kepala-tiket.tsx     identitas (kiri) · status, SLA, Cetak (kanan)
//   info-perkara.tsx     deskripsi + fakta tiket
//   media-bukti.tsx      foto/video lampiran
//   ../linimasa-staf.tsx riwayat tindak lanjut
//   panel-tindakan.tsx   tugaskan, catatan, transisi status
//   panel-selesai.tsx    penyelesaian berfoto
//   panel-chat.tsx       chat dengan pelapor
//   panel-eskalasi.tsx   eskalasi ke atasan
//   cetak/               lembar A4 untuk arsip (Cetak PDF)
//
// TATA LETAK: halaman dashboard menggulir di level dokumen (DashboardShell
// hanya memberi pt-(--navbar-h)), jadi `h-full` tidak punya batas tinggi.
// Karena itu komponen ini diberi tinggi EKSPLISIT dari viewport
// (TINGGI_HALAMAN): kepala menetap (shrink-0), hanya area konten yang
// menggulir (min-h-0 flex-1 overflow-y-auto).
//
// Dua hal sengaja diserahkan ke server, JANGAN dipindahkan ke sini:
//  1. `transisiTersedia` — matriks TRANSISI server, sudah disaring per role.
//  2. `sla` — perhitungan terlambat/sisa waktu datang jadi dari server.
import { useRouter } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "@/components/ui/hugeicons-compat";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import { LinimasaStaf } from "@/features/dashboard/components/pengaduan/linimasa-staf";
import { LembarCetak } from "./cetak/lembar-cetak";
import { useCetak } from "./cetak/use-cetak";
import { InfoPerkara } from "./info-perkara";
import { KepalaTiket } from "./kepala-tiket";
import { MediaBukti } from "./media-bukti";
import { PanelChat } from "./panel-chat";
import { PanelEskalasi } from "./panel-eskalasi";
import { PanelSelesai } from "./panel-selesai";
import { PanelTindakan } from "./panel-tindakan";
import { useDetailTiket } from "./use-detail-tiket";

/// Tinggi layar dikurangi navbar (--navbar-h) dan ruang di atas komponen ini:
/// padding PageContainer + baris breadcrumb ≈ 4.5rem. Kalau halaman masih
/// tergulir sedikit, naikkan angka 4.5rem; kalau ada ruang kosong di bawah,
/// turunkan. Cukup diubah di sini.
const TINGGI_HALAMAN = "h-[calc(100dvh-var(--navbar-h)-4.5rem)]";

export function DetailTiket({ pengaduanId }: { pengaduanId: string }) {
  const router = useRouter();
  const { detail, petugas, memuat, galat, mengirim, jalankan } = useDetailTiket(pengaduanId);
  const { mencetak, tanggalCetak, mulai: cetak } = useCetak();

  if (memuat && !detail) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{galat ?? "Tiket tidak ditemukan."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/pengaduan")}>
          <ArrowLeft /> Kembali ke daftar
        </Button>
      </div>
    );
  }

  const bisaSelesai = detail.transisiTersedia.includes("SELESAI");
  const terbuka = detail.status !== "DITUTUP";
  const aksi = { detail, mengirim, jalankan };

  return (
    <div className={`flex ${TINGGI_HALAMAN} min-h-0 flex-col gap-4`}>
      <KepalaTiket detail={detail} onCetak={cetak} mencetak={mencetak} />

      {/* Hanya area ini yang menggulir. */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Kiri: duduk perkara, lampiran, linimasa */}
          <div className="flex min-w-0 flex-col gap-4">
            <InfoPerkara detail={detail} />
            <MediaBukti detail={detail} />
            <PanelKartu judul="Riwayat tindak lanjut">
              <LinimasaStaf riwayat={detail.riwayat} />
            </PanelKartu>
          </div>

          {/* Kanan: seluruh aksi */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
            <PanelTindakan {...aksi} petugas={petugas} />
            {bisaSelesai && <PanelSelesai {...aksi} />}
            {terbuka && <PanelChat {...aksi} />}
            {terbuka && <PanelEskalasi {...aksi} petugas={petugas} />}

            {galat && (
              <p className="text-xs text-destructive" role="alert">
                {galat}
              </p>
            )}
          </div>
        </div>
      </div>

      {mencetak && <LembarCetak detail={detail} tanggalCetak={tanggalCetak} />}
    </div>
  );
}