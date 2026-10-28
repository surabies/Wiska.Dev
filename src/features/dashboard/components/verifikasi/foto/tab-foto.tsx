"use client";

// features/dashboard/components/verifikasi/tab-foto.tsx — tab tiga foto
// bukti laporan lapangan (stand meter / segel / rumah) dari aplikasi
// petugas. Dipakai dua tempat dengan varian berbeda:
// - "panel": preview kecil + dialog zoom (FotoBukti) di panel detail;
// - "zoom":  FotoZoom langsung, untuk kolom foto di modal verifikasi V1.
// Foto yang belum ada tetap punya tab-nya dengan empty state yang
// menjelaskan diri — jadi verifikator tahu foto itu memang tidak dikirim,
// bukan gagal termuat.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FotoBukti, FotoKosong, FotoZoom } from "./foto-bukti";

export interface ItemTabFoto {
  kunci: string;
  /** Judul tab, mis. "Stand meter". */
  label: string;
  url: string | null | undefined;
  /** Teks empty state bila foto tidak ada. */
  keteranganKosong?: string;
}

export function TabFoto({
  item,
  varian,
}: {
  item: ItemTabFoto[];
  varian: "panel" | "zoom";
}) {
  // Tab awal = foto pertama yang benar-benar ada, supaya panel tidak
  // terbuka di empty state padahal ada foto di tab sebelahnya.
  const awal = (item.find((t) => t.url) ?? item[0])?.kunci;

  return (
    <Tabs defaultValue={awal} className="gap-1.5">
      <TabsList className="h-7 w-full">
        {item.map((t) => (
          <TabsTrigger key={t.kunci} value={t.kunci} className="text-[11px]">
            {t.label}
            {!t.url && <span className="text-muted-foreground/60">·</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {item.map((t) => (
        <TabsContent key={t.kunci} value={t.kunci}>
          {varian === "panel" ? (
            <FotoBukti
              url={t.url}
              label={t.label}
              keterangan={t.keteranganKosong}
            />
          ) : t.url ? (
            <FotoZoom url={t.url} label={t.label} />
          ) : (
            <FotoKosong label={t.label} keterangan={t.keteranganKosong} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
