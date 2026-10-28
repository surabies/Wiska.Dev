"use client"

// Pemilih tema 3 pilihan (sistem / terang / gelap) di footer — padanan "Select a display theme"
// di nextjs.org: kapsul bulat berisi 3 tombol radio berikon, yang terpilih diberi latar putih + bayangan.
// Memakai next-themes (useTheme), seperti pengaturan standar shadcn/ui.
import { useId, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

const PILIHAN = [
  { nilai: "system", label: "sistem", ikon: ComputerIcon },
  { nilai: "light", label: "terang", ikon: Sun03Icon },
  { nilai: "dark", label: "gelap", ikon: Moon02Icon },
] as const

// Penanda "sudah di browser": false saat render di server / hidrasi, true setelahnya.
// Memakai useSyncExternalStore (bukan useState + useEffect) supaya lolos aturan
// react-hooks/set-state-in-effect dan tidak memicu render ganda.
const langganan = () => () => {}
const diBrowser = () => true
const diServer = () => false

export function FooterTema() {
  const { theme, setTheme } = useTheme()
  const id = useId()
  // Tema baru diketahui di browser; sebelum itu tidak ada radio yang dicentang (hindari mismatch hidrasi)
  const siap = useSyncExternalStore(langganan, diBrowser, diServer)

  return (
    <div className="flex items-center gap-2">
      <fieldset className="isolate m-0 flex h-6 w-fit rounded-full border-0 p-0 shadow-[0_0_0_1px_var(--border)]">
        <legend className="sr-only">Pilih tema tampilan:</legend>
        {PILIHAN.map((p) => (
          <span key={p.nilai} className="h-full">
            {/* Radio disembunyikan (appearance-none) tapi tetap bisa difokus keyboard; label bereaksi lewat "peer" */}
            <input
              type="radio"
              name={`tema-${id}`}
              id={`tema-${p.nilai}-${id}`}
              value={p.nilai}
              aria-label={p.label}
              checked={siap && theme === p.nilai}
              onChange={() => setTheme(p.nilai)}
              className="peer absolute m-0 appearance-none p-0 outline-none"
            />
            <label
              htmlFor={`tema-${p.nilai}-${id}`}
              className="group relative m-0 flex size-6 cursor-pointer items-center justify-center rounded-full bg-none text-muted-foreground hover:text-foreground peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-[0_0_0_1px_var(--border),0_1px_2px_0_rgb(0_0_0/0.08)] peer-focus-visible:text-foreground peer-focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
            >
              <span className="sr-only">{p.label}</span>
              <span className="relative z-1 size-4">
                <HugeiconsIcon icon={p.ikon} size={16} aria-hidden />
              </span>
            </label>
          </span>
        ))}
      </fieldset>
    </div>
  )
}