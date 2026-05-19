import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, CheckCircle2, Download, FileText, LogOut, Plus,
  UserPlus, Users, Building2, Phone, Mail, Star, TrendingUp, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

const COMPANY = {
  name: "New Dawn Franchising LLC",
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

interface BrokerProfile {
  id: string;
  fullName: string;
  email: string;
  company?: string;
  phone?: string;
  agreementSigned: boolean;
  agreementSignedAt?: string;
}

interface BrokerClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
  crmStatus?: string | null;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  new:               { label: "New Lead",          color: "bg-slate-100 text-slate-700" },
  broker_outreach:   { label: "Broker Outreach",   color: "bg-purple-100 text-purple-700" },
  broker_introduced: { label: "Introduced",        color: "bg-blue-100 text-blue-700" },
  meeting_scheduled: { label: "Meeting Scheduled", color: "bg-cyan-100 text-cyan-700" },
  cold_drip:         { label: "Cold Drip",         color: "bg-orange-100 text-orange-700" },
  fdd_sent:          { label: "FDD Sent",           color: "bg-amber-100 text-amber-700" },
  fdd_signed:        { label: "FDD Signed",         color: "bg-lime-100 text-lime-700" },
  agreement_sent:    { label: "Agreement Sent",    color: "bg-teal-100 text-teal-700" },
  agreement_signed:  { label: "Agreement Signed",  color: "bg-emerald-100 text-emerald-700" },
  wire_received:     { label: "Wire Received",     color: "bg-green-100 text-green-700" },
  active:            { label: "Active",            color: "bg-green-100 text-green-800" },
  declined:          { label: "Declined",          color: "bg-red-100 text-red-700" },
};

// ── Auth Forms ────────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.role === "admin") {
        window.location.href = "/crm";
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/brokers/me"] });
    },
    onError: (err: Error) => {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="nh-surface border-card-border/80 p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Sign in to your account</h2>
      <p className="mt-1 text-sm text-gray-500">Access your broker dashboard and manage referrals.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }}
      >
        <div>
          <Label htmlFor="login-email">Email address</Label>
          <Input
            data-testid="input-login-email"
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="login-password">Password</Label>
          <Input
            data-testid="input-login-password"
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button data-testid="button-login" type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        New broker?{" "}
        <button data-testid="link-switch-register" onClick={onSwitch} className="font-medium text-[hsl(var(--primary))] hover:underline">
          Create an account
        </button>
      </p>
    </Card>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", company: "", password: "", confirmPassword: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
      const res = await apiRequest("POST", "/api/brokers/register", {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        password: form.password,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brokers/me"] });
    },
    onError: (err: Error) => {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="nh-surface border-card-border/80 p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Create your broker account</h2>
      <p className="mt-1 text-sm text-gray-500">Free to join. Earn commission on every completed franchise sale.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); registerMutation.mutate(); }}
      >
        <div>
          <Label htmlFor="reg-name">Full name *</Label>
          <Input data-testid="input-reg-name" id="reg-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="reg-email">Email address *</Label>
          <Input data-testid="input-reg-email" id="reg-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="reg-phone">Phone</Label>
            <Input data-testid="input-reg-phone" id="reg-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="reg-company">Company</Label>
            <Input data-testid="input-reg-company" id="reg-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div>
          <Label htmlFor="reg-password">Password * <span className="font-normal text-gray-400">(min. 8 characters)</span></Label>
          <Input data-testid="input-reg-password" id="reg-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </div>
        <div>
          <Label htmlFor="reg-confirm">Confirm password *</Label>
          <Input data-testid="input-reg-confirm" id="reg-confirm" type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
        </div>
        <Button data-testid="button-register" type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <button data-testid="link-switch-login" onClick={onSwitch} className="font-medium text-[hsl(var(--primary))] hover:underline">
          Sign in
        </button>
      </p>
    </Card>
  );
}

// ── Agreement ─────────────────────────────────────────────────────────────────

