import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AboutPage from "@/pages/about";
import E2FitPage from "@/pages/e2-fit";
import TerritoriesPage from "@/pages/territories";
import ContactPage from "@/pages/contact";
import QuizPage from "@/pages/quiz";
import TeamPage from "@/pages/team";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import BrokerPortalPage from "@/pages/broker-portal";
import LoginPage from "@/pages/login";
import CrmPage from "@/pages/crm";
import ProcessPage from "@/pages/process";
import MarketingPage from "@/pages/marketing";
import RealEstatePage from "@/pages/real-estate";
import CrmContactsPage from "@/pages/crm-contacts";
import CrmContactProfilePage from "@/pages/crm-contact-profile";
import CrmPipelinePage from "@/pages/crm-pipeline";
import CrmSegmentsPage from "@/pages/crm-segments";
import CrmTasksPage from "@/pages/crm-tasks";
import CrmTestsPage from "@/pages/crm-tests";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsPage from "@/pages/terms";
import SignDocumentPage from "@/pages/sign-document";
import SeoPage from "@/pages/seo";
import AgentPage from "@/pages/agent";
import ApprovePage from "@/pages/approve";
import TrainingPortal from "@/pages/training-portal";
import MarketingPortalPage from "@/pages/marketing-portal-page";
import VerifyCertificate from "@/pages/verify-certificate";
import HeygenSettingsPage from "@/pages/heygen-settings";
import { SiteShell } from "@/components/site-shell";

function Router() {
  return (
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
