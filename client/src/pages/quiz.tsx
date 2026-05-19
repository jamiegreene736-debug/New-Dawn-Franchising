import { useState } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";

type Answer = {
  label: string;
  points: number;
};

type Question = {
  id: string;
  question: string;
  subtitle?: string;
  answers: Answer[];
};

const QUESTIONS: Question[] = [
  {
    id: "investment",
    question: "How much capital are you prepared to invest in a U.S. business?",
    subtitle: "This helps us understand which franchise tier fits your situation.",
    answers: [
      { label: "Under $100,000", points: 1 },
      { label: "$100,000 – $200,000", points: 3 },
      { label: "$200,000 – $400,000", points: 4 },
      { label: "Over $400,000", points: 4 },
    ],
  },
  {
    id: "timeline",
    question: "When are you looking to start your U.S. business?",
    answers: [
      { label: "Within the next 3 months", points: 4 },
      { label: "3 to 6 months", points: 4 },
      { label: "6 to 12 months", points: 3 },
      { label: "More than 12 months out", points: 1 },
    ],
  },
  {
    id: "visa",
    question: "What is your current U.S. immigration status?",
    subtitle: "Select the option that best describes your situation.",
    answers: [
      { label: "I need an E-2 visa to enter/stay in the U.S.", points: 4 },
      { label: "I have a different visa and want to switch to E-2", points: 3 },
      { label: "I'm a U.S. citizen or permanent resident", points: 3 },
      { label: "I'm not sure yet", points: 2 },
    ],
  },
  {
    id: "involvement",
    question: "How involved do you want to be in day-to-day operations?",
    answers: [
      { label: "Director-led — I want an expert team to handle execution", points: 4 },
      { label: "Oversight only — I'll review reports and make key decisions", points: 4 },
      { label: "Somewhat involved — I'd help with some tasks", points: 2 },
      { label: "Fully hands-on — I want to do everything myself", points: 1 },
    ],
  },
  {
    id: "experience",
    question: "Do you have experience in property management or real estate?",
    answers: [
      { label: "Yes, significant experience", points: 4 },
      { label: "Some experience or related industry", points: 3 },
      { label: "No, but I'm eager to learn", points: 3 },
      { label: "No, and I prefer not to learn — I want it handled for me", points: 4 },
    ],
  },
  {
    id: "location",
    question: "Are you open to a franchise territory in Texas?",
    answers: [
      { label: "Yes, Texas is my top choice", points: 4 },
      { label: "Yes, I'm open to Texas", points: 4 },
      { label: "I'd consider it, but prefer other states", points: 2 },
      { label: "No, I'm only interested in other states", points: 0 },
    ],
  },
  {
    id: "goal",
    question: "What's your primary goal with this investment?",
    answers: [
      { label: "Build a business that qualifies for an E-2 visa", points: 4 },
      { label: "Generate steady income through property management", points: 4 },
      { label: "Diversify my investments into the U.S. market", points: 3 },
      { label: "I'm still exploring options", points: 2 },
    ],
  },
];

type Result = {
  tier: "strong" | "good" | "early";
  title: string;
  subtitle: string;
  details: string[];
};

function getResult(score: number): Result {
  const max = QUESTIONS.length * 4;
  const pct = score / max;

  if (pct >= 0.78) {
    return {
      tier: "strong",
      title: "Strong fit",
      subtitle:
        "Based on your answers, you appear to be a strong candidate for the New Dawn franchise model.",
      details: [
        "Your investment range and timeline align well with our franchise requirements.",
        "Your preference for director-led operations with professional execution matches our territory representative model.",
        "Texas is a great market for long-term rental management — and you're open to it.",
        "We recommend requesting the overview deck and scheduling an intro call.",
      ],
    };
  }

  if (pct >= 0.55) {
    return {
      tier: "good",
      title: "Potential fit",
      subtitle:
        "You share several qualities with our ideal franchise investors. A few areas may need further discussion.",
      details: [
        "Some of your preferences or circumstances may need alignment with our model.",
        "A conversation with our team can help clarify whether this is the right path.",
        "We're happy to walk you through the operating model and answer questions.",
        "Request the overview deck to learn more about how the franchise works.",
      ],
    };
  }

  return {
    tier: "early",
    title: "Early stage",
    subtitle:
      "It looks like you may be in the early stages of exploring franchise options. That's completely fine.",
    details: [
      "Our franchise requires a meaningful capital commitment and openness to the Texas market.",
      "The model is designed for investors who want to direct a professionally operated business.",
      "If your circumstances change, we'd love to hear from you.",
      "In the meantime, explore our Why E-2 page to learn more about the visa and model.",
    ],
  };
}

