import { Anton, Hanken_Grotesk } from "next/font/google"

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
