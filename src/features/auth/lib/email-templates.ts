import "server-only"

// features/auth/lib/email-templates.ts — isi email.
//
// HTML email SENGAJA ditulis dengan tabel + style inline dan TIDAK memakai
// Tailwind maupun komponen React: klien email (terutama Outlook) tidak
// memuat CSS eksternal dan dukungan flexbox/grid-nya tidak bisa diandalkan.
// Jangan tergoda memakai komponen UI aplikasi di sini.
//
// Setiap email menyertakan versi `text` — bukan pelengkap: banyak klien
// memblokir HTML secara default, dan email tanpa versi teks lebih sering
// masuk folder spam.

interface Isi {
  html: string
  text: string
}

/// Jangan pernah menaruh nilai dari pengguna ke HTML tanpa escaping —
/// `nama` berasal dari database dan bisa mengandung karakter HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function emailResetPassword({ nama, url }: { nama: string; url: string }): Isi {
  const namaAman = escapeHtml(nama)

  const text = [
    `Halo ${nama},`,
    "",
    "Kami menerima permintaan untuk mengatur ulang password akun Anda di dashboard PERUMDA Tirtawening.",
    "",
    "Buka tautan berikut untuk membuat password baru (berlaku 1 jam):",
    url,
    "",
    "Jika Anda tidak meminta ini, abaikan email ini — password Anda tidak berubah.",
    "",
    "PERUMDA Tirtawening Kota Bandung",
  ].join("\n")

  const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;">Halo ${namaAman},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;">
            Kami menerima permintaan untuk mengatur ulang password akun Anda di
            dashboard <strong>PERUMDA Tirtawening</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;">
            Klik tombol di bawah untuk membuat password baru. Tautan ini
            <strong>berlaku 1 jam</strong> dan hanya bisa dipakai sekali.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="border-radius:6px;background:#0f766e;">
                <a href="${url}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Atur ulang password</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#666;">
            Tombol tidak berfungsi? Salin tautan ini ke browser Anda:
          </p>
          <p style="margin:0 0 24px;font-size:12px;line-height:18px;word-break:break-all;color:#0f766e;">${url}</p>
          <p style="margin:0;font-size:12px;line-height:18px;color:#666;border-top:1px solid #e5e5e5;padding-top:16px;">
            Jika Anda tidak meminta ini, abaikan email ini — password Anda tidak berubah.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { html, text }
}
