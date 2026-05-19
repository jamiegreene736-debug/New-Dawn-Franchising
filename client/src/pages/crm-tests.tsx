import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, FlaskConical, RefreshCw } from "lucide-react";
import { CrmLayout } from "@/components/crm-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

interface TestResponse {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
}

export default function CrmTestsPage() {
  const [runKey, setRunKey] = useState(0);
  const [hasRun, setHasRun] = useState(false);

  const { data, isLoading } = useQuery<TestResponse>({
    queryKey: ["/api/admin/tests", runKey],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/tests");
      return res.json();
    },
    enabled: hasRun,
    staleTime: 0,
  });

  const run = () => {
    setHasRun(true);
    setRunKey((k) => k + 1);
  };

  const passRate = data ? Math.round((data.passed / data.total) * 100) : 0;

  const groups = [
    { label: "Database Tests", prefix: ["contacts table", "contact_activities", "contact_tasks", "pipeline_deals", "saved_segments"] },
    { label: "Lead Scoring Tests", prefix: ["UAE attorney", "Bounced contact", "Score is capped", "Score recalculates"] },
    { label: "Apollo Tests", prefix: ["Apollo status", "Apollo API key"] },
    { label: "Contact CRUD Tests", prefix: ["POST /api/contacts", "GET contact", "PATCH contact", "Soft delete", "Bulk tag"] },
    { label: "Pipeline Tests", prefix: ["Pipeline deals"] },
    { label: "Segment Tests", prefix: ["Empty segment"] },
    { label: "Duplicate Tests", prefix: ["Exact email"] },
  ];

  function getGroupResults(prefixes: string[]): TestResult[] {
    if (!data) return [];
    return data.results.filter((r) =>
      prefixes.some((p) => r.name.toLowerCase().startsWith(p.toLowerCase()))
    );
  }

  function ungrouped(): TestResult[] {
    if (!data) return [];
    const allGrouped = groups.flatMap((g) => getGroupResults(g.prefix).map((r) => r.name));
    return data.results.filter((r) => !allGrouped.includes(r.name));
  }

  return (
    <CrmLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CRM Self-Tests</h1>
            <p className="text-sm text-muted-foreground">Automated checks for database, scoring, API, and data integrity</p>
          </div>
          <Button data-testid="button-run-tests" onClick={run} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {isLoading ? "Running…" : hasRun ? "Re-run Tests" : "Run Tests"}
          </Button>
        </div>

        {!hasRun && (
          <Card className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <FlaskConical className="size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">Click "Run Tests" to start</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Runs {20}+ automated checks covering database tables, lead scoring, CRUD operations, and duplicate detection.
            </p>
          </Card>
        )}

        {isLoading && hasRun && (
          <Card className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="size-10 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-muted-foreground">Running tests…</p>
          </Card>
        )}

        {data && !isLoading && (
          <>
            {/* Summary */}
            <Card className={`p-5 border-2 ${data.failed === 0 ? "border-green-300 bg-green-50/40" : "border-amber-300 bg-amber-50/40"}`}>
              <div className="flex items-center gap-4">
                {data.failed === 0 ? (
                  <CheckCircle2 className="size-10 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="size-10 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="text-lg font-bold">
                    {data.passed} / {data.total} tests passed ({passRate}%)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.failed === 0
                      ? "All checks passed. The CRM is fully operational."
                      : `${data.failed} test${data.failed !== 1 ? "s" : ""} failed. Review details below.`}
                  </p>
                </div>
              </div>
            </Card>

            {/* Grouped results */}
            <div className="space-y-4">
              {groups.map((group) => {
                const results = getGroupResults(group.prefix);
                if (results.length === 0) return null;
                const groupPassed = results.filter((r) => r.passed).length;
                return (
                  <Card key={group.label} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{group.label}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        groupPassed === results.length ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {groupPassed}/{results.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {results.map((r) => (
                        <div key={r.name} data-testid={`test-result-${r.name.slice(0, 20)}`}
                          className={`flex items-start gap-2 p-2 rounded-lg text-sm ${r.passed ? "" : "bg-red-50"}`}>
                          {r.passed
                            ? <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                            : <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />}
                          <div>
                            <span className={r.passed ? "text-foreground" : "text-red-700 font-medium"}>{r.name}</span>
                            {!r.passed && r.detail && (
                              <p className="text-xs text-red-500 mt-0.5">{r.detail}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}

              {/* Ungrouped */}
              {ungrouped().length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-3">Other Tests</h3>
                  <div className="space-y-2">
                    {ungrouped().map((r) => (
                      <div key={r.name} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${r.passed ? "" : "bg-red-50"}`}>
                        {r.passed
                          ? <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                          : <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />}
                        <div>
                          <span>{r.name}</span>
                          {!r.passed && r.detail && <p className="text-xs text-red-500 mt-0.5">{r.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </CrmLayout>
  );
}
