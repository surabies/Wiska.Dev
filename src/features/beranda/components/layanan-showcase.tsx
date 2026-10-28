// features/beranda/components/layanan-showcase.tsx — tiga layanan publik,
// gaya glass+spotlight di atas obsidian. Vinyet meniru elemen halaman
// aslinya sehingga warga sudah tahu apa yang akan mereka lihat sebelum
// mengklik. Kartu "Cek Tagihan" tetap memakai flag `nonaktif` yang sudah
// ada — logic disable TIDAK diubah, cuma tampilannya.
import Link from "next/link"
import { ArrowRight, Camera, CheckCircle2, Search, Ticket } from "@/components/ui/hugeicons-compat"
import { Reveal } from "./motion/reveal"
import { SpotlightCard } from "./motion/spotlight-card"

function VinyetCekTagihan() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5">
        <Search className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground">00401700010</span>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { p: "Mei 2026", s: "Lunas", ok: true },
          { p: "April 2026", s: "Lunas", ok: true },
          { p: "Maret 2026", s: "Jatuh tempo", ok: false },
        ].map((r) => (
          <div key={r.p} className="flex items-center justify-between border-b border-dashed border-border pb-2">
            <span className="text-xs text-foreground">{r.p}</span>
            <span
              className={
                "inline-flex items-center gap-1.5 text-[10px] font-semibold " +
                (r.ok ? "text-success" : "text-destructive")
              }
            >
              <span className={"size-1.5 rounded-full " + (r.ok ? "bg-success" : "bg-destructive")} />
              {r.s}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VinyetLaporMeter() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-col items-center gap-1.5 rounded-md border-2 border-dashed border-border py-5">
        <Camera className="size-5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Foto angka meter</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
        <span className="text-[11px] text-muted-foreground">Stand meter</span>
        <span className="font-mono text-sm font-bold text-foreground">
          3.955 <span className="font-sans text-[10px] font-normal text-muted-foreground">m³</span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 text-success" />
        <span className="text-[11px] text-muted-foreground">Menunggu verifikasi petugas</span>
      </div>
    </div>
  )
}

function VinyetPengaduan() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
        <span className="flex items-center gap-2">
          <Ticket className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">TKT-2606•••</span>
        </span>
        <span className="text-[10px] font-semibold text-warning">Sedang ditangani</span>
      </div>
      <ol className="mt-3 space-y-0">
        {["Diterima", "Ditugaskan ke petugas", "Sedang ditangani"].map((t, i, arr) => (
          <li key={t} className="relative flex gap-3 pb-3 last:pb-0">
            {i < arr.length - 1 && <span className="absolute top-3 left-0.75 h-full w-px bg-border" />}
            <span className={"mt-1.5 size-1.75 shrink-0 rounded-full " + (i === arr.length - 1 ? "bg-info" : "bg-muted-foreground/40")} />
            <span className="text-[11px] text-muted-foreground">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const LAYANAN = [
  {
    href: "/cek-tagihan",
    judul: "Cek tagihan & riwayat pemakaian",
    deskripsi:
      "Masukkan nomor langganan dan lihat sampai 12 periode terakhir: rincian biaya per komponen, status pembayaran, jatuh tempo, hingga grafik konsumsi air rumah Anda.",
    aksi: "Cek sekarang",
    Vinyet: VinyetCekTagihan,
    // Dinonaktifkan SEMENTARA — lihat catatan di nav-links.ts.
    nonaktif: true,
  },
  {
    href: "/lapor-meter",
    judul: "Lapor angka meter mandiri",
    deskripsi:
      "Petugas tidak sempat mampir bulan ini? Kirim sendiri angka meter beserta foto sebagai bukti. Satu laporan per bulan, diverifikasi petugas sebelum menjadi dasar perhitungan tagihan.",
    aksi: "Lapor meter",
    Vinyet: VinyetLaporMeter,
    nonaktif: false,
  },
  {
    href: "/pengaduan",
    judul: "Pengaduan gangguan & lacak tiket",
    deskripsi:
      "Pipa bocor, air keruh, atau meter rusak — laporkan dengan lokasi kejadian, lalu pantau perkembangannya lewat nomor tiket. Laporan kebocoran otomatis diprioritaskan.",
    aksi: "Buat pengaduan",
    Vinyet: VinyetPengaduan,
    nonaktif: false,
  },
] as const

export function LayananShowcase() {
  return (
    <section aria-labelledby="layanan-judul" className="border-b border-border bg-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-14 md:px-8 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-24">
            <p className="text-xs font-medium text-primary">Tiga layanan inti</p>
            <h2 id="layanan-judul" className="mt-3 text-3xl font-semibold tracking-tight text-balance">
              Dirancang untuk urusan yang biasanya butuh datang ke kantor.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Semuanya terbuka 24 jam, tanpa membuat akun. Sistem yang sama dipakai petugas di
              lapangan dan di kantor pelayanan — jadi laporan Anda masuk ke antrean kerja yang
              sungguhan, bukan kotak masuk yang tidak dibaca.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-8">
          {LAYANAN.map(({ href, judul, deskripsi, aksi, Vinyet, nonaktif }, i) => {
            const kelasIsi =
              "group flex flex-col justify-between gap-6 p-6 " + (i === 0 ? "sm:col-span-2 sm:flex-row sm:items-center" : "")

            const isi = (
              <div className={kelasIsi}>
                <div className={i === 0 ? "sm:max-w-sm" : ""}>
                  <h3 className="text-lg font-semibold tracking-tight">{judul}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{deskripsi}</p>
                  <span
                    className={
                      "mt-4 inline-flex items-center gap-1.5 text-sm font-medium " +
                      (nonaktif ? "text-muted-foreground" : "text-primary")
                    }
                  >
                    {nonaktif ? "Sementara tidak tersedia" : aksi}
                    {!nonaktif && (
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </span>
                </div>
                <div className={i === 0 ? "sm:w-72 sm:shrink-0" : ""}>
                  <Vinyet />
                </div>
              </div>
            )

            return (
              <Reveal key={href} delay={i * 0.08} className={i === 0 ? "sm:col-span-2" : ""}>
                {nonaktif ? (
                  <div
                    aria-disabled="true"
                    title="Sementara tidak tersedia"
                    className="cursor-not-allowed rounded-xl border border-border bg-muted/40 opacity-60"
                  >
                    {isi}
                  </div>
                ) : (
                  <Link href={href} className="block">
                    <SpotlightCard className="transition-colors">{isi}</SpotlightCard>
                  </Link>
                )}
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
