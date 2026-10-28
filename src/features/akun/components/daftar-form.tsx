"use client"

// features/akun/components/daftar-form.tsx — form pendaftaran akun warga.
//
// Memakai signIn dari "next-auth/react" SETELAH POST /api/public/auth/register
// berhasil, dengan `redirect: false` — pola sama seperti credentials-form.tsx
// (login staf), supaya warga langsung masuk begitu akunnya jadi, tanpa
// mengetik ulang kredensial di halaman /login terpisah.
import * as React from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TriangleAlert } from "@/components/ui/hugeicons-compat"
import { daftarAkun, ApiError } from "../lib/api"

const PANJANG_PASSWORD_MIN = 8

export function DaftarForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [pesanError, setPesanError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setPesanError(null)
    setErrors({})

    const fd = new FormData(e.currentTarget)
    const nama = String(fd.get("nama") ?? "").trim()
    const email = String(fd.get("email") ?? "")
      .trim()
      .toLowerCase()
    const password = String(fd.get("password") ?? "")
    const konfirmasi = String(fd.get("konfirmasi") ?? "")

    const next: Record<string, string> = {}
    if (nama.length < 2) next.nama = "Nama wajib diisi."
    if (!email.includes("@")) next.email = "Format email tidak valid."
    if (password.length < PANJANG_PASSWORD_MIN)
      next.password = `Password minimal ${PANJANG_PASSWORD_MIN} karakter.`
    if (password !== konfirmasi)
      next.konfirmasi = "Konfirmasi password tidak sama."
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    setPending(true)
    try {
      await daftarAkun({ nama, email, password })

      const hasil = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      })
      if (hasil?.error) {
        // Akun sudah jadi tapi auto-masuk gagal (jarang terjadi) — arahkan
        // ke /login manual daripada membuatnya terlihat seperti pendaftaran
        // gagal padahal akunnya sudah ada.
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
        return
      }
      router.push(callbackUrl)
      router.refresh()
    } catch (err) {
      setPesanError(
        err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.",
      )
    } finally {
      setPending(false)
    }
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

        <Field data-invalid={!!errors.nama}>
          <FieldLabel htmlFor="nama">Nama lengkap</FieldLabel>
          <Input
            id="nama"
            name="nama"
            autoComplete="name"
            aria-invalid={!!errors.nama}
            disabled={pending}
          />
          {errors.nama && <FieldError>{errors.nama}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!errors.email}
            disabled={pending}
          />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            disabled={pending}
          />
          {errors.password ? (
            <FieldError>{errors.password}</FieldError>
          ) : (
            <FieldDescription>
              Minimal {PANJANG_PASSWORD_MIN} karakter.
            </FieldDescription>
          )}
        </Field>

        <Field data-invalid={!!errors.konfirmasi}>
          <FieldLabel htmlFor="konfirmasi">Konfirmasi password</FieldLabel>
          <Input
            id="konfirmasi"
            name="konfirmasi"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.konfirmasi}
            disabled={pending}
          />
          {errors.konfirmasi && <FieldError>{errors.konfirmasi}</FieldError>}
        </Field>

        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending && <Spinner className="size-4" />}
          {pending ? "Mendaftar…" : "Daftar akun"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Sudah punya akun?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Masuk
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
