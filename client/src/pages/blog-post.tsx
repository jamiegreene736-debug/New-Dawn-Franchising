import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlogPost } from "@shared/schema";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="mt-8 mb-3 text-xl font-semibold">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mt-10 mb-4 text-2xl font-semibold">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [line.slice(2)];
      while (i + 1 < lines.length && (lines[i + 1].startsWith("- ") || lines[i + 1].startsWith("* "))) {
        i++;
        items.push(lines[i].slice(2));
      }
      elements.push(
        <ul key={i} className="my-4 ml-6 list-disc space-y-2 text-muted-foreground">
          {items.map((item, j) => (
            <li key={j}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
    } else if (line.trim() === "") {
      continue;
    } else {
      elements.push(
        <p key={i} className="my-4 leading-relaxed text-muted-foreground">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  }

  return <div>{elements}</div>;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: [`/api/posts/${slug}`],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div data-testid="page-blog-post" className="min-h-screen">
        <div className="nh-container py-8 md:py-20">
          <div className="mx-auto max-w-3xl animate-pulse">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-6 h-8 w-3/4 rounded bg-muted" />
            <div className="mt-8 space-y-4">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div data-testid="page-blog-post" className="min-h-screen">
        <div className="nh-container py-8 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-2xl font-semibold">Post Not Found</h1>
            <p className="mt-2 text-muted-foreground">
              This article may have been moved or no longer exists.
            </p>
            <Link href="/blog">
              <Button data-testid="button-back-to-blog" className="mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-blog-post" className="min-h-screen">
      <section className="border-b">
        <div className="nh-container py-8 md:py-20">
          <div className="mx-auto max-w-3xl">
            <Link href="/blog">
              <button
                data-testid="link-back-to-blog"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to all articles
              </button>
            </Link>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <time>{formatDate(post.publishedAt as unknown as string)}</time>
            </div>

            <h1
              data-testid="text-post-title"
              className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
            >
              {post.title}
            </h1>

            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="nh-container py-8 md:py-20">
          <article data-testid="text-post-content" className="mx-auto max-w-3xl prose-custom">
            <MarkdownContent content={post.content} />
          </article>
        </div>
      </section>

      <section data-testid="section-post-cta" className="bg-primary/5">
        <div className="nh-container py-8 text-center">
          <h2 className="text-2xl font-semibold">Interested in Learning More?</h2>
          <p className="mt-2 text-muted-foreground">
            Schedule a consultation to explore how a property management franchise can work for you.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/contact">
              <Button data-testid="button-post-contact">
                Get in Touch <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/blog">
              <Button data-testid="button-post-more-articles" variant="outline">
                More Articles
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
