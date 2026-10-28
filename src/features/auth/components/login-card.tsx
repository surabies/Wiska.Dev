// features/auth/components/login-card.tsx — isi halaman masuk.
//
// Server component: merakit + menerjemahkan kode error. Bagian interaktifnya
// (form credentials & tombol Google) diisolasi sebagai komponen client
// tersendiri — lihat FRONTEND.md, "use client" ditaruh di daun.
//
// URUTAN SENGAJA: Google dulu, baru credentials. Google adalah jalur utama
// (akun kantor, tanpa password untuk dikelola/dibocorkan); credentials
// disediakan sebagai alternatif untuk akun yang belum/tidak memakai Google.
import Link from "next/link"
import { AppLogo } from "@/components/app-logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TriangleAlert } from "@/components/ui/hugeicons-compat"
import { pesanErrorMasuk } from "../lib/sign-in-errors"
import { GoogleSignInButton } from "./google-sign-in-button"
import { CredentialsForm } from "./credentials-form"

export function LoginCard({ error, callbackUrl }: { error?: string; callbackUrl: string }) {
  const pesanError = pesanErrorMasuk(error)

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <AppLogo />
        <CardTitle className="mt-4 text-lg">Masuk ke dashboard</CardTitle>
        <CardDescription>Gunakan akun kantor Anda untuk melanjutkan.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {pesanError && (
          // <Alert> sudah membawa role="alert", jadi pembaca layar
          // mengumumkan kegagalan saat pengguna dilempar balik kemari dengan
          // ?error=... (mis. dari callback Google).
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{pesanError}</AlertDescription>
          </Alert>
        )}

        <GoogleSignInButton callbackUrl={callbackUrl} />

        {/* Pemisah dengan label "atau". Garisnya dibuat lewat border pada
            pseudo-element flex, bukan <Separator>, karena teks harus duduk
            DI TENGAH garis. */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">atau</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <CredentialsForm callbackUrl={callbackUrl} />

        <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Akses terbatas untuk pegawai terdaftar. Belum punya akses? Hubungi
          administrator sistem di divisi Anda.
        </p>

        {/* Kredensial pegawai & warga login lewat form yang sama di atas
            (Credentials provider tidak membedakan role) — baris ini
            HANYA menyalurkan warga yang belum punya akun ke pendaftaran
            mandiri, tanpa mengubah pesan akses staf di atas. */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pelanggan atau warga?{" "}
          <Link href={`/daftar?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="underline underline-offset-4 hover:text-foreground">
            Daftar akun
          </Link>{" "}
          untuk memantau laporan pengaduan Anda.
        </p>
      </CardContent>
    </Card>
  )
}
