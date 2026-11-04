import { Anton, Hanken_Grotesk } from "next/font/google"

/**
 * Font asli DICE (Foggy & ABC Favorit) bersifat proprietary, jadi tidak
 * di-hotlink. Pengganti terdekat dari Google Fonts dipakai di sini.
 *
 * Jika punya lisensinya, cukup ganti dua export di bawah dengan
 * `next/font/local` — nama variable CSS-nya tidak perlu diubah.
 */
export const fontBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
})

export const fontDisplay = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-src",
  display: "block",
})
