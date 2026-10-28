import type { Metadata } from "next"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"

export const metadata: Metadata = { title: "Pertanyaan Umum" }

// TODO: ganti dengan pertanyaan yang sering diajukan pelanggan.
const FAQ = [
  {
    tanya: "Di mana saya menemukan nomor langganan?",
    jawab: "Nomor langganan 11 digit tertera di rekening air Anda.",
  },
  {
    tanya: "Kapan angka meter harus dilaporkan?",
    jawab: "Contoh: setiap bulan sebelum tanggal tertentu. Isi dengan jadwal yang benar.",
  },
  {
    tanya: "Berapa lama laporan diverifikasi?",
    jawab: "Contoh: paling lama beberapa hari kerja. Isi dengan estimasi yang benar.",
  },
]

export default function Page() {
  return (
    <HalamanInfo judul="Pertanyaan Umum" deskripsi="Jawaban untuk pertanyaan yang paling sering diajukan pelanggan.">
      <Bagian judul="Pertanyaan yang sering diajukan">
        <KontenContoh>Pertanyaan dan jawaban di bawah hanya contoh. Ganti dengan isi yang benar.</KontenContoh>
        <div className="mt-4 divide-y divide-border rounded-lg border border-border">
          {FAQ.map((f) => (
            <details key={f.tanya} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground outline-none focus-visible:underline">
                {f.tanya}
                <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.jawab}</p>
            </details>
          ))}
        </div>
      </Bagian>
    </HalamanInfo>
  )
}