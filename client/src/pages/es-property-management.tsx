import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Banknote,
  Building2,
  ClipboardList,
  Gauge,
  HelpCircle,
  Home,
  Mail,
  MapPin,
  Phone,
  Repeat,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─────────────────────────────────────────────────────────────────────────────
// Spanish (es) equivalent of the Property Management page — LATAM Spanish.
//
// ⚠️  Traducción de primera mano — requiere revisión de un hablante nativo antes
// de promocionarla en campañas/anuncios.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = "https://www.newdawnfranchising.com";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

const SEO = {
  title:
    "New Dawn Franchising | Franquicia de Administración de Propiedades para inversionistas de la visa E-2",
  description:
    "Franquicia de administración de propiedades para la visa E-2. Usted es dueño y dirige un negocio de ingresos recurrentes por alquileres de largo plazo, mientras nuestros equipos locales manejan las operaciones diarias. Inversión desde $225,000.",
  canonical: `${SITE}/es/property-management`,
};

const GLANCE = [
  {
    icon: Repeat,
    title: "Ingresos recurrentes, no ventas únicas",
    desc: "Cada propiedad bajo administración genera un honorario mensual mientras el propietario siga siendo cliente — ingresos que se acumulan en lugar de reiniciar desde cero cada mes.",
    id: "recurrentes",
  },
  {
    icon: ClipboardList,
    title: "Sistemas operativos documentados",
    desc: "Equipos locales de ejecución, procedimientos documentados y paneles de reportería para el dueño dan al negocio la estructura, el personal y el control de supervisión que respaldan un caso E-2 creíble.",
    id: "sistemas",
  },
  {
    icon: ShieldCheck,
    title: "Estabilidad del alquiler a largo plazo",
    desc: "Los contratos anuales significan honorarios mensuales predecibles, inquilinos establecidos y flujo de caja constante — en lugar de las fluctuaciones de los alquileres vacacionales o de corto plazo.",
    id: "estabilidad",
  },
];

const WHY = [
  {
    icon: Banknote,
    title: "Control de las cuentas bancarias",
    desc: "Usted controla las cuentas bancarias de la franquicia y aprueba los gastos importantes — el control financiero sustantivo que exige la visa E-2.",
    id: "control",
  },
  {
    icon: Building2,
    title: "Decisiones clave bajo su dirección",
    desc: "Usted fija la estrategia, aprueba las decisiones importantes y supervisa el desempeño a través de su panel de dueño. Es un rol directivo real, no pasivo.",
    id: "decisiones",
  },
  {
    icon: Users,
    title: "Crea empleos en EE. UU.",
    desc: "El negocio emplea personal en Estados Unidos a medida que crece la cartera — lo que ayuda a demostrar que la empresa no es marginal.",
    id: "empleos",
  },
  {
    icon: Gauge,
    title: "Usted supervisa; nuestros equipos ejecutan",
    desc: "Equipos locales aprobados manejan la operación diaria mientras usted mantiene la propiedad, la supervisión y el control ejecutivo del negocio.",
    id: "supervisa",
  },
];

const FAQS = [
  {
    q: "¿Qué hace la franquicia de Administración de Propiedades?",
    a: "Administra alquileres residenciales de largo plazo en nombre de los propietarios — gestionando contratos, cobro de rentas, relación con inquilinos, coordinación de mantenimiento y reportería al propietario — bajo acuerdos de administración continuos.",
  },
  {
    q: "¿Tengo que manejar la operación diaria yo mismo?",
    a: "No. Usted es el dueño y director. Equipos locales aprobados manejan la ejecución diaria mientras usted conserva el control de la propiedad, la supervisión de las cuentas bancarias y la supervisión ejecutiva a través de su panel de dueño.",
  },
  {
    q: "¿Cómo respalda esto mi visa E-2?",
    a: "Es un negocio real y en operación que usted posee y dirige, genera ingresos recurrentes y emplea trabajadores en EE. UU. — características que respaldan un caso E-2 creíble. New Dawn Franchising no brinda asesoría legal ni migratoria y no garantiza ningún resultado de visa.",
  },
  {
    q: "¿Cuánto se invierte?",
    a: "La inversión en la franquicia de Administración de Propiedades comienza desde $225,000. La visa E-2 no tiene un mínimo legal fijo, pero la inversión debe ser sustancial en relación con el costo total del negocio.",
  },
];

