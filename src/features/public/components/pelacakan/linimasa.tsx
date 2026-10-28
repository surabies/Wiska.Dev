// features/public/components/pelacakan/linimasa.tsx — jejak tindak lanjut
// satu tiket, sebagaimana dilihat WARGA.
//
// Yang tampil di sini SEPENUHNYA ditentukan server: hanya entri
// RiwayatPengaduan ber-`isPublik: true` yang dikirim (difilter di query,
// bukan di sini). Komponen ini sengaja TIDAK punya logika "mana yang boleh
// dilihat" — kalau penyaringan ada di dua tempat, cepat atau lambat keduanya
// menyimpang dan yang kalah adalah privasi catatan internal petugas.
import { BingkaiFoto } from "@/components/bingkai-foto"
import {
  CheckCircle2,
  CircleDot,
  FileText,
  MessageSquare,
  RotateCcw,
  Star,
  UserCheck,
} from "@/components/ui/hugeicons-compat"
import type { EntriRiwayatTiket } from "../../lib/api"
import { formatWaktu, statusPengaduanWarga } from "../../lib/format"

const IKON: Record<string, React.ElementType> = {
  DIBUAT: FileText,
  DITUGASKAN: UserCheck,
  STATUS_DIUBAH: CircleDot,
  CATATAN: MessageSquare,
  DIKONFIRMASI: CheckCircle2,
  DIBUKA_KEMBALI: RotateCcw,
  DINILAI: Star,
  ESKALASI: CircleDot,
}

/// Judul peristiwa. Untuk STATUS_DIUBAH, label status-lah yang paling
/// informatif ("Sedang ditangani") — bukan kata "Status diubah", yang benar
/// tapi tidak memberi tahu apa pun.
function judulEntri(entri: EntriRiwayatTiket): string {
  if (entri.statusKe && (entri.aksi === "STATUS_DIUBAH" || entri.aksi === "DITUGASKAN")) {
    return statusPengaduanWarga(entri.statusKe).label
  }
  switch (entri.aksi) {
    case "DIBUAT":
      return "Pengaduan diterima"
    case "CATATAN":
      return "Perkembangan"
    case "DIKONFIRMASI":
      return "Dikonfirmasi selesai"
    case "DIBUKA_KEMBALI":
      return "Dibuka kembali"
    case "DINILAI":
      return "Penilaian Anda"
    default:
      return "Pembaruan"
  }
}

export function Linimasa({ riwayat }: { riwayat: EntriRiwayatTiket[] }) {
  if (riwayat.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada perkembangan yang bisa ditampilkan.</p>
  }

  return (
    <ol className="flex flex-col">
      {riwayat.map((entri, i) => {
        const Ikon = IKON[entri.aksi] ?? CircleDot
        const terakhir = i === riwayat.length - 1
        const nada = entri.statusKe ? statusPengaduanWarga(entri.statusKe) : null

        return (
          <li key={`${entri.createdAt}-${i}`} className="flex gap-3">
            {/* Rel vertikal + titik. Garisnya digambar oleh elemen ini
                (bukan border pada <ol>) supaya bisa berhenti tepat di
                peristiwa terakhir alih-alih menjuntai ke bawah. */}
            <div className="flex flex-col items-center">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
                  nada?.badgeClass ?? "border-border bg-muted text-muted-foreground"
                }`}
              >
                <Ikon className="size-3.5" />
              </span>
              {!terakhir && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
            </div>

            <div className={`flex-1 ${terakhir ? "pb-0" : "pb-5"}`}>
              <p className="text-sm font-medium">{judulEntri(entri)}</p>
              <p className="text-xs text-muted-foreground">
                {formatWaktu(entri.createdAt)} WIB · {entri.olehNama}
              </p>
              {entri.catatan && <p className="mt-1.5 text-sm text-muted-foreground">{entri.catatan}</p>}
              {entri.fotoUrl && (
                // Frame rasio tetap (BingkaiFoto) — tinggi linimasa tidak
                // ditentukan dimensi file foto; klik untuk melihat utuh.
                <BingkaiFoto src={entri.fotoUrl} alt="Foto tindak lanjut petugas" className="mt-2 max-w-xs" />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
