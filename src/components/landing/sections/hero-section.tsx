// Hero: latar (canvas di tema terang, titik putih pudar di tema gelap), tulisan besar "PW5"
// (garis tepi neon berwarna yang memudar), judul, deskripsi, dan kotak status.
import { LatarHero } from "@/components/landing/latar-hero"
import { HERO } from "@/lib/landing/content"

// Warna tiap huruf: P hijau, W biru, 5 abu-abu. Terang = lebih jenuh, gelap = lebih terang.
const HURUF = [
  { h: "P", warna: "stroke-[#46b536] dark:stroke-[#7bf06a]" },
  { h: "W", warna: "stroke-[#1a7fe0] dark:stroke-[#4db5ff]" },
  { h: "5", warna: "stroke-[#6d6e71] dark:stroke-[#d1d2d6]" },
] as const

// Atribut yang sama untuk semua lapis teks supaya posisinya persis berimpit.
const ATRIBUT_TEKS = {
  x: 250,
  y: 160,
  textAnchor: "middle" as const,
  textRendering: "geometricPrecision" as const,
  style: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 200,
  },
}

// Animasi denyut neon. Berhenti otomatis bila pengguna memilih "reduce motion".
const GAYA_NEON = `
@keyframes tirta-nyala { 0%, 100% { opacity: 1 } 50% { opacity: .78 } }
.tirta-neon { animation: tirta-nyala 4.5s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .tirta-neon { animation: none } }
`

// Tiga huruf berwarna sebagai <tspan>, dipakai ulang oleh tiap lapis teks.
function Huruf() {
  return (
    <>
      {HURUF.map(({ h, warna }) => (
        <tspan key={h} className={warna}>
          {h}
        </tspan>
      ))}
    </>
  )
}

// Tulisan besar dekoratif dengan efek neon. Urutan lapis dari bawah:
//  1) cahaya jauh  : garis lebar + blur besar, lembut
//  2) cahaya dekat : garis sedang + blur kecil, lebih terang
//  3) garis tajam  : inti tabung neon
//  4) isi warna latar: menutup bagian dalam, jadi cahaya hanya terlihat di luar huruf
function TulisanMerek() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 500 180"
      className="pointer-events-none block w-full max-w-sm select-none overflow-visible sm:max-w-md lg:max-w-2xl"
    >
      <defs>
        <style>{GAYA_NEON}</style>

        <filter id="tirta-cahaya-jauh" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="tirta-cahaya-dekat" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>

        {/* Gradasi mask: terlihat penuh di atas, hilang total sebelum dasar huruf. */}
        <linearGradient id="tirta-pudar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.3" stopColor="#fff" />
          <stop offset="0.8" stopColor="#000" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        {/* Area mask dibuat lebih luas supaya cahaya di tepi tidak terpotong. */}
        <mask id="tirta-mask" maskUnits="userSpaceOnUse" x="-120" y="-80" width="740" height="320">
          <rect x="-120" y="-80" width="740" height="320" fill="url(#tirta-pudar)" />
        </mask>
      </defs>

      <g mask="url(#tirta-mask)">
        {/* Lapis cahaya (berdenyut pelan) */}
        <g className="tirta-neon">
          <text
            {...ATRIBUT_TEKS}
            fill="none"
            strokeWidth={7}
            strokeLinejoin="round"
            filter="url(#tirta-cahaya-jauh)"
            className="opacity-50 dark:opacity-90"
          >
            <Huruf />
          </text>
          <text
            {...ATRIBUT_TEKS}
            fill="none"
            strokeWidth={4}
            strokeLinejoin="round"
            filter="url(#tirta-cahaya-dekat)"
            className="opacity-60 dark:opacity-100"
          >
            <Huruf />
          </text>
        </g>

        {/* Garis tajam: inti neon */}
        <text
          {...ATRIBUT_TEKS}
          fill="none"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="opacity-90 dark:opacity-100"
        >
          <Huruf />
        </text>

        {/* Isi warna latar: menutup bagian dalam garis dan cahaya */}
        <text {...ATRIBUT_TEKS} className="fill-background" stroke="none">
          {HURUF.map(({ h }) => h).join("")}
        </text>
      </g>
    </svg>
  )
}

function KotakStatus({ teks }: { teks: string }) {
  return (
    <div className="flex h-10 max-w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-0">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
      <span className="min-w-0 truncate text-sm">{teks}</span>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Latar. Terang: opacity-60 + pudar atas-bawah (seperti sebelumnya).
          Gelap: opacity penuh (kepekatan titik diatur di LatarHero) + pudar melingkar
          di semua sisi, jadi titik menghilang halus ke latar gelap. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 mask-[linear-gradient(to_bottom,transparent,black_15%,black_65%,transparent)] dark:opacity-100 dark:mask-[radial-gradient(ellipse_80%_85%_at_50%_45%,black_30%,transparent_100%)]"
      >
        <LatarHero />
      </div>

      {/* Konten: pointer-events-none agar sorotan kursor tetap menjangkau latar di belakangnya.
          Padding atas dinaikkan agar jarak dari navbar ke tulisan PW5 menyamai halaman Next.js. */}
      <div className="pointer-events-none mx-auto flex w-full max-w-362 flex-col items-center px-5 pt-14 pb-12 text-center sm:min-h-136 sm:px-4 sm:pt-20 sm:pb-16 lg:min-h-176 lg:px-6 lg:pt-28 lg:pb-24">
        <TulisanMerek />

        {/* HP: jarak dilonggarkan agar judul tidak menimpa dasar huruf. Layar lebih besar: sama seperti sebelumnya. */}
        <div className="relative -mt-2 flex max-w-2xl flex-col items-center gap-5 sm:-mt-10 sm:gap-6 lg:-mt-14">
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {HERO.judul}
          </h1>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            {HERO.deskripsiAwal} <strong className="font-medium text-foreground">{HERO.deskripsiTebal}</strong>{" "}
            {HERO.deskripsiAkhir}
          </p>
        </div>

        <div className="mt-8 sm:mt-10">
          <KotakStatus teks={HERO.lencana} />
        </div>
      </div>
    </section>
  )
}