"use client"

// features/dashboard/components/verifikasi/aksi-massal.tsx — bilah aksi
// untuk baris terpilih, plus pintasan papan ketik.
//
// KENAPA MUNCUL-HILANG, BUKAN SELALU ADA. Bilah ini hanya berarti kalau ada
// yang dipilih; menampilkannya kosong sepanjang waktu memakan tinggi layar
// yang lebih berguna untuk baris. Ia menempel di bawah tabel supaya jempol
// tidak perlu naik ke atas layar setelah memilih.
//
// PENGAMAN YANG DIJAGA: aksi massal SELALU meminta konfirmasi yang menyebut
// JUMLAH dan RING-nya. "Verifikasi 4.812 baris ke V3" harus terbaca sebelum
// ditekan, karena V3 menerbitkan pembacaan resmi dan membatalkannya jauh
// lebih mahal daripada mengulang klik.

import * as React from "react"
import { CheckCheck, Download, Loader2, ShieldCheck, X, Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"

export type Ring = 1 | 2 | 3

const RING_INFO: Record<Ring, { label: string; pintasan: string; jelas: string }> = {
  1: { label: "V1 Periksa", pintasan: "F1", jelas: "Menandai baris sudah diperiksa supervisor. Meter tujuan diisi otomatis dari meter aktif pelanggan." },
  2: { label: "V2 Validasi", pintasan: "F2", jelas: "Validasi manajemen. Hanya baris yang sudah lolos V1." },
  3: { label: "V3 Resmi", pintasan: "F3", jelas: "Persetujuan final — MENERBITKAN pembacaan meter resmi. Hanya baris yang sudah lolos V1 dan V2." },
}

export function AksiMassal({
  jumlah,
  bolehRing,
  onJalankan,
  onBersihkan,
  onEkspor,
  sedangJalan,
  kemajuan,
}: {
  jumlah: number
  /// Ring mana yang boleh ditekan pengguna ini — cermin RBAC server.
  bolehRing: (r: Ring) => boolean
  onJalankan: (ring: Ring, sertakanAnomali: boolean) => void
  onBersihkan: () => void
  onEkspor: () => void
  sedangJalan: boolean
  kemajuan: { selesai: number; total: number } | null
}) {
  const [konfirmasi, setKonfirmasi] = React.useState<Ring | null>(null)
  const [sertakanAnomali, setSertakanAnomali] = React.useState(false)

  // Pintasan papan ketik. Sengaja TIDAK langsung menjalankan: F1/F2/F3
  // membuka dialog konfirmasi yang sama dengan tombolnya. Pintasan
  // mempercepat menjangkau, bukan melewati pemeriksaan.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return
      const peta: Record<string, Ring> = { F1: 1, F2: 2, F3: 3 }
      const ring = peta[e.key]
      if (ring && jumlah > 0 && bolehRing(ring)) {
        e.preventDefault()
        setKonfirmasi(ring)
      }
      if (e.key === "Escape" && jumlah > 0) onBersihkan()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [jumlah, bolehRing, onBersihkan])

  if (jumlah === 0 && !sedangJalan) return null

  return (
    <>
      <div className="border-border/70 bg-card flex flex-wrap items-center gap-2 border p-2">
        <Badge className="tabular-nums">{jumlah.toLocaleString("id-ID")} baris dipilih</Badge>

        {sedangJalan && kemajuan ? (
          <span className="text-muted-foreground flex items-center gap-2 text-xs tabular-nums">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {kemajuan.selesai.toLocaleString("id-ID")} / {kemajuan.total.toLocaleString("id-ID")} diproses…
          </span>
        ) : (
          <>
            {([1, 2, 3] as const).map((r) => (
              <Tooltip key={r}>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant={r === 3 ? "default" : "outline"}
                      className="h-8 text-xs"
                      disabled={!bolehRing(r)}
                      onClick={() => setKonfirmasi(r)}
                    >
                      {r === 3 ? <ShieldCheck className="size-3.5" aria-hidden /> : <CheckCheck className="size-3.5" aria-hidden />}
                      {RING_INFO[r].label}
                      <kbd className="bg-muted text-muted-foreground ml-1 rounded px-1 text-[10px]">
                        {RING_INFO[r].pintasan}
                      </kbd>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-xs">
                  {bolehRing(r) ? RING_INFO[r].jelas : "Role Anda tidak berwenang untuk ring ini."}
                </TooltipContent>
              </Tooltip>
            ))}

            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onEkspor}>
              <Download className="size-3.5" aria-hidden /> Ekspor terpilih
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onBersihkan}>
              <X className="size-3.5" aria-hidden /> Batal pilih
              <kbd className="bg-muted text-muted-foreground ml-1 rounded px-1 text-[10px]">Esc</kbd>
            </Button>
          </>
        )}

        <span className="text-muted-foreground ml-auto hidden items-center gap-1 text-[11px] lg:flex">
          <Keyboard className="size-3.5" aria-hidden /> Ctrl+A pilih semua · Shift+klik pilih rentang
        </span>
      </div>

      <AlertDialog open={konfirmasi !== null} onOpenChange={(b) => { if (!b) setKonfirmasi(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Verifikasi {jumlah.toLocaleString("id-ID")} baris ke {konfirmasi ? RING_INFO[konfirmasi].label : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {konfirmasi ? RING_INFO[konfirmasi].jelas : ""}
              {konfirmasi === 3 && (
                <span className="mt-2 block font-medium">
                  V3 menerbitkan pembacaan meter resmi yang jadi dasar penagihan. Membatalkannya jauh
                  lebih mahal daripada mengulang langkah ini.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Anomali: bawaannya DILEWATI. Pengguna harus menyatakan niatnya
              secara sadar — kotak ini sengaja tidak tercentang. */}
          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={sertakanAnomali}
              onCheckedChange={(v) => setSertakanAnomali(v === true)}
              className="mt-0.5"
            />
            <span>
              Ikutkan baris anomali.
              <span className="text-muted-foreground block">
                Tanpa ini, baris di luar ambang penyimpangan dilewati dan dilaporkan — supaya
                &ldquo;verifikasi semua&rdquo; tidak pernah berarti meloloskan yang mencurigakan tanpa dilihat.
              </span>
            </span>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (konfirmasi) onJalankan(konfirmasi, sertakanAnomali)
                setKonfirmasi(null)
              }}
            >
              Ya, jalankan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
