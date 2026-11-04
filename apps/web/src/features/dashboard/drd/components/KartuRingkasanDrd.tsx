"use client"

import * as React from "react"
import {
  Alert02Icon,
  DropletsIcon,
  ReceiptIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import {
  StatPanel,
  StatPanelGrid,
} from "@/features/dashboard/ringkasan/components/StatPanel"
import { formatRupiah } from "@/features/public/lib/Format"
import type { RingkasanDrd } from "../types/TipeDrd"

const formatAngka = (n: number) => n.toLocaleString("id-ID")

export function KartuRingkasanDrd({
  ringkasan,
}: {
  ringkasan: RingkasanDrd
}) {
  const total = ringkasan.jumlahPelanggan
  const persenDomestik =
    total > 0
      ? ((ringkasan.jumlahDomestik / total) * 100).toLocaleString("id-ID", {
          maximumFractionDigits: 1,
        })
      : "0"

  const rataPemakaian =
    total > 0
      ? (ringkasan.pemakaianM3 / total).toLocaleString("id-ID", {
          maximumFractionDigits: 1,
        })
      : "0"

  const rataTagihan =
    total > 0 ? Math.round(ringkasan.totalTagihan / total) : 0

  const persenTaa =
    total > 0
      ? ((ringkasan.jumlahTaa / total) * 100).toLocaleString("id-ID", {
          maximumFractionDigits: 1,
        })
      : "0"

  return (
    <StatPanelGrid kolom={4}>
      <StatPanel
        label="Pelanggan Ditagih"
        nilai={formatAngka(ringkasan.jumlahPelanggan)}
        keterangan={`${formatAngka(ringkasan.jumlahDomestik)} pelanggan domestik (${persenDomestik}%)`}
        icon={UserGroupIcon}
      />
      <StatPanel
        label="Volume Pemakaian (DRD)"
        nilai={`${formatAngka(ringkasan.pemakaianM3)} m³`}
        keterangan={`Rata-rata ${rataPemakaian} m³ per sambungan`}
        icon={DropletsIcon}
        nada="info"
      />
      <StatPanel
        label="Total Tagihan DRD"
        nilai={formatRupiah(ringkasan.totalTagihan)}
        keterangan={`Rata-rata ${formatRupiah(rataTagihan)} per sambungan`}
        icon={ReceiptIcon}
        nada="sukses"
      />
      <StatPanel
        label="Tidak Ada Air (TAA)"
        nilai={formatAngka(ringkasan.jumlahTaa)}
        keterangan={
          ringkasan.jumlahTaa > 0
            ? `${persenTaa}% dari seluruh sambungan langganan`
            : "Tidak ada kasus TAA pada periode ini"
        }
        icon={Alert02Icon}
        nada={ringkasan.jumlahTaa > 0 ? "perhatian" : "sukses"}
        progres={
          total > 0
            ? Math.min(100, (ringkasan.jumlahTaa / total) * 100 * 5)
            : 0
        }
      />
    </StatPanelGrid>
  )
}
