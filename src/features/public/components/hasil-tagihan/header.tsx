// features/publik/components/hasil-tagihan/header.tsx — identitas pelanggan
// di atas kartu hasil cek-tagihan.
//
// TIDAK ADA LENCANA STATUS PEMBAYARAN, dan itu keputusan sadar. Basis data
// ini belum pernah menerima data pembayaran: `RiwayatPembayaran` kosong dan
// `tanggalBayar` null di seluruh 157.898 tagihan, sehingga `Tagihan.status`
// hanyalah pantulan dari `jumlahRekTunggak` hasil impor — bukan bukti bayar.
// Menampilkannya berarti memberi tahu pelanggan sesuatu yang tidak kita
// ketahui: menyebut "Lunas" pada yang belum membuat orang tidak membayar,
// menyebut "Belum dibayar" pada yang sudah adalah tuduhan. Halaman ini
// menampilkan RIWAYAT TAGIHAN dan pemakaiannya saja; kebenaran pembayaran
// ada di loket.
import type { HasilCekTagihan } from "../../lib/api"

export function HasilTagihanHeader({ hasil }: { hasil: HasilCekTagihan }) {
  const { pelanggan } = hasil

  return (
    <div className="px-5 py-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">No. Pelanggan</p>
        <p className="font-mono text-base font-bold text-foreground">{pelanggan.nomorLangganan}</p>
        <p className="truncate text-sm text-muted-foreground">{pelanggan.nama}</p>
      </div>
      <div className="mt-4 h-px bg-border/60" />
    </div>
  )
}
