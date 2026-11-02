import { ambilSatu } from "@/features/dashboard/api/ApiDashboard"
import type {
  OpsiPeriodeDrd,
  RingkasanDrd,
  TabDrd,
  TitikGrafikDrd,
} from "../types/TipeDrd"

export function ambilOpsiPeriodeDrd(): Promise<OpsiPeriodeDrd> {
  return ambilSatu("/drd/stats")
}

export function ambilRingkasanDrd(periode: number): Promise<RingkasanDrd> {
  return ambilSatu("/drd/ringkasan", { periode })
}

export function ambilGrafikDrd(
  periode: number,
  tab: TabDrd
): Promise<TitikGrafikDrd[]> {
  return ambilSatu("/drd/grafik", { periode, tab })
}
