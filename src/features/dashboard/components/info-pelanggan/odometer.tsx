// Angka stand meter dalam gaya roda angka meter air: satu kotak per digit.
// Warna tetap (navy) supaya sama dengan lembar cetak/PDF.
// Angka stand meter dalam gaya roda angka meter air: satu kotak per digit.
// Kotak berskala mengikuti lebar kartu (container query), selalu di tengah.
// Warna memakai token primary, otomatis terbalik di tema gelap.
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
    nilai == null ? null : String(Math.max(0, Math.trunc(nilai))).padStart(digit, "0")

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
              className="flex aspect-3/4 min-w-0 flex-1 items-center justify-center rounded-sm bg-primary font-mono text-[clamp(1rem,11cqw,2.25rem)] font-medium tabular-nums text-primary-foreground ring-1 ring-inset ring-background/10"
            >
              {d}
            </span>
          ))}
        </div>
      ) : (
        <span className="flex h-12 items-center text-3xl text-muted-foreground">—</span>
      )}
    </div>
  )
}