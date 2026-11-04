// features/dashboard/pengguna/hooks/UseDaftarOrganisasi.ts
import * as React from "react"
import { ambilList } from "@/features/dashboard/api/ApiDashboard"
import type {
  Divisi,
  BagianItem,
  SubBagianItem,
} from "../types/TipeFormulirPengguna"

export function useDaftarOrganisasi() {
  const [divisi, setDivisi] = React.useState<Divisi[]>([])
  const [bagian, setBagian] = React.useState<BagianItem[]>([])
  const [subBagian, setSubBagian] = React.useState<SubBagianItem[]>([])
  const [memuat, setMemuat] = React.useState(true)

  React.useEffect(() => {
    let batal = false

    Promise.all([
      ambilList<Divisi>("/divisi", { pageSize: 50 }).catch(() => ({ rows: [] })),
      ambilList<BagianItem>("/bagian", { pageSize: 100 }).catch(() => ({ rows: [] })),
      ambilList<SubBagianItem>("/sub-bagian", { pageSize: 200 }).catch(() => ({ rows: [] })),
    ]).then(([resDivisi, resBagian, resSub]) => {
      if (!batal) {
        setDivisi(resDivisi.rows)
        setBagian(resBagian.rows)
        setSubBagian(resSub.rows)
        setMemuat(false)
      }
    })

    return () => {
      batal = true
    }
  }, [])

  return { divisi, bagian, subBagian, memuat }
}
