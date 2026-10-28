// Lokasi pencatatan di OpenStreetMap (tanpa API key), lebar penuh di bawah
// foto. Hanya ada di layar — di PDF diganti koordinat teks. Bila CSP memblokir
// iframe, tambahkan https://www.openstreetmap.org ke frame-src.
export function BlokLokasi({
  lokasi,
}: {
  lokasi: { lat: number; lng: number } | null
}) {
  return (
    <section aria-label="Lokasi" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Lokasi</h2>
        {lokasi && (
          <a
            href={`https://www.google.com/maps?q=${lokasi.lat},${lokasi.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Buka di Google Maps
          </a>
        )}
      </div>

      {lokasi ? (
        <iframe
          title={`Peta lokasi ${lokasi.lat}, ${lokasi.lng}`}
          src={
            `https://www.openstreetmap.org/export/embed.html?bbox=` +
            `${lokasi.lng - 0.003},${lokasi.lat - 0.0012},${lokasi.lng + 0.003},${lokasi.lat + 0.0012}` +
            `&layer=mapnik&marker=${lokasi.lat},${lokasi.lng}`
          }
          loading="lazy"
          className="h-72 w-full rounded-lg border border-border"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
          Koordinat pelanggan ini belum tercatat.
        </div>
      )}
    </section>
  )
}
