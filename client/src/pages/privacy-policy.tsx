export default function PrivacyPolicyPage() {
  const effectiveDate = "April 8, 2026";
  const company = "New Dawn Franchising LLC";
  const address = "2601 N Zaragoza Rd, El Paso, TX 79938";
  const email = "franchising@newdawnfranchising.com";
  const phone = "(346) 597-9994";

  return (
    <div className="nh-container py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Effective date: {effectiveDate}</p>

      <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-foreground/90">

        <section>
          <p>
            {company} ("New Dawn Franchising," "we," "us," or "our") is committed to protecting the
            privacy of visitors to our website at <strong>newdawnfranchising.com</strong> and
            individuals who contact us regarding our franchise opportunity. This Privacy Policy
            explains what information we collect, how we use it, and your rights with respect to
            that information.
          </p>
          <p className="mt-2">
            By using our website or submitting any information to us, you agree to the terms of
            this Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Information We Collect</h2>
          <p className="mb-2">We may collect the following categories of personal information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Contact information</strong> — name, email address, phone number, and country of residence submitted through our contact or inquiry forms.</li>
            <li><strong>Investment information</strong> — estimated capital range and investment timeline provided voluntarily through our inquiry forms or quiz.</li>
            <li><strong>Communications</strong> — messages, questions, and correspondence you send us by email, form, or phone.</li>
            <li><strong>Usage data</strong> — pages visited, time on site, browser type, device type, and referring URL, collected automatically via analytics tools (such as Google Analytics).</li>
            <li><strong>Cookies</strong> — session cookies used to maintain secure login states for authorized portal users. We do not use tracking cookies for advertising purposes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. How We Use Your Information</h2>
          <p className="mb-2">We use the information we collect to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Respond to franchise inquiries and provide you with information about the New Dawn Franchising opportunity.</li>
            <li>Determine whether our franchise model is a potential fit for your E-2 visa investment goals.</li>
            <li>Send follow-up communications, updates, and educational content related to our franchise offering (you may opt out at any time).</li>
            <li>Improve and maintain our website and services.</li>
            <li>Comply with applicable legal obligations.</li>
          </ul>
          <p className="mt-2">
            We do not sell, rent, or share your personal information with unaffiliated third parties
            for their own marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Referring Brokers and Partners</h2>
          <p>
            If you were referred to us by a licensed immigration attorney, business broker, or
            referring partner registered in our Referral Partner Portal, that partner may have
            limited access to the status of your inquiry for referral-tracking purposes only.
            We do not share your full profile or sensitive details with referring partners without
            your consent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to fulfill the purposes
            described in this policy, maintain records required by law, or as otherwise required
            by our operational needs. If you wish to have your information deleted, please contact
            us at the address below and we will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Third-Party Services</h2>
          <p className="mb-2">
            Our website uses the following third-party services that may process data on our behalf:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Google Analytics</strong> — website traffic analysis. See Google's privacy policy at <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">policies.google.com/privacy</a>.</li>
            <li><strong>OpenAI</strong> — used to generate blog content. No personal data submitted through our forms is sent to OpenAI.</li>
            <li><strong>Email delivery providers</strong> — used to send inquiry responses and informational emails.</li>
          </ul>
          <p className="mt-2">
            These providers are contractually required to keep your information confidential and
            may not use it for any purpose other than providing services to us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. International Users</h2>
          <p>
            New Dawn Franchising serves investors from around the world. If you are located
            outside the United States, please be aware that any information you provide will be
            transferred to and processed in the United States. By submitting your information, you
            consent to that transfer.
          </p>
          <p className="mt-2">
            If you are a resident of the European Economic Area (EEA), the United Kingdom, or
            another jurisdiction with specific data protection rights, you may have additional
            rights under applicable law, including the right to access, correct, or delete your
            personal data. Please contact us to exercise these rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Data Security</h2>
          <p>
            We implement commercially reasonable security measures to protect the personal
            information you provide to us against unauthorized access, disclosure, alteration, or
            destruction. However, no method of transmission over the Internet or electronic
            storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Your Rights and Choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Opt out of email communications</strong> — Click "Unsubscribe" in any email we send you, or contact us directly.</li>
            <li><strong>Access or correct your information</strong> — Contact us at the address below to request access to or correction of the personal information we hold about you.</li>
            <li><strong>Request deletion</strong> — You may request that we delete your personal information. We will comply unless we are required to retain it by law or for legitimate business purposes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Children's Privacy</h2>
          <p>
            Our website and services are not directed to children under the age of 18. We do not
            knowingly collect personal information from children. If you believe we have
            inadvertently collected information from a child, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will update the
            effective date at the top of this page. Your continued use of our website after any
            changes constitutes your acceptance of the revised policy. We encourage you to review
            this page periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or how we handle your information,
            please contact us:
          </p>
          <address className="not-italic mt-2 space-y-0.5">
            <p className="font-semibold">{company}</p>
            <p>{address}</p>
            <p>
              <a href={`mailto:${email}`} className="text-primary underline">{email}</a>
            </p>
            <p>
              <a href="tel:+13465979994" className="text-primary underline">{phone}</a>
            </p>
          </address>
        </section>

      </div>
    </div>
  );
}