function AgreementSection({ broker, onSigned }: { broker: BrokerProfile; onSigned: () => void }) {
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/brokers/sign-agreement");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Agreement signed", description: "Your broker commission agreement is now active." });
      onSigned();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to sign agreement. Please try again.", variant: "destructive" });
    },
  });

  if (broker.agreementSigned) {
    return (
      <Card className="nh-surface border-card-border/80 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-semibold text-green-800">Referral Agreement Active</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Signed {new Date(broker.agreementSignedAt!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>
          <Button
            data-testid="button-download-agreement"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => window.open("/api/brokers/agreement-pdf", "_blank")}
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="nh-surface border-card-border/80 overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
        <FileText className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <div className="font-semibold text-amber-900">Action Required: Sign Your Referral Agreement</div>
          <div className="text-xs text-amber-700 mt-0.5">Read and e-sign below to unlock client registration</div>
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-xl border bg-white/80 p-6 max-h-[380px] overflow-y-auto text-sm leading-relaxed text-gray-600 space-y-4">
          <p className="font-bold text-gray-900 text-base text-center">REFERRING BROKER COMMISSION AGREEMENT</p>
          <p>This Referring Broker Commission Agreement ("Agreement") is entered into by and between <strong>New Dawn Franchising LLC</strong>, a Texas limited liability company ("Company"), and the undersigned referring broker ("Broker").</p>

          <p className="font-semibold text-gray-900">1. PURPOSE</p>
          <p>This Agreement establishes the terms under which the Broker may refer prospective franchise buyers ("Clients") to the Company and earn a commission on completed franchise sales resulting from such referrals.</p>

          <p className="font-semibold text-gray-900">2. COMMISSION RATE</p>
          <p>The Company agrees to pay the Broker a commission as outlined in the separate Broker Commission Schedule provided upon agreement execution, based on the gross sales price of any franchise package sold to a Client referred by the Broker, subject to the conditions set forth herein.</p>

          <p className="font-semibold text-gray-900">3. REFERRAL REQUIREMENTS</p>
          <p>To qualify for a commission, the Broker must:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Register the Client through the Broker Portal prior to or contemporaneously with the Client's first substantive contact with the Company;</li>
            <li>Provide the Client's first name, last name, email address, and telephone number;</li>
            <li>The Client must not have been previously registered by another broker or already in active discussions with the Company.</li>
          </ul>

          <p className="font-semibold text-gray-900">4. COMMISSION PAYMENT</p>
          <p>Commissions shall be paid within thirty (30) days following the Company's receipt of funds from the Client's designated escrow account. The commission is only payable once New Dawn Franchising LLC has received the funds — not upon the Client's deposit into escrow. If the franchise sale is structured with installment payments, the commission shall be paid proportionally as payments are received by the Company from escrow.</p>

          <p className="font-semibold text-gray-900">5. EXCLUSIONS</p>
          <p>No commission shall be owed if:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>The Client was already known to the Company prior to the Broker's referral;</li>
            <li>The Client does not complete a franchise purchase;</li>
            <li>The franchise sale is rescinded, refunded, or reversed for any reason.</li>
          </ul>

          <p className="font-semibold text-gray-900">6. NON-EXCLUSIVE RELATIONSHIP</p>
          <p>This Agreement does not create an exclusive relationship. The Broker is free to refer clients to other franchise systems, and the Company may engage other referring brokers.</p>

          <p className="font-semibold text-gray-900">7. INDEPENDENT CONTRACTOR</p>
          <p>The Broker is an independent contractor and not an employee, agent, or representative of the Company. The Broker shall not make any representations, warranties, or commitments on behalf of the Company.</p>

          <p className="font-semibold text-gray-900">8. TERM AND TERMINATION</p>
          <p>This Agreement shall remain in effect for a period of one (1) year from the date of execution and shall automatically renew for successive one-year terms unless terminated by either party with thirty (30) days' written notice. Commissions earned on referrals made prior to termination shall survive termination.</p>

          <p className="font-semibold text-gray-900">9. GOVERNING LAW</p>
          <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.</p>

          <p className="font-semibold text-gray-900">10. ELECTRONIC SIGNATURE</p>
          <p>By clicking "I Agree & Sign" below, the Broker acknowledges that they have read, understood, and agree to be bound by the terms of this Agreement. This electronic signature shall have the same legal effect as a handwritten signature.</p>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              data-testid="checkbox-agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">
              I, <strong>{broker.fullName}</strong>, have read and fully agree to the terms of the Referring Broker Commission Agreement with New Dawn Franchising LLC.
            </span>
          </label>
          <Button
            data-testid="button-sign-agreement"
            onClick={() => signMutation.mutate()}
            disabled={!agreed || signMutation.isPending}
            className="w-full"
            size="lg"
          >
            {signMutation.isPending ? "Signing..." : "I Agree & Sign Electronically"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Client Registration ───────────────────────────────────────────────────────

function ClientRegistration({ brokerId }: { brokerId: string }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<BrokerClient[]>({
    queryKey: ["/api/brokers/clients"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/brokers/clients", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brokers/clients"] });
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
      setShowForm(false);
      toast({ title: "Client registered", description: "Your client has been registered and our team has been notified." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="nh-surface border-card-border/80 overflow-hidden">
      <div className="px-6 py-5 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--primary))]/10">
            <Users className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Referred Clients</h3>
            <p className="text-xs text-gray-500">{clients.length} client{clients.length !== 1 ? "s" : ""} registered</p>
          </div>
        </div>
        <Button
          data-testid="button-add-client"
          variant={showForm ? "outline" : "default"}
          size="sm"
          className="gap-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" />Register a Client</>}
        </Button>
      </div>

      <div className="p-6">
        {showForm && (
          <form
            className="mb-6 rounded-xl border bg-blue-50/50 border-blue-100 p-5 space-y-4"
            onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }}
          >
            <p className="text-sm font-medium text-gray-700">New client details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="client-first">First name *</Label>
                <Input data-testid="input-client-first" id="client-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="client-last">Last name *</Label>
                <Input data-testid="input-client-last" id="client-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label htmlFor="client-email">Email address *</Label>
              <Input data-testid="input-client-email" id="client-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="client-phone">Phone number *</Label>
              <Input data-testid="input-client-phone" id="client-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <Button data-testid="button-submit-client" type="submit" className="w-full" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Registering..." : "Submit referral"}
            </Button>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border bg-white/60 p-4">
                <div className="h-4 w-1/3 rounded bg-gray-100" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : clients.length === 0 && !showForm ? (
          <div className="rounded-xl border border-dashed bg-gray-50 p-8 text-center">
            <UserPlus className="mx-auto w-8 h-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No clients referred yet.</p>
            <p className="text-xs text-gray-400 mt-1">Click "Register a Client" above to submit your first referral.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => {
              const stage = client.crmStatus ? (STAGE_LABELS[client.crmStatus] ?? { label: client.crmStatus, color: "bg-slate-100 text-slate-700" }) : null;
              return (
                <div
                  key={client.id}
                  data-testid={`card-client-${client.id}`}
                  className="rounded-xl border bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 shrink-0">
                        {client.firstName[0]}{client.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{client.firstName} {client.lastName}</div>
                        <div className="text-xs text-gray-500 truncate">{client.email} · {client.phone}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {stage ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${stage.color}`}>
                          {stage.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-500">
                          Pending Review
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {new Date(client.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BrokerPortalPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const queryClient = useQueryClient();

  const { data: broker, isLoading } = useQuery<BrokerProfile | null>({
    queryKey: ["/api/brokers/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/brokers/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brokers/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brokers/clients"] });
    },
  });

  const isAuthenticated = !!broker;

  return (
    <div data-testid="page-broker" className="min-h-screen bg-gray-50">

      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">New Dawn Franchising</span>
            <span className="text-gray-300 mx-1">·</span>
            <span className="text-sm text-gray-500">Broker Portal</span>
          </div>
          {isAuthenticated && (
            <Button
              data-testid="button-logout"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-gray-500 hover:text-gray-900"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          )}
        </div>
      </header>

      {/* Hero / welcome banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14">
          {isAuthenticated ? (
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                    <CheckCircle2 className="w-3 h-3 mr-1" />Active Partner
                  </Badge>
                  {broker.agreementSigned && (
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                      Agreement Signed
                    </Badge>
                  )}
                </div>
                <h1 data-testid="broker-title" className="text-2xl md:text-3xl font-bold text-gray-900">
                  Welcome back, {broker.fullName.split(" ")[0]}
                </h1>
                <p data-testid="broker-subtitle" className="mt-1.5 text-gray-500">
                  {broker.company ? `${broker.company} · ` : ""}{broker.email}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3 border">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Questions? <a href={`mailto:${COMPANY.email}`} className="text-[hsl(var(--primary))] hover:underline">{COMPANY.email}</a></span>
              </div>
            </div>
          ) : (
            <div className="max-w-xl">
              <h1 data-testid="broker-title" className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                Referring Broker Portal
              </h1>
              <p data-testid="broker-subtitle" className="mt-3 text-gray-500 text-base leading-relaxed">
                Partner with New Dawn Franchising and earn commission on every franchise sale you refer. Register, sign your agreement, and start submitting clients today.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="max-w-lg mx-auto animate-pulse">
            <Card className="p-8">
              <div className="h-6 w-1/2 rounded bg-gray-100" />
              <div className="mt-4 h-4 w-full rounded bg-gray-100" />
              <div className="mt-2 h-4 w-3/4 rounded bg-gray-100" />
            </Card>
          </div>
        ) : isAuthenticated ? (
          <div className="space-y-6 max-w-3xl">
            <AgreementSection
              broker={broker}
              onSigned={() => queryClient.invalidateQueries({ queryKey: ["/api/brokers/me"] })}
            />
            {broker.agreementSigned ? (
              <ClientRegistration brokerId={broker.id} />
            ) : (
              <Card className="nh-surface border-card-border/80 p-5">
                <div className="flex items-center gap-3 text-gray-500">
                  <Users className="w-5 h-5 shrink-0" />
                  <p className="text-sm">Client registration unlocks after you sign the agreement above.</p>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Auth forms */}
            <div className="max-w-md w-full">
              {mode === "login" ? (
                <LoginForm onSwitch={() => setMode("register")} />
              ) : (
                <RegisterForm onSwitch={() => setMode("login")} />
              )}
            </div>

            {/* How it works sidebar */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">How the broker program works</h2>

              {[
                {
                  icon: UserPlus,
                  step: "1",
                  title: "Register & sign",
                  desc: "Create your free account and e-sign the broker commission agreement.",
                  color: "bg-blue-100 text-blue-700",
                },
                {
                  icon: Users,
                  step: "2",
                  title: "Refer clients",
                  desc: "Submit your client's details through the portal before they contact us.",
                  color: "bg-purple-100 text-purple-700",
                },
                {
                  icon: TrendingUp,
                  step: "3",
                  title: "Earn commission",
                  desc: "Receive your commission within 30 days of the franchise sale closing.",
                  color: "bg-green-100 text-green-700",
                },
              ].map(({ icon: Icon, step, title, desc, color }) => (
                <div key={step} className="flex gap-4 items-start bg-white rounded-xl border border-gray-200 p-4">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full ${color} shrink-0 font-bold text-sm`}>
                    {step}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}

              <div className="bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 rounded-xl p-4 mt-2">
                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Questions about commissions?</div>
                    <div className="text-xs text-gray-500 mt-0.5">Contact us at <a href={`mailto:${COMPANY.email}`} className="text-[hsl(var(--primary))] hover:underline">{COMPANY.email}</a> or call <a href={`tel:${COMPANY.phoneTel}`} className="text-[hsl(var(--primary))] hover:underline">{COMPANY.phone}</a>.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} New Dawn Franchising LLC · {COMPANY.addressFull}</span>
          <span>{COMPANY.phone} · <a href={`mailto:${COMPANY.email}`} className="hover:text-gray-600">{COMPANY.email}</a></span>
        </div>
      </footer>
    </div>
  );
}
