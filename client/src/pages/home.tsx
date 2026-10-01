import {
  HeroSection,
  BusinessSection,
  ProfessionalPathsSection,
  DiscoverySection,
} from "@/components/franchise/home-sections";

export default function Home() {
  return (
    <div data-testid="page-home">
      <HeroSection />
      <BusinessSection />
      <ProfessionalPathsSection />
      <DiscoverySection />
    </div>
  );
}
