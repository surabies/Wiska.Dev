// server/modules/closing/Closing.schema.ts — skema validasi Zod & tipe kontrak
// untuk modul penutupan periode penagihan (closing).

import { z } from "zod"

export const periodeParam = z.coerce.number().int().min(190001).max(999912)

export const tutupSchema = z.object({
  /// Jatuh tempo seluruh tagihan periode ini. WAJIB dikirim — tidak ada
  /// nilai bawaan. Versi impor memakai placeholder "periode + 1 bulan" yang
  /// tidak punya dasar di sumber data mana pun; menetapkannya di sini
  /// membuat tanggal itu jadi keputusan yang tercatat, bukan tebakan kode.
  tanggalJatuhTempo: z.coerce.date(),
})

export const bukaSchema = z.object({
  /// Wajib, minimal 10 karakter: membuka periode yang sudah ditagihkan
  /// harus bisa dipertanggungjawabkan belakangan, dan "ok" bukan alasan.
  alasan: z.string().trim().min(10).max(500),
})

export type TutupPeriodeBody = z.infer<typeof tutupSchema>
export type BukaPeriodeBody = z.infer<typeof bukaSchema>
