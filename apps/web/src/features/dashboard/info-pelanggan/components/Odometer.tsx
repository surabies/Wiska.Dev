// Odometer menampilkan angka stand meter dalam gaya roda angka: satu kotak per digit.
// Kotak berskala mengikuti lebar kartu dan memakai token warna tema.
export function Odometer({
  label,
  nilai,
  digit = 5,
}: {
  label: string
  nilai: number | null
  digit?: number
}) {
  const teks =
    nilai == null
      ? null
      : String(Math.max(0, Math.trunc(nilai))).padStart(digit, "0")

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {teks ? (
        <div
          role="img"
          aria-label={`${label} ${nilai?.toLocaleString("id-ID")}`}
          className="@container flex w-full max-w-64 justify-center gap-1"
        >
          {[...teks].map((d, i) => (
            <span
              key={i}
              aria-hidden
              className="flex aspect-3/4 min-w-0 flex-1 items-center justify-center rounded-sm bg-primary font-mono text-[clamp(1rem,11cqw,2.25rem)] font-medium text-primary-foreground tabular-nums ring-1 ring-background/10 ring-inset"
            >
              {d}
            </span>
          ))}
        </div>
      ) : (
        <span className="flex h-12 items-center text-3xl text-muted-foreground">
          —
        </span>
      )}
    </div>
  )
}
