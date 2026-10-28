// src/lib/footer-props.ts
// Satu sumber data footer, dipakai bersama oleh semua layout dashboard.
import type { DashboardFooterProps } from "@/components/layout/shell/DashboardFooter"
import { getSystemStatus } from "@/lib/system-status"
import pkg from "../../package.json"

export const ORGANIZATION = "Perumda Air Minum Tirtawening"

export async function getFooterProps(): Promise<DashboardFooterProps> {
  return {
    status: await getSystemStatus(),
    // Isi dengan waktu sinkron nyata (ISO 8601) bila prosesnya ada.
    // Selama null, segmen "Sinkron terakhir" otomatis tidak ditampilkan.
    syncedAt: null,
    version: pkg.version,
    organization: ORGANIZATION,
  }
}