// KerangkaMemuat menampilkan placeholder selama data dimuat.
import { PanelDasbor } from "../../shared/PanelDasbor"

function Blok({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />
}

export function KerangkaMemuat() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat data pelanggan"
      className="flex flex-col gap-6"
    >
      <PanelDasbor label="Profil pelanggan">
        <div className="flex flex-col gap-3">
          <Blok className="h-9 w-72 max-w-full" />
          <Blok className="h-4 w-96 max-w-full" />
        </div>
      </PanelDasbor>
      <PanelDasbor label="Stand meter dan pemakaian">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.15fr]">
          <Blok className="h-28" />
          <Blok className="h-28" />
          <Blok className="h-28" />
        </div>
      </PanelDasbor>
      <div className="grid gap-3 lg:grid-cols-2">
        <PanelDasbor label="Pemakaian per periode">
          <Blok className="h-64" />
        </PanelDasbor>
        <PanelDasbor label="Rincian pencatatan">
          <Blok className="h-64" />
        </PanelDasbor>
      </div>
      <PanelDasbor label="Foto lapangan">
        <div className="grid gap-4 sm:grid-cols-3">
          <Blok className="aspect-3/4" />
          <Blok className="aspect-3/4" />
          <Blok className="aspect-3/4" />
        </div>
      </PanelDasbor>
      <PanelDasbor label="Lokasi">
        <Blok className="h-72" />
      </PanelDasbor>
    </div>
  )
}
