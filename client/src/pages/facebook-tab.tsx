import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Facebook,
  Loader2,
  Plus,
  Send,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FacebookPost {
  id: string;
  content: string;
  imagePrompt?: string;
  status: string;
  scheduledFor?: string;
  postedAt?: string;
  facebookPostId?: string;
  errorMessage?: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    scheduled: "bg-blue-100 text-blue-700",
    posted: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  const icons: Record<string, React.ReactNode> = {
    draft: <Edit2 className="size-3" />,
    scheduled: <Clock className="size-3" />,
    posted: <CheckCircle2 className="size-3" />,
    failed: <AlertCircle className="size-3" />,
  };
  return (
    <span data-testid={`badge-fb-status-${status}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
      {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function GoogleAdsPanel() {
  const [spend, setSpend] = useState("");
  const [clicks, setClicks] = useState("");
  const [conversions, setConversions] = useState("");
  const [impressions, setImpressions] = useState("");

  const ctr = clicks && impressions ? ((Number(clicks) / Number(impressions)) * 100).toFixed(2) : null;
  const cpc = spend && clicks ? (Number(spend) / Number(clicks)).toFixed(2) : null;
  const cpl = spend && conversions ? (Number(spend) / Number(conversions)).toFixed(2) : null;

  return (
    <section className="py-8">
      <div className="nh-container space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 data-testid="google-ads-title" className="text-xl font-semibold flex items-center gap-2">
              <svg className="size-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Ads
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Track your Google Ads performance and access your dashboard</p>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="button-google-ads-dashboard"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open("https://ads.google.com", "_blank")}
            >
              <ExternalLink className="size-4" /> Open Google Ads
            </Button>
            <Button
              data-testid="button-google-analytics"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open("https://analytics.google.com", "_blank")}
            >
              <ExternalLink className="size-4" /> Analytics
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">This Month — Enter Your Stats</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Ad Spend ($)", value: spend, setter: setSpend, placeholder: "e.g. 500", testId: "input-google-spend" },
              { label: "Impressions", value: impressions, setter: setImpressions, placeholder: "e.g. 12000", testId: "input-google-impressions" },
              { label: "Clicks", value: clicks, setter: setClicks, placeholder: "e.g. 340", testId: "input-google-clicks" },
              { label: "Conversions", value: conversions, setter: setConversions, placeholder: "e.g. 8", testId: "input-google-conversions" },
            ].map((f) => (
              <Card key={f.label} className="p-4">
                <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                <input
                  data-testid={f.testId}
                  type="number"
                  value={f.value}
                  onChange={(e) => f.setter(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:text-base"
                />
              </Card>
            ))}
          </div>
        </div>

        {(ctr || cpc || cpl) && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Calculated Metrics</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {ctr && (
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{ctr}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Click-Through Rate</div>
                </Card>
              )}
              {cpc && (
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">${cpc}</div>
                  <div className="text-xs text-muted-foreground mt-1">Cost Per Click</div>
                </Card>
              )}
              {cpl && (
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">${cpl}</div>
                  <div className="text-xs text-muted-foreground mt-1">Cost Per Lead</div>
                </Card>
              )}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Links</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Keyword Planner", desc: "Research keywords and estimate search volume", url: "https://ads.google.com/aw/keywordplanner/home", icon: "🔍" },
              { label: "Campaign Manager", desc: "Create and manage your ad campaigns", url: "https://ads.google.com/aw/campaigns", icon: "📢" },
              { label: "Search Console", desc: "Monitor organic search performance", url: "https://search.google.com/search-console", icon: "📊" },
              { label: "Business Profile", desc: "Manage your Google Business listing", url: "https://business.google.com", icon: "📍" },
              { label: "Audience Manager", desc: "Build remarketing and lookalike audiences", url: "https://ads.google.com/aw/audiences", icon: "👥" },
              { label: "Conversion Tracking", desc: "Set up and review goal completions", url: "https://ads.google.com/aw/conversions", icon: "🎯" },
            ].map((link) => (
              <Card
                key={link.label}
                data-testid={`card-google-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="p-4 flex items-start gap-3 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => window.open(link.url, "_blank")}
              >
                <span className="text-2xl">{link.icon}</span>
                <div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    {link.label} <ExternalLink className="size-3 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{link.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FacebookContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCompose, setShowCompose] = useState(false);
  const [composeContent, setComposeContent] = useState("");
  const [editingPost, setEditingPost] = useState<FacebookPost | null>(null);

  const { data: posts = [], isLoading } = useQuery<FacebookPost[]>({
    queryKey: ["/api/facebook/posts"],
  });

  const { data: autoPost } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/facebook/auto-post"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/facebook/generate");
      return res.json();
    },
    onSuccess: (post: FacebookPost) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/posts"] });
      setEditingPost(post);
      toast({ title: "Post generated", description: "AI has created a draft post. Review and edit before publishing." });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/facebook/posts", { content, status: "draft" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/posts"] });
      setShowCompose(false);
      setComposeContent("");
      toast({ title: "Draft saved" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/facebook/posts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/posts"] });
      setEditingPost(null);
      toast({ title: "Post updated" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/facebook/posts/${id}/publish`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/posts"] });
      toast({ title: "Published!", description: "Post has been published to your Facebook page." });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/posts"] });
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/facebook/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/posts"] });
      toast({ title: "Post deleted" });
    },
  });

  const toggleAutoPost = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/facebook/auto-post", { enabled: !autoPost?.enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/auto-post"] });
      toast({ title: autoPost?.enabled ? "Auto-posting disabled" : "Auto-posting enabled" });
    },
  });

  const stats = {
    total: posts.length,
    drafts: posts.filter((p) => p.status === "draft").length,
    posted: posts.filter((p) => p.status === "posted").length,
    failed: posts.filter((p) => p.status === "failed").length,
  };

  return (
    <section className="py-8">
      <div className="nh-container">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 data-testid="fb-title" className="text-xl font-semibold">Facebook Content Manager</h2>
            <p className="mt-1 text-sm text-muted-foreground">Generate AI content, manage drafts, and publish to your Facebook page</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-testid="button-fb-toggle-auto"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => toggleAutoPost.mutate()}
              disabled={toggleAutoPost.isPending}
            >
              {autoPost?.enabled ? <ToggleRight className="size-4 text-green-600" /> : <ToggleLeft className="size-4" />}
              Auto-post {autoPost?.enabled ? "ON" : "OFF"}
            </Button>
            <Button
              data-testid="button-fb-compose"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setShowCompose(true); setEditingPost(null); }}
            >
              <Plus className="size-4" /> Write post
            </Button>
            <Button
              data-testid="button-fb-generate"
              size="sm"
              className="gap-2"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generateMutation.isPending ? "Generating..." : "AI Generate"}
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Posts", value: stats.total, color: "text-foreground" },
            { label: "Drafts", value: stats.drafts, color: "text-gray-600" },
            { label: "Published", value: stats.posted, color: "text-green-600" },
            { label: "Failed", value: stats.failed, color: "text-red-600" },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>

        {autoPost?.enabled && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
            <Bot className="size-5 text-green-600" />
            <div>
              <span className="font-medium text-green-800">Auto-posting is active.</span>{" "}
              <span className="text-green-700">AI will generate and publish a new post daily at 10:00 AM ET. Make sure your Facebook Page credentials are configured.</span>
            </div>
          </div>
        )}

        {(showCompose || editingPost) && (
          <Card className="mb-6 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Facebook className="size-4 text-blue-600" />
              {editingPost ? "Edit Post" : "New Post"}
            </div>
            <textarea
              data-testid="input-fb-content"
              value={editingPost ? editingPost.content : composeContent}
              onChange={(e) =>
                editingPost
                  ? setEditingPost({ ...editingPost, content: e.target.value })
                  : setComposeContent(e.target.value)
              }
              rows={6}
              placeholder="Write your Facebook post content here..."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
            {editingPost?.imagePrompt && (
              <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <span className="font-medium">Suggested image idea:</span> {editingPost.imagePrompt}
              </div>
            )}
            <div className="mt-3 flex gap-2 justify-end">
              <Button
                data-testid="button-fb-cancel"
                variant="outline"
                size="sm"
                onClick={() => { setShowCompose(false); setEditingPost(null); setComposeContent(""); }}
              >
                Cancel
              </Button>
              {editingPost ? (
                <>
                  <Button
                    data-testid="button-fb-save-edit"
                    variant="secondary"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: editingPost.id, data: { content: editingPost.content } })}
                    disabled={updateMutation.isPending}
                  >
                    Save draft
                  </Button>
                  <Button
                    data-testid="button-fb-publish-edit"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      updateMutation.mutate(
                        { id: editingPost.id, data: { content: editingPost.content } },
                        { onSuccess: () => publishMutation.mutate(editingPost.id) }
                      );
                    }}
                    disabled={publishMutation.isPending || updateMutation.isPending}
                  >
                    <Send className="size-3.5" />
                    {publishMutation.isPending ? "Publishing..." : "Publish now"}
                  </Button>
                </>
              ) : (
                <Button
                  data-testid="button-fb-save-compose"
                  size="sm"
                  onClick={() => createMutation.mutate(composeContent)}
                  disabled={!composeContent.trim() || createMutation.isPending}
                >
                  Save draft
                </Button>
              )}
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-12 text-center">
            <Facebook className="mx-auto size-10 text-blue-400 opacity-50" />
            <p className="mt-3 text-sm text-muted-foreground">No Facebook posts yet. Click "AI Generate" to create your first one!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} data-testid={`card-fb-post-${post.id}`} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={post.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {post.postedAt && (
                        <span className="text-xs text-green-600">
                          Posted {new Date(post.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
                    {post.errorMessage && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                        <AlertCircle className="size-3" />
                        {post.errorMessage}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {(post.status === "draft" || post.status === "failed") && (
                      <>
                        <Button
                          data-testid={`button-fb-edit-${post.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingPost(post); setShowCompose(false); }}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          data-testid={`button-fb-publish-${post.id}`}
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => publishMutation.mutate(post.id)}
                          disabled={publishMutation.isPending}
                        >
                          <Send className="size-3.5" />
                        </Button>
                      </>
                    )}
                    {post.status !== "posted" && (
                      <Button
                        data-testid={`button-fb-delete-${post.id}`}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(post.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function FacebookTab() {
  const [paidTab, setPaidTab] = useState<"facebook" | "google">("facebook");

  return (
    <>
      <div className="border-b bg-background">
        <div className="nh-container">
          <div className="flex gap-1">
            <button
              data-testid="tab-paid-facebook"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${paidTab === "facebook" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setPaidTab("facebook")}
            >
              <Facebook className="size-4" /> Facebook
            </button>
            <button
              data-testid="tab-paid-google"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${paidTab === "google" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setPaidTab("google")}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Ads
            </button>
          </div>
        </div>
      </div>

      {paidTab === "facebook" && <FacebookContent />}
      {paidTab === "google" && <GoogleAdsPanel />}
    </>
  );
}
