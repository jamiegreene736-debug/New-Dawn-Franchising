import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div data-testid="page-not-found" className="nh-container py-16">
      <div className="mx-auto max-w-xl rounded-3xl border bg-white/60 p-10 text-center shadow-sm">
        <div data-testid="text-404" className="text-6xl font-semibold tracking-tight">
          404
        </div>
        <div data-testid="text-404-title" className="mt-4 text-2xl font-semibold">
          Page not found
        </div>
        <p data-testid="text-404-subtitle" className="mt-3 text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist.
        </p>
        <div className="mt-7 flex justify-center">
          <Button data-testid="button-404-home" className="gap-2" asChild>
            <Link href="/">
              Go to home
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
