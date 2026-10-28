"use client"

// features/dashboard/components/pengguna/pengguna-dialog/bagian-reset-sandi.tsx
// — reset kata sandi akun orang lain.
//
// Reset sandi berdiri SENDIRI, tidak ikut tombol Simpan (dan sengaja berada
// DI LUAR <form> dialog, jadi Enter di sini tidak menyimpan form utama). Ia
// bukan penyuntingan data melainkan tindakan istimewa dengan jejak audit
// sendiri (RESET_PASSWORD); menggabungkannya ke Simpan akan membuat orang
// mengganti sandi orang lain tanpa sadar saat sekadar membetulkan email.
// Karena berdiri sendiri, state dan pesannya juga lokal di sini.
import * as React from "react"
import { KeyRound, Loader2 } from "@/components/ui/hugeicons-compat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { kirimJson, ApiError } from "@/features/dashboard/lib/api-client"
import { KELAS_INPUT } from "./tata-letak-form"

export function BagianResetSandi({ penggunaId }: { penggunaId: string }) {
  const [terbuka, setTerbuka] = React.useState(false)
  const [sandiBaru, setSandiBaru] = React.useState("")
  const [mereset, setMereset] = React.useState(false)
  const [pesan, setPesan] = React.useState<string | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)

  function tutup() {
    setTerbuka(false)
    setSandiBaru("")
  }

  async function terapkan() {
    setMereset(true)
    setGalat(null)
    setPesan(null)
    try {
      await kirimJson(`/users/${penggunaId}/password`, "PATCH", { passwordBaru: sandiBaru })
      setPesan("Kata sandi berhasil direset.")
      tutup()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal mereset kata sandi.")
    } finally {
      setMereset(false)
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3">
      {!terbuka ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Kata sandi</p>
            <p className="text-xs text-muted-foreground">
              Sandi lama tidak perlu diketahui. Tercatat sebagai RESET_PASSWORD di log audit.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setTerbuka(true)}>
            <KeyRound aria-hidden /> Reset kata sandi
          </Button>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="pg-reset">Kata sandi baru</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="pg-reset"
              type="password"
              autoComplete="new-password"
              value={sandiBaru}
              onChange={(e) => setSandiBaru(e.target.value)}
              placeholder="min. 8 karakter"
              className={`${KELAS_INPUT} min-w-48 flex-1`}
            />
            <Button type="button" onClick={terapkan} disabled={sandiBaru.trim().length < 8 || mereset}>
              {mereset && <Loader2 className="animate-spin" />} Terapkan
            </Button>
            <Button type="button" variant="ghost" onClick={tutup} disabled={mereset}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {pesan && (
        <Alert>
          <AlertDescription>{pesan}</AlertDescription>
        </Alert>
      )}
      {galat && (
        <Alert variant="destructive">
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
