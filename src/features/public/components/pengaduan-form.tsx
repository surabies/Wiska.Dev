"use client"

// features/publik/components/pengaduan-form.tsx
import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Copy, MapPin, Send, TriangleAlert, UserPlus } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { kirimPengaduan, ApiError, type HasilPengaduan } from "../lib/api"
import { LABEL_JENIS_PENGADUAN, LABEL_KLASIFIKASI_PENGADUAN, formatWaktu } from "../lib/format"
import { PemilihFoto } from "./pemilih-foto"
import { PemilihVideo } from "./pemilih-video"
import { MiniPetaLokasi } from "./mini-peta-lokasi"
import { TombolUtama } from "./tombol-utama"
import type { PetaCakupan } from "../../beranda/lib/peta-tipe"

type Koordinat = { lat: number; lng: number }

/// Rapikan nomor sebelum divalidasi/dikirim: buang spasi, tanda hubung,
/// titik, dan tanda kurung yang lazim diketik warga.
function normalisasiHp(v: string): string {
  return v.trim().replace(/[\s().-]/g, "")
}

/// Longgar SENGAJA: menerima HP (08…/+62…/62…) MAUPUN telepon rumah berkode
/// area (mis. 022…) — pelapor bisa bukan pemilik ponsel. Yang ditolak hanya
/// yang jelas bukan nomor: huruf, terlalu pendek/panjang. Server tetap
/// menyimpan apa adanya; ini murni penjaga kualitas data di sisi warga.
function hpValid(v: string): boolean {
  return /^(\+?62|0)\d{7,13}$/.test(normalisasiHp(v))
}

