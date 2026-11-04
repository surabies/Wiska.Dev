import { BenefitsSection } from "@/components/home/BenefitsSection";
import { FeatureSection } from "@/components/home/FeatureSection";
import { HeroSection } from "@/components/home/HeroSection";
import { TicketingSection } from "@/components/home/TicketingSection";
import { TopEventsSection } from "@/components/home/TopEventsSection";
import {
  benefitsContent,
  featureSections,
  heroContent,
  ticketingContent,
  topEventsContent,
} from "@/data/home";

export default function HomePage() {
  return (
    <>
      <HeroSection content={heroContent} />
      <TopEventsSection content={topEventsContent} />
      <TicketingSection content={ticketingContent} />
      <BenefitsSection content={benefitsContent} />
      {featureSections.map((section) => (
        <FeatureSection key={section.id} section={section} />
      ))}
    </>
  );
}
