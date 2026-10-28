import * as React from "react"
import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, Upload01Icon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPeriode } from "@/features/public/lib/format"
import { kirimForm, ApiError } from "../../../lib/api-client"
import { keAngkaPeriode, ukuranBerkas } from "../format"
import { JENIS_FOTO, type HasilImpor, type JenisFoto } from "./tipe"
import { ZonaBerkas } from "../zona-berkas"

function Bidang({
  id,
  label,
  bantuan,
  children,
}: {
  id: string
  label: string
  bantuan: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{bantuan}</p>
    </div>
  )
}

export function FormImpor({
  judul,
  keterangan,
  accept,
  format,
  path,
  denganJenis,
  onHasil,
}: {
  judul: string
  keterangan: ReactNode
  accept: string
  format: string
  path: string
  denganJenis?: boolean
  onHasil: (h: HasilImpor | null) => void
}) {
  const id = React.useId()
  const [bulan, setBulan] = React.useState("")
  const [jenis, setJenis] = React.useState<JenisFoto>("stand")
  const [files, setFiles] = React.useState<File[]>([])
  const [mengirim, setMengirim] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  const periode = keAngkaPeriode(bulan)
  const siap = periode !== null && files.length > 0 && !mengirim
  const totalUkuran = files.reduce((n, f) => n + f.size, 0)

  async function impor() {
    if (periode === null || files.length === 0) return
    setMengirim(true)
    setGalat(null)
    onHasil(null)
    try {
      const form = new FormData()
      form.append("periode", String(periode))
      if (denganJenis) form.append("jenis", jenis)
      for (const f of files) form.append("berkas", f)
      onHasil(await kirimForm<HasilImpor>(path, form))
      setFiles([])
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal mengimpor.")
    } finally {
      setMengirim(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">{judul}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{keterangan}</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <Bidang
          id={`${id}-periode`}
          label="Periode"
          bantuan={
            periode !== null ? (
              <>
                {formatPeriode(periode)} · <span className="font-mono">{periode}</span>
              </>
            ) : (
              "Wajib dipilih lebih dulu."
            )
          }
        >
          <Input
            id={`${id}-periode`}
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="h-9 cursor-pointer"
          />
        </Bidang>

        {denganJenis && (
          <Bidang id={`${id}-jenis`} label="Jenis berkas" bantuan="Satu jenis per unggahan.">
            <Select value={jenis} onValueChange={(v) => setJenis(v as JenisFoto)}>
              <SelectTrigger id={`${id}-jenis`} aria-label="Jenis berkas" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JENIS_FOTO.map((j) => (
                  <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Bidang>
        )}
      </div>

      <ZonaBerkas
        id={`${id}-berkas`}
        accept={accept}
        format={format}
        files={files}
        onUbah={setFiles}
        disabled={periode === null}
      />

      {galat && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground tabular-nums">
          {files.length > 0
            ? `${files.length} berkas · ${ukuranBerkas(totalUkuran)}`
            : "Belum ada berkas dipilih"}
        </p>
        <Button onClick={impor} disabled={!siap} className="h-9 min-w-32 shrink-0">
          <HugeiconsIcon
            icon={mengirim ? Loading03Icon : Upload01Icon}
            strokeWidth={2}
            className={mengirim ? "size-4 animate-spin" : "size-4"}
            aria-hidden
          />
          {mengirim ? "Mengimpor…" : "Impor"}
        </Button>
      </footer>
    </div>
  )
}
