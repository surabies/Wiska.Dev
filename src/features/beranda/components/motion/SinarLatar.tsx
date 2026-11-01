// features/beranda/components/motion/SinarLatar.tsx — versi ringan
// "Background Beams" ala Aceternity UI: Aceternity aslinya menganimasikan
// puluhan path SVG (mahal untuk dijalankan). Di sini diganti 3 blob
// gradient besar yang blur + drift pelan lewat keyframe CSS
// (--animate-beam-drift-a/b di globals.css) — kesan visual setara,
// jauh lebih murah untuk browser. Murni CSS, tidak butuh "use client".
export function BackgroundBeams() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="animate-beam-drift-a absolute top-1/2 left-1/4 size-105 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[100px]" />
      <div className="animate-beam-drift-b bg-emas/15 absolute top-1/3 right-1/4 size-95 rounded-full blur-[100px]" />
      <div className="animate-beam-drift-a absolute bottom-0 left-1/2 size-80 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[100px]" />
    </div>
  )
}
