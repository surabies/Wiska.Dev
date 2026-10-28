// features/auth/components/forgot-password-card.tsx
import Link from "next/link"
import { ArrowLeft } from "@/components/ui/hugeicons-compat"
import { AppLogo } from "@/components/app-logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "./forgot-password-form"

export function ForgotPasswordCard() {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <AppLogo />
        <CardTitle className="mt-4 text-lg">Lupa password</CardTitle>
        <CardDescription>
          Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat
          password baru.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ForgotPasswordForm />

        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke halaman masuk
        </Link>
      </CardContent>
    </Card>
  )
}
