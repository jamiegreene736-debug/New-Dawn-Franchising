import {
  HeroSection,
  BusinessSection,
  PathwaySection,
  InvestmentSection,
  DiscoverySection,
} from "@/components/franchise/home-sections";

export default function Home() {
  return (
    <div data-testid="page-home">
      <HeroSection />
      <BusinessSection />
      <PathwaySection />
      <InvestmentSection />
      <DiscoverySection />
    </div>
  );
}
