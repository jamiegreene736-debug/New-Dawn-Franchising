import { useEffect } from "react";
import { Link } from "wouter";

const topics = [
  ["Investment and ongoing costs", "Request the current FDD and review Items 5–7 for fees, estimated initial investment and additional capital. Confirm territory-specific costs and working-capital assumptions in writing."],
  ["Owner responsibilities", "Compare the franchise agreement and operating requirements with the proposed owner's actual authority, time commitment, staffing and local licensing needs. Evaluate the business as an operating investment."],
  ["Operating and financial evidence", "Review any financial performance representations in the current FDD Item 19, their scope and assumptions. Ask for supporting records and speak with current and former franchisees identified in Item 20."],
  ["Escrow and exit terms", "Request the actual agreements, release and refund conditions, exclusions, deadlines, counterparties and funding obligations. Evaluate any proposed buyback on its written conditions and counterparty capacity."],
  ["Immigration suitability", "Independent immigration counsel should assess treaty nationality, lawful funds, investment commitment, control and the proposed operating plan for the individual applicant. A franchise purchase does not establish visa eligibility or assure approval."],
  ["Referral arrangements", "Request written eligibility, disclosure, compensation and payment-trigger terms separately. Counsel and other regulated professionals should assess applicable conflict and professional rules before entering an arrangement."],
];
export default function PartnerReviewPage() {
  useEffect(() => { const previous = document.title; document.title = "Professional review guide | New Dawn Franchising"; return () => { document.title = previous; }; }, []);
  return <main className="mx-auto max-w-4xl px-6 py-14" data-testid="partner-review">
    <p className="text-sm uppercase tracking-widest text-muted-foreground">For attorneys and referral partners</p>
    <h1 className="text-4xl font-semibold mt-4 mb-5">Evaluate New Dawn for a client</h1>
    <p className="text-lg mb-8">Use this review guide to decide what information you need before considering a referral. It is a starting point for diligence; the current disclosure documents and signed agreements contain the terms.</p>
    <div className="grid gap-6 md:grid-cols-2">{topics.map(([title, body]) => <section className="border rounded-xl p-6" key={title}><h2 className="text-xl font-semibold mb-3">{title}</h2><p className="leading-relaxed text-muted-foreground">{body}</p></section>)}</div>
    <section className="mt-10 border-t pt-8"><h2 className="text-2xl font-semibold mb-3">Request documents for professional review</h2>
      <p className="mb-4">Email Dylan with your firm, role and the materials you want to review. You do not need to provide a client's identity, citizenship or investment timeline to start this conversation.</p>
      <a className="inline-block rounded-lg bg-primary text-primary-foreground px-5 py-3" href="mailto:dylan@newdawnfranchising.com?subject=Professional%20review%20materials">Email Dylan</a>
      <p className="mt-5 text-sm"><Link href="/property-management" className="underline">Property management overview</Link> · <Link href="/other-businesses" className="underline">Other business options</Link></p>
    </section>
  </main>;
}
