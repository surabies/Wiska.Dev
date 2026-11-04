import { ambilSatu, kirimJson } from "@/features/dashboard/api/ApiDashboard"
import type { JendelaLaporMandiri } from "../types/TipeJendelaLaporMandiri"

export function ambilJendelaLaporMandiri() {
  return ambilSatu<JendelaLaporMandiri>("/konfigurasi/lapor-mandiri/jendela")
}

export function simpanJendelaLaporMandiri(nilai: JendelaLaporMandiri) {
  return kirimJson<JendelaLaporMandiri>(
    "/konfigurasi/lapor-mandiri/jendela",
    "PATCH",
    nilai
  )
}
