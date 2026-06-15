import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Building2, Cpu, ShieldCheck, Banknote, Handshake, MapPin, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Korean (ko) investor landing page.
//
// ⚠️  FIRST-PASS TRANSLATION — NEEDS NATIVE-SPEAKER REVIEW BEFORE PROMOTION.
// South Korea is a perennial top-3 E-2 country, so this is a high-value locale —
// but have a native Korean speaker review the copy (and especially the legal
// disclaimer) before featuring it in outreach/ads.
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
  title: "New Dawn Franchising | E-2 비자 투자자를 위한 프랜차이즈",
  description:
    "E-2 비자 투자자를 위한 다업종 프랜차이즈 본사. 반복 수익형 세 가지 프랜차이즈(부동산 관리, 통신(VoIP), 보험) 중에서 선택하세요. 귀하가 사업을 이끌고 재무를 관리하며, 저희 팀이 일상 운영을 담당합니다. FDD는 요청 시 제공됩니다.",
  canonical: `${SITE}/ko`,
};

const VERTICALS = [
  {
    icon: <Building2 className="size-5 text-primary" />,
    title: "부동산 관리",
    desc: "임대 관리 수수료를 통한 반복 수익. 저희 팀이 임차인, 유지보수, 수금을 담당하고 귀하는 사업을 감독합니다.",
  },
  {
    icon: <Cpu className="size-5 text-primary" />,
    title: "통신(VoIP)",
    desc: "기업용 클라우드 전화 서비스. 매월 반복 청구되며, 장기 비즈니스 고객을 보유한 성장 분야입니다.",
  },
  {
    icon: <ShieldCheck className="size-5 text-primary" />,
    title: "보험",
    desc: "반복적인 갱신 수수료를 받는 보험 대리점. 해마다 수익을 창출하는 보험 포트폴리오를 구축하세요.",
  },
];

const BENEFITS = [
  {
    icon: <Banknote className="size-5 text-primary" />,
    title: "반복 수익 모델",
    desc: "세 가지 프랜차이즈 모두 일회성 판매가 아닌 월간 또는 갱신 수익을 기반으로 합니다.",
  },
  {
    icon: <Handshake className="size-5 text-primary" />,
    title: "저희 팀이 사업을 운영합니다",
    desc: "귀하가 프랜차이즈를 이끌고 재무를 관리하며, 저희 팀이 일상 운영을 담당합니다.",
  },
  {
    icon: <MapPin className="size-5 text-primary" />,
    title: "보호된 지역",
    desc: "저희의 기술과 경험을 바탕으로 지정된 지역에서 사업을 운영합니다.",
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: "FDD 요청 시 제공",
    desc: "프랜차이즈 공개 문서(FDD)는 검토할 준비가 되면 제공해 드립니다.",
  },
];

function useKoSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevLang = document.documentElement.lang;
    document.title = SEO.title;
    document.documentElement.lang = "ko";

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

export default function KoPage() {
  useKoSeo();

  return (
    <div data-testid="page-ko" lang="ko" className="min-h-screen">
      {/* Hero */}
      <section data-testid="section-ko-hero" className="border-b">
        <div className="nh-container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/60 px-3 py-1 text-xs font-medium text-foreground/70">
              E-2 비자 투자자를 위한 프랜차이즈
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              E-2 비자로 미국에서 프랜차이즈를 소유하세요
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              <span translate="no">New Dawn Franchising</span> 은 E-2 비자 투자자를 위한 다업종 프랜차이즈 본사입니다.
              반복 수익형 세 가지 프랜차이즈(부동산 관리, 통신(VoIP), 보험) 중에서 선택할 수 있습니다.
              귀하가 사업을 이끌고 재무를 관리하며, 저희 팀이 일상 운영을 담당합니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-ko-contact" className="gap-2" asChild>
                <Link href="/contact">
                  자료 요청
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-ko-calendly" variant="secondary" className="gap-2" asChild>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
                  상담 예약
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/70">
              영어로 보시겠어요?{" "}
              <Link href="/" className="underline underline-offset-2 hover:text-foreground" translate="no">
                English 사이트 보기
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Verticals */}
      <section data-testid="section-ko-verticals" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              세 가지 프랜차이즈, 하나의 반복 수익 모델.
            </h2>
            <p className="mt-3 text-muted-foreground">투자 목표에 가장 적합한 분야를 선택하세요.</p>
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
      <section data-testid="section-ko-benefits" className="border-b">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              왜 <span translate="no">New Dawn Franchising</span> 인가요?
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
      <section data-testid="section-ko-cta">
        <div className="nh-container py-16">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white/60 p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              귀하의 E-2 비자 여정에 대해 이야기해 보세요
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              목표를 알려주시면 프랜차이즈 모델의 작동 방식을 설명해 드립니다. 저희는 전 세계 투자자를 지원합니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button data-testid="button-ko-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  자료 요청
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
                  이메일 보내기
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
              본 정보는 일반적이고 교육적인 목적으로만 제공되며, 프랜차이즈 판매 제안이 아니며 법률·이민·세무·재무 자문도 아닙니다.
              프랜차이즈는 프랜차이즈 공개 문서(FDD)를 통해서만 제공 및 판매됩니다. E-2 비자의 자격과 승인은 오직 미국 정부가 결정하며 결코 보장되지 않습니다.
              전체 법적 고지는 당사의{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
                이용약관
              </Link>
              을 참조하십시오.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
