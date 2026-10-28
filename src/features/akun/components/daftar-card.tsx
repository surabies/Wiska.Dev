// features/akun/components/daftar-card.tsx — isi halaman /daftar.
import { AppLogo } from "@/components/app-logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DaftarForm } from "./daftar-form"

export function DaftarCard({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <AppLogo />
        <CardTitle className="mt-4 text-lg">Daftar akun warga</CardTitle>
        <CardDescription>
          Supaya laporan pengaduan Anda tersimpan otomatis dan mudah dipantau
          kapan saja — tanpa mencatat nomor tiket sendiri.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <DaftarForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  )
}
