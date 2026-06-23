import { useState, useEffect } from "react";
import { formatPhone } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import {
  CheckCircle2,
  ChevronDown,
  Edit2,
  Eye,
  FileText,
  LogOut,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
  Crosshair,
  Facebook,
  Mail,
  BarChart2,
  Clock,
  MapPin,
  TrendingUp,
  Bot,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  Bell,
  Zap,
  BookOpen,
  Tag,
  Phone,
  Sparkles,
  ShieldCheck,
  ListPlus,
  ListChecks,
} from "lucide-react";
import { CrmClientDetail } from "./crm-client-detail";
import ProspectFinder from "./prospect-finder";
import AiSearchInsights from "@/components/ai-search-insights";
import EmailCampaigns from "./email-campaigns";
import FacebookTab from "./facebook-tab";
import PhoneCallsTab from "./phone-calls-tab";
import EmailDeliverabilityTab from "./email-deliverability-tab";
import { CrmPlaybook } from "./crm-playbook";
import { BulkEnrichDialog } from "@/components/bulk-enrich-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New Lead", color: "bg-slate-100 text-slate-700" },
  { value: "broker_outreach", label: "Broker Outreach", color: "bg-blue-100 text-blue-700" },
  { value: "broker_introduced", label: "Broker Introduced", color: "bg-cyan-100 text-cyan-700" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-yellow-100 text-yellow-700" },
  { value: "cold_drip", label: "Cold Drip", color: "bg-gray-100 text-gray-600" },
  { value: "fdd_sent", label: "FDD Sent", color: "bg-purple-100 text-purple-700" },
  { value: "fdd_signed", label: "FDD Receipt Signed", color: "bg-violet-100 text-violet-700" },
  { value: "agreement_sent", label: "Agreement Sent", color: "bg-orange-100 text-orange-700" },
  { value: "agreement_signed", label: "Agreement Signed", color: "bg-amber-100 text-amber-700" },
  { value: "wire_received", label: "Wire Received", color: "bg-lime-100 text-lime-700" },
  { value: "active", label: "Active Franchisee", color: "bg-green-100 text-green-700" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-700" },
  // Legacy statuses (kept for backwards compatibility)
  { value: "contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-700" },
  { value: "fdd_reviewed", label: "FDD Reviewed", color: "bg-indigo-100 text-indigo-700" },
  { value: "receipt_signed", label: "Receipt Signed", color: "bg-teal-100 text-teal-700" },
  { value: "franchise_agreement", label: "Franchise Agreement", color: "bg-orange-100 text-orange-700" },
];

const TEMPERATURE_OPTIONS = [
  { value: "cold",      label: "Cold",      color: "bg-blue-100 text-blue-700",   icon: "🧊" },
  { value: "warm",      label: "Warm",      color: "bg-amber-100 text-amber-700", icon: "☀️" },
  { value: "hot",       label: "Hot",       color: "bg-red-100 text-red-700",     icon: "🔥" },
  { value: "qualified", label: "Qualified", color: "bg-green-100 text-green-700", icon: "✅" },
  { value: "closed",    label: "Closed",    color: "bg-gray-200 text-gray-600",   icon: "🔒" },
];

function TemperatureBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  const opt = TEMPERATURE_OPTIONS.find((t) => t.value === value);
  if (!opt) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${opt.color}`}>
      {opt.icon} {opt.label}
    </span>
  );
}

interface CrmClient {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  status: string;
  fddSent: boolean;
  receiptSigned: boolean;
  brokerId?: string | null;
  notes?: string | null;
  lastContactedAt?: string | null;
  lastContactMethod?: string | null;
  investmentAmount?: string | null;
  citizenship?: string | null;
  visaType?: string | null;
  languagePreference?: string | null;
  linkedinUrl?: string | null;
  leadSource?: string | null;
  companyName?: string | null;
  profession?: string | null;
  leadTemperature?: string | null;
  tags?: string[] | null;
  emailStatus?: string | null;        // valid | risky | invalid | unknown
  emailVerifiedAt?: string | null;
  emailScore?: number | null;
  suggestedEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BrokerOption {
  id: string;
  fullName: string;
  email: string;
  company?: string;
}

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span data-testid={`badge-status-${status}`} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

// Email deliverability flag from the Hunter.io bulk verifier. Rendered on each
// contact so a bad address is impossible to miss (red), with risky/valid states
// and a subtle "unverified" until the contact has been checked.
function EmailStatusBadge({ status, score }: { status?: string | null; score?: number | null }) {
  if (!status) return null;
  const map: Record<string, { cls: string; label: string; Icon: typeof CheckCircle }> = {
    valid:   { cls: "bg-green-100 text-green-700", label: "Email valid", Icon: CheckCircle },
    risky:   { cls: "bg-amber-100 text-amber-700", label: "Email risky", Icon: AlertCircle },
    invalid: { cls: "bg-red-100 text-red-700",     label: "Bad email",   Icon: XCircle },
    unknown: { cls: "bg-gray-100 text-gray-500",   label: "Unverified",  Icon: AlertCircle },
  };
  const m = map[status];
  if (!m) return null;
  const Icon = m.Icon;
  const showScore = typeof score === "number" && status !== "invalid" && status !== "unknown";
  return (
    <span data-testid={`badge-email-${status}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
      <Icon className="size-3" /> {m.label}{showScore ? ` · ${score}` : ""}
    </span>
  );
}

