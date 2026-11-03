"use client"

import * as React from "react"
import type { RingkasanDrd } from "../types/TipeDrd"
import { BaganKelurahan } from "./grafik/BaganKelurahan"
import { BaganCakupan } from "./grafik/BaganCakupan"
import { BaganTarif } from "./grafik/BaganTarif"
import { BaganDomestik } from "./grafik/BaganDomestik"
import { BaganTaaKelurahan } from "./grafik/BaganTaaKelurahan"
import { BaganTaaStatus } from "./grafik/BaganTaaStatus"
import { BaganTagihanKomposisi } from "./grafik/BaganTagihanKomposisi"

export function GrafikDrd({ ringkasan }: { ringkasan: RingkasanDrd }) {
  const dataKelurahan = ringkasan.dataKelurahan ?? []
  const dataCakupan = ringkasan.dataCakupan ?? []
  const dataTarif = ringkasan.dataTarif ?? []
  const dataDomestik = ringkasan.dataDomestik ?? []
  const dataTaaKelurahan = ringkasan.dataTaaKelurahan ?? []
  const dataTaaStatus = ringkasan.dataTaaStatus ?? {
    normal: Math.max(0, ringkasan.jumlahPelanggan - ringkasan.jumlahTaa),
    taa: ringkasan.jumlahTaa,
    persenTaa:
      ringkasan.jumlahPelanggan > 0
        ? (ringkasan.jumlahTaa / ringkasan.jumlahPelanggan) * 100
        : 0,
    sebaranTarif: [],
  }
  const dataTagihanKomposisi = ringkasan.dataTagihanKomposisi ?? {
    hargaAir: 0,
    beaBeban: 0,
    beaAdmin: 0,
    airKotor: 0,
    lainLain: 0,
    totalTagihan: ringkasan.totalTagihan,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Baris 1: Distribusi Wilayah Kelurahan & Cakupan Layanan (Dual Axis) */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <BaganKelurahan data={dataKelurahan} />
        <BaganCakupan data={dataCakupan} />
      </div>

      {/* Baris 2: Struktur Golongan Tarif & Segmentasi Domestik */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <BaganTarif data={dataTarif} />
        <BaganDomestik data={dataDomestik} />
      </div>

      {/* Baris 3: Pemetaan Kendala TAA (Per Wilayah & Rasio Layanan) */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <BaganTaaKelurahan data={dataTaaKelurahan} />
        <BaganTaaStatus status={dataTaaStatus} />
      </div>

      {/* Baris 4: Struktur Komponen Tagihan DRD (Full Width) */}
      <BaganTagihanKomposisi komposisi={dataTagihanKomposisi} />
    </div>
  )
}
