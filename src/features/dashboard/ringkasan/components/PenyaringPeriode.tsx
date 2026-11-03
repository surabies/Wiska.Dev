"use client"

// features/dashboard/ringkasan/components/PenyaringPeriode.tsx — filter periode (shadcn Select).
//
// Satu kontrol utuh: sel ikon kalender (latar putih) + Select (latar abu tipis)
// dalam SATU bingkai bersudut membulat dengan garis pemisah, seperti contoh
// filter waktu. Pilihan disimpan di URL (?periode=...) supaya halaman server
// membaca ulang datanya. Komponen ini hanya mengurus tampilan + navigasi;
// daftar opsi dan nilai terpilih dikirim dari page.tsx.
import { useMemo, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Calendar } from "@/components/ui/hugeicons-compat"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/Utilitas"

export type OpsiPeriode = { value: string; label: string }

export function FilterPeriode({
  opsi,
  nilai,
  className,
}: {
  opsi: OpsiPeriode[]
  /** Nilai terpilih saat ini (idealnya ada di `opsi`). */
  nilai: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulai] = useTransition()

  // Bila nilai terpilih tidak ada di daftar (mis. periode dari URL yang
  // belum terdaftar), Select akan tampil kosong. Tambahkan sebagai opsi
  // supaya pilihan aktif selalu terlihat.
  const opsiAman = useMemo(() => {
    if (!nilai || opsi.some((o) => o.value === nilai)) return opsi
    return [{ value: nilai, label: nilai }, ...opsi]
  }, [opsi, nilai])

  function ganti(v: string) {
    if (v === nilai) return
    // Pertahankan query param lain; hanya `periode` yang diganti.
    const params = new URLSearchParams(searchParams.toString())
    params.set("periode", v)
    mulai(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div
      className={cn(
        "inline-flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background transition-opacity",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        pending && "opacity-70",
        className
      )}
    >
      <div
        aria-hidden
        className="flex w-9 shrink-0 items-center justify-center border-r border-input text-muted-foreground"
      >
        <Calendar strokeWidth={1.6} className="size-4" />
      </div>
      <Select value={nilai} onValueChange={ganti} disabled={pending}>
        <SelectTrigger
          size="lg"
          aria-label="Pilih periode"
          className="min-w-36 gap-3 rounded-none border-0 bg-muted/60 px-3 text-sm font-medium shadow-none hover:bg-muted focus-visible:ring-0"
        >
          <SelectValue placeholder="Pilih periode" />
        </SelectTrigger>
        <SelectContent align="end">
          {opsiAman.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
