// features/auth/components/reset-password-card.tsx
//
// `tokenValid` diputuskan di SERVER (page.tsx) sebelum komponen ini dirender,
// supaya pengguna dengan tautan kedaluwarsa langsung tahu — bukan setelah
// bersusah payah mengetik password baru lalu ditolak.
import Link from "next/link"
import { TriangleAlert } from "@/components/ui/hugeicons-compat"
import { AppLogo } from "@/components/app-logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "./reset-password-form"

export function ResetPasswordCard({
  token,
  email,
  tokenValid,
}: {
  token: string
  email: string
  tokenValid: boolean
}) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <AppLogo />
        <CardTitle className="mt-4 text-lg">
          {tokenValid ? "Buat password baru" : "Tautan tidak berlaku"}
        </CardTitle>
        <CardDescription>
          {tokenValid
            ? `Untuk akun ${email}.`
            : "Tautan reset hanya berlaku 1 jam dan hanya bisa dipakai sekali."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {tokenValid ? (
          <ResetPasswordForm token={token} email={email} />
        ) : (
          <>
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                Tautan ini sudah kedaluwarsa, sudah pernah dipakai, atau tidak
                valid. Silakan minta tautan baru.
              </AlertDescription>
            </Alert>
            <Button asChild className="h-10 w-full">
              <Link href="/forgot-password">Minta tautan baru</Link>
            </Button>
          </>
        )}

        <Link
          href="/login"
          className="border-t border-border pt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Kembali ke halaman masuk
        </Link>
      </CardContent>
    </Card>
  )
}
