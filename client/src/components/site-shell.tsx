import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight, ChevronDown, Globe2, Loader2, Mail, MapPin, Menu, Phone, Send, X, MessageCircle, GraduationCap, Megaphone, ShieldCheck, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/language-switcher";
import logo from "@assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png";
import mark from "@/assets/images/nhf-mark.png";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  address: "2601 N Zaragoza Rd",
  city: "El Paso, TX 79938",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
  facebook: "https://www.facebook.com/profile.php?id=61588637044169",
};

// ─── Footer legal disclaimer ──────────────────────────────────────────────────
// Surfaced on every page (consistent with the fuller Terms & Conditions §1–§2).
// Covers: (1) franchise / FTC Franchise Rule "not an offer" + FDD + registration
// states; (2) not a law firm / no legal, immigration, tax or financial advice +
// E-2 visa never guaranteed (decided solely by DOS & USCIS); (3) consult your own
// attorneys/advisors, no warranty, earnings are illustrative only.
const LEGAL_DISCLAIMER = {
  lead: "This website is for general information only — it is not an offer to sell a franchise, and it is not legal, immigration, tax, or financial advice.",
  paragraphs: [
    "The information on this site is provided for general informational and educational purposes only and is not an offer to sell, or a solicitation of an offer to buy, a franchise. A franchise is offered and sold only through a Franchise Disclosure Document (FDD) that complies with the FTC Franchise Rule (16 CFR Part 436) and applicable state franchise laws. Certain states regulate the offer and sale of franchises and require registration or filing; New Dawn Franchising will offer or sell a franchise only in states where we are registered or exempt, and only after we have met applicable pre-sale registration, filing, and disclosure requirements and delivered the FDD as required by law.",
    "New Dawn Franchising LLC is a franchisor, not a law firm. Nothing on this site is legal, immigration, tax, or financial advice, and no attorney-client or other professional relationship is created by using the site or contacting us. We do not provide immigration services and do not form your legal entity — your own attorney does. E-2 treaty investor visa information is general and educational only; immigration laws and qualifying treaty countries change over time. E-2 eligibility and approval are determined solely by the U.S. government (Department of State consular officers, and USCIS for change or extension of status), never by us, and a visa is never guaranteed.",
    "Before making any investment or visa-related decision, you should retain your own licensed U.S. immigration attorney and qualified tax and financial advisors, and conduct your own independent due diligence. Information is provided “as is,” may be incomplete or out of date, and we make no warranty as to its accuracy or completeness. Any income, earnings, results, or performance figures are illustrative only and are not guarantees of future results; individual outcomes vary.",
  ],
};

