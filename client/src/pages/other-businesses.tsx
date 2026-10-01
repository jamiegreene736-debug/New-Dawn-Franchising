import { DiscoveryCallLink } from "@/components/franchise/discovery-call-link";

const opportunities = [
  {
    id: "telecom",
    icon: "⌁",
    label: "01 / TELECOM",
    title: "Keep people connected.",
    description:
      "A service business centered on connectivity, with centralized sales workflows, training, and reporting tools.",
    support: [
      "Sales and service workflows",
      "Team training and operational support",
      "Owner oversight and performance reporting",
    ],
  },
  {
    id: "insurance",
    icon: "◇",
    label: "02 / INSURANCE",
    title: "Build lasting relationships.",
    description:
      "A client-service business with systems and training to support the operating team you lead.",
    support: [
      "Client relationship workflows",
      "Operational training and support",
      "Owner direction and team supervision",
    ],
  },
] as const;

export default function OtherBusinessesPage() {
  return (
    <div className="other-page" data-testid="page-other-businesses">
      <section className="section other-intro">
        <a className="textlink" href="/">
          ← Back to property management
        </a>
        <div className="eyebrow">OTHER SUPPORTED BUSINESSES</div>
        <h1>
          More ways to build
          <br />
          <span>your American chapter.</span>
        </h1>
        <p>
          Property management is our lead franchise opportunity.
          <br />
          If your interests point elsewhere, explore these other supported
          business verticals with our team.
        </p>
      </section>
      <section
        className="section other-options"
        aria-label="Supported business verticals"
      >
        {opportunities.map((opportunity) => (
          <article key={opportunity.id}>
            <span className="other-icon" aria-hidden="true">
              {opportunity.icon}
            </span>
            <div className="eyebrow">{opportunity.label}</div>
            <h2>{opportunity.title}</h2>
            <p>{opportunity.description}</p>
            <ul>
              {opportunity.support.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <DiscoveryCallLink placement={opportunity.id} />
            <a
              className="v6-resource-link other-detail-link"
              href={`/${opportunity.id}`}
            >
              More about {opportunity.id} ↗
            </a>
          </article>
        ))}
      </section>
      <section className="section other-return">
        <div>
          <div className="eyebrow">START WITH OUR LEAD OPPORTUNITY</div>
          <h2>Explore property management.</h2>
          <p>
            Understand the model, your role, and the support behind your
            business.
          </p>
        </div>
        <a className="textlink" href="/#opportunities">
          See the franchise <span aria-hidden="true">↗</span>
        </a>
      </section>
    </div>
  );
}
