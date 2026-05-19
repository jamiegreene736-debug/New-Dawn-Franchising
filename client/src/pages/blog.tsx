import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, ArrowRight, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BlogPost } from "@shared/schema";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/posts"],
  });

  return (
    <div data-testid="page-blog" className="min-h-screen">
      <section data-testid="section-blog-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h1 data-testid="blog-title" className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Insights & Resources
            </h1>
            <p data-testid="blog-subtitle" className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              Expert articles on property management franchising, E-2 visa investment, and building wealth through real estate in Texas.
            </p>
          </div>
        </div>
      </section>

      <section data-testid="section-blog-list" className="border-b">
        <div className="nh-container py-8 md:py-20">
          {isLoading ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="nh-surface nh-noise border-card-border/80 p-6 animate-pulse">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-4 h-3 w-full rounded bg-muted" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-muted" />
                </Card>
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card
                    data-testid={`card-blog-${post.id}`}
                    className="nh-surface nh-noise border-card-border/80 p-6 transition-shadow hover:shadow-lg cursor-pointer h-full flex flex-col"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(post.publishedAt as unknown as string)}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold leading-snug line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">
                      Read more <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-md text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Coming Soon</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We're preparing insightful articles about property management franchising and E-2 visa investment. Check back soon!
              </p>
              <Link href="/contact">
                <Button data-testid="button-blog-cta" className="mt-6">
                  Get in Touch <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section data-testid="section-blog-cta" className="bg-primary/5">
        <div className="nh-container py-8 text-center">
          <h2 className="text-2xl font-semibold">Ready to Explore Franchise Ownership?</h2>
          <p className="mt-2 text-muted-foreground">
            Learn how you can own a property management franchise and qualify for an E-2 visa.
          </p>
          <Link href="/contact">
            <Button data-testid="button-blog-bottom-cta" className="mt-6">
              Schedule a Consultation <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
