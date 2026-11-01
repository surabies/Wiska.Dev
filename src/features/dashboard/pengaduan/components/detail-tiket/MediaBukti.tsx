// features/dashboard/pengaduan/components/detail-tiket/MediaBukti.tsx —
// lampiran: foto & video dari pelapor + foto bukti penyelesaian dari petugas.
// BingkaiFoto/BingkaiVideo memakai frame rasio tetap — tinggi halaman TIDAK
// ditentukan dimensi file; klik foto untuk melihat utuh.
import {
  CheckCircle2,
  ImageIcon,
  Video,
} from "@/components/ui/hugeicons-compat"
import { BingkaiFoto } from "@/components/BingkaiFoto"
import { BingkaiVideo } from "@/components/BingkaiVideo"
import { urlVideoTeroptimasi } from "@/features/public/lib/Format"
import { JudulBagian } from "@/features/dashboard/pengaduan/components/bersama/JudulBagian"
import { PanelKartu } from "@/features/dashboard/pengaduan/components/bersama/PanelKartu"
import type { PengaduanDetail } from "@/features/dashboard/pengaduan/types/TipePengaduan"

export function MediaBukti({ detail }: { detail: PengaduanDetail }) {
  const { fotoUrl, videoUrl, fotoPenyelesaianUrl } = detail
  if (!fotoUrl && !videoUrl && !fotoPenyelesaianUrl) return null

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
            <JudulBagian ikon={CheckCircle2}>
              Foto bukti penyelesaian
            </JudulBagian>
            <BingkaiFoto
              src={fotoPenyelesaianUrl}
              alt="Foto bukti penyelesaian dari petugas"
            />
          </div>
        )}
      </div>
    </PanelKartu>
  )
}
