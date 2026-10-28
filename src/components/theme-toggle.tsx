"use client"

// components/theme-toggle.tsx — pengalih tema terang/gelap.
//
// Ikonnya ditentukan CSS (`dark:` variant), BUKAN state React. Ini disengaja:
// tema sesungguhnya baru diketahui di client (localStorage / preferensi OS),
// jadi render server mustahil menebaknya. Pendekatan lazim `useState(mounted)`
// + useEffect memang menghindari hydration mismatch, tapi menyebabkan ikon
// baru muncul setelah hydrate (kedip) dan melanggar aturan lint
// react-hooks/set-state-in-effect.
//
// Karena next-themes menempelkan class `dark` di <html> SEBELUM React hydrate,
// membiarkan CSS yang memilih ikon membuat markup server & client identik —
// tanpa state, tanpa effect, tanpa kedip, dan ikon sudah benar sejak cat
// pertama.
import { useTheme } from "next-themes"
import { Moon, Sun } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-label="Ganti tema terang/gelap"
      title="Ganti tema terang/gelap"
      // resolvedTheme dibaca saat DIKLIK, bukan saat render — jadi tidak
      // pernah ikut menentukan markup awal dan aman dari mismatch.
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
    </Button>
  )
}
