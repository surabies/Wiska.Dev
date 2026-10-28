"use client"

// Form cek tagihan cepat di hero beranda.
// Mengikuti pola dokumentasi:
// - HaloSearchInput: Enter ditangani lewat onKeyDown.
// - HaloButton: type="button" + onClick, label berupa string polos,
//   isLoading/loadingText untuk status memuat, lebar diatur div pembungkus.
import { useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"

import { HaloButton } from "@/components/ui/halo-button"
import { HaloSearchInput } from "@/components/ui/halo-search"
import { cn } from "@/lib/utils"

const PANJANG_NOMOR = 11

/**
 * Ubah ke true saat layanan cek tagihan sudah aktif.
 * Saat false, tombol tampak redup, klik diabaikan, dan pesan "tidak tersedia" tampil.
 */
const CEK_TAGIHAN_TERSEDIA = false

/** Rute tujuan cek tagihan — sesuaikan dengan rute di proyek. */
const RUTE_CEK_TAGIHAN = "/cek-tagihan"

export function CekCepatForm() {
  const router = useRouter()
  const [nomor, setNomor] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Tahap 1: tombol hanya berfungsi jika layanan aktif dan nomor lengkap.
  const bisaCek =
    CEK_TAGIHAN_TERSEDIA && nomor.length === PANJANG_NOMOR && !isLoading

  // Tahap 2: satu jalur kirim, dipakai tombol maupun tombol Enter.
  function kirim() {
    if (!bisaCek) {
      return
    }
    setIsLoading(true)
    router.push(`${RUTE_CEK_TAGIHAN}?nomor=${nomor}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") {
      return
    }
    e.preventDefault()
    kirim()
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* Tahap 3: input selebar kolom. */}
      <HaloSearchInput
        aria-label="Nomor langganan"
        autoComplete="off"
        inputMode="numeric"
        isLoading={isLoading}
        loadingText="Memeriksa…"
        maxLength={PANJANG_NOMOR}
        onChange={(e) =>
          setNomor(e.target.value.replace(/\D/g, "").slice(0, PANJANG_NOMOR))
        }
        onClear={() => setNomor("")}
        onKeyDown={handleKeyDown}
        placeholder={`Nomor langganan — ${PANJANG_NOMOR} digit`}
        value={nomor}
      />

      {/* Tahap 4: tombol di dalam div selebar kolom (sama seperti demo
          dokumentasi), jadi lebarnya sama dengan input dan tombol CTA. */}
      <div
        className={cn("w-full", !bisaCek && !isLoading && "opacity-60")}
        aria-disabled={!bisaCek}
      >
        <HaloButton
          isLoading={isLoading}
          loadingText="Memeriksa…"
          onClick={kirim}
          type="button"
        >
          Cek tagihan
        </HaloButton>
      </div>

      {/* Tahap 5: pesan status. */}
      {!CEK_TAGIHAN_TERSEDIA ? (
        <p role="status" className="text-xs text-muted-foreground">
          Cek tagihan sementara tidak tersedia.
        </p>
      ) : null}
    </div>
  )
}