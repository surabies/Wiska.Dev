"use client"

import * as React from "react"
import { ApiError } from "@/features/dashboard/api/ApiDashboard"
import { ambilOpsiPeriodeDrd, ambilRingkasanDrd } from "../api/ApiDrd"
import type { RingkasanDrd, TabDrd } from "../types/TipeDrd"

export function useDrd() {
  const [periodes, setPeriodes] = React.useState<number[]>([])
  const [periode, setPeriode] = React.useState<number | null>(null)
  const [tab, setTab] = React.useState<TabDrd>("ringkasan")
  const [ringkasan, setRingkasan] = React.useState<RingkasanDrd | null>(null)
  const [memuatPeriode, setMemuatPeriode] = React.useState(true)
  const [memuatRingkasan, setMemuatRingkasan] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  React.useEffect(() => {
    let batal = false
    ambilOpsiPeriodeDrd()
      .then(({ periodes: tersedia }) => {
        if (batal) return
        setPeriodes(tersedia)
        setPeriode((aktif) =>
          aktif !== null && tersedia.includes(aktif)
            ? aktif
            : (tersedia[0] ?? null)
        )
      })
      .catch((error: unknown) => {
        if (!batal) {
          setGalat(
            error instanceof ApiError
              ? error.message
              : "Daftar periode DRD gagal dimuat."
          )
        }
      })
      .finally(() => {
        if (!batal) setMemuatPeriode(false)
      })

    return () => {
      batal = true
    }
  }, [])

  React.useEffect(() => {
    if (periode === null) {
      setRingkasan(null)
      return
    }

    let batal = false
    setMemuatRingkasan(true)
    setGalat(null)
    ambilRingkasanDrd(periode)
      .then((data) => {
        if (!batal) setRingkasan(data)
      })
      .catch((error: unknown) => {
        if (!batal) {
          setRingkasan(null)
          setGalat(
            error instanceof ApiError
              ? error.message
              : "Ringkasan DRD gagal dimuat."
          )
        }
      })
      .finally(() => {
        if (!batal) setMemuatRingkasan(false)
      })

    return () => {
      batal = true
    }
  }, [periode])

  function gantiPeriode(nilai: number) {
    setPeriode(nilai)
  }

  function gantiTab(nilai: TabDrd) {
    setTab(nilai)
  }

  return {
    periodes,
    periode,
    tab,
    ringkasan,
    memuatPeriode,
    memuatRingkasan,
    galat,
    gantiPeriode,
    gantiTab,
  }
}