// ─── Localized footer / newsletter copy ───────────────────────────────────────
// The footer lives in the shared shell, so it must follow the active locale
// (e.g. the /es page). Spanish is a first-pass draft — the legal disclaimer in
// particular should get a native-speaker & legal review before being relied on.
const FOOTER_I18N = {
  en: {
    groupPrefix: "Part of the ",
    groupSuffix: " — proprietary technology, decades of experience",
    outreachLine: "Servimos a inversionistas de todo el mundo — hablamos español",
    outreachLang: "es",
    followFacebook: "Follow us on Facebook",
    stayUpdated: "Stay updated",
    newsletterDesc:
      "Get the latest franchise news, E-2 visa updates, and industry insights delivered to your inbox.",
    newsletterPlaceholder: "Enter your email",
    subscribe: "Subscribe",
    newsletterSuccess: "You're signed up! We'll keep you updated with the latest news.",
    requestInfo: "Request info",
    legalHeading: "Legal Disclaimer",
    disclaimerLead: LEGAL_DISCLAIMER.lead,
    disclaimerParagraphs: LEGAL_DISCLAIMER.paragraphs as readonly string[],
    seeFullPrefix: "See our full ",
    seeFullSuffix: " for complete disclosures.",
    termsLabel: "Terms & Conditions",
    rightsReserved: "All rights reserved.",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    legal: "Legal & Disclaimers",
  },
  es: {
    groupPrefix: "Parte del ",
    groupSuffix: " — tecnología propia y décadas de experiencia",
    outreachLine: "Servimos a inversionistas de todo el mundo — hablamos español",
    outreachLang: "es",
    followFacebook: "Síganos en Facebook",
    stayUpdated: "Manténgase informado",
    newsletterDesc:
      "Reciba las últimas noticias sobre franquicias, novedades de la visa E-2 e información del sector directamente en su correo.",
    newsletterPlaceholder: "Ingrese su correo electrónico",
    subscribe: "Suscribirse",
    newsletterSuccess: "¡Listo! Le mantendremos informado con las últimas noticias.",
    requestInfo: "Solicitar información",
    legalHeading: "Aviso legal",
    disclaimerLead:
      "Este sitio web es solo de carácter informativo general — no es una oferta para vender una franquicia ni constituye asesoría legal, migratoria, fiscal o financiera.",
    disclaimerParagraphs: [
      "La información de este sitio se proporciona únicamente con fines informativos y educativos de carácter general y no es una oferta para vender, ni una solicitud de oferta para comprar, una franquicia. Una franquicia se ofrece y se vende solo mediante un Documento de Divulgación de la Franquicia (FDD) que cumple con la Regla de Franquicias de la FTC (16 CFR Parte 436) y las leyes estatales de franquicias aplicables. Algunos estados regulan la oferta y venta de franquicias y exigen registro o presentación; New Dawn Franchising ofrecerá o venderá una franquicia solo en los estados donde estemos registrados o exentos, y únicamente después de cumplir los requisitos de registro, presentación y divulgación previos a la venta y de entregar el FDD según lo exige la ley.",
      "New Dawn Franchising LLC es un franquiciante, no un bufete de abogados. Nada en este sitio constituye asesoría legal, migratoria, fiscal o financiera, y el uso del sitio o el contacto con nosotros no crea ninguna relación abogado-cliente ni profesional. No prestamos servicios migratorios ni constituimos su entidad legal — eso lo hace su propio abogado. La información sobre la visa de inversionista por tratado E-2 es general y educativa; las leyes migratorias y los países con tratado cambian con el tiempo. La elegibilidad y aprobación de la visa E-2 las determina únicamente el gobierno de EE. UU. (los oficiales consulares del Departamento de Estado y USCIS para cambio o extensión de estatus), nunca nosotros, y una visa nunca está garantizada.",
      "Antes de tomar cualquier decisión de inversión o migratoria, debe contratar a su propio abogado de inmigración con licencia en EE. UU. y a asesores fiscales y financieros calificados, y realizar su propia diligencia debida independiente. La información se proporciona «tal cual», puede estar incompleta o desactualizada, y no ofrecemos ninguna garantía sobre su exactitud o integridad. Cualquier cifra de ingresos, ganancias, resultados o desempeño es solo ilustrativa y no constituye una garantía de resultados futuros; los resultados individuales varían.",
    ] as readonly string[],
    seeFullPrefix: "Consulte nuestros ",
    seeFullSuffix: " completos para ver todas las divulgaciones.",
    termsLabel: "Términos y Condiciones",
    rightsReserved: "Todos los derechos reservados.",
    privacy: "Política de Privacidad",
    terms: "Términos y Condiciones",
    legal: "Aviso Legal",
  },
  fr: {
    groupPrefix: "Membre du ",
    groupSuffix: " — technologie propriétaire, des décennies d'expérience",
    outreachLine: "Nous accompagnons des investisseurs du monde entier — nous parlons français",
    outreachLang: "fr",
    followFacebook: "Suivez-nous sur Facebook",
    stayUpdated: "Restez informé",
    newsletterDesc:
      "Recevez les dernières actualités sur les franchises, les nouveautés du visa E-2 et des analyses du secteur directement dans votre boîte mail.",
    newsletterPlaceholder: "Saisissez votre adresse e-mail",
    subscribe: "S'abonner",
    newsletterSuccess: "Vous êtes inscrit ! Nous vous tiendrons informé des dernières actualités.",
    requestInfo: "Demander des informations",
    legalHeading: "Mentions légales",
    disclaimerLead:
      "Ce site web est fourni à titre d'information générale uniquement — il ne s'agit pas d'une offre de vente d'une franchise, ni d'un conseil juridique, d'immigration, fiscal ou financier.",
    disclaimerParagraphs: [
      "Les informations de ce site sont fournies uniquement à des fins d'information et d'éducation générales et ne constituent pas une offre de vente, ni une sollicitation d'offre d'achat, d'une franchise. Une franchise est proposée et vendue uniquement au moyen d'un Document d'information sur la franchise (FDD) conforme à la règle de la FTC sur les franchises (16 CFR partie 436) et aux lois étatiques applicables. Certains États réglementent l'offre et la vente de franchises et exigent un enregistrement ou un dépôt ; New Dawn Franchising n'offrira ou ne vendra une franchise que dans les États où nous sommes enregistrés ou exemptés, et seulement après avoir satisfait aux exigences applicables d'enregistrement, de dépôt et d'information préalables à la vente et remis le FDD comme l'exige la loi.",
      "New Dawn Franchising LLC est un franchiseur, et non un cabinet d'avocats. Rien sur ce site ne constitue un conseil juridique, d'immigration, fiscal ou financier, et aucune relation avocat-client ou professionnelle n'est créée par l'utilisation du site ou la prise de contact avec nous. Nous ne fournissons pas de services d'immigration et ne constituons pas votre entité juridique — c'est votre propre avocat qui le fait. Les informations sur le visa d'investisseur par traité E-2 sont générales et éducatives ; les lois sur l'immigration et les pays signataires de traités évoluent avec le temps. L'admissibilité et l'approbation du visa E-2 relèvent uniquement du gouvernement des États-Unis (les agents consulaires du Département d'État, et l'USCIS pour le changement ou la prolongation de statut), jamais de nous, et un visa n'est jamais garanti.",
      "Avant de prendre toute décision d'investissement ou liée à l'immigration, vous devez faire appel à votre propre avocat spécialisé en immigration aux États-Unis ainsi qu'à des conseillers fiscaux et financiers qualifiés, et mener votre propre diligence raisonnable indépendante. Les informations sont fournies « en l'état », peuvent être incomplètes ou obsolètes, et nous n'offrons aucune garantie quant à leur exactitude ou leur exhaustivité. Tout chiffre de revenus, de gains, de résultats ou de performance est fourni à titre indicatif uniquement et ne constitue pas une garantie de résultats futurs ; les résultats individuels varient.",
    ] as readonly string[],
    seeFullPrefix: "Consultez nos ",
    seeFullSuffix: " complètes pour l'ensemble des informations légales.",
    termsLabel: "Conditions générales",
    rightsReserved: "Tous droits réservés.",
    privacy: "Politique de confidentialité",
    terms: "Conditions générales",
    legal: "Mentions légales",
  },
  zh: {
    groupPrefix: "隶属于 ",
    groupSuffix: " —— 自有专利技术，数十年经验",
    outreachLine: "我们服务来自世界各地的投资者 —— 我们会说中文",
    outreachLang: "zh",
    followFacebook: "在 Facebook 上关注我们",
    stayUpdated: "保持关注",
    newsletterDesc:
      "在您的邮箱中获取最新的特许经营新闻、E-2 签证动态和行业洞见。",
    newsletterPlaceholder: "输入您的电子邮箱",
    subscribe: "订阅",
    newsletterSuccess: "订阅成功！我们会向您推送最新消息。",
    requestInfo: "索取资料",
    legalHeading: "法律声明",
    disclaimerLead:
      "本网站仅供一般参考之用 —— 它并非出售特许经营的要约，也不构成法律、移民、税务或财务建议。",
    disclaimerParagraphs: [
      "本网站信息仅供一般参考和教育之用，并非出售特许经营的要约，也不构成购买特许经营要约的招揽。特许经营仅通过符合美国联邦贸易委员会（FTC）特许经营规则（16 CFR 第 436 部分）及适用各州特许经营法律的《特许经营披露文件》（FDD）提供和出售。某些州对特许经营的提供和销售进行监管，并要求注册或备案；New Dawn Franchising 仅在我们已注册或获豁免的州提供或出售特许经营，并且只有在满足适用的销售前注册、备案和披露要求并依法交付 FDD 之后。",
      "New Dawn Franchising LLC 是特许经营商，而非律师事务所。本网站上的任何内容均不构成法律、移民、税务或财务建议，使用本网站或与我们联系不会建立任何律师-客户关系或其他专业关系。我们不提供移民服务，也不为您设立法律实体 —— 这由您自己的律师完成。E-2 条约投资者签证信息仅为一般性和教育性内容；移民法律和符合条约的国家会随时间变化。E-2 签证的资格和批准完全由美国政府决定（美国国务院领事官员，以及负责身份变更或延期的 USCIS），绝非由我们决定，且签证从不保证。",
      "在做出任何投资或与移民相关的决定之前，您应聘请您自己持有美国执照的移民律师以及合格的税务和财务顾问，并自行进行独立的尽职调查。信息按其现状提供，可能不完整或已过时，我们不对其准确性或完整性作出任何保证。任何收入、收益、结果或业绩数字均仅为示例，并不保证未来结果；个人结果各不相同。",
    ] as readonly string[],
    seeFullPrefix: "完整披露请参阅我们的",
    seeFullSuffix: "。",
    termsLabel: "条款与条件",
    rightsReserved: "保留所有权利。",
    privacy: "隐私政策",
    terms: "条款与条件",
    legal: "法律与免责声明",
  },
  ja: {
    groupPrefix: "",
    groupSuffix: " の一員 —— 自社技術と数十年の経験",
    outreachLine: "世界中の投資家をサポートしています —— 日本語対応可能",
    outreachLang: "ja",
    followFacebook: "Facebook でフォローする",
    stayUpdated: "最新情報を受け取る",
    newsletterDesc:
      "最新のフランチャイズ情報、E-2ビザの最新動向、業界インサイトをメールでお届けします。",
    newsletterPlaceholder: "メールアドレスを入力",
    subscribe: "登録",
    newsletterSuccess: "登録が完了しました！最新情報をお届けします。",
    requestInfo: "資料を請求する",
    legalHeading: "法的免責事項",
    disclaimerLead:
      "本ウェブサイトは一般的な情報提供のみを目的としており、フランチャイズの販売の申し出ではなく、法律・移民・税務・財務に関する助言でもありません。",
    disclaimerParagraphs: [
      "本サイトの情報は一般的な情報提供および教育目的でのみ提供されており、フランチャイズの販売の申し出、または購入の申し込みの勧誘ではありません。フランチャイズは、米国連邦取引委員会（FTC）のフランチャイズ規則（16 CFR 第436部）および適用される州のフランチャイズ法に準拠したフランチャイズ開示書類（FDD）を通じてのみ提供・販売されます。一部の州ではフランチャイズの提供および販売が規制されており、登録または届出が義務付けられています。New Dawn Franchising は、当社が登録済みまたは免除されている州においてのみ、かつ適用される販売前の登録・届出・開示要件を満たし、法律で定められたとおりに FDD を交付した後にのみ、フランチャイズを提供または販売します。",
      "New Dawn Franchising LLC はフランチャイザーであり、法律事務所ではありません。本サイトのいかなる内容も法律・移民・税務・財務に関する助言を構成するものではなく、本サイトの利用または当社への連絡によって弁護士・依頼者関係やその他の専門的関係が生じることはありません。当社は移民サービスを提供せず、お客様の法人設立も行いません——それはお客様ご自身の弁護士が行います。E-2条約投資家ビザに関する情報は一般的かつ教育的なものです。移民法および条約締約国は時とともに変化します。E-2ビザの適格性と承認は米国政府（国務省の領事官、および在留資格の変更・延長については USCIS）のみが決定するものであり、当社が決定することは決してなく、ビザが保証されることもありません。",
      "投資または移民に関する決定を行う前に、お客様ご自身の米国認可の移民弁護士、ならびに有資格の税務および財務アドバイザーに依頼し、独立したデューデリジェンスを実施してください。情報は「現状有姿」で提供され、不完全または古くなっている可能性があり、その正確性または完全性について当社は一切保証しません。収入、利益、成果、業績に関する数値はすべて例示にすぎず、将来の成果を保証するものではありません。個々の結果は異なります。",
    ] as readonly string[],
    seeFullPrefix: "完全な開示事項については当社の",
    seeFullSuffix: "をご覧ください。",
    termsLabel: "利用規約",
    rightsReserved: "無断複写・転載を禁じます。",
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    legal: "法的事項・免責事項",
  },
  ko: {
    groupPrefix: "",
    groupSuffix: " 의 일원 —— 자체 기술과 수십 년의 경험",
    outreachLine: "전 세계 투자자를 지원합니다 —— 한국어 상담 가능",
    outreachLang: "ko",
    followFacebook: "Facebook에서 팔로우하기",
    stayUpdated: "최신 소식 받기",
    newsletterDesc:
      "최신 프랜차이즈 소식, E-2 비자 업데이트, 업계 인사이트를 이메일로 받아보세요.",
    newsletterPlaceholder: "이메일 주소를 입력하세요",
    subscribe: "구독",
    newsletterSuccess: "구독이 완료되었습니다! 최신 소식을 전해 드리겠습니다.",
    requestInfo: "자료 요청",
    legalHeading: "법적 고지",
    disclaimerLead:
      "본 웹사이트는 일반적인 정보 제공만을 목적으로 하며, 프랜차이즈 판매 제안이 아니며 법률·이민·세무·재무 자문도 아닙니다.",
    disclaimerParagraphs: [
      "본 사이트의 정보는 일반적인 정보 제공 및 교육 목적으로만 제공되며, 프랜차이즈를 판매하기 위한 제안이나 구매 제안의 권유가 아닙니다. 프랜차이즈는 미국 연방거래위원회(FTC) 프랜차이즈 규칙(16 CFR Part 436) 및 적용 가능한 주 프랜차이즈 법률을 준수하는 프랜차이즈 공개 문서(FDD)를 통해서만 제공 및 판매됩니다. 일부 주는 프랜차이즈의 제공 및 판매를 규제하며 등록 또는 신고를 요구합니다. New Dawn Franchising은 당사가 등록되어 있거나 면제된 주에서만, 그리고 적용 가능한 판매 전 등록·신고·공개 요건을 충족하고 법률에 따라 FDD를 전달한 후에만 프랜차이즈를 제공하거나 판매합니다.",
      "New Dawn Franchising LLC은 프랜차이즈 본사이며 법률 사무소가 아닙니다. 본 사이트의 어떠한 내용도 법률·이민·세무·재무 자문을 구성하지 않으며, 사이트 이용이나 당사와의 연락으로 변호사-의뢰인 관계 또는 기타 전문적 관계가 형성되지 않습니다. 당사는 이민 서비스를 제공하지 않으며 귀하의 법인을 설립하지 않습니다——이는 귀하 자신의 변호사가 수행합니다. E-2 조약 투자자 비자 정보는 일반적이고 교육적인 내용이며, 이민법과 조약 체결국은 시간이 지남에 따라 변경됩니다. E-2 비자의 자격과 승인은 오직 미국 정부(국무부 영사관, 신분 변경 또는 연장의 경우 USCIS)가 결정하며, 당사가 결정하지 않고, 비자는 결코 보장되지 않습니다.",
      "투자 또는 이민 관련 결정을 내리기 전에 귀하 자신의 미국 면허 이민 변호사와 자격을 갖춘 세무 및 재무 고문을 선임하고 독립적인 실사를 수행해야 합니다. 정보는 '있는 그대로' 제공되며, 불완전하거나 오래되었을 수 있고, 당사는 그 정확성이나 완전성에 대해 어떠한 보증도 하지 않습니다. 모든 소득, 수익, 결과 또는 실적 수치는 예시일 뿐이며 미래 결과를 보장하지 않습니다. 개별 결과는 다를 수 있습니다.",
    ] as readonly string[],
    seeFullPrefix: "전체 공개 사항은 당사의 ",
    seeFullSuffix: "을 참조하십시오.",
    termsLabel: "이용약관",
    rightsReserved: "모든 권리 보유.",
    privacy: "개인정보 처리방침",
    terms: "이용약관",
    legal: "법적 고지 및 면책조항",
  },
  tr: {
    groupPrefix: "",
    groupSuffix: " bünyesindedir —— özel teknoloji, onlarca yıllık deneyim",
    outreachLine: "Dünyanın her yerinden yatırımcılara hizmet veriyoruz —— Türkçe konuşuyoruz",
    outreachLang: "tr",
    followFacebook: "Bizi Facebook'ta takip edin",
    stayUpdated: "Güncel kalın",
    newsletterDesc:
      "En son franchise haberlerini, E-2 vizesi güncellemelerini ve sektör analizlerini e-postanıza alın.",
    newsletterPlaceholder: "E-posta adresinizi girin",
    subscribe: "Abone ol",
    newsletterSuccess: "Kaydınız alındı! Sizi en son haberlerle güncel tutacağız.",
    requestInfo: "Bilgi isteyin",
    legalHeading: "Yasal Uyarı",
    disclaimerLead:
      "Bu web sitesi yalnızca genel bilgilendirme amaçlıdır — bir franchise satış teklifi değildir ve hukuki, göçmenlik, vergi veya mali danışmanlık niteliği taşımaz.",
    disclaimerParagraphs: [
      "Bu sitedeki bilgiler yalnızca genel bilgilendirme ve eğitim amacıyla sağlanmaktadır ve bir franchise satışı teklifi ya da satın alma teklifi daveti değildir. Bir franchise yalnızca, FTC Franchise Kuralı'na (16 CFR Bölüm 436) ve geçerli eyalet franchise yasalarına uygun bir Franchise Açıklama Belgesi (FDD) aracılığıyla sunulur ve satılır. Bazı eyaletler franchise sunumunu ve satışını düzenler ve kayıt veya bildirim gerektirir; New Dawn Franchising, yalnızca kayıtlı veya muaf olduğumuz eyaletlerde ve yalnızca geçerli satış öncesi kayıt, bildirim ve açıklama gerekliliklerini karşıladıktan ve yasaların gerektirdiği şekilde FDD'yi teslim ettikten sonra bir franchise sunar veya satar.",
      "New Dawn Franchising LLC bir franchise verendir, bir hukuk bürosu değildir. Bu sitedeki hiçbir şey hukuki, göçmenlik, vergi veya mali danışmanlık niteliği taşımaz ve sitenin kullanılması veya bizimle iletişime geçilmesi avukat-müvekkil ilişkisi ya da başka bir profesyonel ilişki oluşturmaz. Göçmenlik hizmetleri sunmuyoruz ve tüzel kişiliğinizi kurmuyoruz — bunu kendi avukatınız yapar. E-2 anlaşmalı yatırımcı vizesi bilgileri geneldir ve eğitim amaçlıdır; göçmenlik yasaları ve anlaşmalı ülkeler zamanla değişir. E-2 vizesi uygunluğu ve onayı yalnızca ABD hükümeti (Dışişleri Bakanlığı konsolosluk memurları ve statü değişikliği veya uzatması için USCIS) tarafından belirlenir, asla bizim tarafımızdan değil ve bir vize asla garanti edilmez.",
      "Herhangi bir yatırım veya göçmenlikle ilgili karar vermeden önce, kendi ABD lisanslı göçmenlik avukatınıza ve nitelikli vergi ve mali danışmanlarınıza başvurmalı ve kendi bağımsız durum tespitinizi yapmalısınız. Bilgiler \"olduğu gibi\" sağlanır, eksik veya güncel olmayabilir ve doğruluğu veya eksiksizliği konusunda hiçbir garanti vermeyiz. Tüm gelir, kazanç, sonuç veya performans rakamları yalnızca örnektir ve gelecekteki sonuçların garantisi değildir; bireysel sonuçlar değişir.",
    ] as readonly string[],
    seeFullPrefix: "Tüm açıklamalar için ",
    seeFullSuffix: " belgemize bakın.",
    termsLabel: "Şartlar ve Koşullar",
    rightsReserved: "Tüm hakları saklıdır.",
    privacy: "Gizlilik Politikası",
    terms: "Şartlar ve Koşullar",
    legal: "Yasal Uyarılar",
  },
} as const;

