"use client"

// features/public/components/pemilih-foto.tsx — pemilih + pratinjau SATU foto
// bukti, dipakai bersama oleh form pengaduan DAN lapor-meter supaya keduanya
// identik (dulu markup-nya disalin dua kali dan pelan-pelan menyimpang —
// padding & ukuran ikon beda). Ubah di sini, kedua halaman ikut.
//
// Komponen ini memproses berkas (validasi tipe/ukuran + kompres di browser)
// lalu MENYERAHKAN File terkompres + object-URL pratinjau ke pemanggil lewat
// `onPilih`. Siklus hidup URL (revoke) tetap milik pemanggil karena sebagian
// halaman (lapor-meter sukses) masih memakai URL itu setelah kirim.
import * as React from "react"
import { Camera, X } from "@/components/ui/hugeicons-compat"
import { BingkaiFoto, type RasioFoto } from "@/components/bingkai-foto"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { compressImage } from "../lib/compress-image"

/// Batas berkas ASLI sebelum dikompres di browser. Lebih longgar dari batas
/// server (5 MB) karena compressImage() hampir selalu menurunkannya jauh di
/// bawah itu — menolak di sini pada 5 MB akan menolak foto HP normal.
const MAKS_FOTO_ASLI_BYTE = 15 * 1024 * 1024

export function PemilihFoto({
  previewUrl,
  onPilih,
  onHapus,
  onError,
  label,
  deskripsi,
  disabled = false,
  rasio = "16/9",
  mode = "utuh",
}: {
  previewUrl: string | null
  /// Dipanggil dengan File terkompres + object-URL baru. Pemanggil yang
  /// menyimpan keduanya (dan me-revoke URL lama).
  onPilih: (file: File, previewUrl: string) => void
  onHapus: () => void
  onError: (pesan: string | null) => void
  label: string
  deskripsi?: string
  disabled?: boolean
  rasio?: RasioFoto
  mode?: "isi" | "utuh"
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // memilih file yang sama dua kali tetap memicu onChange
    if (!file) return
    if (!file.type.startsWith("image/")) return onError("File harus berupa gambar (JPG, PNG, atau WEBP).")
    if (file.size > MAKS_FOTO_ASLI_BYTE) return onError("Ukuran foto maksimal 15 MB.")

    onError(null)
    try {
      const kompres = await compressImage(file)
      onPilih(kompres, URL.createObjectURL(kompres))
    } catch {
      onError("Gagal memproses foto. Coba foto lain.")
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {/* TANPA atribut `capture`, dan itu disengaja.
          `capture="environment"` memerintahkan browser HP membuka kamera
          LANGSUNG dan melewati pemilih berkas — galeri jadi tidak bisa
          dijangkau sama sekali. Itu menyakitkan untuk kasus yang wajar:
          warga sudah memotret meternya lebih dulu, atau memotretkan meter
          orang tua di rumah lain lalu mengirimkannya kemudian.
          Tanpa `capture`, browser HP menampilkan pilihan (Kamera / Galeri /
          Berkas) dan pengguna yang memutuskan. Di desktop atribut ini memang
          tidak berpengaruh, jadi tidak ada yang hilang. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pilih}
        disabled={disabled}
      />
      {previewUrl ? (
        <div className="relative">
          {/* Frame rasio tetap; blob: lokal jadi tanpa dialog zoom. */}
          <BingkaiFoto src={previewUrl} alt="Pratinjau foto bukti" rasio={rasio} mode={mode} tanpaDialog />
          <button
            onClick={onHapus}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white"
            aria-label="Hapus foto"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-6 hover:bg-muted/50"
          type="button"
          disabled={disabled}
        >
          <Camera className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm">Ambil foto</p>
        </button>
      )}
      {deskripsi && <FieldDescription>{deskripsi}</FieldDescription>}
    </Field>
  )
}
