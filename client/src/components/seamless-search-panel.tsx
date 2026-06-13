import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search, Sparkles, ChevronDown, X, Users, Building2, Loader2, SlidersHorizontal, Plus,
  Folder, Bookmark, Clock, Settings2, Info, ListChecks, LineChart, Send, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Shared filter shape (mirrors server LeadSearchFilters) ──────────────────

export interface LeadFilters {
  jobTitle: string[];
  seniority: string[];
  department: string[];
  industry: string[];
  companySize: string[];
  companyRevenue: string[];
  companyName: string[];
  companyDomain: string[];
  contactState: string[];
  contactCountry: string[];
  keywords: string[];
  fullName: string[];
  companyType: "" | "Public" | "Private";
  companyFoundedOn: string[];
}

export const EMPTY_FILTERS: LeadFilters = {
  jobTitle: [], seniority: [], department: [], industry: [],
  companySize: [], companyRevenue: [], companyName: [], companyDomain: [],
  contactState: [], contactCountry: [], keywords: [], fullName: [],
  companyType: "", companyFoundedOn: [],
};

export function countActiveFilters(f: LeadFilters): number {
  let n = 0;
  for (const [k, v] of Object.entries(f)) {
    if (k === "companyType") { if (v) n++; continue; }
    if (Array.isArray(v) && v.length) n++;
  }
  return n;
}

// ─── Enum option lists (must match the Seamless API exactly) ─────────────────

const SENIORITY = ["C-Level", "VP", "Director", "Manager", "Senior", "Mid-Level", "Entry Level", "Other"];
const DEPARTMENT = ["Sales", "Marketing", "Engineering", "Human Resources", "Finance", "IT", "Operations", "Support", "Legal", "Project Management", "Other"];
const COMPANY_SIZE = ["0 - 1 (Self-employed)", "2 - 10", "11 - 50", "51 - 200", "201 - 500", "501 - 1,000", "1,001 - 5,000", "5,001 - 10,000", "10,001+"];
const COMPANY_REVENUE = ["$0 - $100K", "$100K - $1M", "$1M - $5M", "$5M - $20M", "$20M - $50M", "$50M - $100M", "$100M - $500M", "$500M - $1B", "$1B+"];
const FOUNDED = ["Less than 1 Year", "Last 1-3 Years", "Last 4-10 Years", "10+ Years"];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming", "District of Columbia",
];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Germany", "France", "Brazil", "Mexico",
  "Japan", "South Korea", "China", "India", "Australia", "Israel", "Turkey", "Italy",
  "Spain", "Netherlands", "Sweden", "Switzerland", "United Arab Emirates", "Saudi Arabia",
  "Colombia", "Argentina", "Chile", "Peru", "South Africa", "Nigeria", "Egypt", "Thailand",
  "Vietnam", "Philippines", "Indonesia", "Singapore", "Hong Kong", "Taiwan",
];

