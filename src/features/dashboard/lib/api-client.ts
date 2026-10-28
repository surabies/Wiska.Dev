// features/dashboard/lib/api-client.ts — klien /api/v1 untuk komponen client
// dashboard (grid interaktif, peta).
//
// KENAPA fetch, padahal FRONTEND.md menyuruh server component baca DB
// langsung? Aturan itu untuk render awal halaman. Grid AG Grid bermodel
// infinite: baris diminta BERTAHAP dari browser saat pengguna menggulir /
// memfilter — itu memang pekerjaan HTTP API. Endpoint /api/v1 sudah menjaga
// dirinya sendiri (verifyAuth blanket + requireRole per route), cookie sesi
// ikut otomatis karena same-origin.
//
// Bentuk envelope sama dengan features/publik/lib/api.ts; diterjemahkan
// SEKALI di sini menjadi "kembalikan data" atau "lempar ApiError".

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

interface EnvelopeList<T> {
  success: boolean
  data: T[]
  meta?: { page: number; pageSize: number; total: number; totalPages: number }
  error?: { code: string; message: string }
}

interface EnvelopeSatu<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

export interface HasilList<T> {
  rows: T[]
  total: number
}

/** GET /api/v1<path> dengan query params; null/undefined/"" dibuang. */
export async function ambilList<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>
): Promise<HasilList<T>> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }

  const res = await fetch(`/api/v1${path}?${qs}`)
  let body: EnvelopeList<T>
  try {
    body = await res.json()
  } catch {
    throw new ApiError(res.status, "NETWORK", "Gagal menghubungi server.")
  }

  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Terjadi kesalahan.")
  }

  return { rows: body.data, total: body.meta?.total ?? body.data.length }
}

async function bacaEnvelope<T>(res: Response): Promise<T> {
  let body: EnvelopeSatu<T>
  try {
    body = await res.json()
  } catch {
    throw new ApiError(res.status, "NETWORK", "Gagal menghubungi server.")
  }
  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? "Terjadi kesalahan.")
  }
  return body.data
}

/** GET /api/v1<path> untuk satu objek (detail atau agregat non-list). */
export async function ambilSatu<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {}
): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }
  const query = qs.size > 0 ? `?${qs}` : ""
  return bacaEnvelope<T>(await fetch(`/api/v1${path}${query}`))
}

/** Mutasi JSON ke /api/v1<path> (PATCH/POST/PUT/DELETE). */
export async function kirimJson<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return bacaEnvelope<T>(res)
}

/** POST multipart/form-data ke /api/v1<path> (unggah berkas, mis.
 *  POST /pengaduan/foto). Content-Type SENGAJA tidak di-set manual —
 *  browser yang menulis boundary-nya. */
export async function kirimForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { method: "POST", body: form })
  return bacaEnvelope<T>(res)
}
