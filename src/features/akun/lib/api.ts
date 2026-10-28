// features/akun/lib/api.ts — klien untuk pendaftaran akun warga mandiri.
//
// Pendaftaran memakai POST /api/public/auth/register (tanpa login — lihat
// server/modules/publik/akun-warga.router.ts). Setelah akun dibuat, form
// yang memanggil fungsi ini bertanggung jawab memanggil signIn("credentials")
// sendiri (next-auth/react) supaya pengguna langsung masuk tanpa mengetik
// ulang kredensialnya di halaman terpisah — lihat daftar-form.tsx.
import { ApiError } from "@/features/public/lib/api"

export { ApiError }

interface EnvelopeSukses<T> {
  success: true
  data: T
}
interface EnvelopeError {
  success: false
  error: { code: string; message: string; details?: Array<{ path: string; message: string }> }
}

async function tangani<T>(res: Response): Promise<T> {
  let body: EnvelopeSukses<T> | EnvelopeError
  try {
    body = await res.json()
  } catch {
    throw new ApiError(res.status, "NETWORK", "Gagal menghubungi server. Periksa koneksi Anda dan coba lagi.")
  }
  if (!res.ok || !body.success) {
    const err = (body as EnvelopeError).error
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "Terjadi kesalahan.", err?.details)
  }
  return body.data
}

export interface HasilDaftar {
  id: string
  name: string | null
  email: string
  pesan: string
}

export function daftarAkun(input: { nama: string; email: string; password: string }) {
  return fetch("/api/public/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => tangani<HasilDaftar>(res))
}
