// Placeholder berdenyut selama data dimuat, mengikuti tata letak halaman.
function Blok({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />
}

export function KerangkaMemuat() {
  return (
    <div aria-busy="true" aria-label="Memuat data pelanggan" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Blok className="h-9 w-72 max-w-full" />
        <Blok className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.15fr]">
        <Blok className="h-28" />
        <Blok className="h-28" />
        <Blok className="h-28" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Blok className="h-64" />
        <Blok className="h-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Blok className="aspect-square" />
        <Blok className="aspect-square" />
        <Blok className="aspect-square" />
      </div>
    </div>
  )
}