export function PengaduanForm({ sudahLogin, peta = null }: { sudahLogin: boolean; peta?: PetaCakupan | null }) {
  // Kunci idempotensi: SATU nilai untuk seluruh umur form ini. Dibuat lazy
  // sekali (bukan tiap render) supaya retry / tap-ganda / gagal-lalu-kirim-
  // ulang memakai kunci yang sama — server memulangkan tiket yang sama alih-
  // alih membuat kembar. Reload halaman = laporan baru = kunci baru.
  const [clientRequestId] = React.useState(() => crypto.randomUUID())
  const [pending, setPending] = React.useState(false)
  const [pesanError, setPesanError] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<HasilPengaduan | null>(null)
  const [klasifikasi, setKlasifikasi] = React.useState("BUKAN_NILAI_TAGIHAN_REKENING")
  const [jenis, setJenis] = React.useState("LAPOR_STAND_METER")
  const [koordinat, setKoordinat] = React.useState<Koordinat | null>(null)
  const [ambilLokasi, setAmbilLokasi] = React.useState(false)
  const [errorLokasi, setErrorLokasi] = React.useState<string | null>(null)
  const [fotoFile, setFotoFile] = React.useState<File | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = React.useState<string | null>(null)
  const [videoFile, setVideoFile] = React.useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = React.useState<string | null>(null)

  // Blob URL adalah alokasi memori yang bertahan sampai dicabut — tanpa ini
  // media yang diganti berkali-kali menumpuk sampai tab ditutup.
  React.useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
    }
  }, [fotoPreviewUrl])
  React.useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  function pilihFoto(file: File, url: string) {
    setFotoFile(file)
    setFotoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return url
    })
  }
  function hapusFoto() {
    setFotoFile(null)
    setFotoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return null
    })
  }
  function pilihVideo(file: File, url: string) {
    setVideoFile(file)
    setVideoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return url
    })
  }
  function hapusVideo() {
    setVideoFile(null)
    setVideoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return null
    })
  }

  // Backend menolak BOCOR_PIPA_DINAS tanpa koordinat (422). Ditampilkan
  // sebagai syarat di UI supaya pengguna tahu sebelum menekan kirim, bukan
  // sesudah.
  const butuhLokasi = jenis === "BOCOR_PIPA_DINAS"

  function mintaLokasi() {
    setErrorLokasi(null)
    if (!("geolocation" in navigator)) {
      setErrorLokasi("Perangkat Anda tidak mendukung deteksi lokasi. Isi alamat kejadian selengkap mungkin.")
      return
    }
    setAmbilLokasi(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setKoordinat({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setAmbilLokasi(false)
      },
      (err) => {
        setAmbilLokasi(false)
        setErrorLokasi(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Aktifkan izin lokasi di browser, atau tulis alamat kejadian selengkap mungkin."
            : "Lokasi tidak terdeteksi. Coba lagi atau tulis alamat kejadian selengkap mungkin."
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    if (butuhLokasi && !koordinat) {
      setPesanError("Untuk laporan bocor pipa dinas, tekan \"Deteksi lokasi saya\" agar petugas bisa menemukan titiknya.")
      return
    }

    const nomorLangganan = String(fd.get("nomorLangganan") ?? "").trim()
    const kontakPelapor = String(fd.get("kontakPelapor") ?? "").trim()
    if (!hpValid(kontakPelapor)) {
      setPesanError("Nomor HP/telepon tidak valid. Contoh: 081234567890 atau 022xxxxxxx.")
      return
    }

    setPesanError(null)
    setPending(true)
    try {
      setHasil(
        await kirimPengaduan({
          klasifikasi,
          jenis,
          judul: String(fd.get("judul") ?? "").trim(),
          deskripsi: String(fd.get("deskripsi") ?? "").trim(),
          pelapor: String(fd.get("pelapor") ?? "").trim(),
          kontakPelapor: normalisasiHp(kontakPelapor),
          alamatKejadian: String(fd.get("alamatKejadian") ?? "").trim() || undefined,
          nomorLangganan: nomorLangganan || undefined,
          koordinat: koordinat ?? undefined,
          foto: fotoFile,
          video: videoFile,
          clientRequestId,
        })
      )
    } catch (err) {
      setPesanError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.")
    } finally {
      setPending(false)
    }
  }

  if (hasil) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>
          <CheckCircle2 />
          <AlertDescription className="flex flex-col gap-3">
            <span>{hasil.pesan}</span>
            <span className="flex flex-wrap items-center gap-2">
              {/* Ukuran & tracking dilebihkan sengaja: ini satu-satunya hal di
                  layar ini yang WAJIB dibawa pulang pelapor — kecuali ia
                  sedang login (lihat blok di bawah), tiket ini SUDAH
                  tersimpan di akunnya juga. */}
              <code className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-wider">
                {hasil.nomorTiket}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(hasil.nomorTiket)}>
                <Copy />
                Salin
              </Button>
            </span>
            {hasil.targetSelesaiAt && (
              <span className="text-xs text-muted-foreground">
                Target penanganan: <strong className="text-foreground">{formatWaktu(hasil.targetSelesaiAt)} WIB</strong>.
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {sudahLogin
                ? "Nomor tiket ini tetap berguna sebagai referensi, tapi Anda tidak wajib menyimpannya sendiri."
                : "Nomor tiket ini satu-satunya cara memantau laporan Anda — simpan baik-baik."}
            </span>
          </AlertDescription>
        </Alert>

        {/* Beda pesan tergantung status login — supaya CTA-nya selalu masuk
            akal: warga yang belum punya akun diajak mendaftar (baru dibuat
            di akun-warga.router.ts, tiket ini SENDIRI TIDAK ikut tertaut
            karena dibuat sebelum akunnya ada); yang sudah login diberi tahu
            laporannya sudah otomatis tersimpan. */}
        {sudahLogin ? (
          <Alert>
            <CheckCircle2 />
            <AlertDescription>
              Laporan ini otomatis tersimpan di akun Anda.{" "}
              <Link href="/akun" className="underline underline-offset-4 hover:text-foreground">
                Lihat semua laporan saya
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <UserPlus />
            <AlertDescription>
              Punya banyak laporan? Buat akun supaya semuanya tersimpan otomatis dan tidak perlu mengingat nomor tiket
              satu per satu.{" "}
              <Link href="/daftar?callbackUrl=/akun" className="underline underline-offset-4 hover:text-foreground">
                Daftar akun
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="klasifikasi">Klasifikasi pengaduan</FieldLabel>
          <NativeSelect
            id="klasifikasi"
            name="klasifikasi"
            className="w-full"
            value={klasifikasi}
            onChange={(e) => setKlasifikasi(e.currentTarget.value)}
            disabled={pending}
          >
            {Object.entries(LABEL_KLASIFIKASI_PENGADUAN).map(([nilai, label]) => (
              <NativeSelectOption key={nilai} value={nilai}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Menentukan unit mana yang menindaklanjuti laporan Anda.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="jenis">Jenis pengaduan</FieldLabel>
          <NativeSelect
            id="jenis"
            name="jenis"
            className="w-full"
            value={jenis}
            onChange={(e) => setJenis(e.currentTarget.value)}
            disabled={pending}
          >
            {Object.entries(LABEL_JENIS_PENGADUAN).map(([nilai, label]) => (
              <NativeSelectOption key={nilai} value={nilai}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="judul">Judul singkat</FieldLabel>
          <Input id="judul" name="judul" placeholder="Pipa bocor di Jl. Asmi depan no. 1" disabled={pending} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="deskripsi">Keterangan</FieldLabel>
          <Textarea id="deskripsi" name="deskripsi" rows={4} placeholder="KEBERATAN BAYAR" disabled={pending} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="alamatKejadian">Alamat kejadian</FieldLabel>
          <Input id="alamatKejadian" name="alamatKejadian" placeholder="Jl. Asmi No. 1, RT 02" disabled={pending} />
        </Field>

        <Field data-invalid={butuhLokasi && !koordinat && !!pesanError}>
          <FieldLabel htmlFor="lokasi">
            Titik lokasi {butuhLokasi ? <span className="text-destructive">*</span> : "(opsional)"}
          </FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" id="lokasi" variant="outline" size="sm" onClick={mintaLokasi} disabled={pending || ambilLokasi}>
              {ambilLokasi ? <Spinner className="size-3.5" /> : <MapPin />}
              {ambilLokasi ? "Mendeteksi…" : koordinat ? "Perbarui lokasi" : "Deteksi lokasi saya"}
            </Button>
            {koordinat && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {koordinat.lat.toFixed(5)}, {koordinat.lng.toFixed(5)} ✓
              </span>
            )}
          </div>
          <FieldDescription>
            {butuhLokasi
              ? "Wajib untuk laporan bocor pipa dinas — petugas memakai titik ini untuk menemukan lokasinya."
              : "Membantu petugas menemukan lokasi Anda lebih cepat."}
          </FieldDescription>
          {errorLokasi && <p className="text-xs text-destructive">{errorLokasi}</p>}
          <MiniPetaLokasi peta={peta} koordinat={koordinat} />
        </Field>

        <PemilihFoto
          previewUrl={fotoPreviewUrl}
          onPilih={pilihFoto}
          onHapus={hapusFoto}
          onError={setPesanError}
          label="Foto bukti (opsional)"
          deskripsi="Satu foto kondisi di lapangan sangat membantu petugas menyiapkan alat sebelum berangkat."
          disabled={pending}
        />

        <PemilihVideo
          previewUrl={videoPreviewUrl}
          onPilih={pilihVideo}
          onHapus={hapusVideo}
          onError={setPesanError}
          label="Video bukti (opsional)"
          deskripsi="Klip pendek 30–60 detik (maksimal 60) — mis. aliran air bocor. Ditampilkan dalam kualitas teroptimasi."
          disabled={pending}
        />

        <Field>
          <FieldLabel htmlFor="nomorLangganan">Nomor langganan (opsional)</FieldLabel>
          <Input id="nomorLangganan" name="nomorLangganan" inputMode="numeric" maxLength={11} placeholder="Kosongkan bila Anda bukan pelanggan" disabled={pending} />
          <FieldDescription>Warga yang bukan pelanggan tetap boleh melapor — mis. melihat pipa bocor di jalan.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="pelapor">Nama Anda</FieldLabel>
          <Input id="pelapor" name="pelapor" autoComplete="name" disabled={pending} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="kontakPelapor">Nomor HP yang bisa dihubungi</FieldLabel>
          <Input id="kontakPelapor" name="kontakPelapor" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812…" disabled={pending} required />
          <FieldDescription>Dipakai petugas untuk menghubungi Anda soal laporan ini.</FieldDescription>
        </Field>

        {pesanError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{pesanError}</AlertDescription>
          </Alert>
        )}

        <TombolUtama type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? <Spinner className="size-4" /> : <Send />}
          {pending ? "Mengirim…" : "Kirim pengaduan"}
        </TombolUtama>
      </FieldGroup>
    </form>
  )
}
