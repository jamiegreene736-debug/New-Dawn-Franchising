import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search, Sparkles, ChevronDown, X, Users, Building2, Loader2, SlidersHorizontal, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block">
        {label}{hint && <span className="ml-1 font-normal normal-case text-muted-foreground/70">· {hint}</span>}
      </label>
      {children}
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
}

export default function SeamlessSearchPanel({
  searchTab, setSearchTab, filters, setFilters, aiQuery, setAiQuery, onSearch, onAiSearch, isSearching,
}: Props) {
  const [showFilters, setShowFilters] = useState(true);
  const active = countActiveFilters(filters);
  const set = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => setFilters({ ...filters, [key]: value });
  const isCompanies = searchTab === "companies";

  return (
    <Card className="p-4 space-y-4">
      {/* Contacts / Companies tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-md border border-input bg-muted p-0.5 gap-0.5">
          {(["contacts", "companies"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSearchTab(t)}
              data-testid={`seamless-tab-${t}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                searchTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "contacts" ? <Users className="size-3.5" /> : <Building2 className="size-3.5" />}
              {t === "contacts" ? "Contacts Search" : "Companies Search"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="size-3 text-primary" />
          Powered by Seamless.AI — search is free, revealing email &amp; phone uses ~1 credit each
        </span>
      </div>

      {/* AI search box */}
      <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" /> AI Search — who can I help you find today?
        </div>
        <div className="relative">
          <textarea
            value={aiQuery}
            data-testid="seamless-ai-query"
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onAiSearch(); }}
            rows={2}
            placeholder={isCompanies
              ? "e.g. Property management companies in Florida with 51-200 employees"
              : "e.g. Finance CEOs in Texas with more than 500 employees"}
            className="w-full resize-none rounded-lg border border-input bg-background p-3 pr-32 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            onClick={onAiSearch}
            disabled={isSearching || !aiQuery.trim()}
            className="absolute bottom-2 right-2 h-8 gap-1.5 text-xs"
            data-testid="seamless-ai-search-btn"
          >
            {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            AI Search
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Type naturally and we'll translate it into filters below. Press ⌘/Ctrl + Enter to run.
        </p>
      </div>

      {/* Filters header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {active > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground size-5 text-[10px] font-bold">{active}</span>
          )}
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showFilters ? "" : "-rotate-90"}`} />
        </button>
        {active > 0 && (
          <button onClick={() => setFilters({ ...EMPTY_FILTERS })} className="text-xs text-muted-foreground underline hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      {/* Filter grid */}
      {showFilters && (
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {!isCompanies && (
            <Section label="Job titles" hint="Enter to add">
              <ChipInput values={filters.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="e.g. CEO, Owner, Managing Director" testId="filter-jobtitle" />
            </Section>
          )}
          {!isCompanies && (
            <Section label="Seniority">
              <ToggleChips options={SENIORITY} values={filters.seniority} onChange={(v) => set("seniority", v)} />
            </Section>
          )}
          {!isCompanies && (
            <Section label="Department">
              <ToggleChips options={DEPARTMENT} values={filters.department} onChange={(v) => set("department", v)} />
            </Section>
          )}
          {!isCompanies && (
            <Section label="Full name" hint="find a specific person">
              <ChipInput values={filters.fullName} onChange={(v) => set("fullName", v)} placeholder="e.g. Chris Pohlot" testId="filter-fullname" />
            </Section>
          )}

          <Section label="Company name">
            <ChipInput values={filters.companyName} onChange={(v) => set("companyName", v)} placeholder="e.g. Seamless.AI" testId="filter-companyname" />
          </Section>
          <Section label="Company domain / URL">
            <ChipInput values={filters.companyDomain} onChange={(v) => set("companyDomain", v)} placeholder="e.g. visafranchise.com" testId="filter-domain" />
          </Section>

          <Section label="Industry" hint="pick from list">
            <TokenSelect options={INDUSTRIES} values={filters.industry} onChange={(v) => set("industry", v)} placeholder="Search industries…" testId="filter-industry" />
          </Section>

          <Section label="Location — State">
            <TokenSelect options={US_STATES} values={filters.contactState} onChange={(v) => set("contactState", v)} placeholder="Search US states…" testId="filter-state" />
          </Section>
          <Section label="Location — Country">
            <TokenSelect options={COUNTRIES} values={filters.contactCountry} onChange={(v) => set("contactCountry", v)} placeholder="Search countries…" testId="filter-country" />
          </Section>

          <Section label="Employee size">
            <ToggleChips options={COMPANY_SIZE} values={filters.companySize} onChange={(v) => set("companySize", v)} />
          </Section>
          <Section label="Revenue">
            <ToggleChips options={COMPANY_REVENUE} values={filters.companyRevenue} onChange={(v) => set("companyRevenue", v)} />
          </Section>
          <Section label="Year founded">
            <ToggleChips options={FOUNDED} values={filters.companyFoundedOn} onChange={(v) => set("companyFoundedOn", v)} />
          </Section>

          <Section label="Company type">
            <div className="inline-flex rounded-md border border-input overflow-hidden text-xs font-medium">
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
          </Section>

          <Section label="Keywords" hint="skills, niche, anything">
            <ChipInput values={filters.keywords} onChange={(v) => set("keywords", v)} placeholder="e.g. property management, E-2 visa" testId="filter-keywords" />
          </Section>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1 border-t">
        <Button onClick={onSearch} disabled={isSearching} className="gap-2" data-testid="seamless-search-btn">
          {isSearching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {isSearching ? "Searching…" : isCompanies ? "Search Companies" : "Search Contacts"}
        </Button>
        {active > 0 && (
          <Button variant="ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })} className="gap-1.5 text-muted-foreground">
            <Plus className="size-4 rotate-45" /> Clear filters
          </Button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {active > 0 ? `${active} filter${active > 1 ? "s" : ""} active` : "No filters — add filters or use AI Search"}
        </span>
      </div>
    </Card>
  );
}
