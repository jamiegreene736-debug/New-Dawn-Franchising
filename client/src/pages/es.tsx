import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, Cpu, ShieldCheck, Banknote, Handshake, MapPin, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Spanish (es) investor landing page — pilot locale.
//
// ⚠️  FIRST-PASS TRANSLATION — NEEDS NATIVE-SPEAKER REVIEW BEFORE PROMOTION.
// The copy below is a solid working draft of the English value proposition, but
// it should be reviewed by a native Spanish speaker (ideally one familiar with
// the E-2 investor audience) before this page is featured in outreach/ads.
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
  title: "New Dawn Franchising | Franquicias para inversionistas de la visa E-2",
  description:
    "Franquiciante multisectorial para inversionistas de la visa E-2. Elija entre tres franquicias de ingresos recurrentes —Administración de Propiedades, Telecomunicaciones (VoIP) o Seguros—. Usted dirige el negocio; nuestros equipos manejan las operaciones diarias. FDD disponible a solicitud.",
  canonical: `${SITE}/es`,
};

const VERTICALS = [
  {
    icon: <Building2 className="size-5 text-primary" />,
    title: "Administración de Propiedades",
    desc: "Ingresos recurrentes por honorarios de administración de alquileres. Nuestro equipo gestiona inquilinos, mantenimiento y cobros mientras usted supervisa el negocio.",
  },
  {
    icon: <Cpu className="size-5 text-primary" />,
    title: "Telecomunicaciones (VoIP)",
    desc: "Servicios de telefonía empresarial en la nube con facturación mensual recurrente. Una categoría en crecimiento con clientes comerciales de largo plazo.",
  },
  {
    icon: <ShieldCheck className="size-5 text-primary" />,
    title: "Seguros",
    desc: "Una agencia de seguros con comisiones recurrentes por renovación. Construya una cartera de pólizas que genera ingresos año tras año.",
  },
];

const BENEFITS = [
  {
    icon: <Banknote className="size-5 text-primary" />,
    title: "Modelo de ingresos recurrentes",
    desc: "Las tres franquicias se basan en ingresos mensuales o por renovación, no en ventas únicas.",
  },
  {
    icon: <Handshake className="size-5 text-primary" />,
    title: "Nuestros equipos operan el negocio",
    desc: "Usted dirige la franquicia y controla sus finanzas; nuestros equipos se encargan de las operaciones diarias.",
  },
  {
    icon: <MapPin className="size-5 text-primary" />,
    title: "Territorios protegidos",
    desc: "Opere en un territorio definido con el respaldo de nuestra tecnología y experiencia.",
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: "FDD disponible a solicitud",
    desc: "El Documento de Divulgación de la Franquicia (FDD) está disponible cuando usted esté listo para revisarlo.",
  },
];

function useEsSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    document.title = SEO.title;
    document.documentElement.lang = "es";

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

    // canonical + hreflang alternates (pairs the EN home with this ES page)
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
    addLink("alternate", `${SITE}/`, "x-default");

    return () => {
      document.title = prevTitle;
      document.documentElement.lang = prevLang;
      created.forEach((el) => el.remove());
    };
  }, []);
}

export default function EsPage() {
  useEsSeo();

  return (
    <div data-testid="page-es" lang="es" className="min-h-screen">
      {/* Hero */}
      <section data-testid="section-es-hero" className="border-b">
        <div className="nh-container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/70">
              Franquicias para inversionistas de la visa E-2
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Sea dueño de una franquicia en EE. UU. con la visa E-2
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              <span translate="no">New Dawn Franchising</span> es un franquiciante multisectorial para
              inversionistas de la visa E-2. Elija entre tres franquicias de ingresos recurrentes
              —Administración de Propiedades, Telecomunicaciones (VoIP) o Seguros—. Usted dirige el
              negocio y controla sus finanzas; nuestros equipos manejan las operaciones diarias.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-es-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Solicitar información
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-es-calendly" variant="secondary" className="gap-2" asChild>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
                  Agendar una llamada
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              ¿Prefiere leer en inglés?{" "}
              <Link href="/" className="underline underline-offset-2 hover:text-foreground" translate="no">
                Ver el sitio en English
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section data-testid="section-es-verticals" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Tres franquicias. Un modelo de ingresos recurrentes.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Elija el sector que mejor se adapte a sus objetivos como inversionista.
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
      <section data-testid="section-es-benefits" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              ¿Por qué <span translate="no">New Dawn Franchising</span>?
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
      <section data-testid="section-es-cta">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white/60 p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Hablemos sobre su camino con la visa E-2
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Cuéntenos sobre sus objetivos y le explicaremos cómo funciona el modelo de franquicia.
              Atendemos a inversionistas de todo el mundo y hablamos español.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-es-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Solicitar información
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
                  Escríbanos
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
              Esta información es solo de carácter general y educativo; no es una oferta para vender
              una franquicia ni constituye asesoría legal, migratoria, fiscal o financiera. Una
              franquicia se ofrece y se vende únicamente mediante un Documento de Divulgación de la
              Franquicia (FDD). La elegibilidad y aprobación de la visa E-2 las determina únicamente
              el gobierno de EE. UU. y nunca están garantizadas. Consulte el aviso legal completo en
              nuestros{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
                Términos y Condiciones
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
