import { kirimForm } from "@/features/dashboard/api/ApiDashboard"
import type { Hasil } from "../types/TipePbpk"

export function kirimImporPbpk(
  form: FormData,
  terapkan: boolean
): Promise<Hasil> {
  return kirimForm<Hasil>(
    terapkan ? "/pelanggan/impor-pbpk" : "/pelanggan/impor-pbpk/pratinjau",
    form
  )
}