function ClientForm({
  client,
  brokers,
  onSave,
  onCancel,
  onBrokerCreated,
  isPending,
}: {
  client?: CrmClient;
  brokers: BrokerOption[];
  onSave: (data: any) => void;
  onCancel: () => void;
  onBrokerCreated: (broker: BrokerOption) => void;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: client?.fullName || "",
    email: client?.email || "",
    phone: client?.phone || "",
    country: client?.country || "",
    address: client?.address || "",
    status: client?.status || "new",
    fddSent: client?.fddSent || false,
    receiptSigned: client?.receiptSigned || false,
    brokerId: client?.brokerId || "",
    notes: client?.notes || "",
    investmentAmount: client?.investmentAmount || "",
    citizenship: client?.citizenship || "",
    visaType: client?.visaType || "",
    languagePreference: client?.languagePreference || "",
    linkedinUrl: client?.linkedinUrl || "",
    leadSource: client?.leadSource || "",
    companyName: client?.companyName || "",
    profession: client?.profession || "",
    leadTemperature: client?.leadTemperature || "",
  });

  const [showNewBroker, setShowNewBroker] = useState(false);
  const [creatingBroker, setCreatingBroker] = useState(false);
  const [newBroker, setNewBroker] = useState({ fullName: "", email: "", phone: "", company: "" });

  const handleAddBroker = async () => {
    if (!newBroker.fullName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setCreatingBroker(true);
    try {
      const res = await apiRequest("POST", "/api/crm/brokers", {
        fullName: newBroker.fullName.trim(),
        email: newBroker.email.trim() || undefined,
        phone: newBroker.phone.trim() || undefined,
        company: newBroker.company.trim() || undefined,
      });
      const created: BrokerOption = await res.json();
      onBrokerCreated(created);
      setForm((f) => ({ ...f, brokerId: created.id }));
      setNewBroker({ fullName: "", email: "", phone: "", company: "" });
      setShowNewBroker(false);
      toast({ title: "Broker added", description: `${created.fullName} has been added.` });
    } catch (err: any) {
      toast({ title: "Failed to add broker", description: err.message, variant: "destructive" });
    } finally {
      setCreatingBroker(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          phone: form.phone || undefined,
          country: form.country || undefined,
          address: form.address || undefined,
          brokerId: form.brokerId || null,
          notes: form.notes || undefined,
          investmentAmount: form.investmentAmount || undefined,
          citizenship: form.citizenship || undefined,
          visaType: form.visaType || undefined,
          languagePreference: form.languagePreference || undefined,
          linkedinUrl: form.linkedinUrl || undefined,
          leadSource: form.leadSource || undefined,
          companyName: form.companyName || undefined,
          profession: form.profession || undefined,
          leadTemperature: form.leadTemperature || null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="crm-name">Full name *</Label>
          <Input data-testid="input-crm-name" id="crm-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="crm-email">Email *</Label>
          <Input data-testid="input-crm-email" id="crm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="crm-phone">Phone (with country code)</Label>
          <Input data-testid="input-crm-phone" id="crm-phone" type="tel" placeholder="+1 915 555 0100" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-country">Country of Residence</Label>
          <Input data-testid="input-crm-country" id="crm-country" placeholder="e.g. Mexico" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="crm-address">Address</Label>
          <Input data-testid="input-crm-address" id="crm-address" placeholder="Street, City, State, Zip / Postal Code" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-citizenship">Citizenship</Label>
          <Input id="crm-citizenship" placeholder="e.g. Mexican" value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-investment">Investment Amount</Label>
          <Input id="crm-investment" placeholder="e.g. $150,000" value={form.investmentAmount} onChange={(e) => setForm({ ...form, investmentAmount: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-visa">Visa Type</Label>
          <Input id="crm-visa" placeholder="e.g. E-2" value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-language">Language Preference</Label>
          <Input id="crm-language" placeholder="e.g. Spanish" value={form.languagePreference} onChange={(e) => setForm({ ...form, languagePreference: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-company">Company</Label>
          <Input id="crm-company" placeholder="Employer or business name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-profession">Profession</Label>
          <Input id="crm-profession" placeholder="e.g. Real estate investor" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-lead-source">Lead Source</Label>
          <Input id="crm-lead-source" placeholder="e.g. Facebook, Referral" value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="crm-linkedin">LinkedIn URL</Label>
          <Input id="crm-linkedin" placeholder="https://linkedin.com/in/…" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="crm-status">Status</Label>
          <div className="relative">
            <select
              data-testid="select-crm-status"
              id="crm-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
          </div>
        </div>
        <div>
          <Label htmlFor="crm-temperature">Lead Temperature</Label>
          <div className="relative">
            <select
              data-testid="select-crm-temperature"
              id="crm-temperature"
              value={form.leadTemperature}
              onChange={(e) => setForm({ ...form, leadTemperature: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
            >
              <option value="">— Not set —</option>
              {TEMPERATURE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
          </div>
        </div>
        <div>
          <Label htmlFor="crm-broker">Referring broker</Label>
          <div className="relative">
            <select
              data-testid="select-crm-broker"
              id="crm-broker"
              value={showNewBroker ? "__add_new__" : form.brokerId}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  setShowNewBroker(true);
                } else {
                  setShowNewBroker(false);
                  setForm({ ...form, brokerId: e.target.value });
                }
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
            >
              <option value="">Direct client (no broker)</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>{b.fullName}{b.company ? ` — ${b.company}` : ""}</option>
              ))}
              <option value="__add_new__">＋ Add new broker…</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
          </div>

          {showNewBroker && (
            <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">New broker details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Full name *</Label>
                  <input
                    data-testid="input-new-broker-name"
                    type="text"
                    placeholder="Jane Smith"
                    value={newBroker.fullName}
                    onChange={(e) => setNewBroker({ ...newBroker, fullName: e.target.value })}
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <input
                    data-testid="input-new-broker-email"
                    type="email"
                    placeholder="jane@example.com"
                    value={newBroker.email}
                    onChange={(e) => setNewBroker({ ...newBroker, email: e.target.value })}
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <input
                    data-testid="input-new-broker-phone"
                    type="tel"
                    placeholder="+1 555 000 0000"
                    value={newBroker.phone}
                    onChange={(e) => setNewBroker({ ...newBroker, phone: e.target.value })}
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Company / Firm</Label>
                  <input
                    data-testid="input-new-broker-company"
                    type="text"
                    placeholder="Smith Immigration LLC"
                    value={newBroker.company}
                    onChange={(e) => setNewBroker({ ...newBroker, company: e.target.value })}
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  data-testid="button-save-new-broker"
                  type="button"
                  size="sm"
                  onClick={handleAddBroker}
                  disabled={creatingBroker}
                >
                  {creatingBroker ? "Adding…" : "Add broker"}
                </Button>
                <Button
                  data-testid="button-cancel-new-broker"
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowNewBroker(false);
                    setNewBroker({ fullName: "", email: "", phone: "", company: "" });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            data-testid="checkbox-fdd"
            type="checkbox"
            checked={form.fddSent}
            onChange={(e) => setForm({ ...form, fddSent: e.target.checked })}
            className="size-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium">FDD sent</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            data-testid="checkbox-receipt"
            type="checkbox"
            checked={form.receiptSigned}
            onChange={(e) => setForm({ ...form, receiptSigned: e.target.checked })}
            className="size-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium">Receipt page signed</span>
        </label>
      </div>

      <div>
        <Label htmlFor="crm-notes">Notes</Label>
        <textarea
          data-testid="input-crm-notes"
          id="crm-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button data-testid="button-crm-cancel" type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button data-testid="button-crm-save" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : client ? "Update client" : "Add client"}
        </Button>
      </div>
    </form>
  );
}

// ─── Franchisees Tab ─────────────────────────────────────────────────────────
function FranchiseesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", territory: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: franchisees = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/franchisee/admin/franchisees"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/franchisee/admin/franchisees", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to create"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/franchisee/admin/franchisees"] });
      setShowCreate(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", territory: "" });
      toast({ title: "Franchisee created", description: "Login credentials sent to their email." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleAccess = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const res = await fetch(`/api/franchisee/admin/franchisees/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/franchisee/admin/franchisees"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusBadge = (f: any) => {
    if (!f.trainingAccess) return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactive</span>;
    if (f.marketingAccess) return <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">Full Access</span>;
    if (f.checklistComplete) return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Training</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Onboarding</span>;
  };

  return (
    <section className="py-6">
      <div className="nh-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Franchisee Accounts</h2>
            <p className="text-sm text-muted-foreground">{franchisees.length} franchisee{franchisees.length !== 1 ? "s" : ""} registered</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
            <UserPlus className="size-4" /> Add Franchisee
          </Button>
        </div>

        {showCreate && (
          <Card className="p-5 mb-6 border-2 border-dashed border-blue-200 bg-blue-50/30">
            <h3 className="font-semibold text-gray-900 mb-4">Create New Franchisee</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Territory</Label><Input value={form.territory} placeholder="e.g. El Paso, TX" onChange={e => setForm(p => ({ ...p, territory: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Create Account
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : franchisees.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No franchisees yet</p>
            <p className="text-sm mt-1">Add your first franchisee to get started.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {franchisees.map((f: any) => (
              <Card key={f.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                >
                  <div className="size-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {f.firstName?.[0]}{f.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{f.firstName} {f.lastName}</p>
                      {statusBadge(f)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{f.email} {f.territory && `· ${f.territory}`}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <a href="/training" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                      Portal ↗
                    </a>
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expandedId === f.id ? "rotate-180" : ""}`} />
                  </div>
                </div>
                {expandedId === f.id && (
                  <div className="border-t bg-gray-50 p-4 grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Access Control</p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!f.trainingAccess}
                            onChange={e => toggleAccess.mutate({ id: f.id, field: "trainingAccess", value: e.target.checked })}
                            className="size-4 rounded"
                          />
                          <span className="text-sm">Training Academy Access</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!f.marketingAccess}
                            onChange={e => toggleAccess.mutate({ id: f.id, field: "marketingAccess", value: e.target.checked })}
                            className="size-4 rounded"
                          />
                          <span className="text-sm">Marketing Academy Access <span className="text-xs text-muted-foreground">(override gate)</span></span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status</p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <div className="flex justify-between"><span>Checklist</span><span className={f.checklistComplete ? "text-green-600 font-medium" : "text-orange-500"}>{f.checklistComplete ? "Complete" : "Pending"}</span></div>
                        <div className="flex justify-between"><span>Joined</span><span>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "—"}</span></div>
                        {f.territory && <div className="flex justify-between"><span>Territory</span><span className="font-medium">{f.territory}</span></div>}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  new: "New Lead", broker_outreach: "Broker Outreach", broker_introduced: "Broker Introduced",
  meeting_scheduled: "Meeting Scheduled", cold_drip: "Cold Drip", fdd_sent: "FDD Sent",
  fdd_signed: "FDD Receipt Signed", agreement_sent: "Agreement Sent", agreement_signed: "Agreement Signed",
  wire_received: "Wire Received", active: "Active Franchisee", declined: "Declined",
};

function ReportsTab() {
  const [reportsSubTab, setReportsSubTab] = useState<"analytics" | "playbook">("analytics");
  const { data: report, isLoading } = useQuery<any>({ queryKey: ["/api/crm/reports"] });

  return (
    <>
      <div className="border-b bg-background">
        <div className="nh-container">
          <div className="flex gap-1">
            <button
              data-testid="tab-reports-analytics"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${reportsSubTab === "analytics" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReportsSubTab("analytics")}
            >
              <BarChart2 className="size-4" /> Analytics
            </button>
            <button
              data-testid="tab-reports-playbook"
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${reportsSubTab === "playbook" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setReportsSubTab("playbook")}
            >
              <BookOpen className="size-4" /> Playbook
            </button>
          </div>
        </div>
      </div>

      {reportsSubTab === "playbook" && (
        <section className="py-6">
          <div className="nh-container">
            <CrmPlaybook />
          </div>
        </section>
      )}

      {reportsSubTab === "analytics" && <ReportsAnalytics report={report} isLoading={isLoading} />}
    </>
  );
}

function ReportsAnalytics({ report, isLoading }: { report: any; isLoading: boolean }) {
  if (isLoading) return (
    <section className="py-8"><div className="nh-container"><div className="flex items-center justify-center h-32 text-muted-foreground">Loading report…</div></div></section>
  );
  if (!report) return null;

  const statusOrder = ["new","broker_outreach","broker_introduced","meeting_scheduled","cold_drip","fdd_sent","fdd_signed","agreement_sent","agreement_signed","wire_received","active","declined"];
  const maxCount = Math.max(...Object.values(report.byStatus as Record<string,number>).map(Number), 1);

  const contactMethodIcons: Record<string,string> = { email: "✉️", sms: "💬", whatsapp: "📱", voicemail: "📞", none: "—" };

  return (
    <section className="py-6">
      <div className="nh-container space-y-8">
        {/* Key stats */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-5">
            {[
              { label: "Total Leads", value: report.total, color: "text-[hsl(var(--primary))]" },
              { label: "FDD Sent", value: report.fddSent, color: "text-purple-600" },
              { label: "FDD Receipt Signed", value: report.receiptSigned, color: "text-teal-600" },
              { label: "Wire Received", value: report.wireReceived, color: "text-lime-600" },
              { label: "Active / Closed", value: report.active, color: "text-green-600" },
            ].map(s => (
              <Card key={s.label} className="p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* Pipeline funnel */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Pipeline by Stage</h2>
          <Card className="p-6">
            <div className="space-y-3">
              {statusOrder.map(status => {
                const count = (report.byStatus as Record<string,number>)[status] || 0;
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-right text-muted-foreground shrink-0">{STATUS_LABEL[status] || status}</div>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div className="h-full bg-[hsl(var(--primary))] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-8 text-xs font-semibold text-right shrink-0">{count}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* By Country */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Top Countries</h2>
            <Card className="p-5">
              {(report.byCountry as [string,number][]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No country data yet.</p>
              ) : (
                <div className="space-y-2">
                  {(report.byCountry as [string,number][]).map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between text-sm">
                      <span>{country}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* By Lead Source */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Lead Sources</h2>
            <Card className="p-5">
              {(report.byLeadSource as [string,number][]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No lead source data yet.</p>
              ) : (
                <div className="space-y-2">
                  {(report.byLeadSource as [string,number][]).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-sm">
                      <span>{source}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Last Contacted */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Last Contacted</h2>
            <Card className="p-5">
              <div className="space-y-2 text-sm">
                {[
                  ["Today", report.lastContactedBuckets.today, "text-green-600"],
                  ["This week", report.lastContactedBuckets.week, "text-blue-600"],
                  ["This month", report.lastContactedBuckets.month, "text-yellow-600"],
                  ["Over a month ago", report.lastContactedBuckets.older, "text-orange-600"],
                  ["Never contacted", report.lastContactedBuckets.never, "text-red-500"],
                ].map(([label, count, color]) => (
                  <div key={label as string} className="flex items-center justify-between">
                    <span>{label as string}</span>
                    <span className={`font-semibold ${color as string}`}>{count as number}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Contact Methods */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Contact Methods Used</h2>
            <Card className="p-5">
              {Object.keys(report.byContactMethod).length === 0 ? (
                <p className="text-sm text-muted-foreground">No contact data yet.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {Object.entries(report.byContactMethod as Record<string,number>).map(([method, count]) => (
                    <div key={method} className="flex items-center justify-between">
                      <span>{contactMethodIcons[method] || "•"} {method}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Lead Temperature */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Lead Temperature Breakdown</h2>
          <Card className="p-6">
            {Object.keys(report.byTemperature || {}).length === 0 ? (
              <p className="text-sm text-muted-foreground">No temperature data yet — set a temperature on client records.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {TEMPERATURE_OPTIONS.map((t) => {
                  const count = (report.byTemperature as Record<string,number>)[t.value] || 0;
                  return (
                    <div key={t.value} className={`flex flex-col items-center justify-center rounded-xl px-6 py-4 min-w-[100px] ${t.color}`}>
                      <span className="text-2xl">{t.icon}</span>
                      <span className="text-xl font-bold mt-1">{count}</span>
                      <span className="text-xs font-medium mt-0.5">{t.label}</span>
                    </div>
                  );
                })}
                {(report.byTemperature as Record<string,number>)["unset"] > 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl px-6 py-4 min-w-[100px] bg-gray-100 text-gray-500">
                    <span className="text-2xl">—</span>
                    <span className="text-xl font-bold mt-1">{(report.byTemperature as Record<string,number>)["unset"]}</span>
                    <span className="text-xs font-medium mt-0.5">Not set</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}

export default function CrmPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<CrmClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<CrmClient | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [emailFilter, setEmailFilter] = useState<"all" | "bad">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEnrichOpen, setBulkEnrichOpen] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkTagMode, setBulkTagMode] = useState<"merge" | "replace">("merge");
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [inlineTagInput, setInlineTagInput] = useState("");
  const [filterListId, setFilterListId] = useState<string | null>(null);
  const [addToListId, setAddToListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");

  const urlParams = new URLSearchParams(search);
  const urlTab = urlParams.get("tab") as "clients" | "prospects" | "emails" | "facebook" | "reports" | "deliverability" | "api-status" | "franchisees" | "phone-calls" | null;

  const [crmTab, setCrmTab] = useState<"clients" | "prospects" | "ai-insights" | "emails" | "facebook" | "reports" | "deliverability" | "api-status" | "franchisees" | "phone-calls">(
    urlTab || "clients"
  );

  const { data: authData, isLoading: authLoading } = useQuery<{ role: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && (!authData || authData.role !== "admin")) {
      setLocation("/login");
    }
  }, [authData, authLoading, setLocation]);

  const { data: clients = [], isLoading } = useQuery<CrmClient[]>({
    queryKey: ["/api/crm/clients"],
  });

  const { data: brokers = [] } = useQuery<BrokerOption[]>({
    queryKey: ["/api/crm/brokers"],
  });

  const { data: brokerClients = [] } = useQuery<any[]>({
    queryKey: ["/api/crm/broker-clients"],
    staleTime: 0,
  });

  const { data: prospectLists = [] } = useQuery<{ id: string; name: string; count: number }[]>({
    queryKey: ["/api/crm/prospect-lists"],
  });

  const { data: crmTags = [] } = useQuery<string[]>({
    queryKey: ["/api/crm/client-tags"],
  });

  const { data: crmLists = [] } = useQuery<{ id: string; name: string; count: number }[]>({
    queryKey: ["/api/crm/lists"],
  });

  // Seamless.AI auto-sync status — drives the "Sync from Seamless" button + the
  // "last synced …" caption. Polls so the caption stays fresh while the cron runs.
  const { data: seamlessSync } = useQuery<{
    configured: boolean;
    cron: string;
    running: boolean;
    last: { fetched: number; imported: number; skipped: number; lastRunAt: string | null; error: string | null };
  }>({
    queryKey: ["/api/seamless/sync/status"],
    refetchInterval: 60_000,
  });

  // Pull the Seamless org contacts into the CRM tab now (the cron also runs every
  // few minutes). New clients land here; assign them to a list from the CRM tab.
  const syncSeamlessMutation = useMutation({
    mutationFn: async () => {
      // Manual click = a FULL pull of your Seamless contacts (the cron stays
      // incremental). So the button always re-fetches everything, even when the
      // background watermark is already current.
      const res = await apiRequest("POST", "/api/seamless/sync", { full: true });
      return res.json() as Promise<{ fetched: number; imported: number; skipped: number; error: string | null; note?: string }>;
    },
    onSuccess: (data) => {
      if (data.note) {
        toast({ title: data.note });
      } else if (data.error) {
        toast({ title: "Seamless sync finished with an error", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: `Synced ${data.fetched} Seamless contact${data.fetched !== 1 ? "s" : ""}`,
          description: `${data.imported} new in CRM · ${data.skipped} already here`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seamless/sync/status"] });
    },
    onError: (err: Error) => toast({ title: "Seamless sync failed", description: err.message, variant: "destructive" }),
  });

  const { data: apolloSync } = useQuery<{
    configured: boolean;
    cron: string;
    running: boolean;
    last: { fetched: number; imported: number; skipped: number; listAdded: number; lastRunAt: string | null; error: string | null };
  }>({
    queryKey: ["/api/apollo/sync/status"],
    refetchInterval: 60_000,
  });

  const syncApolloMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/apollo/sync", { full: true });
      return res.json() as Promise<{ fetched: number; imported: number; skipped: number; listAdded: number; error: string | null; note?: string }>;
    },
    onSuccess: (data) => {
      if (data.note) {
        toast({ title: data.note });
      } else if (data.error) {
        toast({ title: "Apollo sync finished with an error", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: `Synced ${data.fetched} Apollo contact${data.fetched !== 1 ? "s" : ""}`,
          description: `${data.imported} new in CRM · ${data.listAdded} list membership${data.listAdded !== 1 ? "s" : ""} added`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/apollo/sync/status"] });
    },
    onError: (err: Error) => toast({ title: "Apollo sync failed", description: err.message, variant: "destructive" }),
  });

  // Members of the list currently used as a filter (only fetched when one is active).
  const { data: listMembers = [] } = useQuery<CrmClient[]>({
    queryKey: ["/api/crm/lists", filterListId, "members"],
    queryFn: async () => (await apiRequest("GET", `/api/crm/lists/${filterListId}/members`)).json(),
    enabled: !!filterListId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/crm/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      setShowForm(false);
      toast({ title: "Client added", description: "New client has been added to the CRM." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/crm/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      setEditingClient(null);
      toast({ title: "Client updated", description: "Client information has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crm/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      toast({ title: "Client deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/login");
    },
  });

  const importBrokerClient = useMutation({
    mutationFn: async (bc: any) => {
      const res = await apiRequest("POST", "/api/crm/clients", {
        fullName: `${bc.firstName} ${bc.lastName}`,
        email: bc.email,
        phone: bc.phone,
        brokerId: bc.brokerId,
        status: "new",
        fddSent: false,
        receiptSigned: false,
      });
      const created = await res.json();
      await apiRequest("POST", `/api/crm/broker-clients/${bc.id}/mark-imported`);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/broker-clients"] });
      toast({ title: "Client imported", description: "Broker referral has been added to the CRM." });
    },
  });

  const dismissBrokerClient = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crm/broker-clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/broker-clients"] });
      toast({ title: "Referral dismissed" });
    },
  });

  const bulkTagsMutation = useMutation({
    mutationFn: async ({ ids, tags, mode }: { ids: string[]; tags: string[]; mode: "merge" | "replace" }) => {
      const res = await apiRequest("POST", "/api/crm/clients/bulk-tags", { ids, tags, mode });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/client-tags"] });
      setSelectedIds(new Set());
      setBulkTagInput("");
      toast({ title: `Tags updated on ${vars.ids.length} client${vars.ids.length !== 1 ? "s" : ""}` });
    },
    onError: () => toast({ title: "Failed to update tags", variant: "destructive" }),
  });

  // Verify selected clients' emails via Hunter.io; flags bad addresses and finds
  // replacements server-side (results are persisted, so the UI updates on refetch).
  const bulkVerifyMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Chunk to the server's per-request cap so a large selection isn't silently
      // truncated — verify ALL selected contacts, aggregating the summary.
      const CHUNK = 25;
      const agg = { total: 0, valid: 0, risky: 0, invalid: 0, unknown: 0, suggested: 0 };
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = await apiRequest("POST", "/api/crm/clients/bulk-verify-emails", { ids: ids.slice(i, i + CHUNK) });
        const data = (await res.json()) as { summary: typeof agg };
        (Object.keys(agg) as (keyof typeof agg)[]).forEach((k) => { agg[k] += data.summary?.[k] ?? 0; });
      }
      return { summary: agg };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      setSelectedIds(new Set());
      const s = data.summary;
      toast({
        title: `Verified ${s.total} email${s.total !== 1 ? "s" : ""}`,
        description: `${s.valid} valid · ${s.risky} risky · ${s.invalid} bad${s.suggested ? ` · ${s.suggested} replacement${s.suggested !== 1 ? "s" : ""} found` : ""}`,
      });
    },
    onError: (err: Error) => toast({ title: "Verification failed", description: err.message, variant: "destructive" }),
  });

  // Apply a Hunter-suggested replacement email to a client and reset its flag so
  // it can be re-verified. Reuses the standard client PATCH endpoint.
  const applySuggestedEmailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/clients/${id}`, {
        email,
        emailStatus: "unknown",
        emailScore: null,
        suggestedEmail: null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      toast({ title: "Email updated", description: "Re-verify to confirm the new address." });
    },
    onError: (err: Error) => toast({ title: "Couldn't update email", description: err.message, variant: "destructive" }),
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const res = await apiRequest("PATCH", `/api/crm/clients/${id}`, { tags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/client-tags"] });
      setEditingTagsId(null);
      setInlineTagInput("");
    },
    onError: () => toast({ title: "Failed to update tags", variant: "destructive" }),
  });

  // Add selected clients to a list (existing one, or a new one created on the fly).
  const addToListMutation = useMutation({
    mutationFn: async ({ ids, listId, newName }: { ids: string[]; listId: string | null; newName?: string }) => {
      let targetId = listId;
      if (!targetId) {
        const created = await apiRequest("POST", "/api/crm/lists", { name: newName });
        targetId = (await created.json()).id as string;
      }
      const res = await apiRequest("POST", `/api/crm/lists/${targetId}/members`, { clientIds: ids });
      const data = await res.json();
      return { added: data.added as number, requested: ids.length, listId: targetId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists", data.listId, "members"] });
      // The list is mirrored into a prospect_list so campaigns can select it —
      // refresh the campaign-facing queries (global staleTime is Infinity).
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enroll-candidates"] });
      setSelectedIds(new Set());
      setNewListName("");
      setAddToListId("");
      const skipped = data.requested - data.added;
      toast({
        title: `Added ${data.added} contact${data.added !== 1 ? "s" : ""} to list`,
        description: skipped > 0 ? `${skipped} already in the list` : undefined,
      });
    },
    onError: () => toast({ title: "Failed to add to list", variant: "destructive" }),
  });

  const removeFromListMutation = useMutation({
    mutationFn: async ({ ids, listId }: { ids: string[]; listId: string }) => {
      const res = await apiRequest("POST", `/api/crm/lists/${listId}/members/remove`, { clientIds: ids });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists", vars.listId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enroll-candidates"] });
      setSelectedIds(new Set());
      toast({ title: `Removed ${vars.ids.length} contact${vars.ids.length !== 1 ? "s" : ""} from list` });
    },
    onError: () => toast({ title: "Failed to remove from list", variant: "destructive" }),
  });

  const submitAddToList = () => {
    if (!addToListId || selectedIds.size === 0) return;
    if (addToListId === "__new__" && !newListName.trim()) return;
    addToListMutation.mutate({
      ids: Array.from(selectedIds),
      listId: addToListId === "__new__" ? null : addToListId,
      newName: addToListId === "__new__" ? newListName.trim() : undefined,
    });
  };

  const getBrokerName = (brokerId: string | null | undefined) => {
    if (!brokerId) return null;
    const broker = brokers.find((b) => b.id === brokerId);
    return broker ? broker.fullName : null;
  };

  const listMemberIds = new Set(listMembers.map((c) => c.id));
  const filteredClients = clients.filter((c) => {
    const matchesSearch = !searchTerm ||
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const matchesTag = !filterTag || (c.tags && c.tags.includes(filterTag));
    const matchesList = !filterListId || listMemberIds.has(c.id);
    const matchesEmail = emailFilter === "all" || c.emailStatus === "invalid";
    return matchesSearch && matchesStatus && matchesTag && matchesList && matchesEmail;
  });

  const badEmailCount = clients.filter((c) => c.emailStatus === "invalid").length;

  const unimportedBrokerClients = brokerClients.filter((bc: any) => !bc.importedAt);

  const stats = {
    total: clients.length,
    hotLeads: clients.filter((c) => ["meeting_scheduled", "fdd_sent", "fdd_signed", "agreement_sent", "agreement_signed", "wire_received"].includes(c.status)).length,
    fddSent: clients.filter((c) => c.fddSent).length,
    active: clients.filter((c) => c.status === "active" || c.status === "wire_received").length,
  };

  if (authLoading || !authData || authData.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-testid="page-crm" className="min-h-screen">
      <section className="border-b bg-[hsl(var(--primary))]">
        <div className="nh-container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 data-testid="crm-title" className="text-2xl font-semibold text-white">
                Marketing Academy
              </h1>
              <p className="mt-1 text-sm text-white/70">New Dawn Franchising — Investor Sales & Pipeline</p>
            </div>
            <Button
              data-testid="button-admin-logout"
              variant="outline"
              size="sm"
              className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="nh-container">
          <div className="flex gap-0 overflow-x-auto scrollbar-tab -mb-px pb-0.5">
            <button
              data-testid="tab-crm-clients"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "clients" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("clients")}
            >
              <Users className="size-4" /> CRM
            </button>
            <button
              data-testid="tab-crm-prospects"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "prospects" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("prospects")}
            >
              <Crosshair className="size-4" /> Lead Research
            </button>
            <button
              data-testid="tab-crm-ai-insights"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "ai-insights" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("ai-insights")}
            >
              <Sparkles className="size-4" /> AI Insights
            </button>
            <button
              data-testid="tab-crm-emails"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "emails" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("emails")}
            >
              <Mail className="size-4" /> Campaigns
            </button>
            <button
              data-testid="tab-crm-deliverability"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "deliverability" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("deliverability")}
            >
              <ShieldCheck className="size-4" /> Deliverability
            </button>
            <button
              data-testid="tab-crm-facebook"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "facebook" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("facebook")}
            >
              <TrendingUp className="size-4" /> Paid Marketing
            </button>
            <button
              data-testid="tab-crm-reports"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "reports" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("reports")}
            >
              <BarChart2 className="size-4" /> Reports
            </button>
            <button
              data-testid="tab-crm-api-status"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "api-status" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("api-status")}
            >
              <Activity className="size-4" /> API Status
            </button>
            <button
              data-testid="tab-crm-franchisees"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "franchisees" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("franchisees")}
            >
              <Users className="size-4" /> Franchisees
            </button>
            <button
              data-testid="tab-crm-phone-calls"
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${crmTab === "phone-calls" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCrmTab("phone-calls")}
            >
              <Phone className="size-4" /> Phone Calls
            </button>
            <button
              data-testid="tab-crm-seo"
              className="shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
              onClick={() => setLocation("/seo")}
            >
              <TrendingUp className="size-4" /> SEO
            </button>
            <button
              data-testid="tab-crm-agent"
              className="shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
              onClick={() => setLocation("/agent")}
            >
              <Bot className="size-4" /> AI Agent
            </button>
          </div>
        </div>
      </section>

      <section className="py-6" style={{ display: crmTab === "prospects" ? "block" : "none" }}>
        <div className="nh-container">
          <ProspectFinder />
        </div>
      </section>

      {crmTab === "ai-insights" && (
        <section className="py-6">
          <div className="nh-container">
            <AiSearchInsights />
          </div>
        </section>
      )}

      {crmTab === "emails" && (
        <section className="py-6">
          <div className="nh-container">
            <EmailCampaigns />
          </div>
        </section>
      )}

      {crmTab === "deliverability" && (
        <section className="py-6">
          <div className="nh-container">
            <EmailDeliverabilityTab />
          </div>
        </section>
      )}

      {crmTab === "facebook" && <FacebookTab />}

      {crmTab === "reports" && <ReportsTab />}

      {crmTab === "api-status" && <ApiStatusTab />}

      {crmTab === "franchisees" && <FranchiseesTab />}

      {crmTab === "phone-calls" && (
        <section className="py-6">
          <div className="nh-container">
            <PhoneCallsTab />
          </div>
        </section>
      )}

      {crmTab === "clients" && (<>
      <section className="border-b">
        <div className="nh-container py-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="p-4 text-center">
              <div data-testid="stat-total" className="text-2xl font-bold text-[hsl(var(--primary))]">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Leads</div>
            </Card>
            <Card className="p-4 text-center">
              <div data-testid="stat-hot" className="text-2xl font-bold text-orange-500">{stats.hotLeads}</div>
              <div className="text-xs text-muted-foreground">Hot Leads</div>
            </Card>
            <Card className="p-4 text-center">
              <div data-testid="stat-fdd" className="text-2xl font-bold text-purple-600">{stats.fddSent}</div>
              <div className="text-xs text-muted-foreground">FDD Sent</div>
            </Card>
            <Card className="p-4 text-center">
              <div data-testid="stat-active" className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active / Closed</div>
            </Card>
          </div>
        </div>
      </section>

      {/* Prospect Lists Quick Access */}
      {crmTags.length > 0 && (
        <section className="py-2.5 border-b bg-gray-50">
          <div className="nh-container">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-tab pb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap shrink-0 flex items-center gap-1.5">
                <Tag className="size-3.5" /> Tags
              </span>
              {filterTag && (
                <button
                  onClick={() => setFilterTag(null)}
                  className="flex items-center gap-1 shrink-0 text-xs px-2.5 py-1 rounded-full bg-primary text-white border border-primary"
                >
                  {filterTag} <X className="size-3" />
                </button>
              )}
              {crmTags.filter(t => t !== filterTag).map(tag => {
                const count = clients.filter(c => c.tags && c.tags.includes(tag)).length;
                return (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className="flex items-center gap-1.5 shrink-0 text-xs px-3 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/40 hover:bg-primary/5 text-gray-700 hover:text-primary transition-colors"
                  >
                    <span className="font-medium">{tag}</span>
                    <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-[10px] font-medium">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CRM Lists Quick Access */}
      {crmLists.length > 0 && (
        <section className="py-2.5 border-b bg-gray-50">
          <div className="nh-container">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-tab pb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap shrink-0 flex items-center gap-1.5">
                <ListChecks className="size-3.5" /> Lists
              </span>
              {filterListId && (
                <button
                  onClick={() => setFilterListId(null)}
                  className="flex items-center gap-1 shrink-0 text-xs px-2.5 py-1 rounded-full bg-primary text-white border border-primary"
                >
                  {crmLists.find(l => l.id === filterListId)?.name ?? "List"} <X className="size-3" />
                </button>
              )}
              {crmLists.filter(l => l.id !== filterListId).map(list => (
                <button
                  key={list.id}
                  onClick={() => setFilterListId(list.id)}
                  className="flex items-center gap-1.5 shrink-0 text-xs px-3 py-1 rounded-full bg-white border border-gray-200 hover:border-primary/40 hover:bg-primary/5 text-gray-700 hover:text-primary transition-colors"
                >
                  <span className="font-medium">{list.name}</span>
                  <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 text-[10px] font-medium">{list.count}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-6">
        <div className="nh-container">
          {unimportedBrokerClients.length > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="size-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">
                  {unimportedBrokerClients.length} broker referral{unimportedBrokerClients.length > 1 ? "s" : ""} pending import
                </h3>
              </div>
              <div className="space-y-2">
                {unimportedBrokerClients.map((bc: any) => (
                  <div key={bc.id} className="flex items-center justify-between rounded-lg bg-white p-3 border">
                    <div>
                      <div className="text-sm font-medium">{bc.firstName} {bc.lastName}</div>
                      <div className="text-xs text-muted-foreground">{bc.email} &middot; Referred by {bc.brokerName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        data-testid={`button-import-${bc.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => importBrokerClient.mutate(bc)}
                        disabled={importBrokerClient.isPending}
                      >
                        Import to CRM
                      </Button>
                      <Button
                        data-testid={`button-dismiss-${bc.id}`}
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => dismissBrokerClient.mutate(bc.id)}
                        disabled={dismissBrokerClient.isPending}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  data-testid="input-crm-search"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <select
                  data-testid="select-filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none pr-8"
                >
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-4 text-muted-foreground" />
              </div>
              {(badEmailCount > 0 || emailFilter === "bad") && (
                <button
                  data-testid="button-filter-bad-emails"
                  onClick={() => setEmailFilter(emailFilter === "bad" ? "all" : "bad")}
                  className={`inline-flex items-center gap-1.5 h-9 rounded-md border px-3 text-sm font-medium transition-colors ${emailFilter === "bad" ? "border-red-400 bg-red-100 text-red-700" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`}
                  title="Show only contacts flagged with a bad email"
                >
                  <XCircle className="size-4" /> Bad emails ({badEmailCount})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {seamlessSync?.configured !== false && (
                <div className="flex flex-col items-end">
                  <Button
                    data-testid="button-sync-seamless"
                    variant="outline"
                    className="gap-2"
                    onClick={() => syncSeamlessMutation.mutate()}
                    disabled={syncSeamlessMutation.isPending || seamlessSync?.running}
                    title="Pull your Seamless.AI contacts into the CRM. Then use 'Add to list' to build a campaign audience."
                  >
                    {syncSeamlessMutation.isPending || seamlessSync?.running ? (
                      <><Loader2 className="size-4 animate-spin" /> Syncing…</>
                    ) : (
                      <><RefreshCw className="size-4" /> Sync from Seamless</>
                    )}
                  </Button>
                  {seamlessSync?.last?.lastRunAt && (
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Synced {timeAgo(seamlessSync.last.lastRunAt)}
                      {seamlessSync.last.error ? " · last run errored" : ""}
                    </span>
                  )}
                </div>
              )}
              {apolloSync?.configured !== false && (
                <div className="flex flex-col items-end">
                  <Button
                    data-testid="button-sync-apollo"
                    variant="outline"
                    className="gap-2"
                    onClick={() => syncApolloMutation.mutate()}
                    disabled={syncApolloMutation.isPending || apolloSync?.running}
                    title="Pull your Apollo.io saved contacts into the CRM and mirror Apollo lists into CRM lists for campaigns."
                  >
                    {syncApolloMutation.isPending || apolloSync?.running ? (
                      <><Loader2 className="size-4 animate-spin" /> Syncing…</>
                    ) : (
                      <><RefreshCw className="size-4" /> Sync from Apollo</>
                    )}
                  </Button>
                  {apolloSync?.last?.lastRunAt && (
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Synced {timeAgo(apolloSync.last.lastRunAt)}
                      {apolloSync.last.error ? " · last run errored" : ""}
                    </span>
                  )}
                </div>
              )}
              <Button
                data-testid="button-add-crm-client"
                className="gap-2"
                onClick={() => { setShowForm(true); setEditingClient(null); }}
              >
                <Plus className="size-4" /> Add client
              </Button>
            </div>
          </div>

          {(showForm || editingClient) && (
            <Card className="mb-6 p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingClient ? "Edit Client" : "Add New Client"}
              </h3>
              <ClientForm
                client={editingClient || undefined}
                brokers={brokers}
                onSave={(data) => {
                  if (editingClient) {
                    updateMutation.mutate({ id: editingClient.id, data });
                  } else {
                    createMutation.mutate(data);
                  }
                }}
                onCancel={() => { setShowForm(false); setEditingClient(null); }}
                onBrokerCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/crm/brokers"] })}
                isPending={createMutation.isPending || updateMutation.isPending}
              />
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border bg-white/60 p-5">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                {clients.length === 0
                  ? "No clients yet. Click \"Add client\" to add your first client."
                  : "No clients match your search or filter."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* ── Bulk action bar ───────────────────────────────────────── */}
              {selectedIds.size > 0 && (
                <div className="sticky top-0 z-10 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-blue-800">{selectedIds.size} selected</span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    Deselect all
                  </button>
                  <Button
                    size="sm"
                    data-testid="button-bulk-enrich"
                    className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    onClick={() => setBulkEnrichOpen(true)}
                    title="Find email, phone & LinkedIn for the selected clients"
                  >
                    <Sparkles className="size-3.5" /> Enrich
                  </Button>
                  <Button
                    size="sm"
                    data-testid="button-bulk-verify-emails"
                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    disabled={bulkVerifyMutation.isPending}
                    onClick={() => bulkVerifyMutation.mutate(Array.from(selectedIds))}
                    title="Verify the selected emails with Hunter.io and flag bad ones"
                  >
                    {bulkVerifyMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                    Verify emails
                  </Button>
                  {/* Add selected to a list (existing or new) */}
                  <div className="flex items-center gap-1.5">
                    <select
                      data-testid="select-add-to-list"
                      value={addToListId}
                      onChange={(e) => setAddToListId(e.target.value)}
                      className="h-8 rounded border border-blue-300 bg-white px-2 text-xs text-blue-900 focus:outline-none"
                    >
                      <option value="">Add to list…</option>
                      {crmLists.map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({l.count})</option>
                      ))}
                      <option value="__new__">＋ New list…</option>
                    </select>
                    {addToListId === "__new__" && (
                      <input
                        data-testid="input-new-list-name"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitAddToList(); }}
                        placeholder="New list name"
                        className="h-8 rounded border border-blue-300 bg-white px-2 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                    <Button
                      size="sm"
                      data-testid="button-add-to-list"
                      className="h-8 gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                      disabled={addToListMutation.isPending || !addToListId || (addToListId === "__new__" && !newListName.trim())}
                      onClick={submitAddToList}
                    >
                      <ListPlus className="size-3.5" /> Add
                    </Button>
                    {filterListId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                        disabled={removeFromListMutation.isPending}
                        onClick={() => removeFromListMutation.mutate({ ids: Array.from(selectedIds), listId: filterListId })}
                        title={`Remove selected from "${crmLists.find(l => l.id === filterListId)?.name ?? "list"}"`}
                      >
                        Remove from list
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <select
                      value={bulkTagMode}
                      onChange={(e) => setBulkTagMode(e.target.value as "merge" | "replace")}
                      className="h-8 rounded border border-blue-300 bg-white px-2 text-xs text-blue-900 focus:outline-none"
                    >
                      <option value="merge">Add tags</option>
                      <option value="replace">Replace tags</option>
                    </select>
                    <input
                      data-testid="input-bulk-tag"
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && bulkTagInput.trim()) {
                          bulkTagsMutation.mutate({
                            ids: Array.from(selectedIds),
                            tags: bulkTagInput.split(",").map(t => t.trim()).filter(Boolean),
                            mode: bulkTagMode,
                          });
                        }
                      }}
                      placeholder="tag1, tag2…"
                      className="h-8 rounded border border-blue-300 bg-white px-3 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      disabled={!bulkTagInput.trim() || bulkTagsMutation.isPending}
                      onClick={() => bulkTagsMutation.mutate({
                        ids: Array.from(selectedIds),
                        tags: bulkTagInput.split(",").map(t => t.trim()).filter(Boolean),
                        mode: bulkTagMode,
                      })}
                    >
                      Apply
                    </Button>
                    {/* Quick: remove all tags from selection */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                      disabled={bulkTagsMutation.isPending}
                      onClick={() => { if (confirm(`Remove ALL tags from ${selectedIds.size} client(s)?`)) bulkTagsMutation.mutate({ ids: Array.from(selectedIds), tags: [], mode: "replace" }); }}
                    >
                      Clear tags
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Select-all row ────────────────────────────────────────── */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  data-testid="checkbox-select-all"
                  checked={filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(filteredClients.map(c => c.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="size-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} of ${filteredClients.length} selected`
                    : `${filteredClients.length} client${filteredClients.length !== 1 ? "s" : ""}`}
                </span>
              </div>

              {filteredClients.map((client) => (
                <Card key={client.id} data-testid={`crm-client-${client.id}`} className={`p-4 transition-colors ${selectedIds.has(client.id) ? "border-blue-400 bg-blue-50/40" : ""}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Checkbox */}
                    <div className="shrink-0 pt-0.5">
                      <input
                        type="checkbox"
                        data-testid={`checkbox-client-${client.id}`}
                        checked={selectedIds.has(client.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(client.id); else next.delete(client.id);
                          setSelectedIds(next);
                        }}
                        className="size-4 rounded border-gray-300 accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Row 1: name + status + temperature + doc badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{client.fullName}</span>
                        <StatusBadge status={client.status} />
                        {client.leadTemperature
                          ? <TemperatureBadge value={client.leadTemperature} />
                          : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-400">No warmness</span>
                        }
                        {client.fddSent && (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                            <FileText className="size-3" /> FDD
                          </span>
                        )}
                        {client.receiptSigned && (
                          <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                            <CheckCircle2 className="size-3" /> Receipt
                          </span>
                        )}
                        <EmailStatusBadge status={client.emailStatus} score={client.emailScore} />
                      </div>

                      {/* Row 2: contact info */}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {client.email}
                        {client.phone && ` · ${formatPhone(client.phone)}`}
                        {client.country && ` · ${client.country}`}
                      </div>

                      {/* Suggested replacement email when the current one is bad */}
                      {client.emailStatus === "invalid" && client.suggestedEmail && (
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Suggested: <span className="font-medium text-foreground">{client.suggestedEmail}</span>
                          </span>
                          <button
                            data-testid={`button-apply-email-${client.id}`}
                            disabled={applySuggestedEmailMutation.isPending && applySuggestedEmailMutation.variables?.id === client.id}
                            onClick={() => applySuggestedEmailMutation.mutate({ id: client.id, email: client.suggestedEmail! })}
                            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      )}

                      {/* Row 3: referral party + date */}
                      <div className="mt-1 text-xs flex items-center gap-1">
                        {getBrokerName(client.brokerId)
                          ? <span className="text-[hsl(var(--primary))] font-medium">🤝 Referred by {getBrokerName(client.brokerId)}</span>
                          : <span className="text-muted-foreground">Direct client</span>}
                        <span className="text-muted-foreground">· Added {new Date(client.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>

                      {client.address && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          {client.address}
                        </div>
                      )}
                      {client.lastContactedAt && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3 shrink-0" />
                          Last contacted {new Date(client.lastContactedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {client.lastContactMethod && ` via ${client.lastContactMethod}`}
                        </div>
                      )}
                      {client.notes && (
                        <div className="mt-1 text-xs text-muted-foreground italic line-clamp-1">
                          {client.notes}
                        </div>
                      )}

                      {/* Row: Tags */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {(client.tags || []).map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 font-medium group cursor-pointer"
                            onClick={() => setFilterTag(tag)}
                            title="Click to filter by this tag"
                          >
                            🏷 {tag}
                            <button
                              className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newTags = (client.tags || []).filter(t => t !== tag);
                                updateTagsMutation.mutate({ id: client.id, tags: newTags });
                              }}
                              title="Remove tag"
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {editingTagsId === client.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              autoFocus
                              value={inlineTagInput}
                              onChange={(e) => setInlineTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && inlineTagInput.trim()) {
                                  const newTags = [...new Set([...(client.tags || []), ...inlineTagInput.split(",").map(t => t.trim()).filter(Boolean)])];
                                  updateTagsMutation.mutate({ id: client.id, tags: newTags });
                                }
                                if (e.key === "Escape") { setEditingTagsId(null); setInlineTagInput(""); }
                              }}
                              placeholder="tag1, tag2…"
                              className="h-6 rounded border border-indigo-300 bg-white px-2 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <button
                              className="text-xs text-indigo-600 underline hover:text-indigo-800"
                              onClick={() => {
                                if (inlineTagInput.trim()) {
                                  const newTags = [...new Set([...(client.tags || []), ...inlineTagInput.split(",").map(t => t.trim()).filter(Boolean)])];
                                  updateTagsMutation.mutate({ id: client.id, tags: newTags });
                                } else { setEditingTagsId(null); }
                              }}
                            >Save</button>
                            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setEditingTagsId(null); setInlineTagInput(""); }}>✕</button>
                          </span>
                        ) : (
                          <button
                            data-testid={`button-add-tag-${client.id}`}
                            onClick={() => { setEditingTagsId(client.id); setInlineTagInput(""); }}
                            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-indigo-300 text-indigo-400 hover:border-indigo-500 hover:text-indigo-600 text-xs px-2 py-0.5 transition-colors"
                            title="Add tag"
                          >
                            + tag
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button
                        data-testid={`button-view-${client.id}`}
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => { setSelectedClient(client); setShowForm(false); setEditingClient(null); }}
                      >
                        <Eye className="size-3" /> View
                      </Button>
                      <Button
                        data-testid={`button-edit-${client.id}`}
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => { setEditingClient(client); setShowForm(false); setSelectedClient(null); }}
                      >
                        <Edit2 className="size-3" /> Edit
                      </Button>
                      <Button
                        data-testid={`button-delete-${client.id}`}
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeleteClientId(client.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
      </>)}

      {selectedClient && (
        <CrmClientDetail
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] })}
        />
      )}

      <AlertDialog open={!!deleteClientId} onOpenChange={(open) => { if (!open) setDeleteClientId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the client and all associated records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteClientId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteClientId) {
                  deleteMutation.mutate(deleteClientId);
                  setDeleteClientId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkEnrichDialog
        open={bulkEnrichOpen}
        onOpenChange={setBulkEnrichOpen}
        ids={Array.from(selectedIds)}
        endpoint="/api/crm/clients/bulk-enrich"
        entityNoun="client"
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}

// ─── API Status Tab ────────────────────────────────────────────────────────────

interface ApiHealthResult {
  key: string;
  name: string;
  status: "ok" | "error" | "unconfigured";
  message: string;
  latencyMs?: number;
  checkedAt: string;
  category: "ai" | "email" | "comms" | "data" | "analytics" | "platform";
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: "🤖 Artificial Intelligence",
  email: "📧 Email",
  comms: "💬 Communications",
  data: "📊 Data & Enrichment",
  analytics: "📈 Analytics",
  platform: "⚙️ Platform",
};

const CATEGORY_ORDER = ["ai", "email", "comms", "data", "analytics", "platform"];

function ApiStatusTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const { data: results = [], isLoading, dataUpdatedAt } = useQuery<ApiHealthResult[]>({
    queryKey: ["/api/admin/api-health"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/api-health");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  async function runCheckNow() {
    setRunning(true);
    try {
      const res = await apiRequest("POST", "/api/admin/api-health/run-now");
      const fresh = await res.json();
      queryClient.setQueryData(["/api/admin/api-health"], fresh);
      const errors = fresh.filter((r: ApiHealthResult) => r.status === "error");
      if (errors.length === 0) {
        toast({ title: "All systems operational", description: `${fresh.length} APIs checked — all healthy.` });
      } else {
        toast({
          title: `${errors.length} API${errors.length > 1 ? "s" : ""} reporting errors`,
          description: `Check results below. Alert email sent to jamie.greene736@gmail.com.`,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Check failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = results.filter(r => r.category === cat);
    return acc;
  }, {} as Record<string, ApiHealthResult[]>);

  const errorCount = results.filter(r => r.status === "error").length;
  const okCount = results.filter(r => r.status === "ok").length;
  const unconfiguredCount = results.filter(r => r.status === "unconfigured").length;
  const lastChecked = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : null;

  return (
    <section className="py-6">
      <div className="nh-container max-w-4xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" /> API Status Monitor
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Live health check for all connected services · Checks run automatically every hour
              · Alerts sent to <span className="font-medium">jamie.greene736@gmail.com</span>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastChecked && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last checked {lastChecked}
              </span>
            )}
            <button
              onClick={runCheckNow}
              disabled={running || isLoading}
              className="flex items-center gap-2 bg-[hsl(var(--primary))] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {running ? "Checking…" : "Run check now"}
            </button>
          </div>
        </div>

        {/* Alert banner if errors */}
        {!isLoading && errorCount > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">
                {errorCount} service{errorCount > 1 ? "s are" : " is"} currently offline or erroring
              </p>
              <p className="text-sm text-red-600 mt-0.5">
                An alert email has been sent to jamie.greene736@gmail.com. You will also be notified when the service recovers.
              </p>
            </div>
          </div>
        )}

        {/* All OK banner */}
        {!isLoading && errorCount === 0 && okCount > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-800">
              All {okCount} active API{okCount > 1 ? "s" : ""} are operational
              {unconfiguredCount > 0 && ` · ${unconfiguredCount} optional service${unconfiguredCount > 1 ? "s" : ""} not configured`}
            </p>
          </div>
        )}

        {/* Summary row */}
        {!isLoading && results.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{okCount}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><Wifi className="w-3 h-3" /> Operational</div>
            </div>
            <div className={`bg-white border rounded-xl p-4 text-center ${errorCount > 0 ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
              <div className={`text-2xl font-bold ${errorCount > 0 ? "text-red-600" : "text-gray-300"}`}>{errorCount}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><WifiOff className="w-3 h-3" /> Errors</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-400">{unconfiguredCount}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> Not configured</div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {(isLoading || running) && results.length === 0 && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* API cards by category */}
        {!isLoading && CATEGORY_ORDER.map(cat => {
          const items = grouped[cat];
          if (!items?.length) return null;
          return (
            <div key={cat} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-2">
                {items.map(api => (
                  <ApiStatusCard key={api.key} api={api} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Info footer */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <strong>Automatic monitoring:</strong> Health checks run every hour. You'll receive an email at{" "}
            <span className="font-medium">jamie.greene736@gmail.com</span> the moment any API goes down, and another email when it recovers.
            No alerts are sent for services that are simply not configured (white status).
          </div>
        </div>
      </div>
    </section>
  );
}

function ApiStatusCard({ api }: { api: ApiHealthResult }) {
  const isOk = api.status === "ok";
  const isError = api.status === "error";
  const isUnconfigured = api.status === "unconfigured";

  return (
    <div className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-all ${
      isError ? "border-red-300 bg-red-50 shadow-sm" :
      isOk ? "border-gray-200" :
      "border-gray-100 opacity-60"
    }`}>
      {/* Status icon */}
      <div className="shrink-0">
        {isOk && <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-600" /></div>}
        {isError && <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"><XCircle className="w-4 h-4 text-red-600" /></div>}
        {isUnconfigured && <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><AlertCircle className="w-4 h-4 text-gray-400" /></div>}
      </div>

      {/* Name + message */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{api.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isOk ? "bg-green-100 text-green-700" :
            isError ? "bg-red-100 text-red-700" :
            "bg-gray-100 text-gray-500"
          }`}>
            {isOk ? "Operational" : isError ? "Error" : "Not configured"}
          </span>
        </div>
        <p className={`text-xs mt-0.5 truncate ${isError ? "text-red-600" : "text-gray-500"}`}>
          {api.message}
        </p>
      </div>

      {/* Latency */}
      {api.latencyMs !== undefined && isOk && (
        <div className="shrink-0 text-right">
          <div className={`text-xs font-medium ${api.latencyMs < 500 ? "text-green-600" : api.latencyMs < 2000 ? "text-yellow-600" : "text-red-600"}`}>
            {api.latencyMs}ms
          </div>
          <div className="text-xs text-gray-400">latency</div>
        </div>
      )}

      {/* Checked at */}
      {api.checkedAt && (
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-400">
            {new Date(api.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
      )}
    </div>
  );
}
