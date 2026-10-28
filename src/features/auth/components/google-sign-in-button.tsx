"use client"

// features/auth/components/google-sign-in-button.tsx
//
// Satu-satunya komponen client di alur login — dan hanya karena butuh state
// pending. Pola yang dipakai seterusnya: "use client" ditaruh sedekat
// mungkin dengan interaktivitasnya (di daun), bukan di page/layout, supaya
// sisa halaman tetap server component.
import * as React from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// Logo G resmi Google. Warnanya dikunci (bukan currentColor) karena brand
// guideline Google mewajibkan logo tampil 4 warna aslinya — jadi logo ini
// SENGAJA tidak ikut berubah saat tema gelap, dan itu memang benar.
function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

export function GoogleSignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [pending, setPending] = React.useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 w-full"
      disabled={pending}
      onClick={() => {
        setPending(true)
        // Kalau signIn gagal SEBELUM sempat redirect (mis. jaringan mati),
        // tombol harus hidup lagi — kalau tidak, halaman terkunci diam-diam.
        signIn("google", { callbackUrl }).catch(() => setPending(false))
      }}
    >
      {pending ? <Spinner className="size-4" /> : <GoogleLogo />}
      {pending ? "Mengalihkan ke Google…" : "Masuk dengan Google"}
    </Button>
  )
}
