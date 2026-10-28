// Hero beranda PERUMDA Tirtawening — memakai pola komposisi HeroColorPanels.
// Perubahan: semua konten rata kiri di semua ukuran layar (sebelumnya
// campuran tengah di mobile / kiri di desktop), padding mobile lebih lega,
// tombol CTA penuh lebar di mobile, dan visual mobile lebih terlihat.
import { ArrowUpRight } from "@/components/ui/hugeicons-compat"
import Link from "next/link"
import { HaloBadge } from "@/components/ui/halo-badge"
import { HaloButton } from "@/components/ui/halo-button"
import {
  HeroColorPanelsActions,
  HeroColorPanelsContainer,
  HeroColorPanelsContent,
  HeroColorPanelsDescription,
  HeroColorPanelsHeading,
  HeroColorPanelsRoot,
  HeroColorPanelsVisual,
} from "@/components/ui/hero-color-panel"
import { Reveal } from "./motion/reveal"
import { TextReveal } from "./motion/text-reveal"

// Palet bernuansa air, dipakai bersama oleh versi desktop dan mobile.
const shaderBase = {
  colors: ["#0284c7", "#22d3ee", "#14b8a6", "#38bdf8"],
  colorBack: "#ffffff00",
  density: 5.03,
  angle1: 0.68,
  angle2: 0.28,
  length: 1.13,
  edges: true,
  blur: 0.25,
  fadeIn: 0.85,
  fadeOut: 0.3,
  gradient: 0.56,
  speed: 1,
  scale: 0.96,
  rotation: 180,
}

const desktopShaderProps = {
  ...shaderBase,
  width: 1280,
  height: 720,
}

const mobileShaderProps = {
  ...shaderBase,
}

// Teks dan ikon dibungkus satu span (pola "non-string children" HaloButton)
// supaya dianggap satu label dan tidak pecah ke baris berikutnya.
const labelTombol = "inline-flex items-center gap-2 whitespace-nowrap"

export function Hero() {
  return (
    <HeroColorPanelsRoot
      aria-labelledby="hero-judul"
      srTitle="Jernih airnya, jelas tagihannya."
      title=""
      subtitle=""
      description="Cek tagihan, lapor angka meter, dan sampaikan gangguan air tanpa antre. Setiap laporan diverifikasi petugas."
      showBadges={false}
      desktopShaderProps={desktopShaderProps}
      mobileShaderProps={mobileShaderProps}
      className="isolate border-b border-border bg-background text-foreground"
    >
      <HeroColorPanelsContainer className="mx-auto w-full max-w-6xl px-5 pt-6 pb-10 sm:pt-10 sm:pb-12 md:px-8 lg:pt-12 lg:pb-16">
        <HeroColorPanelsContent className="items-start! text-left! sm:px-0 md:px-0 lg:pl-0 xl:pl-0 2xl:pl-0">
          <Reveal>
            <div className="flex justify-start">
              <HaloBadge
                live
                variant="secondary"
                className="text-xs font-medium text-muted-foreground"
                interactive={false}
              >
                Layanan Aktif · 24 Jam
              </HaloBadge>
            </div>
          </Reveal>

          <HeroColorPanelsHeading className="items-start! justify-start! text-left! pt-0 sm:pt-0">
            <h2
              id="hero-judul"
              className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-6xl"
            >
              <TextReveal
                text="Urusan Air Anda,"
                className="text-foreground"
              />
              <br />
              <TextReveal
                text="Selesai dalam Genggaman."
                className="text-muted-foreground"
              />
            </h2>
          </HeroColorPanelsHeading>

          <Reveal delay={0.15}>
            <HeroColorPanelsDescription
              className="mx-0! text-left! lg:max-w-lg"
              descriptionClassName="!text-left text-base leading-relaxed text-muted-foreground sm:text-base lg:text-base xl:text-base"
            />
          </Reveal>

          <Reveal delay={0.25}>
            <HeroColorPanelsActions className="w-full max-w-lg">
              {/* Lebar diatur pembungkus (pola dokumentasi HaloButton):
                  1 kolom di mobile, 2 kolom sama lebar mulai sm. */}
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="w-full">
                  <HaloButton
                    render={<Link href="/pengaduan" />}
                    nativeButton={false}
                    translucent={false}
                  >
                    <span className={labelTombol}>
                      Laporkan gangguan air
                      <ArrowUpRight aria-hidden className="size-4 shrink-0" />
                    </span>
                  </HaloButton>
                </div>
                <div className="w-full">
                  <HaloButton
                    render={<Link href="/lapor-meter" />}
                    nativeButton={false}
                  >
                    <span className={labelTombol}>
                      Lapor angka meter
                      <ArrowUpRight
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    </span>
                  </HaloButton>
                </div>
              </div>
            </HeroColorPanelsActions>
          </Reveal>
        </HeroColorPanelsContent>

        <HeroColorPanelsVisual desktopClassName="rounded-full dark:opacity-90" />
      </HeroColorPanelsContainer>
    </HeroColorPanelsRoot>
  )
}