type FooterCopy = (typeof FOOTER_I18N)[keyof typeof FOOTER_I18N];

function localeFromPath(path: string): keyof typeof FOOTER_I18N {
  for (const code of ["es", "fr", "zh", "ja", "ko", "tr"] as const) {
    if (path === `/${code}` || path.startsWith(`/${code}/`)) return code;
  }
  return "en";
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

type NavItem = { href: string; label: string; id: string };
type NavGroup = { label: string; id: string; items: NavItem[] };
type DesktopNavEntry = NavItem | NavGroup;

// Top-level entries and the items inside each dropdown are kept in alphabetical
// order by label. (Portals stays a separate trailing utility dropdown.)
const DESKTOP_NAV: DesktopNavEntry[] = [
  {
    label: "About", id: "about-group",
    items: [
      { href: "/about", label: "About Us", id: "about" },
      { href: "/insurance", label: "Insurance", id: "insurance" },
      { href: "/team", label: "Our Team", id: "team" },
      { href: "/property-management", label: "Property Management", id: "property-management" },
      { href: "/telecom", label: "Telecom (VoIP)", id: "telecom" },
      { href: "/why-new-dawn", label: "What Makes Us Different", id: "why-new-dawn" },
    ],
  },
  { href: "/blog", label: "Blog", id: "blog" },
  { href: "/contact", label: "Contact", id: "contact" },
  {
    label: "Franchise", id: "franchise-group",
    items: [
      { href: "/e2-snapon", label: "E-2 SnapOn", id: "e2-snapon" },
      { href: "/e2-visa-franchise", label: "E-2 Visa Franchise", id: "e2-visa-franchise" },
      { href: "/e-2-visa-process", label: "E-2 Visa Process", id: "e2-process" },
      { href: "/process", label: "Process", id: "process" },
      { href: "/request-fdd", label: "Request FDD", id: "request-fdd" },
      { href: "/territories", label: "Territories", id: "territories" },
      { href: "/e2-fit", label: "Why E-2?", id: "e2" },
    ],
  },
  {
    label: "Services", id: "services-group",
    items: [
      { href: "/marketing", label: "Marketing", id: "marketing" },
      { href: "/real-estate", label: "Real Estate", id: "real-estate" },
    ],
  },
];

function isNavGroup(entry: DesktopNavEntry): entry is NavGroup {
  return "items" in entry;
}

// Mobile nav mirrors the desktop grouping so sub-items render nested (indented)
// beneath their parent. Items not part of a group stay as top-level links.
// Home stays first (conventional); every other entry — and the items inside each
// group — is alphabetical by label, mirroring the desktop nav.
const MOBILE_NAV: DesktopNavEntry[] = [
  { href: "/", label: "Home", id: "home" },
  {
    label: "About", id: "about-group",
    items: [
      { href: "/about", label: "About Us", id: "about" },
      { href: "/insurance", label: "Insurance", id: "insurance" },
      { href: "/team", label: "Our Team", id: "team" },
      { href: "/property-management", label: "Property Management", id: "property-management" },
      { href: "/telecom", label: "Telecom (VoIP)", id: "telecom" },
      { href: "/why-new-dawn", label: "What Makes Us Different", id: "why-new-dawn" },
    ],
  },
  { href: "/blog", label: "Blog", id: "blog" },
  { href: "/contact", label: "Contact", id: "contact" },
  {
    label: "Franchise", id: "franchise-group",
    items: [
      { href: "/e2-snapon", label: "E-2 SnapOn", id: "e2-snapon" },
      { href: "/e2-visa-franchise", label: "E-2 Visa Franchise", id: "e2-visa-franchise" },
      { href: "/e-2-visa-process", label: "E-2 Visa Process", id: "e2-process" },
      { href: "/process", label: "Process", id: "process" },
      { href: "/request-fdd", label: "Request FDD", id: "request-fdd" },
      { href: "/territories", label: "Territories", id: "territories" },
      { href: "/e2-fit", label: "Why E-2?", id: "e2" },
    ],
  },
  { href: "/legal", label: "Legal & Disclaimers", id: "legal" },
  { href: "/quiz", label: "Quiz", id: "quiz" },
  { href: "/brokers", label: "Referral Partners", id: "brokers" },
  {
    label: "Services", id: "services-group",
    items: [
      { href: "/marketing", label: "Marketing", id: "marketing" },
      { href: "/real-estate", label: "Real Estate", id: "real-estate" },
    ],
  },
];

const PORTALS = [
  {
    href: "/training",
    icon: GraduationCap,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Franchisee Training Academy",
    description: "Access your training, modules and resources",
    id: "training-portal",
  },
  {
    href: "/marketing-portal",
    icon: Megaphone,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    title: "Franchisee Marketing Academy",
    description: "Manage your leads and outreach tools",
    id: "marketing-portal",
  },
  {
    href: "/brokers",
    icon: Handshake,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "Broker's Portal",
    description: "Register clients and track their pipeline stage",
    id: "brokers-portal",
  },
  {
    href: "/login",
    icon: ShieldCheck,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    title: "Admin",
    description: "Internal CRM, AI agent & reporting",
    id: "admin-portal",
  },
];

function PortalsDropdown({ location: loc }: { location: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isActive = PORTALS.some((p) => loc.startsWith(p.href) && p.href !== "/login") || loc === "/login";
  const handleEnter = () => { clearTimeout(timeout.current); setOpen(true); };
  const handleLeave = () => { timeout.current = setTimeout(() => setOpen(false), 150); };

  useEffect(() => { setOpen(false); }, [loc]);

  return (
    <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        data-testid="link-nav-portals"
        className={
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-black/[0.03] " +
          (isActive ? "text-foreground font-medium" : "text-foreground/70 hover:text-foreground")
        }
        onClick={() => setOpen((v) => !v)}
      >
        Portals
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border bg-white p-2 shadow-xl">
          {PORTALS.map((portal) => (
            <Link
              key={portal.id}
              data-testid={`link-nav-${portal.id}`}
              href={portal.href}
              className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-slate-50 group"
            >
              <div className={`size-9 rounded-lg ${portal.iconBg} flex items-center justify-center shrink-0`}>
                <portal.icon className={`size-4 ${portal.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{portal.title}</p>
                <p className="text-xs text-foreground/60 mt-0.5 leading-snug">{portal.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NavDropdown({ group, location: loc }: { group: NavGroup; location: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isGroupActive = group.items.some((item) => loc === item.href);

  const handleEnter = () => { clearTimeout(timeout.current); setOpen(true); };
  const handleLeave = () => { timeout.current = setTimeout(() => setOpen(false), 150); };

  useEffect(() => { setOpen(false); }, [loc]);

  return (
    <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        data-testid={`link-nav-${group.id}`}
        className={
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-black/[0.03] " +
          (isGroupActive ? "text-foreground font-medium" : "text-foreground/70 hover:text-foreground")
        }
        onClick={() => setOpen((v) => !v)}
      >
        {group.label}
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border bg-white p-1.5 shadow-lg">
          {group.items.map((item) => (
            <Link
              key={item.id}
              data-testid={`link-nav-${item.id}`}
              href={item.href}
              className={
                "block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-black/[0.03] " +
                (loc === item.href ? "text-foreground font-medium" : "text-foreground/70 hover:text-foreground")
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNavGroup({ group, location: loc }: { group: NavGroup; location: string }) {
  const hasActiveChild = group.items.some((item) => loc === item.href);
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        type="button"
        data-testid={`link-mobile-nav-${group.id}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          "flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-black/[0.03] " +
          (hasActiveChild ? "text-foreground" : "text-foreground/70 hover:text-foreground")
        }
      >
        {group.label}
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-3 flex flex-col border-l pl-2">
          {group.items.map((item) => {
            const isActive = loc === item.href;
            return (
              <Link
                key={item.id}
                data-testid={`link-mobile-nav-${item.id}`}
                href={item.href}
                className={
                  "rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-black/[0.03] " +
                  (isActive
                    ? "bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))] font-medium"
                    : "text-foreground/60 hover:text-foreground")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewsletterSignup({ t }: { t: FooterCopy }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Something went wrong");
      }
      setStatus("success");
      setEmail("");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div data-testid="newsletter-success" className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
        <Mail className="size-4 shrink-0" />
        {t.newsletterSuccess}
      </div>
    );
  }

  return (
    <form data-testid="form-newsletter" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          data-testid="input-newsletter-email"
          type="email"
          required
          placeholder={t.newsletterPlaceholder}
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          className="h-9 bg-white text-sm"
        />
        <Button data-testid="button-newsletter-submit" type="submit" size="sm" disabled={status === "loading"} className="shrink-0 gap-1.5">
          {status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {t.subscribe}
        </Button>
      </div>
      {status === "error" && (
        <p data-testid="text-newsletter-error" className="text-xs text-red-600">{errorMsg}</p>
      )}
    </form>
  );
}

// ─── WhatsApp icon SVG ────────────────────────────────────────────────────────
function WAIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string; ts: number };

const CALENDLY_RE = /https?:\/\/calendly\.com\/[^\s)>\]"]+/g;

function renderMsgContent(text: string) {
  const urls = text.match(CALENDLY_RE);
  if (!urls) return <span>{text}</span>;
  const url = urls[0];
  const parts = text.split(url);
  return (
    <>
      {parts[0] && <span>{parts[0]}</span>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 mt-2 bg-[#25D366] text-white rounded-xl px-3 py-2 text-xs font-semibold hover:bg-[#1ebe5d] transition-colors"
      >
        📅 Book a Call with Dylan →
      </a>
      {parts[1] && <span className="block mt-1">{parts[1]}</span>}
    </>
  );
}

function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [notifDot, setNotifDot] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey! 👋 Dylan here — what can I help you with today?", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLeaveMsg, setShowLeaveMsg] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [leaveSent, setLeaveSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: waConfig } = useQuery<{ number: string }>({
    queryKey: ["/api/config/whatsapp"],
    queryFn: () => fetch("/api/config/whatsapp").then((r) => r.json()),
    staleTime: Infinity,
  });
  const WA_NUMBER = waConfig?.number || "19158995538";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setNotifDot(false);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [open]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMsgs: ChatMessage[] = [...messages, { role: "user", content: userMsg, ts: Date.now() }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hey, seems like I'm having a quick tech moment 😅 Try WhatsApp or leave me a message below!", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitLeaveMsg() {
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: leaveForm.name.trim(),
          email: leaveForm.email.trim(),
          phone: leaveForm.phone.trim(),
          message: `[Chat Widget] ${leaveForm.message.trim()}`,
        }),
      });
      setLeaveSent(true);
    } catch {
      setLeaveSent(true);
    }
  }

  const lastUserMsg = messages.filter((m) => m.role === "user").at(-1)?.content || "";
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    lastUserMsg
      ? `Hi Dylan! I was just chatting about: "${lastUserMsg.slice(0, 120)}"`
      : "Hi! I'm interested in the New Dawn Franchise opportunity."
  )}`;

  return (
    <>
      {/* ── Chat window ── */}
      <div
        className={`fixed bottom-24 right-5 z-50 flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/8 transition-all duration-300 ${
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-5 pointer-events-none"
        }`}
        style={{ width: "min(22rem, calc(100vw - 2.5rem))", maxHeight: "min(560px, 80vh)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 rounded-t-2xl bg-[#25D366] px-4 py-3 shrink-0">
          <div className="relative shrink-0">
            <img src="/dylan-headshot.png" alt="Dylan" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" onError={(e) => { (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=Dylan+Delaney&background=1a3a4a&color=fff&size=80"; }} />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-200 border-2 border-[#25D366] rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Dylan Delaney</p>
            <p className="text-xs text-white/80">Typically replies instantly</p>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-full p-1 text-white/70 hover:bg-white/20 hover:text-white transition-colors" aria-label="Close chat">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: "#e5ddd5" }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <img src="/dylan-headshot.png" alt="Dylan" className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5" onError={(e) => { (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=D&background=1a3a4a&color=fff&size=40"; }} />
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-[#dcf8c6] text-gray-800 rounded-br-none"
                    : "bg-white text-gray-800 rounded-bl-none"
                }`}
              >
                {m.role === "assistant" ? renderMsgContent(m.content) : <span>{m.content}</span>}
                <div className="text-[10px] mt-0.5 text-gray-400 text-right">
                  {new Date(m.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-1.5 justify-start">
              <img src="/dylan-headshot.png" alt="Dylan" className="w-6 h-6 rounded-full object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=D&background=1a3a4a&color=fff&size=40"; }} />
              <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="ml-1.5 text-[11px] text-gray-400">Dylan is typing…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input row */}
        <div className="px-3 py-2 bg-[#f0f0f0] border-t border-black/5 shrink-0 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Message Dylan…"
            disabled={loading}
            className="flex-1 text-sm bg-white rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-[#25D366]/40 transition-all shadow-sm"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom CTAs */}
        <div className="px-3 pb-3 pt-2 bg-white rounded-b-2xl shrink-0 space-y-2">
          <div className="flex gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#25D366] border border-[#25D366] rounded-xl py-2 hover:bg-[#25D366]/5 transition-colors"
            >
              <WAIcon className="w-3.5 h-3.5" />
              Continue on WhatsApp
            </a>
            <button
              onClick={() => { setShowLeaveMsg((v) => !v); setLeaveSent(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Leave a Message
            </button>
          </div>

          {showLeaveMsg && !leaveSent && (
            <div className="space-y-1.5">
              <input
                value={leaveForm.name}
                onChange={(e) => setLeaveForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name *"
                className="w-full text-xs bg-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
              <input
                value={leaveForm.email}
                onChange={(e) => setLeaveForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email address *"
                type="email"
                className="w-full text-xs bg-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
              <input
                value={leaveForm.phone}
                onChange={(e) => setLeaveForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Phone number (optional)"
                type="tel"
                className="w-full text-xs bg-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
              <textarea
                value={leaveForm.message}
                onChange={(e) => setLeaveForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Brief message… *"
                rows={2}
                className="w-full text-xs bg-gray-100 rounded-lg px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-[#25D366]/40"
              />
              <button
                onClick={submitLeaveMsg}
                disabled={!leaveForm.name || !leaveForm.email || !leaveForm.message}
                className="w-full py-2 bg-[#25D366] text-white text-xs font-semibold rounded-lg hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send Message
              </button>
            </div>
          )}

          {showLeaveMsg && leaveSent && (
            <p className="text-xs text-center text-green-600 font-medium py-1">Thanks! Dylan will call you back shortly. 😊</p>
          )}
        </div>
      </div>

      {/* ── Floating trigger button ── */}
      <div className="fixed bottom-5 right-5 z-50 group">
        <button
          data-testid="button-whatsapp-chat"
          onClick={() => setOpen((v) => !v)}
          className="relative flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Chat with us"
        >
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#25D366] opacity-30" />
          {open ? <X className="relative size-6" /> : <WAIcon className="relative size-7" />}
        </button>
        {/* Red notification dot */}
        {notifDot && !open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse pointer-events-none" />
        )}
        {/* Tooltip */}
        {!open && (
          <span className="absolute bottom-full right-0 mb-2 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            Chat with us
          </span>
        )}
      </div>
    </>
  );
}

// ─── Visitor tracking beacon ──────────────────────────────────────────────────
const SKIP_TRACK = ["/crm", "/login", "/seo", "/marketing", "/real-estate", "/brokers"];

function getOrCreateSessionId(): string {
  try {
    let sid = localStorage.getItem("_nd_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("_nd_sid", sid);
    }
    return sid;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function useVisitorTracking(location: string) {
  const pageStartRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>("");
  const sessionId = useRef<string>(getOrCreateSessionId());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send heartbeat every 30 s
  useEffect(() => {
    heartbeatRef.current = setInterval(async () => {
      if (SKIP_TRACK.some((p) => location.startsWith(p))) return;
      try {
        await fetch("/api/track/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId.current, seconds: 30 }),
        });
      } catch {}
    }, 30000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, []);

  // Track page view on route change
  useEffect(() => {
    if (SKIP_TRACK.some((p) => location.startsWith(p))) return;
    if (lastPathRef.current === location) return;
    lastPathRef.current = location;
    pageStartRef.current = Date.now();
    try {
      fetch("/api/track/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          path: location,
          title: document.title,
          referrer: document.referrer || "",
        }),
      }).catch(() => {});
    } catch {}
  }, [location]);
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = FOOTER_I18N[localeFromPath(location)];

  useVisitorTracking(location);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div data-testid="site-shell" className="min-h-screen">
      <header data-testid="header-site" className="sticky top-0 z-50 border-b bg-white">
        <div className="nh-container flex h-20 items-center justify-between gap-4 md:h-20">
          <Link
            data-testid="link-brand"
            href="/"
            className="flex items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-black/[0.03]"
          >
            <img
              data-testid="img-logo"
              src={logo}
              alt="New Dawn Franchising logo"
              translate="no"
              className="h-16 sm:h-16 md:h-16 lg:h-20 w-auto"
            />
          </Link>

          <nav data-testid="nav-site" className="hidden items-center gap-0.5 lg:flex">
            {DESKTOP_NAV.map((entry) => {
              if (isNavGroup(entry)) {
                return <NavDropdown key={entry.id} group={entry} location={location} />;
              }
              const isActive = location === entry.href;
              return (
                <Link
                  key={entry.id}
                  data-testid={`link-nav-${entry.id}`}
                  href={entry.href}
                  className={
                    "rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-black/[0.03] " +
                    (isActive ? "text-foreground font-medium" : "text-foreground/70 hover:text-foreground")
                  }
                >
                  {entry.label}
                </Link>
              );
            })}
            <PortalsDropdown location={location} />
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <span data-testid="badge-spanish" className="hidden items-center gap-1 rounded-full border bg-white/60 px-2.5 py-1 text-[11px] font-medium text-foreground/60 lg:inline-flex">
              <Globe2 className="size-3" />
              <span>E-2 investor guidance</span>
            </span>
            <Button data-testid="button-top-cta" className="hidden gap-2 lg:inline-flex" asChild>
              <Link href="/request-fdd">
                Request FDD
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <button
              data-testid="button-mobile-menu"
              className="inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 transition-colors hover:bg-black/[0.03] hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="size-8" /> : <Menu className="size-8" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          data-testid="mobile-menu-overlay"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        data-testid="mobile-menu"
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Menu</span>
          <button
            data-testid="button-close-mobile-menu"
            className="rounded-lg p-2 text-foreground/70 transition-colors hover:bg-black/[0.03] hover:text-foreground"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col p-4 overflow-y-auto max-h-[calc(100vh-80px-180px)]">
          {MOBILE_NAV.map((entry) => {
            if (isNavGroup(entry)) {
              return <MobileNavGroup key={entry.id} group={entry} location={location} />;
            }
            const isActive = location === entry.href;
            return (
              <Link
                key={entry.id}
                data-testid={`link-mobile-nav-${entry.id}`}
                href={entry.href}
                className={
                  "rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-black/[0.03] " +
                  (isActive
                    ? "bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]"
                    : "text-foreground/70 hover:text-foreground")
                }
              >
                {entry.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t pt-3">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-foreground/40">Portals</p>
            {PORTALS.map((portal) => (
              <Link
                key={portal.id}
                data-testid={`link-mobile-nav-${portal.id}`}
                href={portal.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-black/[0.03] hover:text-foreground"
              >
                <div className={`size-7 rounded-md ${portal.iconBg} flex items-center justify-center shrink-0`}>
                  <portal.icon className={`size-3.5 ${portal.iconColor}`} />
                </div>
                <span>{portal.title}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-center gap-1.5 text-xs text-foreground/50">
            <Globe2 className="size-3" />
            <span>E-2 investor guidance</span>
          </div>
          <Button data-testid="button-mobile-cta" className="w-full gap-2" asChild>
            <Link href="/request-fdd">
              Request FDD
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={`mailto:${COMPANY.email}?subject=New%20Horizons%20Franchising%20Inquiry`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-black/[0.03] hover:text-foreground"
            >
              <Mail className="size-4" />
              Email us
            </a>
            <a
              href={`tel:${COMPANY.phoneTel}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-black/[0.03] hover:text-foreground"
            >
              <Phone className="size-4" />
              {COMPANY.phone}
            </a>
          </div>
        </div>
      </div>

      <main data-testid="main-site">{children}</main>

      <AIChatWidget />

      <footer data-testid="footer-site" className="py-10">
        <div className="nh-container">
          <div className="border-t pt-8">
            <div className="flex flex-col gap-8 md:flex-row md:justify-between">
              <div className="flex-1">
                <div data-testid="text-footer-brand" className="text-sm font-semibold" translate="no">
                  New Dawn Franchising
                </div>
                <a data-testid="link-footer-address" href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  <MapPin className="size-3 shrink-0" />
                  {COMPANY.addressFull}
                </a>
                <div data-testid="text-footer-group" className="mt-1 text-xs text-muted-foreground/70">
                  {t.groupPrefix}<span translate="no">New Dawn Franchising Group of Companies&trade;</span>{t.groupSuffix}
                </div>
                <div data-testid="text-footer-spanish" className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Globe2 className="size-3" />
                  <span lang={t.outreachLang}>{t.outreachLine}</span>
                </div>
                <a data-testid="link-footer-facebook" href={COMPANY.facebook} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  <FacebookIcon className="size-4" />
                  {t.followFacebook}
                </a>
              </div>

              <div className="w-full max-w-sm">
                <div data-testid="text-newsletter-title" className="text-sm font-semibold">{t.stayUpdated}</div>
                <p data-testid="text-newsletter-desc" className="mt-1 text-xs text-muted-foreground">
                  {t.newsletterDesc}
                </p>
                <div className="mt-3">
                  <NewsletterSignup t={t} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-6">
              <Button data-testid="button-footer-phone" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  {COMPANY.phone}
                </a>
              </Button>
              <Button data-testid="button-footer-email" variant="secondary" className="gap-2" asChild>
                <a href={`mailto:${COMPANY.email}`}>
                  <Mail className="size-4" />
                  {COMPANY.email}
                </a>
              </Button>
              <Button data-testid="button-footer-facebook" variant="secondary" className="gap-2" asChild>
                <a href={COMPANY.facebook} target="_blank" rel="noopener noreferrer">
                  <FacebookIcon className="size-4" />
                  Facebook
                </a>
              </Button>
              <Button data-testid="button-footer-contact" className="gap-2" asChild>
                <Link href="/contact">{t.requestInfo}</Link>
              </Button>
            </div>
            <div data-testid="footer-legal-disclaimer" className="mt-8 border-t pt-6">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {t.legalHeading}
              </div>
              <p data-testid="text-disclaimer-lead" className="mt-2 max-w-4xl text-[11px] font-medium leading-relaxed text-muted-foreground/75">
                {t.disclaimerLead}
              </p>
              <div className="mt-2 max-w-4xl space-y-2">
                {t.disclaimerParagraphs.map((para, i) => (
                  <p key={i} className="text-[11px] leading-relaxed text-muted-foreground/55">
                    {para}
                  </p>
                ))}
                <p className="text-[11px] leading-relaxed text-muted-foreground/55">
                  {t.seeFullPrefix}
                  <Link href="/terms" data-testid="link-disclaimer-terms" className="underline underline-offset-2 transition-colors hover:text-muted-foreground">
                    {t.termsLabel}
                  </Link>
                  {t.seeFullSuffix}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 border-t pt-6 text-xs text-muted-foreground/60">
              <span>&copy; {new Date().getFullYear()} New Dawn Franchising LLC. {t.rightsReserved}</span>
              <Link href="/privacy-policy" data-testid="link-footer-privacy" className="hover:text-muted-foreground transition-colors">{t.privacy}</Link>
              <Link href="/terms" data-testid="link-footer-terms" className="hover:text-muted-foreground transition-colors">{t.terms}</Link>
              <Link href="/legal" data-testid="link-footer-legal" className="hover:text-muted-foreground transition-colors">{t.legal}</Link>
              <LanguageSwitcher className="ml-auto" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
