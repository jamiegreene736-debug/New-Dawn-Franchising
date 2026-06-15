import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, Cpu, ShieldCheck, Banknote, Handshake, MapPin, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Japanese (ja) investor landing page.
//
// ⚠️  FIRST-PASS TRANSLATION — NEEDS NATIVE-SPEAKER REVIEW BEFORE PROMOTION.
// Japan is consistently a top source of E-2 visas, so this is a high-value
// locale — but have a native Japanese speaker review the copy (and especially
// the legal disclaimer) before featuring it in outreach/ads.
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
  title: "New Dawn Franchising | E-2ビザ投資家向けフランチャイズ",
  description:
    "E-2ビザ投資家向けのマルチ業種フランチャイザー。継続収益型の3つのフランチャイズ（不動産管理、テレコム（VoIP）、保険）からお選びいただけます。あなたが事業を統括し財務を管理し、当社のチームが日常業務を担当します。FDDはご要望に応じてご提供します。",
  canonical: `${SITE}/ja`,
};

const VERTICALS = [
  {
    icon: <Building2 className="size-5 text-primary" />,
    title: "不動産管理",
    desc: "賃貸管理手数料による継続的な収益。当社のチームが入居者対応、メンテナンス、集金を行い、あなたは事業を監督します。",
  },
  {
    icon: <Cpu className="size-5 text-primary" />,
    title: "テレコム（VoIP）",
    desc: "企業向けのクラウド電話サービス。毎月の継続課金。長期的な法人顧客を抱える成長分野です。",
  },
  {
    icon: <ShieldCheck className="size-5 text-primary" />,
    title: "保険",
    desc: "継続的な更新手数料が得られる保険代理店。年々収益を生む保険ポートフォリオを構築します。",
  },
];

const BENEFITS = [
  {
    icon: <Banknote className="size-5 text-primary" />,
    title: "継続収益モデル",
    desc: "3つのフランチャイズはいずれも、単発の販売ではなく月額または更新による収益に基づいています。",
  },
  {
    icon: <Handshake className="size-5 text-primary" />,
    title: "当社のチームが事業を運営",
    desc: "あなたがフランチャイズを統括し財務を管理し、当社のチームが日常業務を担当します。",
  },
  {
    icon: <MapPin className="size-5 text-primary" />,
    title: "保護されたテリトリー",
    desc: "当社の技術と経験に支えられ、定められたテリトリーで事業を運営します。",
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: "FDDはご要望に応じて提供",
    desc: "フランチャイズ開示書類（FDD）は、ご確認の準備が整い次第ご提供します。",
  },
];

function useJaSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    document.title = SEO.title;
    document.documentElement.lang = "ja";

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

export default function JaPage() {
  useJaSeo();

  return (
    <div data-testid="page-ja" lang="ja" className="min-h-screen">
      {/* Hero */}
      <section data-testid="section-ja-hero" className="border-b">
        <div className="nh-container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/70">
              E-2ビザ投資家向けフランチャイズ
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              E-2ビザで米国のフランチャイズを所有する
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              <span translate="no">New Dawn Franchising</span> は、E-2ビザ投資家向けのマルチ業種フランチャイザーです。
              継続収益型の3つのフランチャイズ（不動産管理、テレコム（VoIP）、保険）からお選びいただけます。
              あなたが事業を統括し財務を管理し、当社のチームが日常業務を担当します。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-ja-contact" className="gap-2" asChild>
                <Link href="/contact">
                  資料を請求する
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-ja-calendly" variant="secondary" className="gap-2" asChild>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
                  通話を予約する
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              英語で読みますか？{" "}
              <Link href="/" className="underline underline-offset-2 hover:text-foreground" translate="no">
                English サイトを見る
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section data-testid="section-ja-verticals" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              3つのフランチャイズ。1つの継続収益モデル。
            </h2>
            <p className="mt-3 text-muted-foreground">投資目標に最も合った分野をお選びください。</p>
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
      <section data-testid="section-ja-benefits" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              なぜ <span translate="no">New Dawn Franchising</span> なのか？
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
      <section data-testid="section-ja-cta">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white/60 p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              あなたのE-2ビザへの道についてお話ししましょう
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              あなたの目標をお聞かせください。フランチャイズモデルの仕組みをご説明します。当社は世界中の投資家をサポートしています。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-ja-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  資料を請求する
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
                  メールでお問い合わせ
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
              本情報は一般的かつ教育的な目的のみのものであり、フランチャイズの販売の申し出ではなく、法律・移民・税務・財務に関する助言でもありません。
              フランチャイズはフランチャイズ開示書類（FDD）を通じてのみ提供・販売されます。E-2ビザの適格性と承認は米国政府のみが決定し、保証されることは決してありません。
              完全な法的免責事項は当社の{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
                利用規約
              </Link>
              をご覧ください。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
