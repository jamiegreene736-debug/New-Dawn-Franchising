import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, Cpu, ShieldCheck, Banknote, Handshake, MapPin, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// French (fr) investor landing page.
//
// ⚠️  FIRST-PASS TRANSLATION — NEEDS NATIVE-SPEAKER REVIEW BEFORE PROMOTION.
// Solid working draft of the English value proposition; have a native French
// speaker (ideally familiar with the E-2 investor audience) review before this
// page is featured in outreach/ads.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = "https://www.newdawnfranchising.com";
const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

const SEO = {
  title: "New Dawn Franchising | Franchises pour les investisseurs du visa E-2",
  description:
    "Franchiseur multisectoriel pour les investisseurs du visa E-2. Choisissez parmi trois franchises à revenus récurrents — Gestion immobilière, Télécommunications (VoIP) ou Assurance. Vous dirigez l'entreprise ; nos équipes gèrent les opérations quotidiennes. FDD disponible sur demande.",
  canonical: `${SITE}/fr`,
};

const VERTICALS = [
  {
    icon: <Building2 className="size-5 text-primary" />,
    title: "Gestion immobilière",
    desc: "Revenus récurrents issus des honoraires de gestion locative. Notre équipe gère les locataires, l'entretien et les encaissements pendant que vous supervisez l'entreprise.",
  },
  {
    icon: <Cpu className="size-5 text-primary" />,
    title: "Télécommunications (VoIP)",
    desc: "Services de téléphonie d'entreprise dans le cloud avec facturation mensuelle récurrente. Une catégorie en croissance, avec des clients commerciaux de long terme.",
  },
  {
    icon: <ShieldCheck className="size-5 text-primary" />,
    title: "Assurance",
    desc: "Une agence d'assurance avec des commissions de renouvellement récurrentes. Constituez un portefeuille de polices qui génère des revenus année après année.",
  },
];

const BENEFITS = [
  {
    icon: <Banknote className="size-5 text-primary" />,
    title: "Modèle de revenus récurrents",
    desc: "Les trois franchises reposent sur des revenus mensuels ou de renouvellement, et non sur des ventes ponctuelles.",
  },
  {
    icon: <Handshake className="size-5 text-primary" />,
    title: "Nos équipes gèrent l'entreprise",
    desc: "Vous dirigez la franchise et contrôlez vos finances ; nos équipes s'occupent des opérations quotidiennes.",
  },
  {
    icon: <MapPin className="size-5 text-primary" />,
    title: "Territoires protégés",
    desc: "Exploitez un territoire défini, soutenu par notre technologie et notre expérience.",
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: "FDD disponible sur demande",
    desc: "Le Document d'information sur la franchise (FDD) est disponible lorsque vous êtes prêt à l'examiner.",
  },
];

function useFrSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    document.title = SEO.title;
    document.documentElement.lang = "fr";

    const created: HTMLElement[] = [];

    const setMeta = (selector: string, attr: string, key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', "name", "description", SEO.description);

    const addLink = (rel: string, href: string, hreflang?: string) => {
      const link = document.createElement("link");
      link.setAttribute("rel", rel);
      link.setAttribute("href", href);
      if (hreflang) link.setAttribute("hreflang", hreflang);
      document.head.appendChild(link);
      created.push(link);
    };
    addLink("canonical", SEO.canonical);
    addLink("alternate", `${SITE}/`, "en");
    addLink("alternate", `${SITE}/es`, "es");
    addLink("alternate", `${SITE}/fr`, "fr");
    addLink("alternate", `${SITE}/zh`, "zh");
    addLink("alternate", `${SITE}/ja`, "ja");
    addLink("alternate", `${SITE}/ko`, "ko");
    addLink("alternate", `${SITE}/tr`, "tr");
    addLink("alternate", `${SITE}/`, "x-default");

    return () => {
      document.title = prevTitle;
      document.documentElement.lang = prevLang;
      created.forEach((el) => el.remove());
    };
  }, []);
}

export default function FrPage() {
  useFrSeo();

  return (
    <div data-testid="page-fr" lang="fr" className="min-h-screen">
      {/* Hero */}
      <section data-testid="section-fr-hero" className="border-b">
        <div className="nh-container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/70">
              Franchises pour les investisseurs du visa E-2
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Devenez propriétaire d'une franchise aux États-Unis avec le visa E-2
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              <span translate="no">New Dawn Franchising</span> est un franchiseur multisectoriel pour
              les investisseurs du visa E-2. Choisissez parmi trois franchises à revenus récurrents
              — Gestion immobilière, Télécommunications (VoIP) ou Assurance. Vous dirigez l'entreprise
              et contrôlez vos finances ; nos équipes gèrent les opérations quotidiennes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-fr-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Demander des informations
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-fr-calendly" variant="secondary" className="gap-2" asChild>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
                  Planifier un appel
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              Vous préférez lire en anglais ?{" "}
              <Link href="/" className="underline underline-offset-2 hover:text-foreground" translate="no">
                Voir le site en English
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section data-testid="section-fr-verticals" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Trois franchises. Un modèle de revenus récurrents.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Choisissez le secteur qui correspond le mieux à vos objectifs d'investisseur.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {VERTICALS.map((v) => (
              <Card key={v.title} className="nh-surface border-card-border/80 p-6">
                <div className="grid size-11 place-items-center rounded-xl border bg-white/70 shadow-sm">
                  {v.icon}
                </div>
                <div className="mt-4 text-lg font-semibold">{v.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section data-testid="section-fr-benefits" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Pourquoi <span translate="no">New Dawn Franchising</span> ?
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm">
                  {b.icon}
                </div>
                <div>
                  <div className="text-base font-semibold">{b.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section data-testid="section-fr-cta">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white/60 p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Parlons de votre parcours avec le visa E-2
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Parlez-nous de vos objectifs et nous vous expliquerons le fonctionnement du modèle de
              franchise. Nous accompagnons des investisseurs du monde entier et nous parlons français.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-fr-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Demander des informations
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  {COMPANY.phone}
                </a>
              </Button>
              <Button variant="secondary" className="gap-2" asChild>
                <a href={`mailto:${COMPANY.email}`}>
                  <Mail className="size-4" />
                  Écrivez-nous
                </a>
              </Button>
            </div>
            <a
              href={COMPANY.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <MapPin className="size-3 shrink-0" />
              {COMPANY.addressFull}
            </a>

            <p className="mx-auto mt-8 max-w-2xl text-[11px] leading-relaxed text-muted-foreground/60">
              Ces informations sont fournies à titre général et éducatif uniquement ; elles ne
              constituent pas une offre de vente d'une franchise ni un conseil juridique,
              d'immigration, fiscal ou financier. Une franchise est proposée et vendue uniquement au
              moyen d'un Document d'information sur la franchise (FDD). L'admissibilité et l'approbation
              du visa E-2 relèvent uniquement du gouvernement des États-Unis et ne sont jamais
              garanties. Consultez l'avis juridique complet dans nos{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
                Conditions générales
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
