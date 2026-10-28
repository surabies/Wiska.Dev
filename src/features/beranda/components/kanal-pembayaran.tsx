// features/beranda/components/kanal-pembayaran.tsx — strip kepercayaan,
// berjalan otomatis (marquee) — pola umum "logo ticker" tapi isinya jujur:
// kanal pembayaran yang memang dimodelkan sistem ini (enum KanalPembayaran
// + contoh penyelenggara di prisma/tagihan.prisma), bukan logo pihak
// ketiga yang belum tentu boleh dipakai.
//
// Daftar digandakan 2x lewat dua <ul> bersebelahan di dalam satu wrapper
// yang digeser -50% tanpa henti (animate-marquee, globals.css). Berhenti
// sejenak saat di-hover (supaya bisa dibaca/diklik kalau perlu), dan
// berhenti TOTAL (kembali ke daftar tunggal, scroll manual) kalau
// prefers-reduced-motion — murni lewat variant Tailwind `motion-reduce:`,
// tanpa JS.
//
// PRESISI -50%: SENGAJA tidak ada `gap` di level wrapper (track) antara
// kedua <ul> — gap di sana ditambal lewat `pr-3` di ujung KANAN tiap <ul>
// (nilainya sama persis dengan `gap-3` antar-chip di dalamnya). Sempat
// dicoba pola lazim "gap-3 di wrapper", dan lompatannya SELALU meleset
// setengah nilai gap (matematis: total lebar wrapper = 2×(lebar satu
// salinan) + SATU gap penghubung, sedangkan setengahnya cuma menggeser
// sejauh lebar-satu-salinan + SETENGAH gap — kurang tepat setengah gap
// setiap putaran). Dengan gap dipindah jadi padding-kanan MILIK
// masing-masing salinan, setiap salinan jadi unit genap yang membawa
// spacer-nya sendiri — lebar wrapper otomatis PERSIS 2× lebar satu unit,
// jadi -50% selalu tepat tanpa perlu tempelan `calc()`.
//
// Wrapper marquee SENGAJA di dalam kontainer max-w-6xl yang sama dengan
// judul (bukan full-bleed selebar viewport seperti versi awal) — sejalan
// dengan lebar seksi lain di beranda, overflow-nya terjadi DI DALAM kotak
// itu (bukan menabrak tepi layar).
import { Landmark, Store, QrCode, Building2, RefreshCw, Wallet } from "@/components/ui/hugeicons-compat"
import { Reveal } from "./motion/reveal"

const KANAL = [
  { icon: Landmark, label: "Teller Kantor", detail: "Loket pelayanan" },
  { icon: QrCode, label: "QRIS", detail: "Semua aplikasi pembayaran" },
  { icon: Building2, label: "Virtual Account", detail: "Transfer bank" },
  { icon: Store, label: "Minimarket", detail: "Jaringan PPOB" },
  { icon: Wallet, label: "PPOB Bank", detail: "Kanal perbankan" },
  { icon: RefreshCw, label: "Autodebet", detail: "Potong otomatis" },
] as const

function ChipKanal({ icon: Icon, label, detail }: (typeof KANAL)[number]) {
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted">
      <Icon className="size-4 text-info" aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium whitespace-nowrap text-foreground">{label}</span>
        <span className="text-[11px] whitespace-nowrap text-muted-foreground">{detail}</span>
      </span>
    </div>
  )
}

export function KanalPembayaran() {
  return (
    <section aria-labelledby="kanal-judul" className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-12 md:px-8">
        <Reveal>
          <h2 id="kanal-judul" className="text-xs font-medium text-muted-foreground">
            Bayar lewat kanal yang sudah Anda kenal
          </h2>
        </Reveal>

        <div className="group relative mt-5 overflow-hidden rounded-2xl motion-reduce:overflow-x-auto motion-reduce:pb-1">
          {/* Vinyet tepi kiri/kanan — menyamarkan potongan chip di batas
             kotak supaya marquee terasa mengalir keluar-masuk, bukan
             terpotong kasar. Disembunyikan saat reduced-motion (daftar
             tunggal statis tidak butuh efek ini). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-background to-transparent motion-reduce:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-background to-transparent motion-reduce:hidden"
          />

          <div className="flex w-max animate-marquee group-hover:paused motion-reduce:w-full motion-reduce:animate-none">
            <ul className="flex shrink-0 gap-3 pr-3">
              {KANAL.map((k) => (
                <li key={k.label}>
                  <ChipKanal {...k} />
                </li>
              ))}
            </ul>
            {/* Salinan kedua — murni visual untuk kontinuitas loop, disembunyikan
               dari pembaca layar DAN dari tampilan saat reduced-motion. */}
            <ul aria-hidden="true" className="flex shrink-0 gap-3 pr-3 motion-reduce:hidden">
              {KANAL.map((k) => (
                <li key={k.label}>
                  <ChipKanal {...k} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