function useEsPmSeo() {
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

    // canonical + hreflang alternates (pairs the EN property-management page with this ES page)
    const addLink = (rel: string, href: string, hreflang?: string) => {
      const link = document.createElement("link");
      link.setAttribute("rel", rel);
      link.setAttribute("href", href);
      if (hreflang) link.setAttribute("hreflang", hreflang);
      document.head.appendChild(link);
      created.push(link);
    };
    addLink("canonical", SEO.canonical);
    addLink("alternate", `${SITE}/property-management`, "en");
    addLink("alternate", `${SITE}/es/property-management`, "es");
    addLink("alternate", `${SITE}/property-management`, "x-default");

    return () => {
      document.title = prevTitle;
      document.documentElement.lang = prevLang;
      created.forEach((el) => el.remove());
    };
  }, []);
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">{children}</div>
  );
}

export default function EsPropertyManagementPage() {
  useEsPmSeo();

  return (
    <div data-testid="page-es-property-management" lang="es" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-es-pm-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Home className="size-3.5 text-[hsl(var(--accent))]" />
              Uno de los tres sectores de <span translate="no">New Dawn</span>
            </div>
            <h1
              data-testid="es-pm-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Administración de Propiedades: ingresos recurrentes que usted dirige, operaciones que nosotros manejamos
            </h1>
            <p
              data-testid="es-pm-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Un negocio real y en operación de administración de propiedades en EE. UU., construido en torno a
              contratos de alquiler de largo plazo — estructurado para que usted sea dueño y dirija la empresa mientras
              los equipos locales de <span translate="no">New Dawn</span> se encargan de la ejecución diaria, tal como lo
              requiere la visa E-2.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-es-pm-hero-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Solicitar información
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-es-pm-hero-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  {COMPANY.phone}
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              ¿Prefiere leer en inglés?{" "}
              <Link href="/property-management" className="underline underline-offset-2 hover:text-foreground" translate="no">
                View in English
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 1 — El negocio a simple vista ── */}
      <section data-testid="section-es-pm-glance" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>El negocio a simple vista</SectionEyebrow>
            <h2 data-testid="es-pm-glance-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Administración de alquileres de largo plazo, basada en ingresos recurrentes
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              La franquicia de Administración de Propiedades de <span translate="no">New Dawn</span> administra
              propiedades residenciales en alquiler en nombre de los propietarios, bajo acuerdos de administración
              continuos — gestionando contratos, cobro de rentas, relación con inquilinos, coordinación de
              mantenimiento y reportería. Es una empresa genuina y en operación, con sistemas documentados, personal y
              control de supervisión.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GLANCE.map((g) => (
              <Card key={g.id} data-testid={`card-es-pm-glance-${g.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <g.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{g.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2 — Usted dirige; nuestros equipos operan ── */}
      <section data-testid="section-es-pm-direct" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Usted dirige; nuestros equipos operan</SectionEyebrow>
            <h2 data-testid="es-pm-direct-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Usted dirige el negocio; nuestros equipos manejan las operaciones
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Usted es el dueño y director. Mantiene la propiedad de la empresa, el control de las cuentas bancarias y
              las decisiones clave, supervisa el desempeño y aprueba los gastos importantes. Los equipos locales
              aprobados ejecutan el trabajo diario — pero usted conserva el control ejecutivo del negocio. Es un rol
              directivo real y sustantivo, no pasivo.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {WHY.map((w) => (
              <Card key={w.id} data-testid={`card-es-pm-why-${w.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                    <w.icon className="size-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{w.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 3 — Por qué encaja con la visa E-2 ── */}
      <section data-testid="section-es-pm-e2" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Un buen ajuste para la visa E-2</SectionEyebrow>
            <h2 data-testid="es-pm-e2-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Por qué la administración de propiedades encaja con la visa E-2
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              El sector se alinea con lo que la visa E-2 realmente requiere: un negocio real, en operación, dirigido por
              su dueño, que sea sustancial y no marginal. Los ingresos recurrentes por contratos y los empleos en EE.
              UU. respaldan el caso, y producen un registro auditable de actividad continua para las renovaciones.
            </p>
          </div>

          <div
            data-testid="es-pm-e2-note"
            className="mx-auto mt-10 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Adquirir una franquicia no garantiza la aprobación de la visa E-2. La elegibilidad y la aprobación las
              determinan únicamente los oficiales consulares de EE. UU. y USCIS, con base en cada petición individual.
              El sector está estructurado para respaldar — nunca para garantizar — un caso E-2 sólido.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 4 — Inversión ── */}
      <section data-testid="section-es-pm-investment" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Inversión</SectionEyebrow>
            <h2 data-testid="es-pm-investment-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Una inversión sustancial y en riesgo — estructurada para la E-2
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            <Card data-testid="card-es-pm-investment-amount" className="nh-surface nh-noise border-card-border/80 p-6 text-center">
              <Banknote className="mx-auto size-6 text-[hsl(var(--accent))]" />
              <div className="mt-3 text-3xl font-semibold text-[hsl(var(--primary))]">$225,000</div>
              <div className="mt-1 text-sm text-muted-foreground">Inversión en la franquicia desde</div>
            </Card>
            <Card data-testid="card-es-pm-investment-includes" className="nh-surface nh-noise border-card-border/80 p-6 md:col-span-2">
              <div className="text-base font-semibold">Qué cubre</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Su licencia de franquicia, la capacitación, el acceso a la plataforma tecnológica y la configuración
                operativa. Hay opciones de financiamiento disponibles a través de socios de crédito afiliados. Los
                detalles completos se entregan en el Documento de Divulgación de la Franquicia (FDD).
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 5 — FAQ ── */}
      <section data-testid="section-es-pm-faq" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Preguntas frecuentes</SectionEyebrow>
            <h2 data-testid="es-pm-faq-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Administración de Propiedades, respondida
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} data-testid={`es-pm-faq-item-${i}`}>
                  <AccordionTrigger className="text-left text-base font-semibold">
                    <span className="flex items-start gap-2">
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                      {f.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 6 — CTA ── */}
      <section data-testid="section-es-pm-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="es-pm-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Dirija un negocio de administración de propiedades de ingresos recurrentes en EE. UU.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Solicite información y agende una llamada para ver si el sector de Administración de Propiedades encaja con
              sus objetivos de la visa E-2. Atendemos a inversionistas de todo el mundo y hablamos español.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-es-pm-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Solicitar información
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-es-pm-cta-email" variant="secondary" className="gap-2" asChild>
                <a href={`mailto:${COMPANY.email}`}>
                  <Mail className="size-4" />
                  Escríbanos
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-es-pm-address"
                href={COMPANY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {COMPANY.addressFull}
              </a>
              <a
                data-testid="link-es-pm-phone"
                href={`tel:${COMPANY.phoneTel}`}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0" />
                {COMPANY.phone}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Aviso legal de letra pequeña ── */}
      <section data-testid="section-es-pm-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Aviso importante
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              Esta página es solo de carácter informativo y educativo; no es una oferta para vender ni la solicitud de
              una oferta para comprar una franquicia, ni constituye asesoría legal o migratoria. Las franquicias se
              ofrecen únicamente mediante un Documento de Divulgación de la Franquicia (FDD) conforme a la Regla de
              Franquicias de la FTC y la ley estatal aplicable, y solo en estados donde{" "}
              <span translate="no">New Dawn Franchising</span> esté registrada, exenta o autorizada.{" "}
              <span translate="no">New Dawn Franchising</span> no brinda asesoría legal ni migratoria y no garantiza la
              aprobación de ninguna visa E-2 ni resultado financiero alguno. La elegibilidad y aprobación de la visa E-2
              las determinan únicamente los oficiales consulares del Departamento de Estado de EE. UU. y USCIS. Los
              inversionistas deben consultar a sus propios asesores legales, migratorios y financieros independientes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
