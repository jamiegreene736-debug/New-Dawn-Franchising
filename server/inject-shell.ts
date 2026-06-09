import { type PageShell, getPageShell, defaultShell } from "./page-shells";
import { storage } from "./storage";
import type { BlogPost } from "@shared/schema";
import {
  SITE_URL,
  OG_IMAGE,
  organizationNode,
  websiteNode,
  franchiseServiceNode,
  faqNode,
  teamNodes,
  articleNode,
  breadcrumbNode,
  renderJsonLd,
  absoluteUrl,
} from "./structured-data";

/**
 * Server-side SEO shell injection.
 *
 * The site is a client-rendered React SPA, but AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, CCBot, etc.) and many search bots do not execute JavaScript —
 * they only read the HTML the server sends. For every route we therefore rewrite
 * the title/meta/social tags, inject crawler-readable HTML, and emit a JSON-LD
 * `@graph` so answer engines can understand and cite the page.
 */
export async function injectShell(html: string, pathname: string): Promise<string> {
  const blogSlug = getBlogSlug(pathname);
  const canonicalUrl = `${SITE_URL}${pathname === "/" ? "" : pathname}`;

  let shell: PageShell;
  let post: BlogPost | undefined;
  let ogImage = OG_IMAGE;
  let ogType = "website";

  if (blogSlug) {
    try {
      post = await storage.getBlogPostBySlug(blogSlug);
    } catch {
      post = undefined;
    }
    if (post) {
      shell = {
        title: `${post.title} | New Dawn Franchising Blog`,
        description: post.excerpt,
        html: renderBlogShell(post),
      };
      ogType = "article";
      if (post.coverImageUrl) ogImage = absoluteUrl(post.coverImageUrl);
    } else {
      shell = getPageShell(pathname) ?? defaultShell;
    }
  } else {
    shell = getPageShell(pathname) ?? defaultShell;
  }

  // --- Title & meta description ---
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(shell.title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(shell.description)}" />`,
  );

  // --- Open Graph ---
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeAttr(shell.title)}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeAttr(shell.description)}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:type" content="${ogType}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${ogImage}" />`,
  );

  // --- Twitter ---
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeAttr(shell.title)}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeAttr(shell.description)}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:image" content="${ogImage}" />`,
  );
  // Drop the leftover "@replit" twitter:site handle entirely.
  html = html.replace(/\s*<meta\s+name="twitter:site"\s+content="[^"]*"\s*\/?>/, "");

  // --- Canonical, og:url/site_name, and JSON-LD before </head> ---
  const headInsert = [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:site_name" content="New Dawn Franchising" />`,
    `<script type="application/ld+json">${renderJsonLd(buildGraph(pathname, shell, post, canonicalUrl))}</script>`,
  ].join("\n    ");

  html = html.replace("</head>", `    ${headInsert}\n  </head>`);

  // Inject HTML content into <div id="root"> — visually hidden for users,
  // readable by search crawlers. React clears this on mount.
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"><div data-seo-shell style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;" aria-hidden="true">${shell.html}</div></div>`,
  );

  return html;
}

/** Assemble the per-page JSON-LD `@graph`. */
function buildGraph(
  pathname: string,
  shell: PageShell,
  post: BlogPost | undefined,
  canonicalUrl: string,
): Record<string, unknown>[] {
  const graph: Record<string, unknown>[] = [organizationNode(), websiteNode()];

  if (post) {
    graph.push(articleNode(post, canonicalUrl));
    graph.push(
      breadcrumbNode([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Blog", url: `${SITE_URL}/blog` },
        { name: post.title, url: canonicalUrl },
      ]),
    );
    return graph;
  }

  if (pathname === "/") {
    graph.push(franchiseServiceNode());
  }

  if (shell.faq?.length) {
    graph.push(faqNode(shell.faq));
  }

  if (pathname === "/team") {
    graph.push(...teamNodes());
  }

  if (pathname !== "/") {
    graph.push(
      breadcrumbNode([
        { name: "Home", url: `${SITE_URL}/` },
        { name: crumbLabel(shell.title), url: canonicalUrl },
      ]),
    );
  }

  return graph;
}

/** "/blog/some-slug" -> "some-slug"; null for "/blog" or "/blog/". */
function getBlogSlug(pathname: string): string | null {
  const m = pathname.match(/^\/blog\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Short breadcrumb label derived from a page title ("About … | New Dawn" -> "About …"). */
function crumbLabel(title: string): string {
  return title.split("|")[0].trim();
}

/** Render a blog post's markdown body to crawler-readable HTML (mirrors the React renderer). */
function renderBlogShell(post: BlogPost): string {
  const published = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
<main>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.excerpt)}</p>
    <p>Published ${published}</p>
    ${markdownToHtml(post.content)}
  </article>
</main>`;
}

/** Minimal, safe markdown -> HTML for headings, lists, paragraphs, and inline marks. */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      out.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      out.push(`<h2>${inlineMarkdown(line.slice(2))}</h2>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [line.slice(2)];
      while (i + 1 < lines.length && (lines[i + 1].startsWith("- ") || lines[i + 1].startsWith("* "))) {
        i++;
        items.push(lines[i].slice(2));
      }
      out.push(`<ul>${items.map((it) => `<li>${inlineMarkdown(it)}</li>`).join("")}</ul>`);
    } else if (line.trim() === "") {
      continue;
    } else {
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }

  return out.join("\n    ");
}

/** Inline markdown (bold/italic/code/links) on HTML-escaped text. */
function inlineMarkdown(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => `<a href="${escapeAttr(url)}">${label}</a>`);
  return s;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