const INDUSTRIES = [
  "Aerospace & Defense", "Airlines & Aviation", "Aviation & Aerospace", "Defense & Space", "Military", "Agriculture", "Farming", "Horticulture", "Ranching", "Tobacco", "Apparel & Fashion", "Textiles", "Automotive", "Chemicals & Materials", "Chemicals", "Plastics", "Consumer Goods & Retail", "Consumer Goods", "Luxury Goods & Jewelry", "Retail", "Sporting Goods", "Education & Training", "E-Learning", "Education Management", "Higher Education", "Libraries", "Primary/Secondary Education", "Electronics & Hardware", "Computer Hardware", "Consumer Electronics", "Electrical & Electronic Manufacturing", "Semiconductors", "Energy & Utilities", "Oil & Energy", "Utilities", "Entertainment", "Animation", "Arts & Crafts", "Computer Games", "Fine Art", "Gambling & Casinos", "Mobile Games", "Motion Pictures & Film", "Music", "Performing Arts", "Photography", "Recreational Facilities & Services", "Sports", "Environmental", "Environmental Services", "Renewables & Environment", "Finance & Banking", "Banking", "Capital Markets", "Financial Services", "Investment Banking", "Investment Management", "Venture Capital & Private Equity", "Food & Beverage", "Dairy", "Fishery", "Food & Beverages", "Food Production", "Restaurants", "Supermarkets", "Wine & Spirits", "Government & Public Policy", "Executive Office", "Government Administration", "Government Relations", "Judiciary", "Law Enforcement", "Legislative Office", "Political Organization", "Public Policy", "Public Safety", "Health & Wellness", "Alternative Medicine", "Health, Wellness and Fitness", "Hospital & Health Care", "Medical Practice", "Mental Health Care", "Veterinary", "Hospitality & Tourism", "Events Services", "Hospitality", "Leisure, Travel & Tourism", "Museums & Institutions", "Household, Personal, & Beauty", "Consumer Services", "Cosmetics", "Furniture", "Individual & Family Services", "Insurance", "Internet & E-Commerce", "Internet", "Manufacturing & Engineering", "Civil Engineering", "Industrial Automation", "Machinery", "Mechanical or Industrial Engineering", "Railroad Manufacture", "Shipbuilding", "Marketing & Media", "Broadcast Media", "Graphic Design", "Marketing & Advertising", "Media Production", "Newspapers", "Online Media", "Printing", "Public Relations & Communications", "Publishing", "Writing & Editing", "Metals, Mining & Materials", "Building Materials", "Glass, Ceramics & Concrete", "Mining & Metals", "Paper & Forest Products", "Non-Profit", "Fund-Raising", "Non-Profit Organization Management", "Philanthropy", "Religious Institutions", "Pharmaceuticals & Medical Devices", "Biotechnology", "Medical Devices", "Nanotechnology", "Pharmaceuticals", "Professional Services & Consulting", "Accounting", "Alternative Dispute Resolution", "Civic & Social Organization", "Design", "Human Resources", "International Affairs", "International Trade & Development", "Law Practice", "Legal Services", "Management Consulting", "Market Research", "Outsourcing/Offshoring", "Professional Training & Coaching", "Program Development", "Research", "Security & Investigations", "Staffing & Recruiting", "Think Tanks", "Real Estate & Construction", "Architecture & Planning", "Commercial Real Estate", "Construction", "Facilities Services", "Real Estate", "Software & Information Technology", "Computer & Network Security", "Computer Software", "Information Services", "Information Technology & Services", "Software Development", "Telecommunications & Networking", "Computer Networking", "Telecommunications", "Wireless", "Transportation & Logistics", "Logistics & Supply Chain", "Maritime", "Package/Freight Delivery", "Packaging & Containers", "Translation & Localization", "Transportation/Trucking/Railroad", "Wholesale & Distribution", "Business Supplies & Equipment", "Import & Export", "Warehousing", "Wholesale",
];

// ─── New Dawn sunrise logo mark ──────────────────────────────────────────────

function SunriseMark({ className = "size-5" }: { className?: string }) {
  // Sunrise over the horizon — the New Dawn brand mark, in sunrise gold.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="14" r="4.5" fill="hsl(var(--accent))" />
      <g stroke="hsl(var(--accent))" strokeWidth="1.6" strokeLinecap="round">
        <line x1="12" y1="3.5" x2="12" y2="5.5" />
        <line x1="4.2" y1="6.6" x2="5.7" y2="8.1" />
        <line x1="19.8" y1="6.6" x2="18.3" y2="8.1" />
      </g>
      <line x1="2.5" y1="19" x2="21.5" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ─── Reusable primitives ─────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-medium">
      <span className="max-w-[180px] truncate">{label}</span>
      <button onClick={onRemove} className="hover:text-red-600" title="Remove">
        <X className="size-3" />
      </button>
    </span>
  );
}

/** Free-text chip input — Enter or comma adds a value. */
function ChipInput({
  values, onChange, placeholder, testId,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string; testId?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, "").trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <input
        value={draft}
        data-testid={testId}
        onChange={(e) => {
          const val = e.target.value;
          if (val.endsWith(",")) add(val);
          else setDraft(val);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {values.map((v) => <Chip key={v} label={v} onRemove={() => onChange(values.filter((x) => x !== v))} />)}
        </div>
      )}
    </div>
  );
}