export default function QuizPage() {
  const [step, setStep] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<(number | null)[]>(
    () => new Array(QUESTIONS.length).fill(null)
  );
  const [showResult, setShowResult] = useState(false);

  const current = QUESTIONS[step];
  const progress = showResult ? 100 : ((step + 1) / QUESTIONS.length) * 100;
  const canGoNext = selectedIndices[step] !== null;
  const isLast = step === QUESTIONS.length - 1;

  function selectAnswer(answerIndex: number) {
    setSelectedIndices((prev) => {
      const next = [...prev];
      next[step] = answerIndex;
      return next;
    });
  }

  function goNext() {
    if (isLast) {
      setShowResult(true);
    } else {
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    if (showResult) {
      setShowResult(false);
    } else if (step > 0) {
      setStep((s) => s - 1);
    }
  }

  function restart() {
    setStep(0);
    setSelectedIndices(new Array(QUESTIONS.length).fill(null));
    setShowResult(false);
  }

  const totalScore = selectedIndices.reduce<number>(
    (sum, idx, qIdx) => sum + (idx !== null ? QUESTIONS[qIdx].answers[idx].points : 0),
    0
  );
  const result = getResult(totalScore);

  const tierColors = {
    strong: "text-green-700 bg-green-50 border-green-200",
    good: "text-amber-700 bg-amber-50 border-amber-200",
    early: "text-blue-700 bg-blue-50 border-blue-200",
  };

  return (
    <div data-testid="page-quiz" className="min-h-screen">
      <section className="border-b">
        <div className="nh-container py-8 md:py-10">
          <div className="mx-auto max-w-3xl text-center">
            <h1
              data-testid="quiz-title"
              className="text-balance text-3xl font-semibold tracking-tight md:text-5xl"
            >
              Franchise Readiness Quiz
            </h1>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              Answer {QUESTIONS.length} quick questions to see how well you align with the
              New Dawn franchise model.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {showResult
                  ? "Results"
                  : `Question ${step + 1} of ${QUESTIONS.length}`}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress data-testid="quiz-progress" value={progress} className="h-2" />
          </div>

          <div className="mx-auto mt-8 max-w-2xl">
            {showResult ? (
              <Card
                data-testid="quiz-result"
                className="nh-surface nh-noise border-card-border/80 p-6 md:p-8"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <div
                    data-testid="quiz-result-badge"
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${tierColors[result.tier]}`}
                  >
                    <CheckCircle2 className="size-4" />
                    {result.title}
                  </div>

                  <div
                    data-testid="quiz-result-score"
                    className="text-3xl font-bold text-foreground"
                  >
                    {totalScore}/{QUESTIONS.length * 4}
                  </div>

                  <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                    {result.subtitle}
                  </p>
                </div>

                <div className="mt-6 grid gap-3">
                  {result.details.map((d, i) => (
                    <div
                      key={i}
                      data-testid={`quiz-detail-${i}`}
                      className="flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                      <div className="text-sm text-muted-foreground">{d}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button data-testid="quiz-cta" className="gap-2" asChild>
                    <Link href="/contact">
                      Request the overview deck
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    data-testid="quiz-restart"
                    variant="secondary"
                    className="gap-2"
                    onClick={restart}
                  >
                    <RotateCcw className="size-4" />
                    Retake quiz
                  </Button>
                </div>
              </Card>
            ) : (
              <Card
                data-testid={`quiz-question-${current.id}`}
                className="nh-surface nh-noise border-card-border/80 p-6 md:p-8"
              >
                <h2 className="text-xl font-semibold leading-tight md:text-2xl">
                  {current.question}
                </h2>
                {current.subtitle && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {current.subtitle}
                  </p>
                )}

                <div className="mt-6 grid gap-3">
                  {current.answers.map((a, i) => {
                    const isSelected = selectedIndices[step] === i;
                    return (
                      <button
                        key={i}
                        data-testid={`quiz-answer-${current.id}-${i}`}
                        type="button"
                        onClick={() => selectAnswer(i)}
                        className={
                          "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-all " +
                          (isSelected
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[0.06] font-medium text-foreground shadow-sm"
                            : "bg-white/60 text-muted-foreground hover:border-foreground/20 hover:bg-white/80")
                        }
                      >
                        <div
                          className={
                            "grid size-5 shrink-0 place-items-center rounded-full border transition-colors " +
                            (isSelected
                              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                              : "border-muted-foreground/30")
                          }
                        >
                          {isSelected && (
                            <div className="size-2 rounded-full bg-white" />
                          )}
                        </div>
                        {a.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Button
                    data-testid="quiz-back"
                    variant="ghost"
                    className="gap-2"
                    onClick={goBack}
                    disabled={step === 0}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>
                  <Button
                    data-testid="quiz-next"
                    className="gap-2"
                    onClick={goNext}
                    disabled={!canGoNext}
                  >
                    {isLast ? "See results" : "Next"}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
