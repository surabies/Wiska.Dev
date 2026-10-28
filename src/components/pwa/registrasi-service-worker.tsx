"use client"

// components/pwa/registrasi-service-worker.tsx — mendaftarkan public/sw.js.
//
// Dipisah dari AjakanPasang supaya pendaftaran tetap jalan meski banner
// ajakan sudah ditutup pengguna: service worker-lah yang menyediakan halaman
// cadangan saat offline, dan pada sebagian versi Chrome menjadi syarat
// munculnya prompt "Install app".
import * as React from "react"

export function RegistrasiServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // Pendaftaran ditunda sampai `load`: berkas sw.js tidak boleh berebut
    // bandwidth dengan aset yang dibutuhkan render pertama.
    const daftar = () => {
      navigator.serviceWorker
        // updateViaCache "none": berkas sw.js sendiri selalu diambil dari
        // jaringan, supaya perbaikan pada service worker tidak tertahan cache
        // HTTP browser sampai 24 jam.
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((galat) => {
          // Gagal daftar bukan kondisi fatal — situs tetap berfungsi penuh,
          // hanya kehilangan halaman cadangan offline.
          console.error("Pendaftaran service worker gagal:", galat)
        })
    }

    if (document.readyState === "complete") {
      daftar()
      return
    }
    window.addEventListener("load", daftar)
    return () => window.removeEventListener("load", daftar)
  }, [])

  return null
}
