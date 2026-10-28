import type { Metadata } from "next"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"

export const metadata: Metadata = { title: "Tarif Air" }

// TODO: isi dengan tarif resmi sesuai peraturan yang berlaku.
const TARIF = [
  { golongan: "Contoh: Rumah Tangga", keterangan: "Isi golongan tarif", tarif: "—" },
  { golongan: "Contoh: Niaga", keterangan: "Isi golongan tarif", tarif: "—" },
  { golongan: "Contoh: Sosial", keterangan: "Isi golongan tarif", tarif: "—" },
]

export default function Page() {
  return (
    <HalamanInfo
      judul="Tarif Air"
      deskripsi="Daftar tarif air berdasarkan golongan pelanggan PERUMDA Tirtawening."
    >
      <Bagian judul="Tarif per golongan">
        <KontenContoh>Angka tarif belum diisi. Ganti dengan tarif resmi sebelum halaman dipublikasikan.</KontenContoh>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Golongan</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3 font-medium">Tarif</th>
              </tr>
            </thead>
            <tbody>
              {TARIF.map((t) => (
                <tr key={t.golongan} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{t.golongan}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.keterangan}</td>
                  <td className="px-4 py-3 text-foreground">{t.tarif}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bagian>

      <Bagian judul="Catatan">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Tambahkan keterangan biaya beban, pajak, atau denda keterlambatan di sini.</li>
          <li>Cantumkan dasar hukum dan tanggal berlaku tarif.</li>
        </ul>
      </Bagian>
    </HalamanInfo>
  )
}