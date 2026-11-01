// Beranda /landing: hanya menyusun section. Isi teks ada di lib/landing/Konten.ts.
import { CtaSection } from "@/components/landing/sections/BagianAjakan"
import { FiturSection } from "@/components/landing/sections/FiturBagian"
import { HeroSection } from "@/components/landing/sections/BagianHero"
import { ShowcaseSection } from "@/components/landing/sections/BagianEtalase"
import { TemplateSection } from "@/components/landing/sections/TemplatBagian"
import { ToolingSection } from "@/components/landing/sections/BagianPeralatan"

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
