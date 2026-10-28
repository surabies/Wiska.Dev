"use client"

// features/auth/components/credentials-form.tsx — form masuk email/username +
// password.
//
// Memakai signIn dari "next-auth/react" (HTTP ke /api/auth/*) dengan
// `redirect: false`, BUKAN server action. Dua alasan:
//  1. Endpoint /api/auth/* di app ini dilayani Hono (@hono/auth-js), dan
//     jalur HTTP inilah yang sudah terbukti bekerja end-to-end.
//  2. `redirect: false` membuat pesan "password salah" tampil di tempat,
//     tanpa memuat ulang halaman dan tanpa membuang isi form.
import * as React from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TriangleAlert } from "@/components/ui/hugeicons-compat"
import { loginSchema } from "../lib/schema"

export function CredentialsForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [pesanError, setPesanError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setPesanError(null)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({
      identifier: formData.get("identifier"),
      password: formData.get("password"),
    })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === "string" && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setPending(true)
    const hasil = await signIn("credentials", { ...parsed.data, redirect: false })
    setPending(false)

    if (hasil?.error) {
      // Auth.js hanya mengembalikan "CredentialsSignin" untuk SEMUA kegagalan
      // (user tidak ada / password salah / akun nonaktif) — itu memang
      // disengaja supaya tidak membocorkan akun mana yang ada. Karena itu
      // pesan di sini juga harus umum, jangan dipecah-pecah.
      setPesanError("Email/username atau password salah.")
      return
    }

    // redirect:false berarti navigasi jadi tanggung jawab kita.
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-4">
        {pesanError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{pesanError}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.identifier}>
          <FieldLabel htmlFor="identifier">Email atau username</FieldLabel>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nama@tirtawening.co.id"
            aria-invalid={!!errors.identifier}
            disabled={pending}
          />
          {errors.identifier && <FieldError>{errors.identifier}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Lupa password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            disabled={pending}
          />
          {errors.password && <FieldError>{errors.password}</FieldError>}
        </Field>

        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Spinner className="size-4" />}
          {pending ? "Memeriksa…" : "Masuk"}
        </Button>
      </FieldGroup>
    </form>
  )
}
