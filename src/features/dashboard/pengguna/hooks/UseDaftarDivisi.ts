// features/dashboard/pengguna/hooks/UseDaftarDivisi.ts
import * as React from "react"
import { ambilList } from "@/features/dashboard/api/ApiDashboard"
import type { Divisi } from "../types/TipeFormulirPengguna"

export function useDaftarDivisi() {
  const [divisi, setDivisi] = React.useState<Divisi[]>([])

  React.useEffect(() => {
    let batal = false
    ambilList<Divisi>("/divisi", { pageSize: 50 })
      .then(({ rows }) => {
        if (!batal) setDivisi(rows)
      })
      .catch(() => {
        // Divisi opsional — gagal memuatnya tidak boleh memblokir pembuatan akun.
      })
    return () => {
      batal = true
    }
  }, [])

  return divisi
}
