import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteShell } from "@/components/site-shell";

// Public marketing pages — eager (kept in the main bundle for fast first paint).
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AboutPage from "@/pages/about";
import E2FitPage from "@/pages/e2-fit";
import E2VisaFranchisePage from "@/pages/e2-visa-franchise";
import TerritoriesPage from "@/pages/territories";
import ContactPage from "@/pages/contact";
import QuizPage from "@/pages/quiz";
import TeamPage from "@/pages/team";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import ProcessPage from "@/pages/process";
import MarketingPage from "@/pages/marketing";
import RealEstatePage from "@/pages/real-estate";
import TelecomPage from "@/pages/telecom";
import PropertyManagementPage from "@/pages/property-management";
import InsurancePage from "@/pages/insurance";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsPage from "@/pages/terms";

// Heavy / authenticated app pages (CRM, portals, agent, SEO — many pull in
// recharts and large dependencies). Lazy-loaded so public visitors never
// download them, which keeps the homepage bundle small.
const BrokerPortalPage = lazy(() => import("@/pages/broker-portal"));
const LoginPage = lazy(() => import("@/pages/login"));
const CrmPage = lazy(() => import("@/pages/crm"));
const CrmContactsPage = lazy(() => import("@/pages/crm-contacts"));
const CrmContactProfilePage = lazy(() => import("@/pages/crm-contact-profile"));
const CrmPipelinePage = lazy(() => import("@/pages/crm-pipeline"));
const CrmSegmentsPage = lazy(() => import("@/pages/crm-segments"));
const CrmTasksPage = lazy(() => import("@/pages/crm-tasks"));
const CrmTestsPage = lazy(() => import("@/pages/crm-tests"));
const SignDocumentPage = lazy(() => import("@/pages/sign-document"));
const SeoPage = lazy(() => import("@/pages/seo"));
const AgentPage = lazy(() => import("@/pages/agent"));
const ApprovePage = lazy(() => import("@/pages/approve"));
const TrainingPortal = lazy(() => import("@/pages/training-portal"));
const MarketingPortalPage = lazy(() => import("@/pages/marketing-portal-page"));
const VerifyCertificate = lazy(() => import("@/pages/verify-certificate"));
const HeygenSettingsPage = lazy(() => import("@/pages/heygen-settings"));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Switch>
        {/* Standalone pages — no nav/footer */}
        <Route path="/approve/seo/:token" component={ApprovePage} />
        <Route path="/approve/outreach/:token" component={ApprovePage} />
        <Route path="/approve/outreach-plan/:token" component={ApprovePage} />
        <Route path="/approve/forum/:token" component={ApprovePage} />
        <Route path="/approve/linkedin/:token" component={ApprovePage} />
        <Route path="/sign/:token" component={SignDocumentPage} />
        <Route path="/seo" component={SeoPage} />
        <Route path="/agent" component={AgentPage} />
        <Route path="/heygen" component={HeygenSettingsPage} />
        <Route path="/training" component={TrainingPortal} />
        <Route path="/training/:rest*" component={TrainingPortal} />
        <Route path="/marketing-portal" component={MarketingPortalPage} />
        <Route path="/marketing-portal/:rest*" component={MarketingPortalPage} />
        <Route path="/verify/:verificationId" component={VerifyCertificate} />

        {/* All other pages wrapped in SiteShell */}
        <Route>
          <SiteShell>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/about" component={AboutPage} />
              <Route path="/e2-fit" component={E2FitPage} />
              <Route path="/e2-visa-franchise" component={E2VisaFranchisePage} />
              <Route path="/territories" component={TerritoriesPage} />
              <Route path="/quiz" component={QuizPage} />
              <Route path="/team" component={TeamPage} />
              <Route path="/blog" component={BlogPage} />
              <Route path="/blog/:slug" component={BlogPostPage} />
              <Route path="/brokers" component={BrokerPortalPage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/process" component={ProcessPage} />
              <Route path="/marketing" component={MarketingPage} />
              <Route path="/real-estate" component={RealEstatePage} />
              <Route path="/telecom" component={TelecomPage} />
              <Route path="/property-management" component={PropertyManagementPage} />
              <Route path="/insurance" component={InsurancePage} />
              <Route path="/crm/contacts/:id" component={CrmContactProfilePage} />
              <Route path="/crm/contacts" component={CrmContactsPage} />
              <Route path="/crm/pipeline" component={CrmPipelinePage} />
              <Route path="/crm/segments" component={CrmSegmentsPage} />
              <Route path="/crm/tasks" component={CrmTasksPage} />
              <Route path="/crm/tests" component={CrmTestsPage} />
              <Route path="/crm" component={CrmPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/privacy-policy" component={PrivacyPolicyPage} />
              <Route path="/terms" component={TermsPage} />
              <Route component={NotFound} />
            </Switch>
          </SiteShell>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
