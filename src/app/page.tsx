// Beranda /landing: hanya menyusun section. Isi teks ada di lib/landing/content.ts.
import { CtaSection } from "@/components/landing/sections/cta-section"
import { FiturSection } from "@/components/landing/sections/fitur-section"
import { HeroSection } from "@/components/landing/sections/hero-section"
import { ShowcaseSection } from "@/components/landing/sections/showcase-section"
import { TemplateSection } from "@/components/landing/sections/template-section"
import { ToolingSection } from "@/components/landing/sections/tooling-section"

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FiturSection />
      <ToolingSection />
      <ShowcaseSection />
      <TemplateSection />
      <CtaSection />
    </>
  )
}
