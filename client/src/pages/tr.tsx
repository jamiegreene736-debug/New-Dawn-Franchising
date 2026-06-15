import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, Cpu, ShieldCheck, Banknote, Handshake, MapPin, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Turkish (tr) investor landing page.
//
// ⚠️  FIRST-PASS TRANSLATION — NEEDS NATIVE-SPEAKER REVIEW BEFORE PROMOTION.
// Turkey is one of the largest and fastest-growing sources of E-2 visas, so this
// is a high-value locale — but have a native Turkish speaker review the copy
// (and especially the legal disclaimer) before featuring it in outreach/ads.
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
  title: "New Dawn Franchising | E-2 vizesi yatırımcıları için franchise",
  description:
    "E-2 vizesi yatırımcıları için çok sektörlü bir franchise veren. Yinelenen gelir sağlayan üç franchise arasından birini seçin: Mülk Yönetimi, Telekom (VoIP) veya Sigorta. İşi siz yönetir ve finansınızı kontrol edersiniz; günlük operasyonları ekiplerimiz yürütür. FDD talep üzerine sunulur.",
  canonical: `${SITE}/tr`,
};

const VERTICALS = [
  {
    icon: <Building2 className="size-5 text-primary" />,
    title: "Mülk Yönetimi",
    desc: "Kira yönetim ücretlerinden yinelenen gelir. Ekibimiz kiracıları, bakımı ve tahsilatı yönetirken siz işi denetlersiniz.",
  },
  {
    icon: <Cpu className="size-5 text-primary" />,
    title: "Telekom (VoIP)",
    desc: "İşletmeler için bulut tabanlı telefon hizmetleri; aylık yinelenen faturalandırma. Uzun vadeli ticari müşterilere sahip, büyüyen bir kategori.",
  },
  {
    icon: <ShieldCheck className="size-5 text-primary" />,
    title: "Sigorta",
    desc: "Yinelenen yenileme komisyonları olan bir sigorta acentesi. Yıldan yıla gelir getiren bir poliçe portföyü oluşturun.",
  },
];

const BENEFITS = [
  {
    icon: <Banknote className="size-5 text-primary" />,
    title: "Yinelenen gelir modeli",
    desc: "Üç franchise de tek seferlik satışlara değil, aylık veya yenileme gelirlerine dayanır.",
  },
  {
    icon: <Handshake className="size-5 text-primary" />,
    title: "İşi ekiplerimiz yürütür",
    desc: "Franchise'ı siz yönetir ve finansınızı kontrol edersiniz; günlük operasyonlarla ekiplerimiz ilgilenir.",
  },
  {
    icon: <MapPin className="size-5 text-primary" />,
    title: "Korumalı bölgeler",
    desc: "Teknolojimiz ve deneyimimizle desteklenen, tanımlı bir bölgede faaliyet gösterin.",
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: "FDD talep üzerine sunulur",
    desc: "Franchise Açıklama Belgesi (FDD), incelemeye hazır olduğunuzda sunulur.",
  },
];

function useTrSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    document.title = SEO.title;
    document.documentElement.lang = "tr";

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

export default function TrPage() {
  useTrSeo();

  return (
    <div data-testid="page-tr" lang="tr" className="min-h-screen">
      {/* Hero */}
      <section data-testid="section-tr-hero" className="border-b">
        <div className="nh-container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/70">
              E-2 vizesi yatırımcıları için franchise
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              E-2 vizesiyle ABD'de bir franchise sahibi olun
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              <span translate="no">New Dawn Franchising</span>, E-2 vizesi yatırımcıları için çok sektörlü
              bir franchise verendir. Yinelenen gelir sağlayan üç franchise arasından seçim yapın:
              Mülk Yönetimi, Telekom (VoIP) veya Sigorta. İşi siz yönetir ve finansınızı kontrol
              edersiniz; günlük operasyonları ekiplerimiz yürütür.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-tr-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Bilgi isteyin
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-tr-calendly" variant="secondary" className="gap-2" asChild>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
                  Görüşme planlayın
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              İngilizce okumayı mı tercih edersiniz?{" "}
              <Link href="/" className="underline underline-offset-2 hover:text-foreground" translate="no">
                Siteyi English görüntüleyin
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section data-testid="section-tr-verticals" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Üç franchise. Tek bir yinelenen gelir modeli.
            </h2>
            <p className="mt-3 text-muted-foreground">Yatırım hedeflerinize en uygun sektörü seçin.</p>
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
      <section data-testid="section-tr-benefits" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Neden <span translate="no">New Dawn Franchising</span>?
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
      <section data-testid="section-tr-cta">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white/60 p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              E-2 vizesi yolculuğunuzu konuşalım
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Hedeflerinizi bizimle paylaşın, franchise modelinin nasıl işlediğini anlatalım. Dünyanın
              her yerinden yatırımcılara hizmet veriyoruz.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-tr-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Bilgi isteyin
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
                  Bize yazın
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
              Bu bilgiler yalnızca genel ve eğitim amaçlıdır; bir franchise satış teklifi değildir ve
              hukuki, göçmenlik, vergi veya mali danışmanlık niteliği taşımaz. Bir franchise yalnızca
              bir Franchise Açıklama Belgesi (FDD) aracılığıyla sunulur ve satılır. E-2 vizesi
              uygunluğu ve onayı yalnızca ABD hükümeti tarafından belirlenir ve asla garanti edilmez.
              Tüm yasal açıklamalar için{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
                Şartlar ve Koşullarımıza
              </Link>{" "}
              bakın.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
