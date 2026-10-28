// components/app-logo.tsx — lambang aplikasi. Dipakai bersama oleh halaman
// auth, header dashboard, dan sidebar nanti, supaya identitas visualnya
// didefinisikan SEKALI di sini, bukan di-copy tiap halaman.
//
// Server component (tanpa "use client"): murni presentasional, tanpa state
// maupun event handler. Pola yang sama berlaku untuk komponen tampilan lain —
// jangan tambahkan "use client" kecuali komponennya benar-benar butuh
// interaktivitas.
import Image from "next/image"
import { cn } from "@/lib/utils"

export function AppLogo({ className }: { className?: string }) {
  return (
    // "size-9" (36px) DEFAULT WAJIB ADA — cocok dengan width/height={36} di
    // <Image> di bawah. Tanpa default ini, pemanggil yang lupa mengoper
    // className (login-card/daftar-card/forgot-password-card/
    // reset-password-card semuanya begini) membuat div pembungkus tak
    // berukuran; <Image> dengan "h-full w-full" lalu jatuh ke ukuran
    // piksel asli berkas logo.png, tampil raksasa. twMerge di cn()
    // memastikan className caller (mis. "size-7") tetap menang kalau ada.
    <div className={cn("flex size-9 items-center justify-center", className)}>
      <Image
        src="/logo.png"
        alt="Logo PERUMDA Tirtawening"
        width={36}
        height={36}
        className="object-contain h-full w-full"
      />
    </div>
  )
}
