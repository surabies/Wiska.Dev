// features/beranda/components/motion/shimmer-button.tsx — CTA dengan border
// gradient berputar (pola "Moving Border Button" ala Aceternity UI, murni
// CSS + keyframe `--animate-shimmer-spin` dari globals.css, tanpa JS
// tambahan). Membungkus `Button` shadcn yang sudah ada (bukan komponen
// baru dari nol) — cuma menimpa tampilannya lewat className, perilaku
// (asChild/Slot, focus ring, disabled) tetap punya Button.
//
// Warna border SENGAJA cyan → emas (#e8c170) → cyan, BUKAN gradasi tiga
// warna cyan-emerald-violet seperti versi awal — inilah SATU-SATUNYA
// tempat token `emas` (globals.css) boleh muncul selain badge kecil
// sesekali. Lihat aturan palet di globals.css: emas dipakai hemat di
// "titik tanda tangan" seperti ini, bukan disebar ke seluruh halaman.
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

export function ShimmerButton({ className, children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn("h-11 gap-2 px-5 text-sm font-medium shadow-panel", className)}
    >
      {children}
    </Button>
  )
}
