import type { CampaignTrackStep } from "./campaign-tracks";

const partner = [
  ["A review guide for franchise referrals", "I'm Dylan at New Dawn Franchising. We offer property management and other franchise businesses. I've put together a short review guide covering owner responsibilities, costs, operating evidence and the documents to request before considering a referral.", "Would that guide be useful for your review?"],
  ["What to check before a referral", "Our professional review guide is available at https://www.newdawnfranchising.com/partner-review. It covers the questions to ask about the FDD, staffing, owner control and contractual conditions; it is not a substitute for reviewing those documents.", "Is there a particular document you would need to evaluate fit?"],
  ["Closing my follow-up", "I'll close my follow-up here. If a franchise business becomes relevant to your work, you can reply to this email to request the review guide or current disclosure materials.", "Would you like either before I close the loop?"],
];
const investor = [
  ["Comparing franchise ownership options", "I'm Dylan at New Dawn Franchising. Our property management business is one option to evaluate alongside the owner's responsibilities, staffing, licensing requirements and total costs.", "Would a guide to those questions help with your comparison?"],
  ["Questions to review before investing", "A useful comparison starts with the current FDD, your role in the business and the capital needed beyond the initial fees. Our review guide is at https://www.newdawnfranchising.com/partner-review; the documents and signed agreements contain the terms.", "Which part of operating a franchise would you want to understand first?"],
  ["Closing my follow-up", "I'll close my follow-up here. If you want to revisit New Dawn later, you can reply to this email for current disclosure materials. Any visa-related plans should be assessed with your own immigration counsel.", "Would you like the disclosure materials before I close the loop?"],
];
/** Keep stable step identifiers while limiting the automated send path to three emails. */
export function reviewedEmailSteps(steps: CampaignTrackStep[], audience: "broker" | "client"): CampaignTrackStep[] {
  let emailIndex = 0;
  return steps.map(step => {
    if (step.stepType !== "email") return step;
    const index = emailIndex++;
    const [subject, body, question] = (audience === "client" ? investor : partner)[Math.min(index, 2)];
    const bodyText = `Hi {{firstName}},\n\n${body}\n\n${question}\n\nBest,\nDylan`;
    return { ...step, delayDays: index * 7, stepName: subject, subject, bodyText,
      bodyHtml: bodyText.split("\n\n").map(p => `<p>${p.replaceAll("\n", "<br/>")}</p>`).join("") };
  });
}
