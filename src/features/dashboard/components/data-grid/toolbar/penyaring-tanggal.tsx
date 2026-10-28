import * as React from "react"
import type { DateRange } from "react-day-picker"
import { id as localeId } from "react-day-picker/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import { CalendarDaysIcon } from "@hugeicons/core-free-icons"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  PINTASAN_TANGGAL,
  ringkasRentang,
  tanggalDariTeks,
  teksDariTanggal,
} from "../tanggal"
import { KELAS_KONTROL, KELAS_KONTROL_AKTIF } from "../tema"

/** Penyaring rentang tanggal: satu tombol ringkas -> Popover berisi Calendar
 *  shadcn (mode range) + pintasan. Klik pertama = tanggal awal, klik kedua =
 *  tanggal akhir lalu langsung diterapkan; klik di tanggal yang sama dua kali
 *  = satu hari. Rentang digambar dari state `draft` dan hanya dikirim ke grid
 *  setelah lengkap, supaya tidak ada permintaan dengan tanggal setengah terisi. */
export function PenyaringTanggal({
  label,
  dari,
  sampai,
  onTerapkan,
}: {
  label: string
  dari: string
  sampai: string
  onTerapkan: (dari: string, sampai: string) => void
}) {
  const mobil = useIsMobile()
  const [terbuka, setTerbuka] = React.useState(false)
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined)

  const tglDari = tanggalDariTeks(dari)
  const tglSampai = tanggalDariTeks(sampai)
  const aktif = Boolean(tglDari || tglSampai)

  function ubahTerbuka(buka: boolean) {
    if (buka) {
      setDraft(
        tglDari || tglSampai ? { from: tglDari, to: tglSampai } : undefined
      )
    }
    setTerbuka(buka)
  }

  function klikHari(hari: Date) {
    if (draft?.from && !draft.to) {
      const [awal, akhir] =
        hari < draft.from ? [hari, draft.from] : [draft.from, hari]
      setDraft({ from: awal, to: akhir })
      onTerapkan(teksDariTanggal(awal), teksDariTanggal(akhir))
      setTerbuka(false)
      return
    }
    setDraft({ from: hari, to: undefined })
  }

  return (
    <Popover open={terbuka} onOpenChange={ubahTerbuka}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(KELAS_KONTROL, aktif && KELAS_KONTROL_AKTIF)}
        >
          <HugeiconsIcon
            icon={CalendarDaysIcon}
            strokeWidth={2}
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">
            {ringkasRentang(tglDari, tglSampai)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto gap-0 overflow-hidden rounded-lg border-border p-0 shadow-overlay"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex gap-1 overflow-x-auto border-b border-border-subtle p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
            {PINTASAN_TANGGAL.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 justify-start rounded-md px-2.5 text-[13px] font-normal"
                onClick={() => {
                  onTerapkan(...p.rentang())
                  setTerbuka(false)
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              locale={localeId}
              numberOfMonths={mobil ? 1 : 2}
              defaultMonth={draft?.from ?? tglDari ?? new Date()}
              selected={draft}
              onDayClick={klikHari}
            />
            <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {draft?.from && !draft.to
                  ? "Pilih tanggal akhir"
                  : "Pilih tanggal awal lalu akhir"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-md px-2 text-xs"
                disabled={!aktif && !draft?.from}
                onClick={() => {
                  setDraft(undefined)
                  onTerapkan("", "")
                  setTerbuka(false)
                }}
              >
                Hapus
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
