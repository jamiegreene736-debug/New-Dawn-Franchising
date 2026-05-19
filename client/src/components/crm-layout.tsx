import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Kanban, Target, CheckSquare, Search,
  LogOut, ChevronRight, BarChart2, Mail, Facebook,
  FlaskConical, ArrowLeft,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CRM_NAV = [
  {
    label: "Investor CRM",
    href: "/crm",
    icon: BarChart2,
    exact: true,
  },
  { type: "divider" as const, label: "Attorney CRM" },
  { href: "/crm/contacts", label: "Contacts", icon: Users },
  { href: "/crm/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/crm/segments", label: "Segments", icon: Target },
  { href: "/crm/tasks", label: "Tasks", icon: CheckSquare },
  { type: "divider" as const, label: "Tools" },
  { href: "/crm/tests", label: "Run Tests", icon: FlaskConical },
];

function NavItem({
  href,
  label,
  icon: Icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}) {
  const [loc] = useLocation();
  const active = exact ? loc === href : loc.startsWith(href);
  return (
    <Link href={href}>
      <a
        data-testid={`nav-crm-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-[hsl(var(--primary))] text-white"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </a>
    </Link>
  );
}

export function CrmLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: auth, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && (!auth || (auth as { role?: string }).role !== "admin")) {
      setLocation("/login");
    }
  }, [auth, isLoading, setLocation]);

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setLocation("/login");
    } catch {
      toast({ title: "Logout failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (!auth || (auth as { role?: string }).role !== "admin") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        {/* Header */}
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/">
            <a className="flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors">
              <ArrowLeft className="size-4" />
              Back to site
            </a>
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {CRM_NAV.map((item, i) => {
            if (item.type === "divider") {
              return (
                <div key={i} className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </div>
              );
            }
            const Icon = item.icon!;
            return (
              <NavItem
                key={item.href}
                href={item.href!}
                label={item.label!}
                icon={Icon}
                exact={item.exact}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t p-3">
          <button
            data-testid="button-crm-logout"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
