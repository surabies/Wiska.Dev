"use client"

import * as React from "react"
import { ApiError } from "../../lib/api-client"
import { ambilInfoPelanggan } from "../api/ApiInfoPelanggan"
import type { InfoPelanggan, StatusInfo } from "../types/TipeInfoPelanggan"

export type { StatusInfo } from "../types/TipeInfoPelanggan"

type Hasil = { kunci: string; data?: InfoPelanggan; galat?: string }

export function useInfoPelanggan(nomor: string, periode: string) {
  const kunci = nomor ? `${nomor}|${periode}` : ""
  const [hasil, setHasil] = React.useState<Hasil | null>(null)

  React.useEffect(() => {
    if (!nomor) return
    let batal = false
    let nomorPermintaan = 0
    const kunciPermintaan = `${nomor}|${periode}`

    const muat = () => {
      const permintaan = ++nomorPermintaan
      ambilInfoPelanggan(nomor, periode)
        .then((data) => {
          if (!batal && permintaan === nomorPermintaan) {
            setHasil({ kunci: kunciPermintaan, data })
          }
        })
        .catch((err: unknown) => {
          if (batal || permintaan !== nomorPermintaan) return
          setHasil({
            kunci: kunciPermintaan,
            galat:
              err instanceof ApiError || err instanceof Error
                ? err.message
                : "Gagal memuat data pelanggan.",
          })
        })
    }

    muat()
    window.addEventListener("focus", muat)

    return () => {
      batal = true
      window.removeEventListener("focus", muat)
    }
  }, [nomor, periode])

  const status: StatusInfo = !kunci
    ? "idle"
    : hasil?.kunci !== kunci
      ? "memuat"
      : hasil.galat
        ? "galat"
        : "siap"

  return {
    status,
    data: status === "siap" ? (hasil?.data ?? null) : null,
    galat: status === "galat" ? (hasil?.galat ?? null) : null,
  }
}
