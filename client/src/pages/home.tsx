import {
  HeroSection,
  BusinessSection,
  AttorneySection,
  BrokerSection,
  DiscoverySection,
} from "@/components/franchise/home-sections";

export default function Home() {
  return (
    <div data-testid="page-home">
      <HeroSection />
      <AttorneySection />
      <BrokerSection />
      <BusinessSection />
      <DiscoverySection />
    </div>
  );
}
