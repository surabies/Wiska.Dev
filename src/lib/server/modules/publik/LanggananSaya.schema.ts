// server/modules/publik/LanggananSaya.schema.ts — skema validasi Zod & tipe
// kontrak untuk penautan nomor langganan pada akun warga.

import { z } from "zod"

export const tambahSchema = z.object({
  nomorLangganan: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka"),
})

export type TambahLanggananInput = z.infer<typeof tambahSchema>