/** Toggle-chips for short fixed enums. */
function ToggleChips({
  options, values, onChange,
}: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((x) => x !== o) : [...values, o]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o);
        return (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              on ? "bg-primary text-primary-foreground border-primary"
                 : "bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/40"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Searchable dropdown multi-select for long fixed lists (industries, states…). */
function TokenSelect({
  options, values, onChange, placeholder, testId,
}: { options: string[]; values: string[]; onChange: (v: string[]) => void; placeholder: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !values.includes(o) && (!q || o.toLowerCase().includes(q))).slice(0, 50);
  }, [options, values, query]);

  const add = (o: string) => { onChange([...values, o]); setQuery(""); };

  return (
    <div className="relative" ref={ref}>
      <input
        value={query}
        data-testid={testId}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md py-1">
          {filtered.map((o) => (
            <button
              key={o}
              onMouseDown={(e) => { e.preventDefault(); add(o); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {values.map((v) => <Chip key={v} label={v} onRemove={() => onChange(values.filter((x) => x !== v))} />)}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

/** Collapsible filter section — mirrors the Seamless left-rail accordion rows. */
function FilterAccordion({
  label, info, count, defaultOpen, children,
}: { label: string; info?: string; count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-border/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          {info && <Info className="size-3 text-muted-foreground/60" aria-label={info} />}
          {count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
              {count}
            </span>
          )}
        </span>
        <Plus className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
      {open && <div className="space-y-3 px-4 pb-4 pt-0.5">{children}</div>}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface Props {
  searchTab: "contacts" | "companies";
  setSearchTab: (t: "contacts" | "companies") => void;
  filters: LeadFilters;
  setFilters: (f: LeadFilters) => void;
  aiQuery: string;
  setAiQuery: (s: string) => void;
  onSearch: () => void;
  onAiSearch: () => void;
  isSearching: boolean;
  /** Whether the Seamless data source is connected (drives the status pill). */
  connected?: boolean;
  /** Optional first name for the hero greeting. */
  userName?: string;
}

export default function SeamlessSearchPanel({
  searchTab, setSearchTab, filters, setFilters, aiQuery, setAiQuery,
  onSearch, onAiSearch, isSearching, connected, userName,
}: Props) {
  const [showFilters, setShowFilters] = useState(true);
  const active = countActiveFilters(filters);
  const set = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => setFilters({ ...filters, [key]: value });
  const isCompanies = searchTab === "companies";
  const greetName = (userName || "").trim() || "there";

  const railIcons = [
    { icon: Search, label: "Search", active: true },
    { icon: Users, label: "Contacts", active: false },
    { icon: Building2, label: "Companies", active: false },
    { icon: ListChecks, label: "Saved lists", active: false },
    { icon: Send, label: "Outreach", active: false },
    { icon: LineChart, label: "Analytics", active: false },
  ];

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* ── Brand bar (navy) ───────────────────────────────────────────────── */}
      <div className="flex h-14 items-center justify-between gap-3 bg-[hsl(var(--primary))] px-4 text-primary-foreground sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <SunriseMark className="size-5 text-white/80" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-bold uppercase tracking-[0.18em]">New Dawn</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-primary-foreground/60">Franchising</span>
          </span>
        </div>
        <span className="hidden items-center gap-1.5 text-[11px] font-medium text-primary-foreground/70 sm:flex">
          <Sparkles className="size-3.5 text-[hsl(var(--accent))]" />
          Lead Research
        </span>
      </div>

      {/* ── Sub bar: tabs + agent pill + status ────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["contacts", "companies"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSearchTab(t)}
              data-testid={`seamless-tab-${t}`}
              className={`inline-flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-sm font-medium transition-colors ${
                searchTab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "contacts" ? <Users className="size-4" /> : <Building2 className="size-4" />}
              {t === "contacts" ? "Contacts Search" : "Companies Search"}
            </button>
          ))}
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-[hsl(var(--accent))]" />
            Search with Agent
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            connected
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
          title={connected ? "Lead data source is connected" : "Add SEAMLESS_API_KEY in Railway to enable search"}
        >
          <span className={`size-1.5 rounded-full ${connected ? "bg-green-500" : "bg-amber-500"}`} />
          {connected ? "Data source connected" : "Connect data source"}
        </span>
      </div>

      {/* ── Body: icon rail + filters + AI hero ────────────────────────────── */}
      <div className="flex flex-col md:flex-row">
        {/* Slim icon rail */}
        <div className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r bg-muted/30 py-3 md:flex">
          {railIcons.map(({ icon: Icon, label, active: on }) => (
            <span
              key={label}
              title={label}
              className={`grid size-9 place-items-center rounded-lg ${
                on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground/70"
              }`}
            >
              <Icon className="size-[18px]" />
            </span>
          ))}
        </div>

        {/* Filters column */}
        {showFilters && (
          <div className="flex w-full flex-col border-b md:max-w-[320px] md:shrink-0 md:border-b-0 md:border-r">
            {/* Filters header */}
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <span className="text-base font-semibold text-foreground">Filters</span>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Folder className="size-4" aria-label="Saved filter sets" />
                <Bookmark className="size-4" aria-label="Bookmarked filters" />
                <Clock className="size-4" aria-label="Recent filters" />
              </div>
            </div>

            {/* Saved-search preset banner */}
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Settings2 className="size-4 text-primary" />
              <span className="truncate text-sm font-medium text-foreground">Franchise Prospects</span>
              {active > 0 ? (
                <button
                  onClick={() => setFilters({ ...EMPTY_FILTERS })}
                  className="ml-auto text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              ) : (
                <ChevronDown className="ml-auto size-4 text-muted-foreground" />
              )}
            </div>

            {/* Accordion sections */}
            <div className="max-h-[460px] flex-1 overflow-y-auto border-t">
              <FilterAccordion
                key={`company-${searchTab}`}
                label="Company"
                info="Filter by company name or website"
                count={filters.companyName.length + filters.companyDomain.length}
                defaultOpen={isCompanies}
              >
                <div>
                  <FieldLabel>Company name</FieldLabel>
                  <ChipInput values={filters.companyName} onChange={(v) => set("companyName", v)} placeholder="e.g. New Dawn Franchising" testId="filter-companyname" />
                </div>
                <div>
                  <FieldLabel>Company domain / URL</FieldLabel>
                  <ChipInput values={filters.companyDomain} onChange={(v) => set("companyDomain", v)} placeholder="e.g. visafranchise.com" testId="filter-domain" />
                </div>
              </FilterAccordion>

              {!isCompanies && (
                <FilterAccordion label="Titles" info="Job titles to target" count={filters.jobTitle.length} defaultOpen={!isCompanies}>
                  <ChipInput values={filters.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="e.g. CEO, Owner, Managing Director" testId="filter-jobtitle" />
                </FilterAccordion>
              )}

              {!isCompanies && (
                <FilterAccordion label="Seniority" count={filters.seniority.length}>
                  <ToggleChips options={SENIORITY} values={filters.seniority} onChange={(v) => set("seniority", v)} />
                </FilterAccordion>
              )}

              {!isCompanies && (
                <FilterAccordion label="Department" count={filters.department.length}>
                  <ToggleChips options={DEPARTMENT} values={filters.department} onChange={(v) => set("department", v)} />
                </FilterAccordion>
              )}

              <FilterAccordion
                label="Location"
                info="State and country"
                count={filters.contactState.length + filters.contactCountry.length}
              >
                <div>
                  <FieldLabel>State</FieldLabel>
                  <TokenSelect options={US_STATES} values={filters.contactState} onChange={(v) => set("contactState", v)} placeholder="Search US states…" testId="filter-state" />
                </div>
                <div>
                  <FieldLabel>Country</FieldLabel>
                  <TokenSelect options={COUNTRIES} values={filters.contactCountry} onChange={(v) => set("contactCountry", v)} placeholder="Search countries…" testId="filter-country" />
                </div>
              </FilterAccordion>

              <FilterAccordion label="Keywords" info="Skills, niche, anything" count={filters.keywords.length}>
                <ChipInput values={filters.keywords} onChange={(v) => set("keywords", v)} placeholder="e.g. property management, E-2 visa" testId="filter-keywords" />
              </FilterAccordion>

              <FilterAccordion label="Industry" info="Pick from list" count={filters.industry.length}>
                <TokenSelect options={INDUSTRIES} values={filters.industry} onChange={(v) => set("industry", v)} placeholder="Search industries…" testId="filter-industry" />
              </FilterAccordion>

              <FilterAccordion label="Employee Size" count={filters.companySize.length}>
                <ToggleChips options={COMPANY_SIZE} values={filters.companySize} onChange={(v) => set("companySize", v)} />
              </FilterAccordion>

              <FilterAccordion label="Revenue" count={filters.companyRevenue.length}>
                <ToggleChips options={COMPANY_REVENUE} values={filters.companyRevenue} onChange={(v) => set("companyRevenue", v)} />
              </FilterAccordion>

              <FilterAccordion label="Year Founded" count={filters.companyFoundedOn.length}>
                <ToggleChips options={FOUNDED} values={filters.companyFoundedOn} onChange={(v) => set("companyFoundedOn", v)} />
              </FilterAccordion>

              <FilterAccordion label="Company Type" count={filters.companyType ? 1 : 0}>
                <div className="inline-flex overflow-hidden rounded-md border border-input text-xs font-medium">
                  {(["", "Public", "Private"] as const).map((t) => (
                    <button
                      key={t || "any"}
                      onClick={() => set("companyType", t)}
                      className={`px-3 py-1.5 transition-colors ${filters.companyType === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                    >
                      {t || "Any"}
                    </button>
                  ))}
                </div>
              </FilterAccordion>

              {!isCompanies && (
                <FilterAccordion label="Full Name" info="Find a specific person" count={filters.fullName.length}>
                  <ChipInput values={filters.fullName} onChange={(v) => set("fullName", v)} placeholder="e.g. Chris Pohlot" testId="filter-fullname" />
                </FilterAccordion>
              )}
            </div>

            {/* Footer: structured search */}
            <div className="space-y-1.5 border-t p-3">
              <Button onClick={onSearch} disabled={isSearching} className="h-10 w-full gap-2" data-testid="seamless-search-btn">
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {isSearching ? "Searching…" : "Search"}
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Search is free · revealing email &amp; phone uses ~1 credit each
              </p>
            </div>
          </div>
        )}

        {/* AI hero */}
        <div className="flex min-h-[520px] flex-1 flex-col px-6 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/70">
              <Sparkles className="size-3.5 text-[hsl(var(--accent-border))]" /> AI Search
            </div>
            <h2 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
              Hi {greetName},
            </h2>
            <h3 className="mb-6 font-serif text-3xl leading-tight text-primary sm:text-4xl">
              Who can I help you find today?
            </h3>

            <div className="relative">
              <textarea
                value={aiQuery}
                data-testid="seamless-ai-query"
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (aiQuery.trim()) onAiSearch(); }
                }}
                rows={4}
                placeholder={isCompanies
                  ? "Property management companies in Florida with 51-200 employees"
                  : "Finance CEOs in Texas with more than 500 employees"}
                className="w-full resize-none rounded-2xl border bg-background p-5 pb-16 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                onClick={onAiSearch}
                disabled={isSearching || !aiQuery.trim()}
                className="absolute bottom-4 right-4 h-10 gap-1.5"
                data-testid="seamless-ai-search-btn"
              >
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {isCompanies ? "Search Companies" : "Search Contacts"}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="size-4" />
                {showFilters ? "Hide Filters" : "Show Filters"}
                {active > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {active}
                  </span>
                )}
              </button>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-4" /> Recent Searches
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Star className="size-4" /> Saved Searches
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Type naturally — we'll translate it into the filters on the left. Press Enter to run.
            </p>

            {/* Structured filter search — kept reachable even when the filter rail is hidden */}
            {!showFilters && (
              <Button onClick={onSearch} disabled={isSearching} className="mt-4 gap-2" data-testid="seamless-search-btn-hero">
                {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {active > 0
                  ? `Search with ${active} filter${active > 1 ? "s" : ""}`
                  : isCompanies ? "Search all companies" : "Search all contacts"}
              </Button>
            )}

            {/* Active filter summary */}
            {active > 0 && (
              <div className="mt-6 rounded-xl border bg-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {active} active filter{active > 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => setFilters({ ...EMPTY_FILTERS })}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...filters.jobTitle.map((v) => ({ k: "jobTitle" as const, v })),
                    ...filters.seniority.map((v) => ({ k: "seniority" as const, v })),
                    ...filters.department.map((v) => ({ k: "department" as const, v })),
                    ...filters.fullName.map((v) => ({ k: "fullName" as const, v })),
                    ...filters.companyName.map((v) => ({ k: "companyName" as const, v })),
                    ...filters.companyDomain.map((v) => ({ k: "companyDomain" as const, v })),
                    ...filters.industry.map((v) => ({ k: "industry" as const, v })),
                    ...filters.contactState.map((v) => ({ k: "contactState" as const, v })),
                    ...filters.contactCountry.map((v) => ({ k: "contactCountry" as const, v })),
                    ...filters.companySize.map((v) => ({ k: "companySize" as const, v })),
                    ...filters.companyRevenue.map((v) => ({ k: "companyRevenue" as const, v })),
                    ...filters.companyFoundedOn.map((v) => ({ k: "companyFoundedOn" as const, v })),
                    ...filters.keywords.map((v) => ({ k: "keywords" as const, v })),
                    ...(filters.companyType ? [{ k: "companyType" as const, v: filters.companyType }] : []),
                  ].map(({ k, v }) => (
                    <Chip
                      key={`${k}:${v}`}
                      label={v}
                      onRemove={() => {
                        if (k === "companyType") set("companyType", "");
                        else set(k, (filters[k] as string[]).filter((x) => x !== v));
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
              Lead data powered by Seamless.AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
