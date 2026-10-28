// features/dashboard/components/pengaduan/detail-tiket/media-bukti.tsx —
// lampiran: foto & video dari pelapor + foto bukti penyelesaian dari petugas.
// BingkaiFoto/BingkaiVideo memakai frame rasio tetap — tinggi halaman TIDAK
// ditentukan dimensi file; klik foto untuk melihat utuh.
import { CheckCircle2, ImageIcon, Video } from "@/components/ui/hugeicons-compat";
import { BingkaiFoto } from "@/components/bingkai-foto";
import { BingkaiVideo } from "@/components/bingkai-video";
import { urlVideoTeroptimasi } from "@/features/public/lib/format";
import { JudulBagian } from "@/features/dashboard/components/pengaduan/bersama/judul-bagian";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import type { PengaduanDetail } from "@/features/dashboard/components/pengaduan/tipe";

export function MediaBukti({ detail }: { detail: PengaduanDetail }) {
  const { fotoUrl, videoUrl, fotoPenyelesaianUrl } = detail;
  if (!fotoUrl && !videoUrl && !fotoPenyelesaianUrl) return null;

  return (
    <PanelKartu judul="Lampiran">
      <div className="grid gap-4 sm:grid-cols-2">
        {fotoUrl && (
          <div className="flex flex-col gap-1.5">
            <JudulBagian ikon={ImageIcon}>Foto dari pelapor</JudulBagian>
            <BingkaiFoto src={fotoUrl} alt="Foto bukti dari pelapor" />
          </div>
        )}
        {videoUrl && (
          <div className="flex flex-col gap-1.5">
            <JudulBagian ikon={Video}>Video dari pelapor</JudulBagian>
            <BingkaiVideo src={urlVideoTeroptimasi(videoUrl)!} />
          </div>
        )}
        {fotoPenyelesaianUrl && (
          <div className="flex flex-col gap-1.5">
            <JudulBagian ikon={CheckCircle2}>Foto bukti penyelesaian</JudulBagian>
            <BingkaiFoto src={fotoPenyelesaianUrl} alt="Foto bukti penyelesaian dari petugas" />
          </div>
        )}
      </div>
    </PanelKartu>
  );
}
