import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Building,
  CheckCircle2,
  ClipboardSignature,
  Clock,
  FileSignature,
  FileText,
  GraduationCap,
  Landmark,
  LineChart,
  Shield,
  Stamp,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const STEPS = [
  {
    step: 1,
    title: "Franchise Disclosure Document (FDD)",
    desc: "We send you the FDD — the required legal document that outlines all the details of the franchise, including fees, obligations, and financial performance. You'll review this at your own pace.",
    icon: <FileText className="size-5" />,
    detail: null,
  },
  {
    step: 2,
    title: "Sign the FDD Receipt",
    desc: "Once you've received the FDD, you'll sign a receipt electronically confirming you've received it. This starts the 14-day waiting period required by federal franchise law before you can sign any agreements.",
    icon: <ClipboardSignature className="size-5" />,
    detail: null,
  },
  {
    step: 3,
    title: "14-Day Waiting Period",
    desc: "Federal law requires a minimum 14-day cooling-off period after you receive the FDD. This gives you time to review everything, consult with advisors, and ask us any questions before committing.",
    icon: <Timer className="size-5" />,
    detail: "This is a federal requirement — no franchise can skip this step.",
  },
  {
    step: 4,
    title: "Sign the Franchise Agreement",
    desc: "After the waiting period, we put together your franchise package. You'll sign the franchise agreement, which finalizes the purchase from a paperwork standpoint.",
    icon: <FileSignature className="size-5" />,
    detail: "Once signed, the franchise purchase is complete on paper.",
  },
  {
    step: 5,
    title: "Wire Funds to Escrow",
    desc: "You'll wire the investment funds to a designated escrow attorney's bank account. You can choose your own attorney to hold the funds or we can recommend one — the funds stay in escrow until your E-2 visa is approved.",
    icon: <Landmark className="size-5" />,
    detail: "Your funds are held safely in escrow and are not released until your visa is approved.",
  },
  {
    step: 6,
    title: "Form Your Business Entity",
    desc: "You'll need to form a new legal entity (typically an LLC) that will own the franchise. This is the company that will operate the business and is part of your E-2 visa application.",
    icon: <Building className="size-5" />,
    detail: null,
  },
  {
    step: 7,
    title: "Operating License & Insurance",
    desc: "We handle filing your operating license with the state and help you establish the required $1 million liability insurance policy that every franchise must carry.",
    icon: <Shield className="size-5" />,
    detail: "$1M liability insurance is required for all franchisees.",
  },
  {
    step: 8,
    title: "Franchise Training",
    desc: "You'll complete the required franchise training program. Training is 2 weeks and done entirely online, so you can complete it from anywhere in the world.",
    icon: <GraduationCap className="size-5" />,
    detail: "2 weeks, fully online — no travel required.",
  },
  {
    step: 9,
    title: "Daily Operations Begin",
    desc: "Your franchise portfolio begins operating under the daily guidance of our territory area representative. They handle all day-to-day operations while you maintain ownership and financial control.",
    icon: <LineChart className="size-5" />,
    detail: null,
  },
  {
    step: 10,
    title: "4 Months of Operations",
    desc: "The franchise operates for approximately 4 months to establish a track record. During this time, revenue flows in, expenses are paid, and job creation is demonstrated through 1099 contractor filings — all of which strengthens your E-2 visa application.",
    icon: <Clock className="size-5" />,
    detail: "This operational history shows immigration authorities that your business is real and active.",
  },
  {
    step: 11,
    title: "Business Plan & E-2 Application",
    desc: "You'll coordinate with Journey, our approved business plan writer, to draft your E-2 business plan. If you already have a business plan writer or immigration attorney, you're welcome to use them instead. The business plan, along with your operational records, becomes part of your E-2 visa petition.",
    icon: <BookOpen className="size-5" />,
    detail: "Use our recommended professionals or bring your own — it's your choice.",
  },
  {
    step: 12,
    title: "E-2 Visa Approval & Fund Release",
    desc: "Once your E-2 visa is approved, the escrow attorney releases the funds from escrow to our account. Your franchise is now fully operational, and you have your E-2 visa approved — you and your family can live and work in the United States.",
    icon: <CheckCircle2 className="size-5" />,
    detail: "Funds are only released after your visa is approved.",
  },
];

export default function ProcessPage() {
  return (
    <div data-testid="page-process" className="min-h-screen">
      <section data-testid="section-process-hero" className="relative isolate overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 nh-hero-bg" />
        <div className="absolute inset-0 -z-10 opacity-60 nh-fine-grid" />
        <div className="nh-container py-10 md:py-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">
              Step by step
            </div>
            <h1
              data-testid="text-process-title"
              className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl"
            >
              Your path from inquiry to{" "}
              <span className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
                E-2 visa approval
              </span>
            </h1>
            <p
              data-testid="text-process-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Here's exactly what happens from the moment you decide to move forward through
              your E-2 visa approval. No surprises — every step is laid out clearly so you
              know what to expect.
            </p>
          </motion.div>
        </div>
      </section>

      <section data-testid="section-timeline" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="relative mx-auto max-w-3xl">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border md:left-1/2 md:-translate-x-px" />

            {STEPS.map((s, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={s.step}
                  data-testid={`step-${s.step}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: i * 0.04 }}
                  className={`relative mb-10 pl-16 md:pl-0 md:w-1/2 ${
                    isLeft
                      ? "md:pr-12 md:text-right md:ml-0"
                      : "md:pl-12 md:ml-auto"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-0 z-10 flex size-12 items-center justify-center rounded-full border-2 border-[hsl(var(--primary))] bg-white shadow-sm md:left-auto ${
                      isLeft
                        ? "md:right-0 md:translate-x-1/2 md:-mr-[1px]"
                        : "md:left-0 md:-translate-x-1/2 md:-ml-[1px]"
                    }`}
                  >
                    <span className="text-sm font-bold text-[hsl(var(--primary))]">{s.step}</span>
                  </div>

                  <Card className="nh-surface p-5 transition-shadow hover:shadow-md">
                    <div className={`flex items-center gap-3 ${isLeft ? "md:flex-row-reverse" : ""}`}>
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-white/70 text-[hsl(var(--primary))]">
                        {s.icon}
                      </div>
                      <h3 className="text-base font-semibold leading-snug">{s.title}</h3>
                    </div>
                    <p className={`mt-3 text-sm leading-relaxed text-muted-foreground ${isLeft ? "md:text-right" : ""}`}>
                      {s.desc}
                    </p>
                    {s.detail && (
                      <div className={`mt-3 flex items-start gap-2 rounded-lg bg-[hsl(var(--primary))]/5 px-3 py-2 ${isLeft ? "md:flex-row-reverse md:text-right" : ""}`}>
                        <Stamp className="mt-0.5 size-4 shrink-0 text-[hsl(var(--primary))]" />
                        <span className="text-xs font-medium text-[hsl(var(--primary))]">{s.detail}</span>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section data-testid="section-process-cta" className="border-t bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Ready to get started?</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              The first step is simple — reach out and we'll send you the FDD so you can review everything.
              No pressure, no obligation. Just the information you need to make the right decision.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-process-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-process-brochure" variant="secondary" className="gap-2" asChild>
                <a href="/api/brochure" download>
                  <FileText className="size-4" />
                  Download brochure
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
