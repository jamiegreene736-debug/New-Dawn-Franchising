/**
 * First-touch copy for introducer outreach.
 * v4.1 attorney rules: petition problem first, no partner fee in email 1.
 * {{firmHook}} is an optional opening sentence from the firm's own site.
 * {{name}} is the full name (drip personalize also accepts {{firstName}}).
 */

import { EMAIL_STYLE } from "./campaign-tracks";

export type FirstTouchLang = "en" | "es" | "ko";

export interface FirstTouchCopy {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  linkedinNote: string;
}

const wrap = (inner: string) => `<div style="${EMAIL_STYLE}">${inner}</div>`;

export const FIRST_TOUCH: Record<FirstTouchLang, FirstTouchCopy> = {
  en: {
    subject: "When your E-2 client is ready — and still has no business",
    bodyHtml: wrap(`
  <p>Hi {{name}},</p>
  <p>{{firmHook}}When an E-2 client is ready to file but still does not have a qualifying U.S. business, that is usually what stalls the petition.</p>
  <p>That is the gap we fill. New Dawn is a franchise built for the E-2: the client's $225,000 sits in escrow — with an attorney they choose — until the visa is approved. Local teams run day-to-day so your client can direct the business from anywhere in the U.S.</p>
  <p>I am not asking you to recommend anything from an email. I just want to know whether this is a problem you actually see. What kind of E-2 clients are in front of you right now?</p>
  <p>Best,<br/>Dylan</p>
`),
    bodyText: `Hi {{name}},

{{firmHook}}When an E-2 client is ready to file but still does not have a qualifying U.S. business, that is usually what stalls the petition.

That is the gap we fill. New Dawn is a franchise built for the E-2: the client's $225,000 sits in escrow — with an attorney they choose — until the visa is approved. Local teams run day-to-day so your client can direct the business from anywhere in the U.S.

I am not asking you to recommend anything from an email. I just want to know whether this is a problem you actually see. What kind of E-2 clients are in front of you right now?

Best,
Dylan`,
    linkedinNote:
      "Hi {{name}} — I work with attorneys whose E-2 clients are ready to file but still need a qualifying U.S. business. That's the gap we fill. Would be glad to connect.",
  },
  es: {
    subject: "Cuando su cliente E-2 está listo — y aún no tiene empresa",
    bodyHtml: wrap(`
  <p>Hola {{name}},</p>
  <p>{{firmHook}}Cuando un cliente E-2 ya quiere presentar la petición y todavía no tiene un negocio calificado en EE.UU., eso suele ser lo que frena el caso.</p>
  <p>Eso es lo que resolvemos. New Dawn es una franquicia pensada para la E-2: los USD 225,000 del cliente quedan en escrow — con el abogado que ellos elijan — hasta que se apruebe la visa. Equipos locales operan el día a día para que su cliente dirija el negocio desde cualquier lugar de EE.UU.</p>
  <p>No le pido que recomiende nada a partir de un correo. Solo quiero saber si esto es un problema que usted ve de verdad. ¿Qué tipo de clientes E-2 tiene frente a usted ahora?</p>
  <p>Saludos,<br/>Dylan</p>
`),
    bodyText: `Hola {{name}},

{{firmHook}}Cuando un cliente E-2 ya quiere presentar la petición y todavía no tiene un negocio calificado en EE.UU., eso suele ser lo que frena el caso.

Eso es lo que resolvemos. New Dawn es una franquicia pensada para la E-2: los USD 225,000 del cliente quedan en escrow — con el abogado que ellos elijan — hasta que se apruebe la visa. Equipos locales operan el día a día para que su cliente dirija el negocio desde cualquier lugar de EE.UU.

No le pido que recomiende nada a partir de un correo. Solo quiero saber si esto es un problema que usted ve de verdad. ¿Qué tipo de clientes E-2 tiene frente a usted ahora?

Saludos,
Dylan`,
    linkedinNote:
      "Hola {{name}} — trabajo con abogados cuyos clientes E-2 ya quieren presentar y aún necesitan un negocio calificado en EE.UU. Ese es el hueco que cubrimos. Encantado de conectar.",
  },
  ko: {
    subject: "E-2 고객이 준비됐는데 아직 미국 사업체가 없을 때",
    bodyHtml: wrap(`
  <p>{{name}}님, 안녕하세요.</p>
  <p>{{firmHook}}E-2 고객이 청원 준비가 됐는데도 아직 요건을 갖춘 미국 사업체가 없으면, 보통 그 지점에서 건이 멈춥니다.</p>
  <p>저희가 그 공백을 채웁니다. New Dawn은 E-2에 맞춰 만든 프랜차이즈입니다. 고객의 $225,000는 비자가 승인될 때까지 — 고객이 지정한 변호사 에스크로에 — 보관됩니다. 현지 팀이 일상 운영을 맡아, 고객은 미국 어디서든 사업을 지휘할 수 있습니다.</p>
  <p>이메일 한 통으로 추천을 부탁드리는 것이 아닙니다. 실제로 이런 문제를 보고 계신지만 알고 싶습니다. 지금 앞에 계신 E-2 고객은 어떤 분들인가요?</p>
  <p>감사합니다,<br/>Dylan</p>
`),
    bodyText: `{{name}}님, 안녕하세요.

{{firmHook}}E-2 고객이 청원 준비가 됐는데도 아직 요건을 갖춘 미국 사업체가 없으면, 보통 그 지점에서 건이 멈춥니다.

저희가 그 공백을 채웁니다. New Dawn은 E-2에 맞춰 만든 프랜차이즈입니다. 고객의 $225,000는 비자가 승인될 때까지 — 고객이 지정한 변호사 에스크로에 — 보관됩니다. 현지 팀이 일상 운영을 맡아, 고객은 미국 어디서든 사업을 지휘할 수 있습니다.

이메일 한 통으로 추천을 부탁드리는 것이 아닙니다. 실제로 이런 문제를 보고 계신지만 알고 싶습니다. 지금 앞에 계신 E-2 고객은 어떤 분들인가요?

감사합니다,
Dylan`,
    linkedinNote:
      "{{name}}님, E-2 고객이 청원 준비는 됐는데 아직 미국 사업체가 없는 경우를 돕는 일을 합니다. 연결되면 좋겠습니다.",
  },
};

export function isFirstEmailStep(step: { stepOrder?: number; stepType?: string; stepName?: string | null }): boolean {
  const type = (step.stepType || "").toLowerCase();
  if (type !== "email") return false;
  if (step.stepOrder === 2) return true;
  return /touch 1|first email|ready — and still|listo — y aún|사업체가 없을/i.test(step.stepName || "");
}

export function isLinkedInConnectStep(step: { stepType?: string; stepOrder?: number }): boolean {
  const type = (step.stepType || "").toLowerCase();
  return type === "linkedin_connect" || (type === "linkedin" && (step.stepOrder ?? 0) <= 1);
}
