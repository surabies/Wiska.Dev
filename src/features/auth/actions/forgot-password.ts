"use server"

// features/auth/actions/forgot-password.ts
//
// POLA RUJUKAN untuk server action: terima FormData -> validasi ulang dengan
// zod (jangan percaya client) -> kerjakan -> kembalikan state serializable
// untuk useActionState. Jangan pernah melempar error mentah ke client.
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema } from "../lib/schema"
import { buatTokenReset } from "../lib/password-reset"
import { kirimEmail } from "../lib/mailer"
import { emailResetPassword } from "../lib/email-templates"

export interface ForgotPasswordState {
  status: "idle" | "sukses" | "error"
  pesan?: string
  errors?: Record<string, string>
}

/// Pembatas laju sederhana di memori proses.
/// TERBATAS SECARA SADAR: hilang saat server restart dan tidak berlaku
/// lintas instance. Kalau nanti di-deploy lebih dari satu instance, pindahkan
/// ke Redis/Upstash. Meski begitu, ini tetap jauh lebih baik daripada tanpa
/// pembatas sama sekali — tanpa ini endpoint ini bisa dipakai membanjiri
/// email seseorang (mail bombing) atau menghabiskan kuota penyedia email.
const percobaan = new Map<string, { jumlah: number; reset: number }>()
const MAKS = 3
const JENDELA_MS = 15 * 60 * 1000

function lewatBatas(kunci: string): boolean {
  const now = Date.now()
  const catatan = percobaan.get(kunci)
  if (!catatan || catatan.reset < now) {
    percobaan.set(kunci, { jumlah: 1, reset: now + JENDELA_MS })
    return false
  }
  catatan.jumlah += 1
  return catatan.jumlah > MAKS
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  })
  if (!parsed.success) {
    return {
      status: "error",
      errors: { email: parsed.error.issues[0]?.message ?? "Email tidak valid" },
    }
  }
  const { email } = parsed.data

  // JAWABAN SUKSES YANG SAMA untuk email terdaftar maupun tidak — inilah
  // yang mencegah halaman ini dipakai memetakan siapa saja yang punya akun
  // (user enumeration). Semua cabang di bawah berakhir dengan pesan ini.
  const jawabanNetral: ForgotPasswordState = {
    status: "sukses",
    pesan:
      "Jika email tersebut terdaftar, kami telah mengirim tautan untuk mengatur ulang password. Periksa kotak masuk Anda.",
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal"
  if (lewatBatas(`${email}|${ip}`)) {
    return {
      status: "error",
      pesan: "Terlalu banyak permintaan. Coba lagi dalam beberapa menit.",
    }
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Diam-diam berhenti untuk email tak dikenal / akun nonaktif — pengguna
  // tetap melihat pesan netral di atas.
  if (!user || user.status !== "ACTIVE") return jawabanNetral

  try {
    const { token } = await buatTokenReset(email)
    const url = new URL(
      `/reset-password?token=${token}&email=${encodeURIComponent(email)}`,
      process.env.AUTH_URL ?? "http://localhost:3000",
    ).toString()

    await kirimEmail({
      to: email,
      subject: "Atur ulang password — PERUMDA Tirtawening",
      ...emailResetPassword({ nama: user.name ?? email, url }),
    })
  } catch (err) {
    // Kegagalan kirim dicatat di server, tapi pengguna TETAP menerima pesan
    // netral: membedakan "gagal kirim" dari "email tidak terdaftar" akan
    // membocorkan keberadaan akun — persis yang dicegah di atas.
    console.error("[forgot-password] gagal mengirim email:", err)
  }

  return jawabanNetral
}
