"use client"

// features/public/components/pemilih-video.tsx — pemilih + pratinjau SATU klip
// video bukti (opsional) untuk pengaduan. Sengaja terpisah dari PemilihFoto:
// aturan berkasnya beda (durasi & batas ukuran), dan validasi durasi butuh
// memuat metadata video dulu.
//
// KENAPA TIDAK TRANSCODE DI BROWSER? Kompresi video sejati di browser
// (MediaRecorder/captureStream/ffmpeg.wasm) berjalan real-time (klip 60 detik
// = tunggu 60 detik), rapuh antar-codec, dan boros baterai di HP warga —
// justru orang yang paling sering melapor dari seluler. Jadi di sini kita
// hanya MEMVALIDASI durasi (≤60 dtk) & ukuran, lalu kompresi/optimasi
// dilakukan di sisi pengiriman (Cloudinary q_auto,f_auto — lihat
// urlVideoTeroptimasi di lib/format.ts). Kompresi pra-unggah yang berat
// adalah tugas aplikasi Flutter (native, cepat), bukan web.
import * as React from "react"
import { Video, X } from "@/components/ui/hugeicons-compat"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

/// Batas ukuran berkas video — SEJALAN dengan MAKS_UKURAN_VIDEO_BYTE server
/// (50 MB) di server/lib/storage.ts. Ditolak di sini lebih dulu supaya warga
/// tidak menunggu unggahan besar hanya untuk ditolak server.
const MAKS_VIDEO_BYTE = 50 * 1024 * 1024
/// Durasi maksimal. "30–60 detik saja" — batas atas ditegakkan; klip lebih
/// pendek tetap diterima (mis. semburan pipa yang terekam 12 detik).
const MAKS_DURASI_DETIK = 60

/// Baca durasi video dari metadata TANPA memutarnya. Mengembalikan detik,
/// atau null bila metadata gagal dibaca (berkas rusak / codec tak didukung).
function bacaDurasi(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(v.duration) ? v.duration : null)
    }
    v.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    v.src = url
  })
}

export function PemilihVideo({
  previewUrl,
  onPilih,
  onHapus,
  onError,
  label,
  deskripsi,
  disabled = false,
}: {
  previewUrl: string | null
  onPilih: (file: File, previewUrl: string) => void
  onHapus: () => void
  onError: (pesan: string | null) => void
  label: string
  deskripsi?: string
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [memeriksa, setMemeriksa] = React.useState(false)

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("video/")) return onError("File harus berupa video (MP4 atau WebM).")
    if (file.size > MAKS_VIDEO_BYTE) return onError("Ukuran video maksimal 50 MB.")

    onError(null)
    setMemeriksa(true)
    try {
      const durasi = await bacaDurasi(file)
      if (durasi === null) return onError("Video tidak bisa dibaca. Coba format lain (MP4/WebM).")
      if (durasi > MAKS_DURASI_DETIK + 1) {
        return onError(`Durasi video maksimal ${MAKS_DURASI_DETIK} detik. Klip Anda ${Math.round(durasi)} detik.`)
      }
      onPilih(file, URL.createObjectURL(file))
    } finally {
      setMemeriksa(false)
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {/* TANPA `capture` — alasan sama seperti pemilih-foto.tsx: atribut itu
          memaksa kamera dan menutup akses ke galeri. Untuk video kebocoran
          justru lebih menyakitkan: warga biasanya merekam SAAT kejadian
          terlihat, lalu melapor setelah sampai rumah. Memaksa rekam ulang
          berarti meminta bukti yang sudah tidak ada. */}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={pilih}
        disabled={disabled || memeriksa}
      />
      {previewUrl ? (
        <div className="relative">
          {/* Rasio tetap 16/9 — tinggi frame TIDAK ditentukan dimensi file,
              konsisten dengan BingkaiFoto. object-contain agar klip potret
              tidak terpotong. */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
            {/* Klip bukti warga, tanpa <track> teks. */}
            <video src={previewUrl} controls playsInline className="absolute inset-0 size-full object-contain" />
          </div>
          <button
            onClick={onHapus}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white"
            aria-label="Hapus video"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-6 hover:bg-muted/50 disabled:opacity-60"
          type="button"
          disabled={disabled || memeriksa}
        >
          {memeriksa ? <Spinner className="size-6" /> : <Video className="h-7 w-7 text-muted-foreground" />}
          <p className="text-sm">{memeriksa ? "Memeriksa video…" : "Ambil / pilih video"}</p>
        </button>
      )}
      {deskripsi && <FieldDescription>{deskripsi}</FieldDescription>}
    </Field>
  )
}
