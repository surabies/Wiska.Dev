"use client"

import * as React from "react"
import {
  normalisasiPreferensiKolom,
  pindahkanKolom,
  type KolomVerifikasi,
  type PreferensiKolom,
} from "../lib/PreferensiKolom"

const COOKIE_KOLOM = "verifikasi-kolom-v2"

function bacaCookie(): PreferensiKolom {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_KOLOM}=`))
  if (!cookie) return normalisasiPreferensiKolom(null)

  try {
    return normalisasiPreferensiKolom(
      JSON.parse(decodeURIComponent(cookie.slice(COOKIE_KOLOM.length + 1))),
    )
  } catch {
    document.cookie = `${COOKIE_KOLOM}=; path=/; max-age=0; samesite=lax`
    return normalisasiPreferensiKolom(null)
  }
}

export function usePreferensiKolom() {
  const [preferensiKolom, setPreferensiKolom] =
    React.useState<PreferensiKolom>(() => normalisasiPreferensiKolom(null))
  const [siap, setSiap] = React.useState(false)

  React.useEffect(() => {
    setPreferensiKolom(bacaCookie())
    setSiap(true)
  }, [])

  React.useEffect(() => {
    if (!siap) return
    document.cookie = `${COOKIE_KOLOM}=${encodeURIComponent(
      JSON.stringify(preferensiKolom),
    )}; path=/; max-age=31536000; samesite=lax`
  }, [preferensiKolom, siap])

  return {
    preferensiKolom,
    ubahVisibilitasKolom(kolom: KolomVerifikasi, tampil: boolean) {
      setPreferensiKolom((current) => ({
        ...current,
        tampil: { ...current.tampil, [kolom]: tampil },
      }))
    },
    pindahKolom(dari: KolomVerifikasi, ke: KolomVerifikasi) {
      setPreferensiKolom((current) => pindahkanKolom(current, dari, ke))
    },
    ubahLebarKolom(kolom: KolomVerifikasi, lebar: number) {
      setPreferensiKolom((current) => ({
        ...current,
        lebar: { ...current.lebar, [kolom]: lebar },
      }))
    },
    resetKolom() {
      setPreferensiKolom(normalisasiPreferensiKolom(null))
    },
  }
}
