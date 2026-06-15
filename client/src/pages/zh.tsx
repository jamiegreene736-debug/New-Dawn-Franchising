import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, Cpu, ShieldCheck, Banknote, Handshake, MapPin, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Chinese (zh) investor landing page.
//
// ⚠️  FIRST-PASS TRANSLATION — NEEDS NATIVE-SPEAKER REVIEW BEFORE PROMOTION.
// Solid working draft of the English value proposition; have a native Chinese
// speaker review before this page is featured in outreach/ads. Note: mainland
// China is not an E-2 treaty country — this page targets Taiwan and
// alternate-citizenship (e.g. Grenada) Chinese-speaking investors.
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
  title: "New Dawn Franchising | 面向 E-2 签证投资者的特许经营",
  description:
    "面向 E-2 签证投资者的多行业特许经营商。可从三种带来经常性收入的特许经营中选择——物业管理、电信（VoIP）或保险。您主导业务、掌控财务，我们的团队负责日常运营。FDD 可应要求提供。",
  canonical: `${SITE}/zh`,
};

const VERTICALS = [
  {
    icon: <Building2 className="size-5 text-primary" />,
    title: "物业管理",
    desc: "通过租赁管理费获得经常性收入。我们的团队负责租户、维修与收款，您负责监督业务。",
  },
  {
    icon: <Cpu className="size-5 text-primary" />,
    title: "电信（VoIP）",
    desc: "面向企业的云电话服务，按月经常性计费。这是一个不断增长的领域，拥有长期商业客户。",
  },
  {
    icon: <ShieldCheck className="size-5 text-primary" />,
    title: "保险",
    desc: "经营一家保险代理机构，获得经常性的续保佣金。建立一个年复一年产生收入的保单组合。",
  },
];

const BENEFITS = [
  {
    icon: <Banknote className="size-5 text-primary" />,
    title: "经常性收入模式",
    desc: "三种特许经营都以按月或续约收入为基础，而非一次性销售。",
  },
  {
    icon: <Handshake className="size-5 text-primary" />,
    title: "我们的团队为您运营业务",
    desc: "您主导特许经营并掌控财务；我们的团队负责日常运营。",
  },
  {
    icon: <MapPin className="size-5 text-primary" />,
    title: "受保护的经营区域",
    desc: "在划定的区域内经营，并获得我们的技术与经验支持。",
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: "FDD 可应要求提供",
    desc: "当您准备好查阅时，可提供《特许经营披露文件》（FDD）。",
  },
];

function useZhSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    document.title = SEO.title;
    document.documentElement.lang = "zh";

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
    addLink("alternate", `${SITE}/`, "x-default");

    return () => {
      document.title = prevTitle;
      document.documentElement.lang = prevLang;
      created.forEach((el) => el.remove());
    };
  }, []);
}

export default function ZhPage() {
  useZhSeo();

  return (
    <div data-testid="page-zh" lang="zh" className="min-h-screen">
      {/* Hero */}
      <section data-testid="section-zh-hero" className="border-b">
        <div className="nh-container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/70">
              面向 E-2 签证投资者的特许经营
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              通过 E-2 签证在美国拥有一家特许经营企业
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              <span translate="no">New Dawn Franchising</span> 是一家面向 E-2 签证投资者的多行业特许经营商。
              可从三种带来经常性收入的特许经营中选择——物业管理、电信（VoIP）或保险。您主导业务、掌控财务，
              我们的团队负责日常运营。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-zh-contact" className="gap-2" asChild>
                <Link href="/contact">
                  索取资料
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-zh-calendly" variant="secondary" className="gap-2" asChild>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
                  预约通话
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              想用英文阅读？{" "}
              <Link href="/" className="underline underline-offset-2 hover:text-foreground" translate="no">
                查看 English 网站
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section data-testid="section-zh-verticals" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              三种特许经营，一种经常性收入模式。
            </h2>
            <p className="mt-3 text-muted-foreground">选择最符合您投资目标的行业。</p>
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
      <section data-testid="section-zh-benefits" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              为什么选择 <span translate="no">New Dawn Franchising</span>？
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
      <section data-testid="section-zh-cta">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white/60 p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              聊聊您的 E-2 签证之路
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              告诉我们您的目标，我们会向您说明特许经营模式的运作方式。我们服务来自世界各地的投资者。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-zh-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  索取资料
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
                  给我们发邮件
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
              本信息仅供一般参考和教育之用，并非出售特许经营的要约，也不构成法律、移民、税务或财务建议。
              特许经营仅通过《特许经营披露文件》（FDD）提供和出售。E-2 签证的资格和批准完全由美国政府决定，
              且从不保证。完整法律声明请参阅我们的{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
                条款与条件
              </Link>
              。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
