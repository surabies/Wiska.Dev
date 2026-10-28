import "server-only"

// features/auth/lib/mailer.ts — satu-satunya pintu keluar email.
//
// STATUS SAAT INI: BELUM ADA PENYEDIA EMAIL YANG DIKONFIGURASI di .env
// (hanya ada AUTH_SECRET, AUTH_GOOGLE_*, DATABASE_URL). Karena itu:
//
//   - Bila RESEND_API_KEY diisi  -> email dikirim sungguhan lewat Resend.
//   - Bila tidak                 -> isi email DICETAK KE KONSOL SERVER dan
//                                   TIDAK terkirim ke siapa pun.
//
// Fallback konsol itu SENGAJA, supaya alur lupa-password bisa dipakai dan
// diuji sekarang tanpa menebak-nebak penyedia email mana yang dipakai
// PERUMDA. TAPI ini TIDAK BOLEH dibawa ke produksi: di produksi tanpa
// RESEND_API_KEY, pengguna akan melihat "email terkirim" padahal tidak ada
// email apa pun — karena itu di produksi kondisi tersebut dianggap ERROR,
// bukan didiamkan (lihat di bawah).
//
// Memakai fetch langsung ke REST API Resend, bukan SDK, supaya tidak
// menambah dependency. Mau ganti ke SMTP/nodemailer atau penyedia lain?
// Cukup ganti isi kirimEmail() — pemanggilnya tidak perlu berubah.

interface EmailInput {
  to: string
  subject: string
  html: string
  text: string
}

const FROM = process.env.EMAIL_FROM ?? "PERUMDA Tirtawening <onboarding@resend.dev>"

export async function kirimEmail({ to, subject, html, text }: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      // Gagal keras. Diam-diam tidak mengirim email reset password di
      // produksi jauh lebih berbahaya daripada error yang terlihat.
      throw new Error(
        "RESEND_API_KEY belum diisi — email tidak bisa dikirim di produksi. Set env tersebut atau ganti implementasi kirimEmail()."
      )
    }
    console.warn(
      [
        "",
        "─".repeat(72),
        "  EMAIL TIDAK DIKIRIM (RESEND_API_KEY belum diisi) — mode pengembangan.",
        `  Kepada : ${to}`,
        `  Subjek : ${subject}`,
        "",
        text,
        "─".repeat(72),
        "",
      ].join("\n")
    )
    return
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  })

  if (!res.ok) {
    // Detail dicatat di server, TIDAK diteruskan ke pengguna — pesan dari
    // penyedia bisa membocorkan konfigurasi internal.
    console.error("[mailer] Resend menolak:", res.status, await res.text().catch(() => ""))
    throw new Error("Gagal mengirim email")
  }
}
