import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Peta Pengaduan Air | PERUMDA Tirtawening",
  description:
    "Peta interaktif persebaran aduan gangguan air dan pelaporan warga PERUMDA Tirtawening Kota Bandung.",
}

// Layout khusus peta pengaduan: layar penuh viewport (fixed inset-0 h-screen w-screen),
// mandiri tanpa navbar dan tanpa sidebar dashboard.
export default function PetaPengaduanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-background">
      {children}
    </div>
  )
}
