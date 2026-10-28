"use server"

// features/auth/actions/reset-password.ts
//
// CATATAN: setiap fungsi async yang di-export dari file "use server" menjadi
// endpoint yang bisa dipanggil dari browser. Jadi HANYA server action yang
// boleh di-export dari sini — helper internal (mis. hashPassword) tinggal di
// features/auth/lib/.
import { resetPasswordSchema } from "../lib/schema"
import { pakaiTokenReset, hashPassword } from "../lib/password-reset"

export interface ResetPasswordState {
  status: "idle" | "sukses" | "error"
  pesan?: string
  errors?: Record<string, string>
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  // Divalidasi ULANG di server memakai schema yang sama dengan client —
  // validasi di client hanya demi UX dan bisa dilewati sepenuhnya.
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    email: formData.get("email"),
    password: formData.get("password"),
    konfirmasi: formData.get("konfirmasi"),
  })

  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message
    }
    return { status: "error", errors }
  }

  const { token, email, password } = parsed.data

  const passwordHash = await hashPassword(password)
  const berhasil = await pakaiTokenReset(email, token, passwordHash)

  if (!berhasil) {
    // Satu pesan untuk semua sebab (token salah / kedaluwarsa / sudah
    // dipakai / email tidak ada) — membedakannya akan membocorkan token mana
    // yang pernah valid dan email mana yang terdaftar.
    return {
      status: "error",
      pesan:
        "Tautan ini tidak berlaku lagi. Tautan reset hanya bisa dipakai sekali dan kedaluwarsa dalam 1 jam. Silakan minta tautan baru.",
    }
  }

  // CATATAN PENTING: sesi memakai strategi JWT (auth.config.ts), yang TIDAK
  // bisa dicabut dari server. Artinya sesi yang sudah aktif di perangkat lain
  // TETAP hidup sampai JWT-nya kedaluwarsa, meski password sudah diganti.
  // Untuk benar-benar mengusir sesi lain saat reset (mis. saat akun diduga
  // dibajak), strategi sesi harus dipindah ke database — perubahan besar
  // yang harus diputuskan sadar, bukan diam-diam di sini.
  return {
    status: "sukses",
    pesan:
      "Password berhasil diperbarui. Silakan masuk dengan password baru Anda.",
  }
}
