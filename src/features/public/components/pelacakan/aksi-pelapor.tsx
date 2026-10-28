"use client"

// features/public/components/pelacakan/aksi-pelapor.tsx — dua keputusan yang
// HANYA boleh diambil pelapor setelah petugas menandai tiket SELESAI:
// mengonfirmasi (+ menilai) atau menyatakan masalahnya belum beres.
//
// Kenapa hak ini ada di warga, bukan petugas: kalau petugas boleh menutup
// tiketnya sendiri, angka kepuasan jadi karangan dan penanganan yang buruk
// tidak pernah terlihat. Backend menegakkannya — PATCH status ke DITUTUP
// dari sisi petugas ditolak eksplisit (server/modules/pengaduan/pengaduan.router.ts).
import * as React from "react"
import { RotateCcw, Star, ThumbsUp, TriangleAlert } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { bukaKembaliTiket, konfirmasiTiket, ApiError } from "../../lib/api"

type Mode = "pilih" | "nilai" | "buka"

export function AksiPelapor({
  nomorTiket,
  bisaDinilai,
  bisaDibukaKembali,
  onSelesai,
}: {
  nomorTiket: string
  bisaDinilai: boolean
  bisaDibukaKembali: boolean
  onSelesai: () => void
}) {
  const [mode, setMode] = React.useState<Mode>("pilih")
  const [rating, setRating] = React.useState(0)
  const [hoverRating, setHoverRating] = React.useState(0)
  const [komentar, setKomentar] = React.useState("")
  const [alasan, setAlasan] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [pesanError, setPesanError] = React.useState<string | null>(null)

  async function jalankan(aksi: () => Promise<unknown>) {
    setPesanError(null)
    setPending(true)
    try {
      await aksi()
      onSelesai()
    } catch (err) {
      setPesanError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.")
    } finally {
      setPending(false)
    }
  }

  if (!bisaDinilai && !bisaDibukaKembali) return null

  const error = pesanError && (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{pesanError}</AlertDescription>
    </Alert>
  )

  if (mode === "nilai") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Seberapa puas Anda dengan penanganannya?</p>

        {/* radiogroup, bukan tumpukan <button>: pembaca layar harus tahu ini
            satu pilihan dari lima, dan nilai mana yang sedang terpilih. */}
        <div className="flex gap-1" role="radiogroup" aria-label="Nilai kepuasan 1 sampai 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} dari 5`}
              disabled={pending}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Star
                className={`size-7 transition-colors ${
                  n <= (hoverRating || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          rows={3}
          placeholder="Ceritakan pengalaman Anda (opsional)"
          value={komentar}
          onChange={(e) => setKomentar(e.target.value)}
          disabled={pending}
        />

        {error}

        <div className="flex gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={pending || rating === 0}
            onClick={() => jalankan(() => konfirmasiTiket(nomorTiket, { rating, komentar: komentar.trim() || undefined }))}
          >
            {pending ? <Spinner className="size-4" /> : <ThumbsUp />}
            Kirim & tutup tiket
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("pilih")}>
            Batal
          </Button>
        </div>
      </div>
    )
  }

  if (mode === "buka") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Apa yang masih bermasalah?</p>
        <Textarea
          rows={3}
          placeholder="Mis. air sempat mengalir tapi mati lagi keesokan harinya…"
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Tiket yang sama akan dibuka kembali — riwayat penanganannya tidak hilang.
        </p>

        {error}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={pending || alasan.trim().length < 10}
            onClick={() => jalankan(() => bukaKembaliTiket(nomorTiket, { alasan: alasan.trim() }))}
          >
            {pending ? <Spinner className="size-4" /> : <RotateCcw />}
            Buka kembali tiket
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("pilih")}>
            Batal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">Apakah masalah Anda sudah benar-benar selesai?</p>
      <p className="text-xs text-muted-foreground">
        Tiket ini baru ditutup setelah Anda yang mengonfirmasi — bukan petugas.
      </p>
      <div className="flex flex-wrap gap-2">
        {bisaDinilai && (
          <Button type="button" size="sm" onClick={() => setMode("nilai")}>
            <ThumbsUp />
            Ya, sudah selesai
          </Button>
        )}
        {bisaDibukaKembali && (
          <Button type="button" size="sm" variant="outline" onClick={() => setMode("buka")}>
            <RotateCcw />
            Belum, masih bermasalah
          </Button>
        )}
      </div>
    </div>
  )
}
